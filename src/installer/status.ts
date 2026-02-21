import { getDb } from "../db.js";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import { emitEvent } from "./events.js";

export type RunInfo = {
  id: string;
  run_number: number | null;
  workflow_id: string;
  task: string;
  status: string;
  context: string;
  created_at: string;
  updated_at: string;
};

export type StepInfo = {
  id: string;
  run_id: string;
  step_id: string;
  agent_id: string;
  step_index: number;
  input_template: string;
  expects: string;
  status: string;
  output: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
};

export type WorkflowStatusResult =
  | { status: "ok"; run: RunInfo; steps: StepInfo[] }
  | { status: "not_found"; message: string };

export function getWorkflowStatus(query: string): WorkflowStatusResult {
  const db = getDb();

  // Try run number first (pure digits)
  let run: RunInfo | undefined;
  if (/^\d+$/.test(query)) {
    run = db.prepare("SELECT * FROM runs WHERE run_number = ? LIMIT 1").get(parseInt(query, 10)) as RunInfo | undefined;
  }

  // Try exact task match, then substring match
  if (!run) {
    run = db.prepare("SELECT * FROM runs WHERE LOWER(task) = LOWER(?) ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
  }

  if (!run) {
    run = db.prepare("SELECT * FROM runs WHERE LOWER(task) LIKE '%' || LOWER(?) || '%' ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
  }

  // Also try matching by run ID (prefix or full)
  if (!run) {
    run = db.prepare("SELECT * FROM runs WHERE id LIKE ? || '%' ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
  }

  if (!run) {
    const allRuns = db.prepare("SELECT id, run_number, task, status, created_at FROM runs ORDER BY created_at DESC LIMIT 20").all() as Array<{ id: string; run_number: number | null; task: string; status: string; created_at: string }>;
    const available = allRuns.map((r) => {
      const num = r.run_number != null ? `#${r.run_number}` : r.id.slice(0, 8);
      return `  [${r.status}] ${num.padEnd(6)} ${r.task.slice(0, 60)}`;
    });
    return {
      status: "not_found",
      message: available.length
        ? `No run matching "${query}". Recent runs:\n${available.join("\n")}`
        : "No workflow runs found.",
    };
  }

  const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(run.id) as StepInfo[];
  return { status: "ok", run, steps };
}

export function getWorkflowStatusJson(
  query: string,
  storiesFn?: (runId: string) => Array<{ storyId: string; status: string; title: string }>,
): Record<string, unknown> {
  const result = getWorkflowStatus(query);
  if (result.status === "not_found") {
    return { status: "not_found", message: result.message };
  }

  const { run, steps } = result;
  const payload: Record<string, unknown> = {
    runId: run.id,
    runNumber: run.run_number ?? undefined,
    workflow: run.workflow_id,
    task: run.task,
    status: run.status,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    steps: steps.map((s) => ({ name: s.step_id, status: s.status, agent: s.agent_id })),
  };

  if (storiesFn) {
    const stories = storiesFn(run.id);
    if (stories.length > 0) {
      const done = stories.filter((s) => s.status === "done").length;
      const running = stories.filter((s) => s.status === "running").length;
      const failed = stories.filter((s) => s.status === "failed").length;
      payload.storySummary = { total: stories.length, done, running, failed };
      payload.stories = stories.map((s) => ({ id: s.storyId, status: s.status, title: s.title }));
    }
  }

  return payload;
}

export function listRuns(): RunInfo[] {
  const db = getDb();
  return db.prepare("SELECT * FROM runs ORDER BY created_at DESC").all() as RunInfo[];
}

export type StopWorkflowResult =
  | { status: "ok"; runId: string; workflowId: string; cancelledSteps: number; warning?: string }
  | { status: "not_found"; message: string }
  | { status: "already_done"; message: string };

function findRunByQuery(query: string): RunInfo | undefined {
  const db = getDb();

  if (/^\d+$/.test(query)) {
    const byNumber = db.prepare("SELECT * FROM runs WHERE run_number = ? LIMIT 1").get(parseInt(query, 10)) as RunInfo | undefined;
    if (byNumber) return byNumber;
  }

  let run = db.prepare("SELECT * FROM runs WHERE id = ?").get(query) as RunInfo | undefined;
  if (!run) {
    run = db.prepare("SELECT * FROM runs WHERE id LIKE ? || '%' ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
  }
  return run;
}

function notFoundMessage(query: string): string {
  const db = getDb();
  const allRuns = db.prepare("SELECT id, task, status, created_at FROM runs ORDER BY created_at DESC LIMIT 20").all() as Array<{ id: string; task: string; status: string; created_at: string }>;
  const available = allRuns.map((r) => `  [${r.status}] ${r.id.slice(0, 8)} ${r.task.slice(0, 60)}`);
  return available.length
    ? `No run matching "${query}". Recent runs:\n${available.join("\n")}`
    : "No workflow runs found.";
}

function resetDownstreamForResume(runId: string, failedStepId: string): number {
  const db = getDb();
  const failedStep = db.prepare(
    "SELECT step_index FROM steps WHERE id = ? AND run_id = ?",
  ).get(failedStepId, runId) as { step_index: number } | undefined;
  if (!failedStep) return 0;

  const rows = db.prepare(
    "SELECT id FROM steps WHERE run_id = ? AND step_index > ? AND status IN ('running', 'pending', 'done')",
  ).all(runId, failedStep.step_index) as Array<{ id: string }>;
  if (rows.length === 0) return 0;

  const resetStmt = db.prepare(
    "UPDATE steps SET status = 'waiting', output = NULL, current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?",
  );
  for (const row of rows) {
    resetStmt.run(row.id);
  }
  return rows.length;
}

export async function stopWorkflow(query: string): Promise<StopWorkflowResult> {
  const db = getDb();

  const run = findRunByQuery(query);

  if (!run) {
    return {
      status: "not_found",
      message: notFoundMessage(query),
    };
  }

  if (run.status === "completed" || run.status === "cancelled") {
    return {
      status: "already_done",
      message: `Run ${run.id.slice(0, 8)} is already "${run.status}".`,
    };
  }

  // Set run status to cancelled
  db.prepare("UPDATE runs SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(run.id);

  // Update all non-done steps to failed
  const result = db.prepare(
    "UPDATE steps SET status = 'failed', output = 'Cancelled by user', updated_at = datetime('now') WHERE run_id = ? AND status IN ('waiting', 'pending', 'running')"
  ).run(run.id);
  const cancelledSteps = Number(result.changes);

  // Clean up cron jobs if no other active runs
  let warning: string | undefined;
  try {
    await teardownWorkflowCronsIfIdle(run.workflow_id);
  } catch (err) {
    warning = err instanceof Error ? err.message : String(err);
  }

  // Emit event
  emitEvent({
    ts: new Date().toISOString(),
    event: "run.cancelled",
    runId: run.id,
    workflowId: run.workflow_id,
    detail: "Cancelled by user",
  });

  return {
    status: "ok",
    runId: run.id,
    workflowId: run.workflow_id,
    cancelledSteps,
    warning,
  };
}

async function ensureWorkflowCronsForResume(workflowId: string): Promise<string | null> {
  try {
    const { loadWorkflowSpec } = await import("./workflow-spec.js");
    const { resolveWorkflowDir } = await import("./paths.js");
    const { ensureWorkflowCrons } = await import("./agent-cron.js");
    const workflowDir = resolveWorkflowDir(workflowId);
    const workflow = await loadWorkflowSpec(workflowDir);
    await ensureWorkflowCrons(workflow);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export type ResumeWorkflowResult =
  | { status: "ok"; runId: string; workflowId: string; message: string; warning?: string }
  | { status: "not_found"; message: string }
  | { status: "not_failed"; message: string }
  | { status: "no_failed_step"; message: string };

export async function resumeWorkflow(query: string): Promise<ResumeWorkflowResult> {
  const db = getDb();
  const run = findRunByQuery(query);

  if (!run) {
    return { status: "not_found", message: notFoundMessage(query) };
  }
  if (run.status !== "failed") {
    return {
      status: "not_failed",
      message: `Run ${run.id.slice(0, 8)} is "${run.status}", not "failed".`,
    };
  }

  const failedStep = db.prepare(
    "SELECT id, step_id, type, current_story_id FROM steps WHERE run_id = ? AND status = 'failed' ORDER BY step_index ASC LIMIT 1"
  ).get(run.id) as { id: string; step_id: string; type: string; current_story_id: string | null } | undefined;

  if (!failedStep) {
    return {
      status: "no_failed_step",
      message: `No failed step found in run ${run.id.slice(0, 8)}.`,
    };
  }

  const downstreamReset = resetDownstreamForResume(run.id, failedStep.id);
  if (downstreamReset > 0) {
    emitEvent({
      ts: new Date().toISOString(),
      event: "step.integrity",
      runId: run.id,
      workflowId: run.workflow_id,
      stepId: failedStep.step_id,
      detail: `Resume reset ${downstreamReset} downstream step(s) to waiting before reopening failed step`,
    });
  }

  if (failedStep.type === "loop") {
    const failedStory = db.prepare(
      "SELECT id FROM stories WHERE run_id = ? AND status = 'failed' ORDER BY story_index ASC LIMIT 1"
    ).get(run.id) as { id: string } | undefined;
    if (failedStory) {
      db.prepare(
        "UPDATE stories SET status = 'pending', updated_at = datetime('now') WHERE id = ?"
      ).run(failedStory.id);
    }
    db.prepare(
      "UPDATE steps SET retry_count = 0 WHERE run_id = ? AND type = 'loop'"
    ).run(run.id);
  }

  const loopStep = db.prepare(
    "SELECT id, loop_config FROM steps WHERE run_id = ? AND type = 'loop' AND status IN ('running', 'failed') LIMIT 1"
  ).get(run.id) as { id: string; loop_config: string | null } | undefined;

  let message: string;
  if (loopStep?.loop_config) {
    try {
      const lc = JSON.parse(loopStep.loop_config) as { verifyEach?: boolean; verifyStep?: string };
      if (lc.verifyEach && lc.verifyStep === failedStep.step_id) {
        db.prepare(
          "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
        ).run(loopStep.id);
        db.prepare(
          "UPDATE steps SET status = 'waiting', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
        ).run(failedStep.id);
        db.prepare(
          "UPDATE stories SET status = 'pending', updated_at = datetime('now') WHERE run_id = ? AND status = 'failed'"
        ).run(run.id);
        message = `Resumed run ${run.id.slice(0, 8)} — loop step reset to pending and verify step to waiting.`;
      } else {
        db.prepare(
          "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
        ).run(failedStep.id);
        message = `Resumed run ${run.id.slice(0, 8)} from step "${failedStep.step_id}".`;
      }
    } catch {
      db.prepare(
        "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
      ).run(failedStep.id);
      message = `Resumed run ${run.id.slice(0, 8)} from step "${failedStep.step_id}".`;
    }
  } else {
    db.prepare(
      "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(failedStep.id);
    message = `Resumed run ${run.id.slice(0, 8)} from step "${failedStep.step_id}".`;
  }

  db.prepare(
    "UPDATE runs SET status = 'running', updated_at = datetime('now') WHERE id = ?"
  ).run(run.id);

  const warning = await ensureWorkflowCronsForResume(run.workflow_id);
  const downstreamSuffix = downstreamReset > 0
    ? ` Downstream reset: ${downstreamReset} step(s) moved to waiting.`
    : "";
  return {
    status: "ok",
    runId: run.id,
    workflowId: run.workflow_id,
    message: `${message}${downstreamSuffix}`,
    warning: warning ?? undefined,
  };
}

export type RetryFailedStoryResult =
  | { status: "ok"; runId: string; workflowId: string; storyId: string; message: string; warning?: string }
  | { status: "not_found"; message: string }
  | { status: "already_done"; message: string }
  | { status: "no_failed_story"; message: string };

export async function retryFailedStory(query: string): Promise<RetryFailedStoryResult> {
  const db = getDb();
  const run = findRunByQuery(query);

  if (!run) {
    return { status: "not_found", message: notFoundMessage(query) };
  }
  if (run.status === "completed" || run.status === "cancelled") {
    return {
      status: "already_done",
      message: `Run ${run.id.slice(0, 8)} is "${run.status}" and cannot retry stories.`,
    };
  }

  const story = db.prepare(
    "SELECT id, story_id, title FROM stories WHERE run_id = ? AND status = 'failed' ORDER BY story_index ASC LIMIT 1"
  ).get(run.id) as { id: string; story_id: string; title: string } | undefined;

  if (!story) {
    return {
      status: "no_failed_story",
      message: `No failed stories found in run ${run.id.slice(0, 8)}.`,
    };
  }

  db.prepare(
    "UPDATE stories SET status = 'pending', retry_count = 0, updated_at = datetime('now') WHERE id = ?"
  ).run(story.id);

  const loopStep = db.prepare(
    "SELECT id, step_id, loop_config FROM steps WHERE run_id = ? AND type = 'loop' ORDER BY step_index ASC LIMIT 1"
  ).get(run.id) as { id: string; step_id: string; loop_config: string | null } | undefined;

  if (loopStep) {
    db.prepare(
      "UPDATE steps SET status = 'pending', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(loopStep.id);
    if (loopStep.loop_config) {
      try {
        const lc = JSON.parse(loopStep.loop_config) as { verifyEach?: boolean; verifyStep?: string };
        if (lc.verifyEach && lc.verifyStep) {
          db.prepare(
            "UPDATE steps SET status = 'waiting', current_story_id = NULL, retry_count = 0, updated_at = datetime('now') WHERE run_id = ? AND step_id = ?"
          ).run(run.id, lc.verifyStep);
        }
      } catch {
        // best-effort
      }
    }
  }

  db.prepare(
    "UPDATE runs SET status = 'running', updated_at = datetime('now') WHERE id = ?"
  ).run(run.id);

  emitEvent({
    ts: new Date().toISOString(),
    event: "story.retry",
    runId: run.id,
    workflowId: run.workflow_id,
    stepId: loopStep?.step_id,
    storyId: story.story_id,
    storyTitle: story.title,
    detail: "Manual retry requested",
  });

  const warning = await ensureWorkflowCronsForResume(run.workflow_id);
  return {
    status: "ok",
    runId: run.id,
    workflowId: run.workflow_id,
    storyId: story.story_id,
    message: `Story ${story.story_id} reset to pending.`,
    warning: warning ?? undefined,
  };
}
