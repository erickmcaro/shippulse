import { createAgentCronJob, deleteAgentCronJobs, listCronJobs, checkCronToolAvailable } from "./gateway-api.js";
import type { ModelConfig, WorkflowSpec } from "./types.js";
import { resolveShipPulseCli } from "./paths.js";
import { getDb } from "../db.js";

const DEFAULT_EVERY_MS = 300_000; // 5 minutes
const DEFAULT_AGENT_TIMEOUT_SECONDS = 30 * 60; // 30 minutes
const DEFAULT_POLLING_TIMEOUT_SECONDS = 120;
const HEAVY_WORKFLOW_BASELINE_TIMEOUT_SECONDS = 240;
const MEDIUM_WORKFLOW_BASELINE_TIMEOUT_SECONDS = 180;
const MIN_POLLING_TIMEOUT_SECONDS = 60;
const MAX_POLLING_TIMEOUT_SECONDS = 15 * 60;
const HEAVY_WORKFLOW_IDS = new Set(["idea-to-project", "project-gap-analysis"]);
const FAILFAST_SPAWN_ERROR_ENABLED = process.env.SHIPPULSE_FAILFAST_SPAWN_ERROR?.trim() !== "0";

function buildAgentPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveShipPulseCli();

  return `You are an ShipPulse workflow agent. Check for pending work and execute it.

⚠️ CRITICAL: You MUST call "step complete" or "step fail" before ending your session. If you don't, the workflow will be stuck forever. This is non-negotiable.

Step 1 — Check for pending work:
\`\`\`
node ${cli} step claim "${fullAgentId}"
\`\`\`

If output is "NO_WORK", reply HEARTBEAT_OK and stop.

Step 2 — If JSON is returned, it contains: {"stepId": "...", "runId": "...", "input": "..."}
Save the stepId — you'll need it to report completion.
The "input" field contains your FULLY RESOLVED task instructions. Read it carefully and DO the work.

Step 3 — Do the work described in the input. Format your output with KEY: value lines as specified.

Step 4 — MANDATORY: Report completion (do this IMMEDIATELY after finishing the work):
\`\`\`
cat <<'SHIPPULSE_EOF' > /tmp/shippulse-step-output.txt
STATUS: done
CHANGES: what you did
TESTS: what tests you ran
SHIPPULSE_EOF
cat /tmp/shippulse-step-output.txt | node ${cli} step complete "<stepId>"
\`\`\`

If the work FAILED:
\`\`\`
node ${cli} step fail "<stepId>" "description of what went wrong"
\`\`\`

RULES:
1. NEVER end your session without calling step complete or step fail
2. Write output to a file first, then pipe via stdin (shell escaping breaks direct args)
3. If you're unsure whether to complete or fail, call step fail with an explanation

The workflow cannot advance until you report. Your session ending without reporting = broken pipeline.`;
}

export function buildWorkPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveShipPulseCli();

  return `You are an ShipPulse workflow agent. Execute the pending work below.

⚠️ CRITICAL: You MUST call "step complete" or "step fail" before ending your session. If you don't, the workflow will be stuck forever. This is non-negotiable.

The claimed step JSON is provided below. It contains: {"stepId": "...", "runId": "...", "input": "..."}
Save the stepId — you'll need it to report completion.
The "input" field contains your FULLY RESOLVED task instructions. Read it carefully and DO the work.

Do the work described in the input. Format your output with KEY: value lines as specified.

MANDATORY: Report completion (do this IMMEDIATELY after finishing the work):
\`\`\`
cat <<'SHIPPULSE_EOF' > /tmp/shippulse-step-output.txt
STATUS: done
CHANGES: what you did
TESTS: what tests you ran
SHIPPULSE_EOF
cat /tmp/shippulse-step-output.txt | node ${cli} step complete "<stepId>"
\`\`\`

If the work FAILED:
\`\`\`
node ${cli} step fail "<stepId>" "description of what went wrong"
\`\`\`

RULES:
1. NEVER end your session without calling step complete or step fail
2. Write output to a file first, then pipe via stdin (shell escaping breaks direct args)
3. If you're unsure whether to complete or fail, call step fail with an explanation

The workflow cannot advance until you report. Your session ending without reporting = broken pipeline.`;
}

function normalizeModel(model?: string | ModelConfig): string | undefined {
  const raw = typeof model === "string" ? model : model?.primary;
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase() === "default" ? undefined : trimmed;
}

function clampPollingTimeout(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_POLLING_TIMEOUT_SECONDS;
  const rounded = Math.round(seconds);
  if (rounded < MIN_POLLING_TIMEOUT_SECONDS) return MIN_POLLING_TIMEOUT_SECONDS;
  if (rounded > MAX_POLLING_TIMEOUT_SECONDS) return MAX_POLLING_TIMEOUT_SECONDS;
  return rounded;
}

function baselineTimeoutForWorkflow(workflow: WorkflowSpec): number {
  if (HEAVY_WORKFLOW_IDS.has(workflow.id)) return HEAVY_WORKFLOW_BASELINE_TIMEOUT_SECONDS;
  if (workflow.steps.length >= 6) return MEDIUM_WORKFLOW_BASELINE_TIMEOUT_SECONDS;
  return DEFAULT_POLLING_TIMEOUT_SECONDS;
}

function getAgentOverrideTimeout(agent: WorkflowSpec["agents"][number]): number | undefined {
  const raw = (agent as { pollingTimeoutSeconds?: number }).pollingTimeoutSeconds;
  if (raw === undefined || raw === null) return undefined;
  if (!Number.isFinite(raw)) return undefined;
  return Number(raw);
}

function getStepOverrideTimeout(workflow: WorkflowSpec, agentId: string): number | undefined {
  const overrides = workflow.steps
    .filter((step) => step.agent === agentId)
    .map((step) => Number((step as { pollingTimeoutSeconds?: number }).pollingTimeoutSeconds))
    .filter((timeout) => Number.isFinite(timeout) && timeout > 0);
  if (overrides.length === 0) return undefined;
  return Math.max(...overrides);
}

/**
 * Polling timeout precedence:
 * 1) step-level override (max for this agent's steps)
 * 2) agent-level override
 * 3) workflow-level override
 * 4) adaptive baseline by workflow class
 */
export function resolvePollingTimeoutSeconds(workflow: WorkflowSpec, agentId: string): number {
  const agent = workflow.agents.find((a) => a.id === agentId);
  const fromStep = getStepOverrideTimeout(workflow, agentId);
  const fromAgent = agent ? getAgentOverrideTimeout(agent) : undefined;
  const fromWorkflow = workflow.polling?.timeoutSeconds;
  const chosen = fromStep ?? fromAgent ?? fromWorkflow ?? baselineTimeoutForWorkflow(workflow);
  return clampPollingTimeout(chosen);
}

export function buildPollingPrompt(workflowId: string, agentId: string, workModel?: string | ModelConfig): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveShipPulseCli();
  const model = normalizeModel(workModel);
  const workPrompt = buildWorkPrompt(workflowId, agentId);
  const spawnModelLine = model
    ? `- model: "${model}"`
    : "- model: omit this field so OpenClaw resolves the configured default model";
  const failFastSpawnSection = FAILFAST_SPAWN_ERROR_ENABLED
    ? `If sessions_spawn returns any error (example: pairing required), you MUST fail the claimed step in the same turn:
\`\`\`
node ${cli} step fail "<stepId>" "spawn_error: <exact sessions_spawn error>"
\`\`\`
Then reply SPAWN_FAILED with stepId and exact reason. Never leave a claimed step running after spawn failure.`
    : "If sessions_spawn fails, report the failure clearly before ending the turn.";

  return `Step 1 — Quick check for pending work (lightweight, no side effects):
\`\`\`
node ${cli} step peek "${fullAgentId}"
\`\`\`
If output is "NO_WORK", reply HEARTBEAT_OK and stop immediately. Do NOT run step claim.

Step 2 — If "HAS_WORK", claim the step:
\`\`\`
node ${cli} step claim "${fullAgentId}"
\`\`\`
If output is "NO_WORK", reply HEARTBEAT_OK and stop.

If JSON is returned, parse it to extract stepId, runId, and input fields.
Then call sessions_spawn with these parameters:
- agentId: "${fullAgentId}"
${spawnModelLine}
- task: The full work prompt below, followed by "\\n\\nCLAIMED STEP JSON:\\n" and the exact JSON output from step claim.

Full work prompt to include in the spawned task:
---START WORK PROMPT---
${workPrompt}
---END WORK PROMPT---

${failFastSpawnSection}

Reply with a short summary of what you spawned.`;
}

export async function setupAgentCrons(workflow: WorkflowSpec): Promise<void> {
  const agents = workflow.agents;
  // Allow per-workflow cron interval via cron.interval_ms in workflow.yml
  const everyMs = (workflow as any).cron?.interval_ms ?? DEFAULT_EVERY_MS;

  // Resolve polling model: per-agent > workflow-level; omit "default" so OpenClaw resolves it.
  const workflowPollingModel = normalizeModel(workflow.polling?.model);

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const anchorMs = i * 60_000; // stagger by 1 minute each
    const cronName = `shippulse/${workflow.id}/${agent.id}`;
    const agentId = `${workflow.id}_${agent.id}`;

    // Two-phase: Phase 1 uses cheap polling model + minimal prompt
    const pollingModel = normalizeModel(agent.pollingModel) ?? workflowPollingModel;
    const workModel = agent.model; // Phase 2 model (passed to sessions_spawn via prompt)
    const prompt = buildPollingPrompt(workflow.id, agent.id, workModel);
    const timeoutSeconds = resolvePollingTimeoutSeconds(workflow, agent.id);

    const result = await createAgentCronJob({
      name: cronName,
      schedule: { kind: "every", everyMs, anchorMs },
      sessionTarget: "isolated",
      agentId,
      payload: { kind: "agentTurn", message: prompt, model: pollingModel, timeoutSeconds },
      delivery: { mode: "none" },
      enabled: true,
    });

    if (!result.ok) {
      throw new Error(`Failed to create cron job for agent "${agent.id}": ${result.error}`);
    }
  }
}

export async function removeAgentCrons(workflowId: string): Promise<void> {
  await deleteAgentCronJobs(`shippulse/${workflowId}/`);
}

// ── Run-scoped cron lifecycle ───────────────────────────────────────

/**
 * Count active (running) runs for a given workflow.
 */
function countActiveRuns(workflowId: string): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM runs WHERE workflow_id = ? AND status = 'running'"
  ).get(workflowId) as { cnt: number };
  return row.cnt;
}

/**
 * Check if crons already exist for a workflow.
 */
async function workflowCronsExist(workflowId: string): Promise<boolean> {
  const result = await listCronJobs();
  if (!result.ok || !result.jobs) return false;
  const prefix = `shippulse/${workflowId}/`;
  return result.jobs.some((j) => j.name.startsWith(prefix));
}

/**
 * Start crons for a workflow when a run begins.
 * No-ops if crons already exist (another run of the same workflow is active).
 */
export async function ensureWorkflowCrons(workflow: WorkflowSpec): Promise<void> {
  if (await workflowCronsExist(workflow.id)) return;

  // Preflight: verify cron tool is accessible before attempting to create jobs
  const preflight = await checkCronToolAvailable();
  if (!preflight.ok) {
    throw new Error(preflight.error!);
  }

  await setupAgentCrons(workflow);
}

/**
 * Tear down crons for a workflow when a run ends.
 * Only removes if no other active runs exist for this workflow.
 */
export async function teardownWorkflowCronsIfIdle(workflowId: string): Promise<void> {
  const active = countActiveRuns(workflowId);
  if (active > 0) return;
  await removeAgentCrons(workflowId);
}
