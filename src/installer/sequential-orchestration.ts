export const ORCHESTRATION_MODE_KEY = "orchestration_mode";
export const ORCHESTRATION_MODE_SEQUENTIAL = "sequential";
export const ORCHESTRATION_STATE_KEY = "orchestration_state";
export const ORCHESTRATION_STATE_PENDING = "pending";
export const ORCHESTRATION_STATE_LAUNCHING = "launching";
export const ORCHESTRATION_STATE_LAUNCHED = "launched";
export const ORCHESTRATION_STATE_FAILED = "failed";
export const ORCHESTRATION_NEXT_WORKFLOW_KEY = "orchestration_next_workflow";
export const ORCHESTRATION_CHILD_RUN_ID_KEY = "orchestration_child_run_id";
export const ORCHESTRATION_ERROR_KEY = "orchestration_error";
export const ORCHESTRATION_LAUNCHED_AT_KEY = "orchestration_launched_at";
export const ORCHESTRATION_PARENT_RUN_ID_KEY = "orchestration_parent_run_id";
export const ORCHESTRATION_PARENT_WORKFLOW_ID_KEY = "orchestration_parent_workflow_id";

type GapArtifacts = {
  epics?: unknown[];
  featuresByEpic?: unknown[];
  missingEpics?: unknown[];
  missingFeaturesByEpic?: unknown[];
  prioritizedGapBacklog?: unknown[];
};

function stringifyForTask(value: unknown, maxChars = 20_000): string {
  try {
    const text = JSON.stringify(value, null, 2);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}...`;
  } catch {
    return "";
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseRunContext(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function buildSequentialParentContext(nextWorkflowId: string): Record<string, string> {
  return {
    [ORCHESTRATION_MODE_KEY]: ORCHESTRATION_MODE_SEQUENTIAL,
    [ORCHESTRATION_STATE_KEY]: ORCHESTRATION_STATE_PENDING,
    [ORCHESTRATION_NEXT_WORKFLOW_KEY]: nextWorkflowId,
  };
}

export function buildSequentialChildContext(parentRunId: string, parentWorkflowId: string): Record<string, string> {
  return {
    [ORCHESTRATION_PARENT_RUN_ID_KEY]: parentRunId,
    [ORCHESTRATION_PARENT_WORKFLOW_ID_KEY]: parentWorkflowId,
  };
}

export function isSequentialPending(context: Record<string, string>): boolean {
  if (context[ORCHESTRATION_MODE_KEY] !== ORCHESTRATION_MODE_SEQUENTIAL) return false;
  const state = context[ORCHESTRATION_STATE_KEY] ?? ORCHESTRATION_STATE_PENDING;
  return state === ORCHESTRATION_STATE_PENDING;
}

export function buildFeatureDevTaskFromGapAnalysis(params: {
  sourceRunId: string;
  repo?: string;
  artifacts: GapArtifacts | null | undefined;
}): string {
  const artifacts = params.artifacts ?? {};
  const missingEpics = asArray(artifacts.missingEpics).length > 0
    ? asArray(artifacts.missingEpics)
    : asArray(artifacts.epics);
  const missingFeaturesByEpic = asArray(artifacts.missingFeaturesByEpic).length > 0
    ? asArray(artifacts.missingFeaturesByEpic)
    : asArray(artifacts.featuresByEpic);
  const prioritizedBacklog = asArray(artifacts.prioritizedGapBacklog);

  const sections = [
    params.repo ? `TARGET_REPO: ${params.repo}` : "",
    `SOURCE_RUN_ID: ${params.sourceRunId}`,
    "MISSING_EPICS_JSON:",
    stringifyForTask(missingEpics),
    "MISSING_FEATURES_BY_EPIC_JSON:",
    stringifyForTask(missingFeaturesByEpic),
    prioritizedBacklog.length
      ? `PRIORITIZED_GAP_BACKLOG_JSON:\n${stringifyForTask(prioritizedBacklog)}`
      : "",
  ].filter(Boolean);

  return [
    "Implement the highest-priority missing feature set from the completed gap analysis.",
    "Start with P1 items, keep scope tight, and deliver production-ready code plus tests.",
    "",
    ...sections,
  ].join("\n");
}
