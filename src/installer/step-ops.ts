import { getDb } from "../db.js";
import type { LoopConfig, StepOutputSchema, Story } from "./types.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync, execFileSync } from "node:child_process";
import type { DatabaseSync } from "node:sqlite";
import JSON5 from "json5";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import { resolveOpenClawConfigPath } from "./paths.js";
import { emitEvent } from "./events.js";
import { logger } from "../lib/logger.js";
import { getMaxRoleTimeoutSeconds } from "./install.js";
import { isFrontendChange } from "../lib/frontend-detect.js";
import { getPlanningArtifacts, parsePlanningArtifactsFromOutput, updatePlanningArtifactsFromOutput } from "./planning-artifacts.js";
import { validateAndNormalizeStepOutput } from "./output-validation.js";
import { runWorkflow } from "./run.js";
import {
  buildFeatureDevTaskFromGapAnalysis,
  buildSequentialChildContext,
  isSequentialPending,
  ORCHESTRATION_CHILD_RUN_ID_KEY,
  ORCHESTRATION_ERROR_KEY,
  ORCHESTRATION_LAUNCHED_AT_KEY,
  ORCHESTRATION_NEXT_WORKFLOW_KEY,
  ORCHESTRATION_STATE_FAILED,
  ORCHESTRATION_STATE_KEY,
  ORCHESTRATION_STATE_LAUNCHED,
  ORCHESTRATION_STATE_LAUNCHING,
  parseRunContext,
} from "./sequential-orchestration.js";

/**
 * Parse KEY: value lines from step output with support for multi-line values.
 * Accumulates continuation lines until the next KEY: boundary or end of output.
 * Returns a map of lowercase keys to their (trimmed) values.
 * Skips STORIES_JSON keys (handled separately).
 */
export function parseOutputKeyValues(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = output.split("\n");
  let pendingKey: string | null = null;
  let pendingValue = "";

  function commitPending() {
    if (pendingKey && !pendingKey.startsWith("STORIES_JSON")) {
      result[pendingKey.toLowerCase()] = pendingValue.trim();
    }
    pendingKey = null;
    pendingValue = "";
  }

  for (const line of lines) {
    const match = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (match) {
      // New KEY: line found — flush previous key
      commitPending();
      pendingKey = match[1];
      pendingValue = match[2];
    } else if (pendingKey) {
      // Continuation line — append to current key's value
      pendingValue += "\n" + line;
    }
  }
  // Flush any remaining pending value
  commitPending();

  return result;
}

/**
 * Fire-and-forget cron teardown when a run ends.
 * Looks up the workflow_id for the run and tears down crons if no other active runs.
 */
function scheduleRunCronTeardown(runId: string): void {
  try {
    const db = getDb();
    const run = db.prepare("SELECT workflow_id FROM runs WHERE id = ?").get(runId) as { workflow_id: string } | undefined;
    if (run) {
      teardownWorkflowCronsIfIdle(run.workflow_id).catch(() => {});
    }
  } catch {
    // best-effort
  }
}

function getWorkflowId(runId: string): string | undefined {
  try {
    const db = getDb();
    const row = db.prepare("SELECT workflow_id FROM runs WHERE id = ?").get(runId) as { workflow_id: string } | undefined;
    return row?.workflow_id;
  } catch { return undefined; }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Resolve {{key}} placeholders in a template against a context object.
 */
export function resolveTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
    if (key in context) return context[key];
    const lower = key.toLowerCase();
    if (lower in context) return context[lower];
    return `[missing: ${key}]`;
  });
}

const STRICT_TEMPLATE_VALIDATION_WORKFLOWS = new Set([
  "product-planning",
  "idea-to-project",
  "project-gap-analysis",
]);

function isStrictTemplateValidationEnabled(workflowId?: string): boolean {
  const raw = process.env.SHIPPULSE_STRICT_TEMPLATE_VALIDATION?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return Boolean(workflowId && STRICT_TEMPLATE_VALIDATION_WORKFLOWS.has(workflowId));
}

function getContextValue(context: Record<string, string>, key: string): string | undefined {
  if (key in context) return context[key];
  const lower = key.toLowerCase();
  if (lower in context) return context[lower];
  return undefined;
}

function extractTemplateKeys(template: string): string[] {
  const keys = new Set<string>();
  for (const match of template.matchAll(/\{\{(\w+(?:\.\w+)*)\}\}/g)) {
    const key = String(match[1] ?? "").trim();
    if (key) keys.add(key);
  }
  return Array.from(keys);
}

type ResolvedInputIntegrity = {
  ok: boolean;
  issues: string[];
  missingKeys: string[];
  unresolvedTokens: string[];
  emptyKeys: string[];
};

function validateResolvedInput(
  template: string,
  resolvedInput: string,
  context: Record<string, string>,
  opts: { strictEmptyChecks: boolean },
): ResolvedInputIntegrity {
  const issues: string[] = [];
  const missingKeys = new Set<string>();
  const unresolvedTokens = new Set<string>();
  const emptyKeys = new Set<string>();

  for (const key of extractTemplateKeys(template)) {
    const value = getContextValue(context, key);
    if (value === undefined) {
      missingKeys.add(key);
      continue;
    }
    if (opts.strictEmptyChecks && String(value).trim() === "") {
      emptyKeys.add(key);
    }
  }

  for (const match of resolvedInput.matchAll(/\[missing:\s*([^\]]+)\]/gi)) {
    const token = String(match[1] ?? "").trim();
    if (token) unresolvedTokens.add(token);
  }
  for (const match of resolvedInput.matchAll(/\{\{([^}]+)\}\}/g)) {
    const token = String(match[1] ?? "").trim();
    if (token) unresolvedTokens.add(token);
  }

  if (missingKeys.size > 0) {
    issues.push(`missing context keys: ${Array.from(missingKeys).join(", ")}`);
  }
  if (unresolvedTokens.size > 0) {
    issues.push(`unresolved tokens: ${Array.from(unresolvedTokens).join(", ")}`);
  }
  if (emptyKeys.size > 0) {
    issues.push(`empty required values: ${Array.from(emptyKeys).join(", ")}`);
  }

  return {
    ok: issues.length === 0,
    issues,
    missingKeys: Array.from(missingKeys),
    unresolvedTokens: Array.from(unresolvedTokens),
    emptyKeys: Array.from(emptyKeys),
  };
}

type StepOrderRow = {
  id: string;
  step_id: string;
  step_index: number;
  status: string;
  type: string;
  loop_config: string | null;
};

function allowsVerifyEachClaim(previousStep: StepOrderRow, currentStepId: string): boolean {
  if (previousStep.type !== "loop" || previousStep.status !== "running" || !previousStep.loop_config) {
    return false;
  }
  try {
    const loopConfig = JSON.parse(previousStep.loop_config) as LoopConfig;
    return Boolean(loopConfig.verifyEach && loopConfig.verifyStep === currentStepId);
  } catch {
    return false;
  }
}

function checkMonotonicClaimGuard(db: DatabaseSync, runId: string, stepId: string): { ok: boolean; reason?: string } {
  const rows = db.prepare(
    "SELECT id, step_id, step_index, status, type, loop_config FROM steps WHERE run_id = ? ORDER BY step_index ASC",
  ).all(runId) as StepOrderRow[];
  const target = rows.find((r) => r.id === stepId);
  if (!target) return { ok: true };

  for (const row of rows) {
    if (row.step_index >= target.step_index) break;
    if (row.status === "done") continue;
    if (allowsVerifyEachClaim(row, target.step_id)) continue;
    return {
      ok: false,
      reason: `Integrity guard blocked claim of "${target.step_id}" because prior step "${row.step_id}" is "${row.status}"`,
    };
  }
  return { ok: true };
}

type DownstreamConflict = { stepId: string; status: string } | null;

function findDownstreamConflict(db: DatabaseSync, runId: string, stepIndex: number): DownstreamConflict {
  const row = db.prepare(
    "SELECT step_id, status FROM steps WHERE run_id = ? AND step_index > ? AND status IN ('running', 'done') ORDER BY step_index ASC LIMIT 1",
  ).get(runId, stepIndex) as { step_id: string; status: string } | undefined;
  if (!row) return null;
  return { stepId: row.step_id, status: row.status };
}

/**
 * Get the workspace path for an OpenClaw agent by its id.
 */
function getAgentWorkspacePath(agentId: string): string | null {
  try {
    const configPath = resolveOpenClawConfigPath();
    const config = JSON5.parse(fs.readFileSync(configPath, "utf-8")) as {
      agents?: { list?: Array<{ id?: string; workspace?: string }> };
    };
    const agent = config.agents?.list?.find((a: any) => a.id === agentId);
    return agent?.workspace ?? null;
  } catch {
    return null;
  }
}

/**
 * Read progress.txt from the loop step's agent workspace.
 */
function readProgressFile(runId: string): string {
  const db = getDb();
  const loopStep = db.prepare(
    "SELECT agent_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(runId) as { agent_id: string } | undefined;
  if (!loopStep) return "(no progress file)";
  const workspace = getAgentWorkspacePath(loopStep.agent_id);
  if (!workspace) return "(no progress file)";
  try {
    // Try run-scoped file first, fall back to legacy progress.txt
    const scopedPath = path.join(workspace, `progress-${runId}.txt`);
    const legacyPath = path.join(workspace, "progress.txt");
    const filePath = fs.existsSync(scopedPath) ? scopedPath : legacyPath;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "(no progress yet)";
  }
}

/**
 * Get all stories for a run, ordered by story_index.
 */
export function getStories(runId: string): Story[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM stories WHERE run_id = ? ORDER BY story_index ASC"
  ).all(runId) as any[];
  return rows.map(r => ({
    id: r.id,
    runId: r.run_id,
    storyIndex: r.story_index,
    storyId: r.story_id,
    title: r.title,
    description: r.description,
    acceptanceCriteria: JSON.parse(r.acceptance_criteria),
    status: r.status,
    output: r.output ?? undefined,
    retryCount: r.retry_count,
    maxRetries: r.max_retries,
  }));
}

/**
 * Get the story currently being worked on by a loop step.
 */
export function getCurrentStory(stepId: string): Story | null {
  const db = getDb();
  const step = db.prepare(
    "SELECT current_story_id FROM steps WHERE id = ?"
  ).get(stepId) as { current_story_id: string | null } | undefined;
  if (!step?.current_story_id) return null;
  const row = db.prepare("SELECT * FROM stories WHERE id = ?").get(step.current_story_id) as any;
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    storyIndex: row.story_index,
    storyId: row.story_id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: JSON.parse(row.acceptance_criteria),
    status: row.status,
    output: row.output ?? undefined,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
  };
}

function formatStoryForTemplate(story: Story): string {
  const ac = story.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`).join("\n");
  return `Story ${story.storyId}: ${story.title}\n\n${story.description}\n\nAcceptance Criteria:\n${ac}`;
}

function formatCompletedStories(stories: Story[]): string {
  const done = stories.filter(s => s.status === "done");
  if (done.length === 0) return "(none yet)";
  return done.map(s => `- ${s.storyId}: ${s.title}`).join("\n");
}

function getFirstStoryLoopStepIndex(runId: string): number | null {
  const db = getDb();
  const rows = db.prepare(
    "SELECT step_index, loop_config FROM steps WHERE run_id = ? AND type = 'loop' ORDER BY step_index ASC"
  ).all(runId) as { step_index: number; loop_config: string | null }[];

  for (const row of rows) {
    if (!row.loop_config) return row.step_index;
    try {
      const cfg = JSON.parse(row.loop_config) as LoopConfig;
      if (!cfg.over || cfg.over === "stories") return row.step_index;
    } catch {
      // Malformed loop config should not bypass this safety check.
      return row.step_index;
    }
  }

  return null;
}

type RunOrchestrationRow = {
  workflow_id: string;
  task: string;
  context: string;
};

function launchSequentialOrchestration(runId: string): void {
  let row: RunOrchestrationRow | undefined;
  let context: Record<string, string>;
  try {
    const db = getDb();
    row = db.prepare(
      "SELECT workflow_id, task, context FROM runs WHERE id = ?",
    ).get(runId) as RunOrchestrationRow | undefined;
    if (!row || row.workflow_id !== "project-gap-analysis") return;

    context = parseRunContext(row.context);
    if (!isSequentialPending(context)) return;

    context[ORCHESTRATION_STATE_KEY] = ORCHESTRATION_STATE_LAUNCHING;
    db.prepare(
      "UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(JSON.stringify(context), runId);
  } catch {
    return;
  }

  const parentWorkflowId = row.workflow_id;
  const nextWorkflowId = (context[ORCHESTRATION_NEXT_WORKFLOW_KEY] || "").trim() || "feature-dev";
  const repo = context.repo;
  const taskTitle = buildFeatureDevTaskFromGapAnalysis({
    sourceRunId: runId,
    repo,
    artifacts: getPlanningArtifacts(runId),
  });

  void runWorkflow({
    workflowId: nextWorkflowId,
    taskTitle,
    contextOverrides: buildSequentialChildContext(runId, parentWorkflowId),
  }).then((childRun) => {
    try {
      const db = getDb();
      const latest = db.prepare("SELECT context FROM runs WHERE id = ?").get(runId) as { context: string } | undefined;
      const latestContext = parseRunContext(latest?.context ?? "{}");
      latestContext[ORCHESTRATION_STATE_KEY] = ORCHESTRATION_STATE_LAUNCHED;
      latestContext[ORCHESTRATION_CHILD_RUN_ID_KEY] = childRun.id;
      latestContext[ORCHESTRATION_LAUNCHED_AT_KEY] = new Date().toISOString();
      delete latestContext[ORCHESTRATION_ERROR_KEY];
      db.prepare(
        "UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(JSON.stringify(latestContext), runId);
      emitEvent({
        ts: new Date().toISOString(),
        event: "pipeline.advanced",
        runId,
        workflowId: parentWorkflowId,
        stepId: nextWorkflowId,
        detail: `Sequential orchestration started ${nextWorkflowId} run ${childRun.id}`,
      });
    } catch {
      // best-effort update only
    }
  }).catch((err) => {
    const reason = err instanceof Error ? err.message : String(err);
    try {
      const db = getDb();
      const latest = db.prepare("SELECT context FROM runs WHERE id = ?").get(runId) as { context: string } | undefined;
      const latestContext = parseRunContext(latest?.context ?? "{}");
      latestContext[ORCHESTRATION_STATE_KEY] = ORCHESTRATION_STATE_FAILED;
      latestContext[ORCHESTRATION_ERROR_KEY] = reason;
      db.prepare(
        "UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(JSON.stringify(latestContext), runId);
      emitEvent({
        ts: new Date().toISOString(),
        event: "step.integrity",
        runId,
        workflowId: parentWorkflowId,
        detail: `Sequential orchestration failed: ${reason}`,
      });
      logger.error(`Sequential orchestration failed for next workflow "${nextWorkflowId}": ${reason}`, {
        runId,
        workflowId: parentWorkflowId,
      });
    } catch {
      // best-effort update only
    }
  });
}

// ── T5: STORIES_JSON parsing ────────────────────────────────────────

/**
 * Parse STORIES_JSON from step output and insert stories into the DB.
 */
function parseAndInsertStories(output: string, runId: string): void {
  const lines = output.split("\n");
  const startIdx = lines.findIndex(l => l.startsWith("STORIES_JSON:"));
  if (startIdx === -1) return;

  // Collect JSON text: first line after prefix, then subsequent lines until next KEY: or end
  const firstLine = lines[startIdx].slice("STORIES_JSON:".length).trim();
  const jsonLines = [firstLine];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^[A-Z_]+:\s/.test(lines[i])) break;
    jsonLines.push(lines[i]);
  }

  const jsonText = jsonLines.join("\n").trim();
  let stories: any[];
  try {
    stories = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse STORIES_JSON: ${(e as Error).message}`);
  }

  if (!Array.isArray(stories)) {
    throw new Error("STORIES_JSON must be an array");
  }
  if (stories.length > 20) {
    throw new Error(`STORIES_JSON has ${stories.length} stories, max is 20`);
  }

  type ParsedStory = {
    storyId: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
  };
  const parsedStories: ParsedStory[] = [];
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO stories (
      id, run_id, story_index, story_id, title, description, acceptance_criteria,
      status, retry_count, max_retries, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 2, ?, ?)
    ON CONFLICT(run_id, story_id) DO UPDATE SET
      story_index = excluded.story_index,
      title = excluded.title,
      description = excluded.description,
      acceptance_criteria = excluded.acceptance_criteria,
      updated_at = excluded.updated_at
  `);

  const seenIds = new Set<string>();
  for (let i = 0; i < stories.length; i++) {
    const s = stories[i] as Record<string, unknown>;
    // Accept both camelCase and snake_case
    const ac = s.acceptanceCriteria ?? s.acceptance_criteria;
    const storyId = typeof s.id === "string" ? s.id.trim() : "";
    const title = typeof s.title === "string" ? s.title.trim() : "";
    const description = typeof s.description === "string" ? s.description.trim() : "";
    const acceptanceCriteria = Array.isArray(ac)
      ? ac.map((item) => String(item).trim()).filter((item) => item.length > 0)
      : [];

    if (!storyId || !title || !description || acceptanceCriteria.length === 0) {
      throw new Error(`STORIES_JSON story at index ${i} missing required fields (id, title, description, acceptanceCriteria)`);
    }
    if (seenIds.has(storyId)) {
      throw new Error(`STORIES_JSON has duplicate story id "${storyId}"`);
    }
    seenIds.add(storyId);
    parsedStories.push({
      storyId,
      title,
      description,
      acceptanceCriteria,
    });
  }

  db.exec("BEGIN");
  try {
    for (let i = 0; i < parsedStories.length; i++) {
      const story = parsedStories[i];
      upsert.run(
        crypto.randomUUID(),
        runId,
        i,
        story.storyId,
        story.title,
        story.description,
        JSON.stringify(story.acceptanceCriteria),
        now,
        now,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch {}
    throw err;
  }
}

// ── Abandoned Step Cleanup ──────────────────────────────────────────

const ABANDONED_THRESHOLD_MS = (getMaxRoleTimeoutSeconds() + 5 * 60) * 1000; // max role timeout + 5 min buffer
const MAX_ABANDON_RESETS = 5; // abandoned steps get more chances than explicit failures

/**
 * Find steps that have been "running" for too long and reset them to pending.
 * This catches cases where an agent claimed a step but never completed/failed it.
 * Exported so it can be called from medic/health-check crons independently of claimStep.
 */
export function cleanupAbandonedSteps(): void {
  const db = getDb();
  // Use numeric comparison so mixed timestamp formats don't break ordering.
  const thresholdMs = ABANDONED_THRESHOLD_MS;

  // Find running steps that haven't been updated recently
  const abandonedSteps = db.prepare(
    `SELECT s.id, s.step_id, s.run_id, s.retry_count, s.max_retries, s.type, s.current_story_id, s.loop_config, s.abandoned_count
     FROM steps s
     JOIN runs r ON r.id = s.run_id
     WHERE s.status = 'running'
       AND r.status = 'running'
       AND (julianday('now') - julianday(s.updated_at)) * 86400000 > ?`
  ).all(thresholdMs) as { id: string; step_id: string; run_id: string; retry_count: number; max_retries: number; type: string; current_story_id: string | null; loop_config: string | null; abandoned_count: number }[];

  for (const step of abandonedSteps) {
    if (step.type === "loop" && !step.current_story_id && step.loop_config) {
      try {
        const loopConfig: LoopConfig = JSON.parse(step.loop_config);
        if (loopConfig.verifyEach && loopConfig.verifyStep) {
          const verifyStatus = db.prepare(
            "SELECT status FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1"
          ).get(step.run_id, loopConfig.verifyStep) as { status: string } | undefined;
          if (verifyStatus?.status === "pending" || verifyStatus?.status === "running") {
            continue;
          }
        }
      } catch {
        // If loop config is malformed, fall through to abandonment handling.
      }
    }

    // Loop steps: apply per-story retry, not per-step retry (#35)
    if (step.type === "loop" && step.current_story_id) {
      const story = db.prepare(
        "SELECT id, retry_count, max_retries, story_id, title FROM stories WHERE id = ?"
      ).get(step.current_story_id) as { id: string; retry_count: number; max_retries: number; story_id: string; title: string } | undefined;

      if (story) {
        const newRetry = story.retry_count + 1;
        const wfId = getWorkflowId(step.run_id);
        if (newRetry > story.max_retries) {
          db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, story.id);
          db.prepare("UPDATE steps SET status = 'failed', output = 'Story abandoned and retries exhausted', current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(step.id);
          db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, storyId: story.story_id, storyTitle: story.title, detail: "Abandoned — retries exhausted" });
          emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Story abandoned and retries exhausted" });
          emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story abandoned and retries exhausted" });
          scheduleRunCronTeardown(step.run_id);
        } else {
          db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, story.id);
          db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(step.id);
          emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Story ${story.story_id} abandoned — reset to pending (story retry ${newRetry})` });
          logger.info(`Abandoned step reset to pending (story retry ${newRetry})`, { runId: step.run_id, stepId: step.step_id });
        }
        continue;
      }
    }

    // Single steps (or loop steps without a current story): use abandoned_count, not retry_count
    const newAbandonCount = (step.abandoned_count ?? 0) + 1;
    if (newAbandonCount >= MAX_ABANDON_RESETS) {
      // Too many abandons — fail the step and run
      db.prepare(
        "UPDATE steps SET status = 'failed', output = 'Agent abandoned step without completing (' || ? || ' times)', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newAbandonCount, newAbandonCount, step.id);
      db.prepare(
        "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
      ).run(step.run_id);
      const wfId = getWorkflowId(step.run_id);
      emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: `Retries exhausted — step failed` });
      emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: "Agent abandoned step without completing" });
      emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Step abandoned and retries exhausted" });
      scheduleRunCronTeardown(step.run_id);
    } else {
      // Reset to pending for retry — do NOT increment retry_count (abandonment != explicit failure)
      db.prepare(
        "UPDATE steps SET status = 'pending', abandoned_count = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newAbandonCount, step.id);
      emitEvent({ ts: new Date().toISOString(), event: "step.timeout", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, detail: `Reset to pending (abandon ${newAbandonCount}/${MAX_ABANDON_RESETS})` });
    }
  }

  // Reset running stories that are abandoned — don't touch "done" stories
  // Don't increment retry_count for abandonment; only explicit failStep() counts against retries
  const abandonedStories = db.prepare(
    `SELECT st.id, st.retry_count, st.max_retries, st.run_id
     FROM stories st
     JOIN runs r ON r.id = st.run_id
     WHERE st.status = 'running'
       AND r.status = 'running'
       AND (julianday('now') - julianday(st.updated_at)) * 86400000 > ?`
  ).all(thresholdMs) as { id: string; retry_count: number; max_retries: number; run_id: string }[];

  for (const story of abandonedStories) {
    // Simply reset to pending without incrementing retry_count
    db.prepare("UPDATE stories SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(story.id);
  }

  // Recover stuck pipelines: loop step done but no subsequent step pending/running
  const stuckLoops = db.prepare(`
    SELECT s.id, s.run_id, s.step_index FROM steps s
    JOIN runs r ON r.id = s.run_id
    WHERE s.type = 'loop' AND s.status = 'done' AND r.status = 'running'
    AND NOT EXISTS (
      SELECT 1 FROM steps s2 WHERE s2.run_id = s.run_id 
      AND s2.step_index > s.step_index 
      AND s2.status IN ('pending', 'running')
    )
    AND EXISTS (
      SELECT 1 FROM steps s3 WHERE s3.run_id = s.run_id 
      AND s3.step_index > s.step_index 
      AND s3.status = 'waiting'
    )
  `).all() as { id: string; run_id: string; step_index: number }[];

  for (const stuck of stuckLoops) {
    logger.info(`Recovering stuck pipeline after loop completion`, { runId: stuck.run_id, stepId: stuck.id });
    advancePipeline(stuck.run_id);
  }
}

// ── Frontend change detection ───────────────────────────────────────

/**
 * Compute whether a branch has frontend changes relative to main.
 * Returns 'true' or 'false' as a string for template context.
 */
export function computeHasFrontendChanges(repo: string, branch: string): string {
  function normalizeBranchRef(input: string): string {
    const trimmed = input.trim();
    if (trimmed.startsWith("refs/heads/")) return trimmed.slice("refs/heads/".length);
    if (trimmed.startsWith("refs/remotes/origin/")) return trimmed.slice("refs/remotes/origin/".length);
    if (trimmed.startsWith("origin/")) return trimmed.slice("origin/".length);
    return trimmed;
  }

  function readGitOutput(args: string[]): string | null {
    try {
      const out = execFileSync("git", args, {
        cwd: repo,
        encoding: "utf-8",
        timeout: 10_000,
      });
      const trimmed = out.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }

  function gitRefExists(ref: string): boolean {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], {
        cwd: repo,
        stdio: "ignore",
        timeout: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  function resolveDiffBase(targetBranch: string): string | null {
    const candidates = ["main", "master", "trunk", "develop"];
    for (const candidate of candidates) {
      if (candidate === targetBranch) continue;
      if (gitRefExists(`refs/heads/${candidate}`)) return candidate;
    }
    for (const candidate of candidates) {
      if (candidate === targetBranch) continue;
      if (gitRefExists(`refs/remotes/origin/${candidate}`)) return `origin/${candidate}`;
    }

    const remoteHead = readGitOutput(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    if (remoteHead) {
      const normalized = remoteHead.replace(/^origin\//, "");
      if (normalized !== targetBranch && gitRefExists(`refs/remotes/origin/${normalized}`)) {
        return `origin/${normalized}`;
      }
    }

    const localBranches = readGitOutput(["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
    if (localBranches) {
      const alternatives = localBranches
        .split("\n")
        .map((name) => name.trim())
        .filter((name) => name.length > 0 && name !== targetBranch);
      if (alternatives.length === 1 && gitRefExists(`refs/heads/${alternatives[0]}`)) {
        return alternatives[0];
      }
    }

    return null;
  }

  function resolveTargetBranchRef(targetBranch: string): string | null {
    const normalized = normalizeBranchRef(targetBranch);
    if (gitRefExists(`refs/heads/${normalized}`)) return normalized;
    if (gitRefExists(`refs/remotes/origin/${normalized}`)) return `origin/${normalized}`;
    if (gitRefExists(targetBranch)) return targetBranch;
    return null;
  }

  try {
    const targetRef = resolveTargetBranchRef(branch);
    if (!targetRef) return "false";
    const targetNameForBase = normalizeBranchRef(targetRef);
    const diffBase = resolveDiffBase(targetNameForBase);
    if (!diffBase) return "false";
    const output = execFileSync("git", ["diff", "--name-only", `${diffBase}..${targetRef}`], {
      cwd: repo,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const files = output.trim().split("\n").filter(f => f.length > 0);
    return isFrontendChange(files) ? "true" : "false";
  } catch {
    return "false";
  }
}

// ── Peek (lightweight work check) ───────────────────────────────────

export type PeekResult = "HAS_WORK" | "NO_WORK";

/**
 * Lightweight check: does this agent have any pending/waiting steps in active runs?
 * Unlike claimStep(), this runs a single cheap COUNT query — no cleanup, no context resolution.
 * Returns "HAS_WORK" if any pending/waiting steps exist, "NO_WORK" otherwise.
 */
export function peekStep(agentId: string): PeekResult {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM steps s
     JOIN runs r ON r.id = s.run_id
     WHERE s.agent_id = ? AND s.status IN ('pending', 'waiting')
       AND r.status = 'running'`
  ).get(agentId) as { cnt: number };
  return row.cnt > 0 ? "HAS_WORK" : "NO_WORK";
}

// ── Claim ───────────────────────────────────────────────────────────

interface ClaimResult {
  found: boolean;
  stepId?: string;
  runId?: string;
  resolvedInput?: string;
}

/**
 * Throttle cleanupAbandonedSteps: run at most once every 5 minutes.
 */
let lastCleanupTime = 0;
const CLEANUP_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

class ClaimConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimConflictError";
  }
}

function withImmediateTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch {}
    throw err;
  }
}

/**
 * Find and claim a pending step for an agent, returning the resolved input.
 */
export function claimStep(agentId: string): ClaimResult {
  // Throttle cleanup: run at most once every 5 minutes across all agents
  const now = Date.now();
  if (now - lastCleanupTime >= CLEANUP_THROTTLE_MS) {
    cleanupAbandonedSteps();
    lastCleanupTime = now;
  }
  const db = getDb();
  try {
    return withImmediateTransaction(db, () => {
      const step = db.prepare(
        `SELECT s.id, s.step_id, s.run_id, s.input_template, s.type, s.loop_config
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         WHERE s.agent_id = ? AND s.status = 'pending'
           AND r.status = 'running'
         ORDER BY s.step_index ASC
         LIMIT 1`
      ).get(agentId) as { id: string; step_id: string; run_id: string; input_template: string; type: string; loop_config: string | null } | undefined;

      if (!step) return { found: false };

      // Guard: don't claim work for terminal runs.
      const runStatus = db.prepare("SELECT status FROM runs WHERE id = ?").get(step.run_id) as { status: string } | undefined;
      if (runStatus?.status !== "running") return { found: false };
      const workflowId = getWorkflowId(step.run_id);

      const monotonicGuard = checkMonotonicClaimGuard(db, step.run_id, step.id);
      if (!monotonicGuard.ok) {
        emitEvent({
          ts: new Date().toISOString(),
          event: "step.integrity",
          runId: step.run_id,
          workflowId,
          stepId: step.step_id,
          agentId,
          detail: monotonicGuard.reason,
        });
        logger.warn(monotonicGuard.reason ?? "Integrity guard blocked claim", {
          runId: step.run_id,
          stepId: step.step_id,
        });
        return { found: false };
      }

      // Get run context
      const run = db.prepare("SELECT context FROM runs WHERE id = ?").get(step.run_id) as { context: string } | undefined;
      const context: Record<string, string> = run ? JSON.parse(run.context) : {};
      const strictTemplateValidation = isStrictTemplateValidationEnabled(workflowId);

      // Always inject run_id so templates can use {{run_id}} (e.g. for scoped progress files)
      context["run_id"] = step.run_id;

      // Compute has_frontend_changes from git diff when repo and branch are available
      if (context["repo"] && context["branch"]) {
        context["has_frontend_changes"] = computeHasFrontendChanges(context["repo"], context["branch"]);
      } else {
        context["has_frontend_changes"] = "false";
      }

      // T6: Loop step claim logic
      if (step.type === "loop") {
        const loopConfig: LoopConfig | null = step.loop_config ? JSON.parse(step.loop_config) : null;
        if (loopConfig?.over === "stories") {
          const totalStories = db.prepare(
            "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?"
          ).get(step.run_id) as { cnt: number };
          if (totalStories.cnt === 0) {
            const err = "Loop step has no stories. Upstream step likely missed STORIES_JSON.";
            db.prepare(
              "UPDATE steps SET status = 'failed', output = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
            ).run(err, step.id);
            db.prepare(
              "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND status NOT IN ('failed', 'cancelled')"
            ).run(step.run_id);
            const wfId = getWorkflowId(step.run_id);
            emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, detail: err });
            emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: err });
            scheduleRunCronTeardown(step.run_id);
            return { found: false };
          }

          // Find next pending story
          const nextStory = db.prepare(
            "SELECT * FROM stories WHERE run_id = ? AND status = 'pending' ORDER BY story_index ASC LIMIT 1"
          ).get(step.run_id) as any | undefined;

          if (!nextStory) {
            const failedStory = db.prepare(
              "SELECT id FROM stories WHERE run_id = ? AND status = 'failed' LIMIT 1"
            ).get(step.run_id) as { id: string } | undefined;

            if (failedStory) {
              // No pending stories left, but failures remain — fail loop + run
              db.prepare(
                "UPDATE steps SET status = 'failed', output = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
              ).run("Loop cannot continue because one or more stories failed", step.id);
              db.prepare(
                "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND status NOT IN ('failed', 'cancelled')"
              ).run(step.run_id);
              const wfId = getWorkflowId(step.run_id);
              emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, detail: "Loop has failed stories and no pending stories" });
              emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Loop has failed stories and no pending stories" });
              scheduleRunCronTeardown(step.run_id);
              return { found: false };
            }

            // No pending or failed stories — mark step done and advance
            db.prepare(
              "UPDATE steps SET status = 'done', updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
            ).run(step.id);
            emitEvent({ ts: new Date().toISOString(), event: "step.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
            advancePipeline(step.run_id);
            return { found: false };
          }

          // Claim the story + loop step atomically.
          const storyClaim = db.prepare(
            "UPDATE stories SET status = 'running', updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
          ).run(nextStory.id);
          if (Number(storyClaim.changes) !== 1) {
            throw new ClaimConflictError(`Story ${nextStory.id} is no longer pending`);
          }
          const stepClaim = db.prepare(
            "UPDATE steps SET status = 'running', current_story_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
          ).run(nextStory.id, step.id);
          if (Number(stepClaim.changes) !== 1) {
            throw new ClaimConflictError(`Step ${step.id} is no longer pending`);
          }

          const wfId = getWorkflowId(step.run_id);
          emitEvent({ ts: new Date().toISOString(), event: "step.running", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId });
          emitEvent({ ts: new Date().toISOString(), event: "story.started", runId: step.run_id, workflowId: wfId, stepId: step.step_id, agentId: agentId, storyId: nextStory.story_id, storyTitle: nextStory.title });
          logger.info(`Story started: ${nextStory.story_id} — ${nextStory.title}`, { runId: step.run_id, stepId: step.step_id });

          // Build story template vars
          const story: Story = {
            id: nextStory.id,
            runId: nextStory.run_id,
            storyIndex: nextStory.story_index,
            storyId: nextStory.story_id,
            title: nextStory.title,
            description: nextStory.description,
            acceptanceCriteria: JSON.parse(nextStory.acceptance_criteria),
            status: nextStory.status,
            output: nextStory.output ?? undefined,
            retryCount: nextStory.retry_count,
            maxRetries: nextStory.max_retries,
          };

          const allStories = getStories(step.run_id);
          const pendingCount = allStories.filter(s => s.status === "pending" || s.status === "running").length;

          context["current_story"] = formatStoryForTemplate(story);
          context["current_story_id"] = story.storyId;
          context["current_story_title"] = story.title;
          context["completed_stories"] = formatCompletedStories(allStories);
          context["stories_remaining"] = String(pendingCount);
          context["progress"] = readProgressFile(step.run_id);

          if (!context["verify_feedback"]) {
            context["verify_feedback"] = "";
          }

          // Persist story context vars to DB so verify_each steps can access them
          db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(context), step.run_id);

          const resolvedInput = resolveTemplate(step.input_template, context);
          const integrity = validateResolvedInput(step.input_template, resolvedInput, context, {
            strictEmptyChecks: strictTemplateValidation,
          });
          if (!integrity.ok) {
            const detail = `Input integrity check failed for "${step.step_id}": ${integrity.issues.join(" | ")}`;
            emitEvent({
              ts: new Date().toISOString(),
              event: "step.integrity",
              runId: step.run_id,
              workflowId,
              stepId: step.step_id,
              agentId,
              detail,
            });
            failStep(step.id, detail);
            return { found: false };
          }
          return { found: true, stepId: step.id, runId: step.run_id, resolvedInput };
        }
      }

      // Single step: existing logic
      const claimed = db.prepare(
        "UPDATE steps SET status = 'running', updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
      ).run(step.id);
      if (Number(claimed.changes) !== 1) {
        throw new ClaimConflictError(`Step ${step.id} is no longer pending`);
      }
      emitEvent({ ts: new Date().toISOString(), event: "step.running", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, agentId: agentId });
      logger.info(`Step claimed by ${agentId}`, { runId: step.run_id, stepId: step.step_id });

      // Inject progress for any step in a run that has stories
      const hasStories = db.prepare(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?"
      ).get(step.run_id) as { cnt: number };
      if (hasStories.cnt > 0) {
        context["progress"] = readProgressFile(step.run_id);
      }

      const resolvedInput = resolveTemplate(step.input_template, context);
      const integrity = validateResolvedInput(step.input_template, resolvedInput, context, {
        strictEmptyChecks: strictTemplateValidation,
      });
      if (!integrity.ok) {
        const detail = `Input integrity check failed for "${step.step_id}": ${integrity.issues.join(" | ")}`;
        emitEvent({
          ts: new Date().toISOString(),
          event: "step.integrity",
          runId: step.run_id,
          workflowId,
          stepId: step.step_id,
          agentId,
          detail,
        });
        failStep(step.id, detail);
        return { found: false };
      }

      return {
        found: true,
        stepId: step.id,
        runId: step.run_id,
        resolvedInput,
      };
    });
  } catch (err) {
    if (err instanceof ClaimConflictError) {
      return { found: false };
    }
    throw err;
  }
}

// ── Complete ────────────────────────────────────────────────────────

/**
 * Complete a step: save output, merge context, advance pipeline.
 */
export function completeStep(stepId: string, output: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();

  const step = db.prepare(
    "SELECT id, run_id, step_id, step_index, status, type, loop_config, current_story_id, output_schema FROM steps WHERE id = ?"
  ).get(stepId) as {
    id: string;
    run_id: string;
    step_id: string;
    step_index: number;
    status: string;
    type: string;
    loop_config: string | null;
    current_story_id: string | null;
    output_schema: string | null;
  } | undefined;

  if (!step) throw new Error(`Step not found: ${stepId}`);

  // Guard: don't process completions for failed/cancelled runs.
  const runCheck = db.prepare("SELECT status FROM runs WHERE id = ?").get(step.run_id) as { status: string } | undefined;
  const runStatus = runCheck?.status;
  if (!runStatus || runStatus === "failed" || runStatus === "cancelled") {
    return { advanced: false, runCompleted: false };
  }
  const replayCompletedRun = runStatus === "completed";

  // Guard: only running steps can complete while a run is active.
  // For completed runs, allow replay upserts from already-done steps only.
  if (replayCompletedRun) {
    if (step.status !== "done") {
      return { advanced: false, runCompleted: false };
    }
  } else if (step.status !== "running") {
    return { advanced: false, runCompleted: false };
  }

  // Merge KEY: value lines into run context
  const run = db.prepare("SELECT context FROM runs WHERE id = ?").get(step.run_id) as { context: string };
  const context: Record<string, string> = JSON.parse(run.context);

  // Parse KEY: value lines and merge into context
  const parsed = parseOutputKeyValues(output);

  // Make JSON payloads available to validators even when not emitted as KEY: lines.
  const artifactsInOutput = parsePlanningArtifactsFromOutput(output);
  if (artifactsInOutput.epics) parsed.epics_json = JSON.stringify(artifactsInOutput.epics);
  if (artifactsInOutput.features) parsed.features_json = JSON.stringify(artifactsInOutput.features);
  if (artifactsInOutput.featuresByEpic) parsed.features_by_epic_json = JSON.stringify(artifactsInOutput.featuresByEpic);
  if (artifactsInOutput.stories) parsed.stories_json = JSON.stringify(artifactsInOutput.stories);

  const workflowId = getWorkflowId(step.run_id);
  let outputSchema: StepOutputSchema | undefined;
  if (step.output_schema) {
    try {
      outputSchema = JSON.parse(step.output_schema) as StepOutputSchema;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failStep(step.id, `Invalid persisted output schema for "${step.step_id}": ${message}`);
      return { advanced: false, runCompleted: false };
    }
  }
  const validation = validateAndNormalizeStepOutput(workflowId, step.step_id, parsed, outputSchema);
  if (!validation.ok) {
    const error = `Output validation failed for "${step.step_id}": ${validation.errors.join(" | ")}`;
    failStep(step.id, error);
    return { advanced: false, runCompleted: false };
  }
  for (const [key, value] of Object.entries(validation.normalized)) {
    parsed[key] = value;
  }

  for (const [key, value] of Object.entries(parsed)) {
    context[key] = value;
  }

  db.prepare(
    "UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(context), step.run_id);

  // Persist structured planning artifacts (epics/features/stories) for dashboard rendering.
  updatePlanningArtifactsFromOutput(step.run_id, output);

  // T5: Parse STORIES_JSON from output (any step, typically the planner)
  try {
    parseAndInsertStories(output, step.run_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failStep(step.id, `Output validation failed for "${step.step_id}": ${message}`);
    return { advanced: false, runCompleted: false };
  }

  // Allow idempotent output/story upserts on completed runs, but never mutate pipeline state.
  if (replayCompletedRun) {
    db.prepare(
      "UPDATE steps SET output = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(output, step.id);
    return { advanced: false, runCompleted: false };
  }

  // Guardrail: if a story loop is still ahead, upstream steps must produce stories.
  const firstStoryLoopIndex = getFirstStoryLoopStepIndex(step.run_id);
  if (firstStoryLoopIndex !== null && step.step_index < firstStoryLoopIndex) {
    const storyCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?"
    ).get(step.run_id) as { cnt: number };
    if (storyCount.cnt === 0) {
      const err = `Step "${step.step_id}" completed but produced no STORIES_JSON stories`;
      logger.error(err, { runId: step.run_id, stepId: step.step_id });
      failStep(step.id, err);
      return { advanced: false, runCompleted: false };
    }
  }

  // T7: Loop step completion
  if (step.type === "loop" && step.current_story_id) {
    // Look up story info for event
    const storyRow = db.prepare("SELECT story_id, title FROM stories WHERE id = ?").get(step.current_story_id) as { story_id: string; title: string } | undefined;

    // Mark current story done
    db.prepare(
      "UPDATE stories SET status = 'done', output = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(output, step.current_story_id);
    emitEvent({ ts: new Date().toISOString(), event: "story.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title });
    logger.info(`Story done: ${storyRow?.story_id} — ${storyRow?.title}`, { runId: step.run_id, stepId: step.step_id });

    // Clear current_story_id, save output
    db.prepare(
      "UPDATE steps SET current_story_id = NULL, output = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(output, step.id);

    const loopConfig: LoopConfig | null = step.loop_config ? JSON.parse(step.loop_config) : null;

    // T8: verify_each flow — set verify step to pending
    if (loopConfig?.verifyEach && loopConfig.verifyStep) {
      const verifyStep = db.prepare(
        "SELECT id FROM steps WHERE run_id = ? AND step_id = ? LIMIT 1"
      ).get(step.run_id, loopConfig.verifyStep) as { id: string } | undefined;

      if (verifyStep) {
        db.prepare(
          "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?"
        ).run(verifyStep.id);
        // Loop step stays 'running'
        db.prepare(
          "UPDATE steps SET status = 'running', updated_at = datetime('now') WHERE id = ?"
        ).run(step.id);
        return { advanced: false, runCompleted: false };
      }
    }

    // No verify_each: check for more stories
    return checkLoopContinuation(step.run_id, step.id);
  }

  // T8: Check if this is a verify step triggered by verify-each
  // NOTE: Don't filter by status='running' — the loop step may have been temporarily
  // reset by cleanupAbandonedSteps, causing this to fall through to single-step path (#52)
  const loopStepRow = db.prepare(
    "SELECT id, loop_config, run_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(step.run_id) as { id: string; loop_config: string | null; run_id: string } | undefined;

  if (loopStepRow?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStepRow.loop_config);
    if (lc.verifyEach && lc.verifyStep === step.step_id) {
      return handleVerifyEachCompletion(step, loopStepRow.id, output, context);
    }
  }

  // Single step: mark done and advance
  db.prepare(
    "UPDATE steps SET status = 'done', output = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(output, stepId);
  emitEvent({ ts: new Date().toISOString(), event: "step.done", runId: step.run_id, workflowId: getWorkflowId(step.run_id), stepId: step.step_id });
  logger.info(`Step completed: ${step.step_id}`, { runId: step.run_id, stepId: step.step_id });

  return advancePipeline(step.run_id);
}

/**
 * Handle verify-each completion: pass or fail the story.
 */
function handleVerifyEachCompletion(
  verifyStep: { id: string; run_id: string; step_id: string; step_index: number },
  loopStepId: string,
  output: string,
  context: Record<string, string>
): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();
  const status = context["status"]?.toLowerCase();

  // Reset verify step to waiting for next use
  db.prepare(
    "UPDATE steps SET status = 'waiting', output = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(output, verifyStep.id);

  if (status !== "retry") {
    // Verify passed
    emitEvent({ ts: new Date().toISOString(), event: "story.verified", runId: verifyStep.run_id, workflowId: getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id });
  }

  if (status === "retry") {
    // Verify failed — retry the story
    const lastDoneStory = db.prepare(
      "SELECT id, retry_count, max_retries FROM stories WHERE run_id = ? AND status = 'done' ORDER BY updated_at DESC LIMIT 1"
    ).get(verifyStep.run_id) as { id: string; retry_count: number; max_retries: number } | undefined;

    if (lastDoneStory) {
      const newRetry = lastDoneStory.retry_count + 1;
      if (newRetry > lastDoneStory.max_retries) {
        // Story retries exhausted — fail everything
        db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, lastDoneStory.id);
        db.prepare("UPDATE steps SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(loopStepId);
        db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(verifyStep.run_id);
        const wfId = getWorkflowId(verifyStep.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: verifyStep.run_id, workflowId: wfId, stepId: verifyStep.step_id });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: verifyStep.run_id, workflowId: wfId, detail: "Verification retries exhausted" });
        scheduleRunCronTeardown(verifyStep.run_id);
        return { advanced: false, runCompleted: false };
      }

      // Set story back to pending for retry
      db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, lastDoneStory.id);

      // Store verify feedback
      const issues = context["issues"] ?? output;
      context["verify_feedback"] = issues;
      emitEvent({ ts: new Date().toISOString(), event: "story.retry", runId: verifyStep.run_id, workflowId: getWorkflowId(verifyStep.run_id), stepId: verifyStep.step_id, detail: issues });
      db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(context), verifyStep.run_id);
    }

    // Set loop step back to pending for retry
    db.prepare("UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(loopStepId);
    return { advanced: false, runCompleted: false };
  }

  // Verify passed — clear feedback and continue
  delete context["verify_feedback"];
  db.prepare("UPDATE runs SET context = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(context), verifyStep.run_id);

  try {
    return checkLoopContinuation(verifyStep.run_id, loopStepId);
  } catch (err) {
    logger.error(`checkLoopContinuation failed, recovering: ${String(err)}`, { runId: verifyStep.run_id });
    // Ensure loop step is at least pending so cron can retry
    db.prepare("UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(loopStepId);
    return { advanced: false, runCompleted: false };
  }
}

/**
 * Check if the loop has more stories; if so set loop step pending, otherwise done + advance.
 */
function checkLoopContinuation(runId: string, loopStepId: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();
  const pendingStory = db.prepare(
    "SELECT id FROM stories WHERE run_id = ? AND status = 'pending' LIMIT 1"
  ).get(runId) as { id: string } | undefined;

  const loopStatus = db.prepare(
    "SELECT status FROM steps WHERE id = ?"
  ).get(loopStepId) as { status: string } | undefined;

  if (pendingStory) {
    if (loopStatus?.status === "failed") {
      return { advanced: false, runCompleted: false };
    }
    // More stories — loop step back to pending
    db.prepare(
      "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?"
    ).run(loopStepId);
    return { advanced: false, runCompleted: false };
  }

  const failedStory = db.prepare(
    "SELECT id FROM stories WHERE run_id = ? AND status = 'failed' LIMIT 1"
  ).get(runId) as { id: string } | undefined;

  if (failedStory) {
    const loopStepMeta = db.prepare(
      "SELECT step_id FROM steps WHERE id = ?"
    ).get(loopStepId) as { step_id: string } | undefined;
    // Nothing pending, but failures remain — fail loop + run
    db.prepare(
      "UPDATE steps SET status = 'failed', output = ?, updated_at = datetime('now') WHERE id = ?"
    ).run("Loop cannot continue because one or more stories failed", loopStepId);
    db.prepare(
      "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
    ).run(runId);
    const wfId = getWorkflowId(runId);
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.failed",
      runId,
      workflowId: wfId,
      stepId: loopStepMeta?.step_id ?? loopStepId,
      detail: "Loop has failed stories and no pending stories",
    });
    emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId, workflowId: wfId, detail: "Loop has failed stories and no pending stories" });
    scheduleRunCronTeardown(runId);
    return { advanced: false, runCompleted: false };
  }

  // All stories done — mark loop step done
  db.prepare(
    "UPDATE steps SET status = 'done', updated_at = datetime('now') WHERE id = ?"
  ).run(loopStepId);

  // Also mark verify step done if it exists
  const loopStep = db.prepare("SELECT loop_config, run_id FROM steps WHERE id = ?").get(loopStepId) as { loop_config: string | null; run_id: string } | undefined;
  if (loopStep?.loop_config) {
    const lc: LoopConfig = JSON.parse(loopStep.loop_config);
    if (lc.verifyEach && lc.verifyStep) {
      db.prepare(
        "UPDATE steps SET status = 'done', updated_at = datetime('now') WHERE run_id = ? AND step_id = ?"
      ).run(runId, lc.verifyStep);
    }
  }

  return advancePipeline(runId);
}

/**
 * Advance the pipeline: find the next waiting step and make it pending, or complete the run.
 * Respects terminal run states — a failed run cannot be advanced or completed.
 */
function advancePipeline(runId: string): { advanced: boolean; runCompleted: boolean } {
  const db = getDb();

  // Guard: only running runs can advance.
  const runStatus = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string } | undefined;
  if (runStatus?.status !== "running") {
    return { advanced: false, runCompleted: false };
  }

  const next = db.prepare(
    "SELECT id, step_id FROM steps WHERE run_id = ? AND status = 'waiting' ORDER BY step_index ASC LIMIT 1"
  ).get(runId) as { id: string; step_id: string } | undefined;

  const incomplete = db.prepare(
    "SELECT id FROM steps WHERE run_id = ? AND status IN ('failed', 'pending', 'running') LIMIT 1"
  ).get(runId) as { id: string } | undefined;

  if (!next && incomplete) {
    return { advanced: false, runCompleted: false };
  }

  const wfId = getWorkflowId(runId);
  if (next) {
    db.prepare(
      "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = ?"
    ).run(next.id);
    emitEvent({ ts: new Date().toISOString(), event: "pipeline.advanced", runId, workflowId: wfId, stepId: next.step_id });
    emitEvent({ ts: new Date().toISOString(), event: "step.pending", runId, workflowId: wfId, stepId: next.step_id });
    return { advanced: true, runCompleted: false };
  } else {
    db.prepare(
      "UPDATE runs SET status = 'completed', updated_at = datetime('now') WHERE id = ?"
    ).run(runId);
    emitEvent({ ts: new Date().toISOString(), event: "run.completed", runId, workflowId: wfId });
    logger.info("Run completed", { runId, workflowId: wfId });
    launchSequentialOrchestration(runId);
    archiveRunProgress(runId);
    scheduleRunCronTeardown(runId);
    return { advanced: false, runCompleted: true };
  }
}

// ── Fail ────────────────────────────────────────────────────────────

// ─── Progress Archiving (T15) ────────────────────────────────────────

export function archiveRunProgress(runId: string): void {
  const db = getDb();
  const loopStep = db.prepare(
    "SELECT agent_id FROM steps WHERE run_id = ? AND type = 'loop' LIMIT 1"
  ).get(runId) as { agent_id: string } | undefined;
  if (!loopStep) return;

  const workspace = getAgentWorkspacePath(loopStep.agent_id);
  if (!workspace) return;

  const scopedPath = path.join(workspace, `progress-${runId}.txt`);
  const legacyPath = path.join(workspace, "progress.txt");
  // Prefer run-scoped file, fall back to legacy
  const progressPath = fs.existsSync(scopedPath) ? scopedPath : legacyPath;
  if (!fs.existsSync(progressPath)) return;

  const archiveDir = path.join(workspace, "archive", runId);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(progressPath, path.join(archiveDir, "progress.txt"));
  fs.unlinkSync(progressPath); // clean up
}

/**
 * Fail a step, with retry logic. For loop steps, applies per-story retry.
 */
export function failStep(stepId: string, error: string): { retrying: boolean; runFailed: boolean } {
  const db = getDb();

  const step = db.prepare(
    "SELECT run_id, step_id, step_index, status, agent_id, retry_count, max_retries, type, current_story_id FROM steps WHERE id = ?"
  ).get(stepId) as {
    run_id: string;
    step_id: string;
    step_index: number;
    status: string;
    agent_id: string;
    retry_count: number;
    max_retries: number;
    type: string;
    current_story_id: string | null;
  } | undefined;

  if (!step) throw new Error(`Step not found: ${stepId}`);
  const wfId = getWorkflowId(step.run_id);

  if (step.status !== "running") {
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.integrity",
      runId: step.run_id,
      workflowId: wfId,
      stepId: step.step_id,
      agentId: step.agent_id,
      detail: `Ignored step fail for non-running step state "${step.status}"`,
    });
    return { retrying: false, runFailed: false };
  }

  const downstreamConflict = findDownstreamConflict(db, step.run_id, step.step_index);

  const failForDownstreamConflict = (retryKind: string): { retrying: boolean; runFailed: boolean } => {
    const conflict = downstreamConflict!;
    const message =
      `Integrity guard blocked ${retryKind}: cannot reopen "${step.step_id}" because downstream step ` +
      `"${conflict.stepId}" is "${conflict.status}". Use explicit run resume/reset flow.`;
    db.prepare(
      "UPDATE steps SET status = 'failed', output = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(`${error}\n\n${message}`, stepId);
    db.prepare(
      "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
    ).run(step.run_id);
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.integrity",
      runId: step.run_id,
      workflowId: wfId,
      stepId: step.step_id,
      agentId: step.agent_id,
      detail: message,
    });
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.failed",
      runId: step.run_id,
      workflowId: wfId,
      stepId: step.step_id,
      detail: `${error} (${message})`,
    });
    emitEvent({
      ts: new Date().toISOString(),
      event: "run.failed",
      runId: step.run_id,
      workflowId: wfId,
      detail: "Integrity guard blocked out-of-order retry",
    });
    scheduleRunCronTeardown(step.run_id);
    return { retrying: false, runFailed: true };
  };

  // T9: Loop step failure — per-story retry
  if (step.type === "loop" && step.current_story_id) {
    const story = db.prepare(
      "SELECT id, retry_count, max_retries FROM stories WHERE id = ?"
    ).get(step.current_story_id) as { id: string; retry_count: number; max_retries: number } | undefined;

    if (story) {
      const storyRow = db.prepare("SELECT story_id, title FROM stories WHERE id = ?").get(step.current_story_id!) as { story_id: string; title: string } | undefined;
      const newRetry = story.retry_count + 1;
      if (newRetry > story.max_retries) {
        // Story retries exhausted
        db.prepare("UPDATE stories SET status = 'failed', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, story.id);
        db.prepare("UPDATE steps SET status = 'failed', output = ?, current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(error, stepId);
        db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(step.run_id);
        emitEvent({ ts: new Date().toISOString(), event: "story.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, storyId: storyRow?.story_id, storyTitle: storyRow?.title, detail: error });
        emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: error });
        emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Story retries exhausted" });
        scheduleRunCronTeardown(step.run_id);
        return { retrying: false, runFailed: true };
      }

      if (downstreamConflict) {
        return failForDownstreamConflict("story retry");
      }

      // Retry the story
      db.prepare("UPDATE stories SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?").run(newRetry, story.id);
      db.prepare("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = datetime('now') WHERE id = ?").run(stepId);
      emitEvent({
        ts: new Date().toISOString(),
        event: "step.failed",
        runId: step.run_id,
        workflowId: wfId,
        stepId: step.step_id,
        detail: `${error} (story retry ${newRetry}/${story.max_retries})`,
      });
      emitEvent({
        ts: new Date().toISOString(),
        event: "step.pending",
        runId: step.run_id,
        workflowId: wfId,
        stepId: step.step_id,
      });
      return { retrying: true, runFailed: false };
    }
  }

  // Single step: existing logic
  const newRetryCount = step.retry_count + 1;

  if (newRetryCount > step.max_retries) {
    db.prepare(
      "UPDATE steps SET status = 'failed', output = ?, retry_count = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(error, newRetryCount, stepId);
    db.prepare(
      "UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
    ).run(step.run_id);
    emitEvent({ ts: new Date().toISOString(), event: "step.failed", runId: step.run_id, workflowId: wfId, stepId: step.step_id, detail: error });
    emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: step.run_id, workflowId: wfId, detail: "Step retries exhausted" });
    scheduleRunCronTeardown(step.run_id);
    return { retrying: false, runFailed: true };
  } else {
    if (downstreamConflict) {
      return failForDownstreamConflict("step retry");
    }
    db.prepare(
      "UPDATE steps SET status = 'pending', retry_count = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newRetryCount, stepId);
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.failed",
      runId: step.run_id,
      workflowId: wfId,
      stepId: step.step_id,
      detail: `${error} (retry ${newRetryCount}/${step.max_retries})`,
    });
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.pending",
      runId: step.run_id,
      workflowId: wfId,
      stepId: step.step_id,
    });
    return { retrying: true, runFailed: false };
  }
}
