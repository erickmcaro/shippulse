import crypto from "node:crypto";
import { loadWorkflowSpec } from "./workflow-spec.js";
import { resolveBundledSeedDir, resolveWorkflowDir } from "./paths.js";
import { getDb } from "../db.js";
import { logger } from "../lib/logger.js";
import { ensureWorkflowCrons } from "./agent-cron.js";
import { emitEvent } from "./events.js";
import fs from "node:fs/promises";
import { buildKnowledgebaseIndex, getDefaultIndexPath, searchKnowledgebaseIndex } from "../kb/index.js";

const DETERMINISTIC_KB_WORKFLOWS = new Set(["product-planning", "idea-to-project"]);

function compactSnippet(input: string, max = 160): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

async function ensureKbIndex(seedRoot: string): Promise<string> {
  const indexPath = getDefaultIndexPath();
  try {
    await fs.access(indexPath);
    return indexPath;
  } catch {
    const built = await buildKnowledgebaseIndex({
      seedRoot,
      indexPath,
      withEmbeddings: false,
    });
    return built.indexPath;
  }
}

async function buildSection(indexPath: string, query: string, topK: number): Promise<string> {
  const result = await searchKnowledgebaseIndex({
    query,
    topK,
    indexPath,
    useEmbeddings: false,
    alpha: 1,
  });
  if (!result.hits.length) return "(no direct matches)";
  return result.hits
    .slice(0, topK)
    .map((hit, idx) => `${idx + 1}. ${hit.title} [${hit.source}] — ${compactSnippet(hit.snippet)}`)
    .join("\n");
}

async function buildDeterministicKbContext(
  workflowId: string,
  taskTitle: string,
): Promise<{ context: Record<string, string>; output: string } | null> {
  if (!DETERMINISTIC_KB_WORKFLOWS.has(workflowId)) return null;
  const seedRoot = resolveBundledSeedDir();
  try {
    await fs.access(seedRoot);
  } catch {
    return null;
  }

  try {
    const indexPath = await ensureKbIndex(seedRoot);
    const q = taskTitle.slice(0, 500);
    const kbContext = await buildSection(indexPath, `${q} planning standards constraints`, 8);
    const kbArch = await buildSection(indexPath, `${q} architecture patterns stack boundaries`, 6);
    const kbEpics = await buildSection(indexPath, `${q} epic decomposition outcomes`, 6);
    const kbFeatures = await buildSection(indexPath, `${q} feature decomposition acceptance criteria`, 6);
    const kbTemplates = await buildSection(indexPath, `${q} template given when then`, 6);

    const context = {
      kb_context: kbContext,
      kb_arch_patterns: kbArch,
      kb_epic_patterns: kbEpics,
      kb_feature_patterns: kbFeatures,
      kb_template_snippets: kbTemplates,
    };

    const output = [
      "STATUS: done",
      "DETAIL: Deterministic KB retrieval from local index",
      `KB_CONTEXT: ${kbContext}`,
      `KB_ARCH_PATTERNS: ${kbArch}`,
      `KB_EPIC_PATTERNS: ${kbEpics}`,
      `KB_FEATURE_PATTERNS: ${kbFeatures}`,
      `KB_TEMPLATE_SNIPPETS: ${kbTemplates}`,
    ].join("\n");

    return { context, output };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn(`Deterministic KB retrieval failed; falling back to agent kb-scan. ${reason}`, {
      workflowId,
    });
    return null;
  }
}

export async function runWorkflow(params: {
  workflowId: string;
  taskTitle: string;
  notifyUrl?: string;
  contextOverrides?: Record<string, string>;
}): Promise<{ id: string; runNumber: number; workflowId: string; task: string; status: string }> {
  const workflowDir = resolveWorkflowDir(params.workflowId);
  const workflow = await loadWorkflowSpec(workflowDir);
  const db = getDb();
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  let runNumber = 0;
  const deterministicKb = await buildDeterministicKbContext(params.workflowId, params.taskTitle);
  const autoCompleteKbScan = Boolean(deterministicKb && workflow.steps[0]?.id === "kb-scan");

  const initialContext: Record<string, string> = {
    task: params.taskTitle,
    ...workflow.context,
    ...(deterministicKb?.context ?? {}),
    ...(params.contextOverrides ?? {}),
  };

  db.exec("BEGIN IMMEDIATE");
  try {
    const notifyUrl = params.notifyUrl ?? workflow.notifications?.url ?? null;
    const insertRun = db.prepare(
      `
      INSERT INTO runs (id, run_number, workflow_id, task, status, context, notify_url, created_at, updated_at)
      VALUES (?, (SELECT COALESCE(MAX(run_number), 0) + 1 FROM runs), ?, ?, 'running', ?, ?, ?, ?)
      RETURNING run_number
      `
    );
    const insertedRun = insertRun.get(
      runId,
      workflow.id,
      params.taskTitle,
      JSON.stringify(initialContext),
      notifyUrl,
      now,
      now,
    ) as { run_number: number } | undefined;
    runNumber = Number(insertedRun?.run_number ?? 0);
    if (!Number.isFinite(runNumber) || runNumber <= 0) {
      throw new Error("Failed to allocate run_number");
    }

    const insertStep = db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, max_retries, type, loop_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepUuid = crypto.randomUUID();
      const agentId = `${workflow.id}_${step.agent}`;
      let status = i === 0 ? "pending" : "waiting";
      let output: string | null = null;
      if (autoCompleteKbScan) {
        if (i === 0) {
          status = "done";
          output = deterministicKb?.output ?? null;
        } else if (i === 1) {
          status = "pending";
        }
      }
      const maxRetries = step.max_retries ?? step.on_fail?.max_retries ?? 2;
      const stepType = step.type ?? "single";
      const loopConfig = step.loop ? JSON.stringify(step.loop) : null;
      insertStep.run(stepUuid, runId, step.id, agentId, i, step.input, step.expects, status, output, maxRetries, stepType, loopConfig, now, now);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  // Start crons for this workflow (no-op if already running from another run)
  try {
    await ensureWorkflowCrons(workflow);
  } catch (err) {
    // Mark run + pending work as failed since it cannot advance without crons.
    const db2 = getDb();
    const message = err instanceof Error ? err.message : String(err);
    const failureOutput = `Cron setup failed: ${message}`;
    const failedAt = new Date().toISOString();
    db2.exec("BEGIN");
    try {
      db2.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?").run(failedAt, runId);
      db2.prepare(
        "UPDATE steps SET status = 'failed', output = ?, updated_at = ? WHERE run_id = ? AND status IN ('waiting', 'pending', 'running')",
      ).run(failureOutput, failedAt, runId);
      db2.exec("COMMIT");
    } catch (txErr) {
      try { db2.exec("ROLLBACK"); } catch {}
      throw txErr;
    }
    emitEvent({
      ts: failedAt,
      event: "run.failed",
      runId,
      workflowId: workflow.id,
      detail: failureOutput,
    });
    throw new Error(`Cannot start workflow run: cron setup failed. ${message}`);
  }

  emitEvent({ ts: new Date().toISOString(), event: "run.started", runId, workflowId: workflow.id });
  if (autoCompleteKbScan) {
    const kbStep = workflow.steps[0];
    const nextStep = workflow.steps[1];
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.done",
      runId,
      workflowId: workflow.id,
      stepId: kbStep.id,
      agentId: `${workflow.id}_${kbStep.agent}`,
      detail: "Deterministic KB retrieval completed",
    });
    if (nextStep) {
      emitEvent({
        ts: new Date().toISOString(),
        event: "pipeline.advanced",
        runId,
        workflowId: workflow.id,
        stepId: nextStep.id,
      });
      emitEvent({
        ts: new Date().toISOString(),
        event: "step.pending",
        runId,
        workflowId: workflow.id,
        stepId: nextStep.id,
      });
    }
  }

  logger.info(`Run started: "${params.taskTitle}"`, {
    workflowId: workflow.id,
    runId,
    stepId: workflow.steps[0]?.id,
  });

  return { id: runId, runNumber, workflowId: workflow.id, task: params.taskTitle, status: "running" };
}
