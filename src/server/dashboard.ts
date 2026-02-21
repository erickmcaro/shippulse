import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getDb } from "../db.js";
import { resolveBundledWorkflowsDir, resolveShipPulseRoot } from "../installer/paths.js";
import { readPositiveIntEnv } from "../lib/env-int.js";
import YAML from "yaml";
import { runWorkflow } from "../installer/run.js";
import { getPlanningArtifacts } from "../installer/planning-artifacts.js";
import { stopWorkflow, resumeWorkflow, retryFailedStory } from "../installer/status.js";
import { recommendWorkflowForTask } from "../installer/workflow-intent.js";
import {
  buildFeatureDevTaskFromGapAnalysis,
  buildSequentialParentContext,
} from "../installer/sequential-orchestration.js";

import type { RunInfo, StepInfo } from "../installer/status.js";
import { emitEvent, getRunEvents } from "../installer/events.js";
import { getMedicStatus, getRecentMedicChecks } from "../medic/medic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_HOST = "127.0.0.1";
const DASHBOARD_TOKEN_FILE = path.join(resolveShipPulseRoot(), "dashboard.token");
const DASHBOARD_CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

type StuckLevel = "warning" | "critical";
type StuckSignal = {
  stepId: string;
  agentId: string;
  ageSeconds: number;
  level: StuckLevel;
  causeHint?: string;
};

const STUCK_WARNING_SECONDS = readPositiveIntEnv("SHIPPULSE_STUCK_WARNING_SECONDS", 180);
const STUCK_CRITICAL_SECONDS = readPositiveIntEnv(
  "SHIPPULSE_STUCK_CRITICAL_SECONDS",
  Math.max(600, STUCK_WARNING_SECONDS + 60),
);
const STUCK_SIGNAL_DEDUPE_TTL_MS = readPositiveIntEnv("SHIPPULSE_STUCK_EVENT_TTL_SECONDS", 300) * 1000;
const emittedStuckSignals = new Map<string, { level: StuckLevel; emittedAt: number }>();

let cachedMutationToken: string | null = null;
let cachedMutationTokenSource: "env" | "file" | "generated" | null = null;

function parsePositiveIntQuery(value: string | null, fallback: number, max: number): number {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function getDashboardMutationToken(): string {
  const envToken = process.env.SHIPPULSE_DASHBOARD_TOKEN?.trim();
  if (envToken) {
    if (cachedMutationToken !== envToken || cachedMutationTokenSource !== "env") {
      cachedMutationToken = envToken;
      cachedMutationTokenSource = "env";
    }
    return envToken;
  }
  if (cachedMutationToken && cachedMutationTokenSource !== "env") return cachedMutationToken;

  try {
    const fileToken = fs.readFileSync(DASHBOARD_TOKEN_FILE, "utf-8").trim();
    if (fileToken) {
      cachedMutationToken = fileToken;
      cachedMutationTokenSource = "file";
      return fileToken;
    }
  } catch {
    // Token file missing or unreadable — generate below.
  }

  const generated = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(DASHBOARD_TOKEN_FILE), { recursive: true });
  fs.writeFileSync(DASHBOARD_TOKEN_FILE, `${generated}\n`, { encoding: "utf-8", mode: 0o600 });
  cachedMutationToken = generated;
  cachedMutationTokenSource = "generated";
  return generated;
}

function dashboardMutationTokenRequired(): boolean {
  return true;
}

function getDashboardConfig() {
  // Ensure a token exists before reporting metadata.
  getDashboardMutationToken();
  return {
    mutationAuthRequired: true,
    tokenSource: cachedMutationTokenSource ?? "env",
    tokenPath: cachedMutationTokenSource === "env" ? undefined : DASHBOARD_TOKEN_FILE,
  };
}

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

interface WorkflowDef {
  id: string;
  name: string;
  steps: Array<{ id: string; agent: string }>;
}

type NextPhaseSuggestion = {
  workflowId: string;
  label: string;
  reason: string;
  taskDraft: string;
};

function normalizeWorkflowText(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return fallback;
}

export function loadWorkflowsFromDir(dir: string): WorkflowDef[] {
  const results: WorkflowDef[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const ymlPath = path.join(dir, entry.name, "workflow.yml");
      if (!fs.existsSync(ymlPath)) continue;
      try {
        const parsed = YAML.parse(fs.readFileSync(ymlPath, "utf-8")) as {
          id?: unknown;
          name?: unknown;
          steps?: Array<{ id?: unknown; agent?: unknown }>;
        } | null;
        if (!parsed || typeof parsed !== "object") continue;
        const fallbackName = entry.name.trim() || entry.name;
        results.push({
          id: normalizeWorkflowText(parsed.id, fallbackName),
          name: normalizeWorkflowText(parsed.name, fallbackName),
          steps: Array.isArray(parsed.steps)
            ? parsed.steps.map((s) => ({ id: String(s?.id ?? ""), agent: String(s?.agent ?? "") }))
            : [],
        });
      } catch {
        // Skip malformed workflow files; don't hide other valid workflows.
        continue;
      }
    }
  } catch { /* empty */ }
  return results;
}

function loadWorkflows(): WorkflowDef[] {
  return loadWorkflowsFromDir(resolveBundledWorkflowsDir());
}

function parseRunContext(run: RunInfo): Record<string, unknown> {
  try {
    const parsed = JSON.parse(run.context) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyForTask(value: unknown, maxChars = 20_000): string {
  try {
    const text = JSON.stringify(value, null, 2);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}…`;
  } catch {
    return "";
  }
}

function hasWorkflow(workflows: WorkflowDef[], workflowId: string): boolean {
  return workflows.some((w) => w.id === workflowId);
}

function workflowDisplayName(workflows: WorkflowDef[], workflowId: string): string {
  const hit = workflows.find((w) => w.id === workflowId);
  return hit?.name || workflowId;
}

function buildNextPhaseSuggestion(
  run: RunInfo,
  artifacts: any,
  workflows: WorkflowDef[],
): NextPhaseSuggestion | null {
  const context = parseRunContext(run);
  const repo = typeof context.repo === "string" ? context.repo : "";

  if (run.workflow_id === "project-gap-analysis" && run.status === "completed") {
    const targetWorkflow = hasWorkflow(workflows, "feature-dev")
      ? "feature-dev"
      : (hasWorkflow(workflows, "idea-to-project") ? "idea-to-project" : "");
    if (!targetWorkflow) return null;

    return {
      workflowId: targetWorkflow,
      label: "Implement Missing Capabilities",
      reason: "Gap analysis is complete; the next phase is implementation of highest-priority missing features.",
      taskDraft: buildFeatureDevTaskFromGapAnalysis({
        sourceRunId: run.id,
        repo,
        artifacts: {
          epics: Array.isArray(artifacts?.epics) ? artifacts.epics : undefined,
          featuresByEpic: Array.isArray(artifacts?.featuresByEpic) ? artifacts.featuresByEpic : undefined,
          missingEpics: Array.isArray(artifacts?.missingEpics) ? artifacts.missingEpics : undefined,
          missingFeaturesByEpic: Array.isArray(artifacts?.missingFeaturesByEpic) ? artifacts.missingFeaturesByEpic : undefined,
          prioritizedGapBacklog: Array.isArray(artifacts?.prioritizedGapBacklog) ? artifacts.prioritizedGapBacklog : undefined,
        },
      }),
    };
  }

  if (run.workflow_id === "product-planning" && run.status === "completed") {
    if (!hasWorkflow(workflows, "feature-dev")) return null;
    const epics = Array.isArray(artifacts?.epics) ? artifacts.epics : [];
    const featuresByEpic = Array.isArray(artifacts?.featuresByEpic) ? artifacts.featuresByEpic : [];
    return {
      workflowId: "feature-dev",
      label: "Build Planned Features",
      reason: "Planning artifacts are ready; the next phase is implementation.",
      taskDraft: [
        "Implement the highest-priority planned features from this completed planning run.",
        repo ? `TARGET_REPO: ${repo}` : "",
        `SOURCE_RUN_ID: ${run.id}`,
        `EPICS_JSON:\n${stringifyForTask(epics)}`,
        `FEATURES_BY_EPIC_JSON:\n${stringifyForTask(featuresByEpic)}`,
      ].filter(Boolean).join("\n\n"),
    };
  }

  const recommendation = recommendWorkflowForTask(
    run.task,
    workflows.map((w) => w.id),
  );
  if (recommendation && recommendation.workflowId !== run.workflow_id) {
    return {
      workflowId: recommendation.workflowId,
      label: `Switch to ${workflowDisplayName(workflows, recommendation.workflowId)}`,
      reason: `This task better matches ${recommendation.workflowId}: ${recommendation.reason}`,
      taskDraft: run.task,
    };
  }

  return null;
}

function parseTimestamp(ts: string): Date {
  if (!ts) return new Date(0);
  const normalized = (!ts.includes("T") && ts.includes(" "))
    ? `${ts.replace(" ", "T")}Z`
    : ts;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function classifyCauseFromDetail(detail?: string): string | undefined {
  const raw = String(detail ?? "").trim();
  if (!raw) return undefined;
  if (/sessions?_spawn|spawn_error|pairing|pair required|pair required/i.test(raw)) {
    return "Spawn/session initialization error detected";
  }
  if (/\[missing:|unresolved token|missing context|placeholder|template/i.test(raw)) {
    return "Missing template/context value detected";
  }
  if (/timeout|abandon/i.test(raw)) {
    return "Prior timeout/abandonment signal detected";
  }
  if (/integrity guard|out-of-order|monotonic/i.test(raw)) {
    return "Step ordering integrity violation detected";
  }
  return raw.length > 140 ? `${raw.slice(0, 139)}…` : raw;
}

function likelyCauseHintForStep(runId: string, stepId: string): string | undefined {
  const events = getRunEvents(runId, 300);
  for (let i = events.length - 1; i >= 0; i--) {
    const evt = events[i];
    if (evt.stepId && evt.stepId !== stepId) continue;
    if (evt.event === "step.timeout" || evt.event === "step.failed" || evt.event === "step.integrity") {
      const cause = classifyCauseFromDetail(evt.detail);
      if (cause) return cause;
    }
  }
  return undefined;
}

function shouldEmitStuckSignal(key: string, level: StuckLevel, nowMs: number): boolean {
  const prev = emittedStuckSignals.get(key);
  if (!prev) return true;
  if (prev.level !== level) return true;
  return (nowMs - prev.emittedAt) >= STUCK_SIGNAL_DEDUPE_TTL_MS;
}

function updateStuckSignalCache(runId: string, activeKeys: Set<string>, nowMs: number): void {
  for (const [key] of emittedStuckSignals) {
    if (!key.startsWith(`${runId}:`)) continue;
    if (!activeKeys.has(key)) emittedStuckSignals.delete(key);
  }
  for (const [key, value] of emittedStuckSignals) {
    if ((nowMs - value.emittedAt) > (STUCK_SIGNAL_DEDUPE_TTL_MS * 4)) {
      emittedStuckSignals.delete(key);
    }
  }
}

function detectStuckSignals(run: RunInfo, steps: StepInfo[]): StuckSignal[] {
  if (run.status !== "running") return [];
  const nowMs = Date.now();
  const signals: StuckSignal[] = [];
  const activeKeys = new Set<string>();

  for (const step of steps) {
    if (step.status !== "running") continue;
    const ageSeconds = Math.max(0, Math.round((nowMs - parseTimestamp(step.updated_at).getTime()) / 1000));
    if (ageSeconds < STUCK_WARNING_SECONDS) continue;

    const level: StuckLevel = ageSeconds >= STUCK_CRITICAL_SECONDS ? "critical" : "warning";
    const causeHint = likelyCauseHintForStep(run.id, step.step_id);
    signals.push({
      stepId: step.step_id,
      agentId: step.agent_id,
      ageSeconds,
      level,
      causeHint,
    });

    const cacheKey = `${run.id}:${step.step_id}`;
    activeKeys.add(cacheKey);
    if (shouldEmitStuckSignal(cacheKey, level, nowMs)) {
      const ageMinutes = Math.max(1, Math.round(ageSeconds / 60));
      emitEvent({
        ts: new Date().toISOString(),
        event: "step.stuck",
        runId: run.id,
        workflowId: run.workflow_id,
        stepId: step.step_id,
        agentId: step.agent_id,
        detail: `${level.toUpperCase()}: step running for ${ageMinutes}m${causeHint ? ` — ${causeHint}` : ""}`,
      });
      emittedStuckSignals.set(cacheKey, { level, emittedAt: nowMs });
    }
  }

  updateStuckSignalCache(run.id, activeKeys, nowMs);
  signals.sort((a, b) => b.ageSeconds - a.ageSeconds);
  return signals;
}

function getRuns(workflowId?: string): Array<RunInfo & { steps: StepInfo[]; stuckSignals: StuckSignal[] }> {
  const db = getDb();
  const runs = workflowId
    ? db.prepare("SELECT * FROM runs WHERE workflow_id = ? ORDER BY created_at DESC").all(workflowId) as RunInfo[]
    : db.prepare("SELECT * FROM runs ORDER BY created_at DESC").all() as RunInfo[];
  return runs.map((r) => {
    const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(r.id) as StepInfo[];
    const stuckSignals = detectStuckSignals(r, steps);
    return { ...r, steps, stuckSignals };
  });
}

function getRunById(id: string): (RunInfo & { steps: StepInfo[]; stuckSignals: StuckSignal[] }) | null {
  const db = getDb();
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunInfo | undefined;
  if (!run) return null;
  const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(run.id) as StepInfo[];
  const stuckSignals = detectStuckSignals(run, steps);
  return { ...run, steps, stuckSignals };
}

function getStorySummary(runId: string): { total: number; done: number; failed: number } {
  const db = getDb();
  const row = db.prepare(
    `SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) as done,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed
    FROM stories WHERE run_id = ?`
  ).get(runId) as { total: number; done: number; failed: number };
  return row;
}

function baseDashboardUrl(req: http.IncomingMessage, port: number): string {
  void req;
  return `http://${DASHBOARD_HOST}:${port}`;
}

function buildSharePayload(run: RunInfo & { steps: StepInfo[] }, req: http.IncomingMessage, port: number) {
  const story = getStorySummary(run.id);
  const stepTotal = run.steps.length;
  const stepDone = run.steps.filter((s) => s.status === "done").length;
  const stepFailed = run.steps.filter((s) => s.status === "failed" || s.status === "error").length;
  const shareUrl = `${baseDashboardUrl(req, port)}/?run=${encodeURIComponent(run.id)}`;

  const parts = [
    "ShipPulse run recap",
    `Task: ${run.task}`,
    `Workflow: ${run.workflow_id}`,
    `Status: ${run.status}`,
    `Steps: ${stepDone}/${stepTotal} done${stepFailed > 0 ? `, ${stepFailed} failed` : ""}`,
    story.total > 0 ? `Stories: ${story.done}/${story.total} done${story.failed > 0 ? `, ${story.failed} failed` : ""}` : null,
    `Run ID: ${run.id}`,
    `Dashboard: ${shareUrl}`,
  ].filter(Boolean);

  return {
    runId: run.id,
    workflowId: run.workflow_id,
    status: run.status,
    stepSummary: { total: stepTotal, done: stepDone, failed: stepFailed },
    storySummary: story,
    shareUrl,
    shareText: parts.join("\n"),
  };
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function serveHTML(res: http.ServerResponse) {
  const htmlPath = path.join(__dirname, "index.html");
  // In dist, index.html won't exist—serve from src
  const srcHtmlPath = path.resolve(__dirname, "..", "..", "src", "server", "index.html");
  const filePath = fs.existsSync(htmlPath) ? htmlPath : srcHtmlPath;
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": DASHBOARD_CSP,
  });
  res.end(fs.readFileSync(filePath, "utf-8"));
}

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function readAuthToken(req: http.IncomingMessage): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.trim().length > 0) {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }
  const altHeader = req.headers["x-shippulse-token"];
  if (typeof altHeader === "string") return altHeader.trim();
  if (Array.isArray(altHeader)) return (altHeader[0] ?? "").trim();
  return "";
}

function mutationAuthError(res: http.ServerResponse): void {
  const sourceHint = cachedMutationTokenSource === "env"
    ? "Set SHIPPULSE_DASHBOARD_TOKEN and send it in Authorization: Bearer <token>."
    : `Read token from ${DASHBOARD_TOKEN_FILE} and send it in Authorization: Bearer <token>.`;
  json(
    res,
    { error: `Dashboard mutation token required. ${sourceHint}` },
    401,
  );
}

function requireMutationAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const expectedToken = getDashboardMutationToken();
  const providedToken = readAuthToken(req);
  if (!providedToken || !tokensMatch(expectedToken, providedToken)) {
    mutationAuthError(res);
    return false;
  }
  return true;
}

export function startDashboard(port = 3333): http.Server {
  return startDashboardWithDeps(port, { runWorkflowFn: runWorkflow });
}

type DashboardDeps = {
  runWorkflowFn?: typeof runWorkflow;
  stopWorkflowFn?: typeof stopWorkflow;
  resumeWorkflowFn?: typeof resumeWorkflow;
  retryFailedStoryFn?: typeof retryFailedStory;
  getPlanningArtifactsFn?: typeof getPlanningArtifacts;
};

export function startDashboardWithDeps(port = 3333, deps?: DashboardDeps): http.Server {
  const runWorkflowFn = deps?.runWorkflowFn ?? runWorkflow;
  const stopWorkflowFn = deps?.stopWorkflowFn ?? stopWorkflow;
  const resumeWorkflowFn = deps?.resumeWorkflowFn ?? resumeWorkflow;
  const retryFailedStoryFn = deps?.retryFailedStoryFn ?? retryFailedStory;
  const getPlanningArtifactsFn = deps?.getPlanningArtifactsFn ?? getPlanningArtifacts;
  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...SECURITY_HEADERS,
        "Allow": "GET, POST, OPTIONS",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const p = url.pathname;

    if (p === "/api/dashboard/config") {
      return json(res, getDashboardConfig());
    }

    if (p === "/api/workflows") {
      return json(res, loadWorkflows());
    }

    if (p === "/api/workflows/recommend") {
      if (req.method !== "GET") return json(res, { error: "method not allowed" }, 405);
      const task = url.searchParams.get("task")?.trim() ?? "";
      const selectedWorkflowId = url.searchParams.get("selectedWorkflowId")?.trim() ?? "";
      const workflowIds = loadWorkflows().map((wf) => wf.id);
      const recommendation = task ? recommendWorkflowForTask(task, workflowIds) : null;
      return json(res, {
        recommendation,
        selectedWorkflowId: selectedWorkflowId || undefined,
        mismatch: Boolean(recommendation && selectedWorkflowId && recommendation.workflowId !== selectedWorkflowId),
      });
    }

    const eventsMatch = p.match(/^\/api\/runs\/([^/]+)\/events$/);
    if (eventsMatch) {
      const limit = parsePositiveIntQuery(url.searchParams.get("limit"), 200, 5000);
      return json(res, getRunEvents(eventsMatch[1], limit));
    }

    const eventsStreamMatch = p.match(/^\/api\/runs\/([^/]+)\/events\/stream$/);
    if (eventsStreamMatch) {
      if (req.method !== "GET") return json(res, { error: "method not allowed" }, 405);
      const runId = eventsStreamMatch[1];
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      });
      res.write(": connected\n\n");

      let sent = 0;
      const flush = () => {
        const events = getRunEvents(runId, 400);
        if (sent > events.length) sent = 0;
        for (let i = sent; i < events.length; i++) {
          res.write(`event: run-event\n`);
          res.write(`data: ${JSON.stringify(events[i])}\n\n`);
        }
        sent = events.length;
      };

      flush();
      const interval = setInterval(() => {
        flush();
        res.write(": heartbeat\n\n");
      }, 1500);

      req.on("close", () => {
        clearInterval(interval);
        try { res.end(); } catch { /* noop */ }
      });
      return;
    }

    const storiesMatch = p.match(/^\/api\/runs\/([^/]+)\/stories$/);
    if (storiesMatch) {
      const db = getDb();
      const stories = db.prepare(
        "SELECT * FROM stories WHERE run_id = ? ORDER BY story_index ASC"
      ).all(storiesMatch[1]);
      return json(res, stories);
    }

    const artifactsMatch = p.match(/^\/api\/runs\/([^/]+)\/artifacts$/);
    if (artifactsMatch) {
      if (req.method !== "GET") return json(res, { error: "method not allowed" }, 405);
      const runId = artifactsMatch[1];
      return json(res, getPlanningArtifactsFn(runId) ?? {});
    }

    const nextPhaseMatch = p.match(/^\/api\/runs\/([^/]+)\/next-phase$/);
    if (nextPhaseMatch) {
      if (req.method !== "GET") return json(res, { error: "method not allowed" }, 405);
      const run = getRunById(nextPhaseMatch[1]);
      if (!run) return json(res, { error: "not found" }, 404);
      const workflows = loadWorkflows();
      const artifacts = getPlanningArtifactsFn(run.id) ?? {};
      const suggestion = buildNextPhaseSuggestion(run, artifacts, workflows);
      return json(res, { suggestion });
    }

    const shareMatch = p.match(/^\/api\/runs\/([^/]+)\/share$/);
    if (shareMatch) {
      if (req.method !== "GET") return json(res, { error: "method not allowed" }, 405);
      const run = getRunById(shareMatch[1]);
      if (!run) return json(res, { error: "not found" }, 404);
      emitEvent({
        ts: new Date().toISOString(),
        event: "run.share.clicked",
        runId: run.id,
        workflowId: run.workflow_id,
        detail: "dashboard",
      });
      return json(res, buildSharePayload(run, req, port));
    }

    const shareCopiedMatch = p.match(/^\/api\/runs\/([^/]+)\/share-copied$/);
    if (shareCopiedMatch) {
      if (req.method !== "POST") return json(res, { error: "method not allowed" }, 405);
      if (!requireMutationAuth(req, res)) return;
      const run = getRunById(shareCopiedMatch[1]);
      if (!run) return json(res, { error: "not found" }, 404);
      emitEvent({
        ts: new Date().toISOString(),
        event: "run.share.copied",
        runId: run.id,
        workflowId: run.workflow_id,
        detail: "dashboard",
      });
      return json(res, { ok: true });
    }

    const stopMatch = p.match(/^\/api\/runs\/([^/]+)\/stop$/);
    if (stopMatch) {
      if (req.method !== "POST") return json(res, { error: "method not allowed" }, 405);
      if (!requireMutationAuth(req, res)) return;
      const result = await stopWorkflowFn(stopMatch[1]);
      if (result.status === "ok") return json(res, result);
      if (result.status === "already_done") return json(res, result, 409);
      return json(res, result, 404);
    }

    const resumeMatch = p.match(/^\/api\/runs\/([^/]+)\/resume$/);
    if (resumeMatch) {
      if (req.method !== "POST") return json(res, { error: "method not allowed" }, 405);
      if (!requireMutationAuth(req, res)) return;
      const result = await resumeWorkflowFn(resumeMatch[1]);
      if (result.status === "ok") return json(res, result);
      if (result.status === "not_failed" || result.status === "no_failed_step") return json(res, result, 409);
      return json(res, result, 404);
    }

    const retryStoryMatch = p.match(/^\/api\/runs\/([^/]+)\/retry-story$/);
    if (retryStoryMatch) {
      if (req.method !== "POST") return json(res, { error: "method not allowed" }, 405);
      if (!requireMutationAuth(req, res)) return;
      const result = await retryFailedStoryFn(retryStoryMatch[1]);
      if (result.status === "ok") return json(res, result);
      if (result.status === "already_done" || result.status === "no_failed_story" || result.status === "invalid_state") {
        return json(res, result, 409);
      }
      return json(res, result, 404);
    }

    const runMatch = p.match(/^\/api\/runs\/(.+)$/);
    if (runMatch) {
      const run = getRunById(runMatch[1]);
      return run ? json(res, run) : json(res, { error: "not found" }, 404);
    }

    if (p === "/api/runs") {
      if (req.method === "GET" || !req.method) {
        const wf = url.searchParams.get("workflow") ?? undefined;
        return json(res, getRuns(wf));
      }

      if (req.method === "POST") {
        if (!requireMutationAuth(req, res)) return;
        try {
          const body = await readJsonBody(req);
          const workflowId = typeof body.workflowId === "string" ? body.workflowId.trim() : "";
          const taskTitle = typeof body.task === "string"
            ? body.task.trim()
            : (typeof body.taskTitle === "string" ? body.taskTitle.trim() : "");
          const notifyUrl = typeof body.notifyUrl === "string" ? body.notifyUrl.trim() : undefined;
          const noIntentGuard = body.noIntentGuard === true;
          const sequentialOrchestration = body.sequentialOrchestration === true;

          if (!workflowId) {
            return json(res, { error: "workflowId is required" }, 400);
          }
          if (!taskTitle) {
            return json(res, { error: "task is required" }, 400);
          }

          const workflowIds = loadWorkflows().map((wf) => wf.id);
          const recommendation = recommendWorkflowForTask(taskTitle, workflowIds);
          const shouldStartSequential =
            sequentialOrchestration &&
            workflowId === "feature-dev" &&
            recommendation?.workflowId === "project-gap-analysis";

          const run = await runWorkflowFn({
            workflowId: shouldStartSequential ? recommendation.workflowId : workflowId,
            taskTitle,
            notifyUrl,
            contextOverrides: shouldStartSequential ? buildSequentialParentContext(workflowId) : undefined,
          });
          const payload: Record<string, unknown> = { ...run };
          if (shouldStartSequential) {
            payload.orchestration = {
              mode: "sequential",
              entryWorkflowId: recommendation.workflowId,
              nextWorkflowId: workflowId,
              reason: recommendation.reason,
            };
          }
          if (recommendation && recommendation.workflowId !== workflowId) {
            payload.intentRecommendation = recommendation;
            if (!noIntentGuard && !shouldStartSequential) {
              payload.intentWarning =
                `Suggested workflow "${recommendation.workflowId}" (${recommendation.confidence}): ${recommendation.reason}`;
            }
          }
          return json(res, payload, 201);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return json(res, { error: message }, 400);
        }
      }

      return json(res, { error: "method not allowed" }, 405);
    }

    // Medic API
    if (p === "/api/medic/status") {
      return json(res, getMedicStatus());
    }

    if (p === "/api/medic/checks") {
      const limit = parsePositiveIntQuery(url.searchParams.get("limit"), 20, 500);
      return json(res, getRecentMedicChecks(limit));
    }

    // Serve fonts
    if (p.startsWith("/fonts/")) {
      const fontName = path.basename(p);
      const fontPath = path.resolve(__dirname, "..", "..", "assets", "fonts", fontName);
      const srcFontPath = path.resolve(__dirname, "..", "..", "src", "..", "assets", "fonts", fontName);
      const resolvedFont = fs.existsSync(fontPath) ? fontPath : srcFontPath;
      if (fs.existsSync(resolvedFont)) {
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": "font/woff2",
          "Cache-Control": "public, max-age=31536000",
        });
        return res.end(fs.readFileSync(resolvedFont));
      }
    }

    // Serve logo
    if (p === "/logo.jpeg") {
      const logoPath = path.resolve(__dirname, "..", "..", "assets", "logo.jpeg");
      const srcLogoPath = path.resolve(__dirname, "..", "..", "src", "..", "assets", "logo.jpeg");
      const resolvedLogo = fs.existsSync(logoPath) ? logoPath : srcLogoPath;
      if (fs.existsSync(resolvedLogo)) {
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        });
        return res.end(fs.readFileSync(resolvedLogo));
      }
    }

    // Serve frontend
    serveHTML(res);
  });

  server.listen(port, DASHBOARD_HOST, () => {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    console.log(`ShipPulse Dashboard: http://${DASHBOARD_HOST}:${boundPort}`);
    if (dashboardMutationTokenRequired()) {
      if (cachedMutationTokenSource === "env") {
        console.log("Dashboard mutation auth enabled (SHIPPULSE_DASHBOARD_TOKEN).");
      } else {
        console.log(`Dashboard mutation auth enabled (token file: ${DASHBOARD_TOKEN_FILE}).`);
      }
    }
  });

  return server;
}
