export type WorkflowIntentRecommendation = {
  workflowId: string;
  reason: string;
  confidence: "high" | "medium";
};

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function available(availableWorkflowIds: string[], workflowId: string): boolean {
  return availableWorkflowIds.includes(workflowId);
}

export function recommendWorkflowForTask(
  taskTitle: string,
  availableWorkflowIds: string[],
): WorkflowIntentRecommendation | null {
  const text = normalizeText(taskTitle);
  if (!text) return null;

  const looksLikeFeatureImplementation =
    hasAny(text, [
      /\bimplement\b/,
      /\bbuild\b/,
      /\bdevelop\b/,
      /\bship\b/,
      /\bdeliver\b/,
      /\bcode\b/,
      /\bproduction-ready\b/,
    ]) &&
    hasAny(text, [
      /\bfeatures?\b/,
      /\bstories?\b/,
      /\bepics?\b/,
      /\bmissing\b/,
      /\bsource_run_id\b/,
      /\bmissing_epics_json\b/,
      /\bmissing_features_by_epic_json\b/,
      /\bprioritized_gap_backlog_json\b/,
      /\bfeatures_by_epic_json\b/,
    ]);
  if (looksLikeFeatureImplementation && available(availableWorkflowIds, "feature-dev")) {
    return {
      workflowId: "feature-dev",
      reason: "Task is implementation-focused and references planned/missing feature artifacts.",
      confidence: "high",
    };
  }

  const looksLikeGapAnalysis = hasAny(text, [
    /\bgap analysis\b/,
    /\bmissing epics?\b/,
    /\bmissing features?\b/,
    /\banaly[sz]e (the )?(repo|repository|codebase)\b/,
    /\boutput only missing\b/,
    /\bcurrent capability\b/,
  ]);
  if (looksLikeGapAnalysis && available(availableWorkflowIds, "project-gap-analysis")) {
    return {
      workflowId: "project-gap-analysis",
      reason: "Task asks for repository gap analysis and missing epics/features output.",
      confidence: "high",
    };
  }

  const looksLikePlanningOnly =
    hasAny(text, [/\bepics?\b/, /\bfeatures?\b/, /\broadmap\b/, /\bplan\b/, /\bbacklog\b/]) &&
    !hasAny(text, [/\bimplement\b/, /\bcode\b/, /\bbuild\b/, /\bfix\b/, /\bdeploy\b/]);
  if (looksLikePlanningOnly && available(availableWorkflowIds, "product-planning")) {
    return {
      workflowId: "product-planning",
      reason: "Task is planning-focused (epics/features) without implementation scope.",
      confidence: "medium",
    };
  }

  const looksLikeIdeaToBuild = hasAny(text, [
    /\bfrom scratch\b/,
    /\bidea to (project|product)\b/,
    /\bbootstrap\b/,
    /\bbuild (an?|the) .* from idea\b/,
    /\bend-to-end\b/,
  ]);
  if (looksLikeIdeaToBuild && available(availableWorkflowIds, "idea-to-project")) {
    return {
      workflowId: "idea-to-project",
      reason: "Task describes end-to-end build from idea through implementation.",
      confidence: "medium",
    };
  }

  return null;
}
