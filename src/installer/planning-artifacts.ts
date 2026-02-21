import { getDb } from "../db.js";

export type PlanningArtifacts = {
  epics?: unknown[];
  features?: unknown[];
  featuresByEpic?: unknown[];
  stories?: unknown[];
  missingEpics?: unknown[];
  missingFeaturesByEpic?: unknown[];
  prioritizedGapBacklog?: unknown[];
  updatedAt: string;
};

function extractBalancedJson(text: string, startIdx: number): unknown | null {
  const first = text[startIdx];
  if (first !== "{" && first !== "[") return null;
  const stack = [first];
  let inString = false;
  let escaped = false;

  for (let i = startIdx + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      const open = stack.pop();
      if (!open) return null;
      if ((open === "{" && ch !== "}") || (open === "[" && ch !== "]")) return null;
      if (stack.length === 0) {
        const candidate = text.slice(startIdx, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function extractLabeledJson(output: string, label: string): unknown | null {
  const idx = output.indexOf(label);
  if (idx === -1) return null;
  for (let i = idx + label.length; i < output.length; i++) {
    const ch = output[i];
    if (ch === "{" || ch === "[") {
      return extractBalancedJson(output, i);
    }
    if (!/\s/.test(ch)) break;
  }
  return null;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

export function parsePlanningArtifactsFromOutput(output: string): Partial<PlanningArtifacts> {
  const epics = asArray(extractLabeledJson(output, "EPICS_JSON:"));
  const features = asArray(extractLabeledJson(output, "FEATURES_JSON:"));
  const featuresByEpic = asArray(extractLabeledJson(output, "FEATURES_BY_EPIC_JSON:"));
  const stories = asArray(extractLabeledJson(output, "STORIES_JSON:"));
  const missingEpics = asArray(extractLabeledJson(output, "MISSING_EPICS_JSON:"));
  const missingFeaturesByEpic = asArray(extractLabeledJson(output, "MISSING_FEATURES_BY_EPIC_JSON:"));
  const prioritizedGapBacklog = asArray(extractLabeledJson(output, "PRIORITIZED_GAP_BACKLOG_JSON:"));

  const out: Partial<PlanningArtifacts> = {};
  if (epics) out.epics = epics;
  else if (missingEpics) out.epics = missingEpics;
  if (features) out.features = features;
  if (featuresByEpic) out.featuresByEpic = featuresByEpic;
  else if (missingFeaturesByEpic) out.featuresByEpic = missingFeaturesByEpic;
  if (stories) out.stories = stories;
  if (missingEpics) out.missingEpics = missingEpics;
  if (missingFeaturesByEpic) out.missingFeaturesByEpic = missingFeaturesByEpic;
  if (prioritizedGapBacklog) out.prioritizedGapBacklog = prioritizedGapBacklog;
  return out;
}

function parseArtifacts(raw: string | null | undefined): PlanningArtifacts | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlanningArtifacts;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseArrayContext(raw: unknown): unknown[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function contextFallbackArtifacts(runId: string): PlanningArtifacts | null {
  const db = getDb();
  const row = db.prepare("SELECT context FROM runs WHERE id = ?").get(runId) as { context: string } | undefined;
  if (!row) return null;
  let context: Record<string, unknown>;
  try {
    context = JSON.parse(row.context) as Record<string, unknown>;
  } catch {
    return null;
  }
  const epics = parseArrayContext(context.epics_json);
  const features = parseArrayContext(context.features_json);
  const featuresByEpic = parseArrayContext(context.features_by_epic_json);
  const stories = parseArrayContext(context.stories_json);
  const missingEpics = parseArrayContext(context.missing_epics_json);
  const missingFeaturesByEpic = parseArrayContext(context.missing_features_by_epic_json);
  const prioritizedGapBacklog = parseArrayContext(context.prioritized_gap_backlog_json);
  if (!epics && !features && !featuresByEpic && !stories && !missingEpics && !missingFeaturesByEpic && !prioritizedGapBacklog) return null;
  return {
    epics: epics ?? missingEpics,
    features,
    featuresByEpic: featuresByEpic ?? missingFeaturesByEpic,
    stories,
    missingEpics,
    missingFeaturesByEpic,
    prioritizedGapBacklog,
    updatedAt: new Date().toISOString(),
  };
}

export function getPlanningArtifacts(runId: string): PlanningArtifacts | null {
  const db = getDb();
  const row = db.prepare("SELECT planning_artifacts FROM runs WHERE id = ?").get(runId) as { planning_artifacts: string | null } | undefined;
  if (!row) return null;
  const parsed = parseArtifacts(row.planning_artifacts);
  if (parsed) return parsed;
  return contextFallbackArtifacts(runId);
}

export function updatePlanningArtifactsFromOutput(runId: string, output: string): PlanningArtifacts | null {
  const delta = parsePlanningArtifactsFromOutput(output);
  if (Object.keys(delta).length === 0) return null;

  const db = getDb();
  const existing = getPlanningArtifacts(runId);
  const merged: PlanningArtifacts = {
    ...(existing ?? { updatedAt: new Date().toISOString() }),
    ...delta,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    "UPDATE runs SET planning_artifacts = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(merged), runId);

  return merged;
}
