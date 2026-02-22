import type { StepOutputSchema } from "./types.js";

type ValidationResult = {
  ok: boolean;
  normalized: Record<string, string>;
  errors: string[];
};

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => stableNormalize(v));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = stableNormalize(obj[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

function parseBooleanToken(raw: string): boolean | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function validateStructuredOutput(
  parsed: Record<string, string>,
  schema: StepOutputSchema,
): ValidationResult {
  const errors: string[] = [];
  const normalized: Record<string, string> = {};
  const properties = Object.entries(schema.properties ?? {}).reduce<Record<string, StepOutputSchema["properties"][string]>>(
    (acc, [rawKey, field]) => {
      const key = rawKey.trim().toLowerCase();
      if (key) acc[key] = field;
      return acc;
    },
    {},
  );
  const required = (schema.required ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  const additionalProperties = schema.additionalProperties !== false;

  for (const key of required) {
    if (parsed[key] === undefined) {
      errors.push(`Output schema requires key "${key}".`);
    }
  }

  for (const [key, rawValue] of Object.entries(parsed)) {
    const field = properties[key];
    if (!field) {
      if (!additionalProperties) errors.push(`Output schema does not allow key "${key}".`);
      continue;
    }

    const fieldType = field.type ?? "string";
    if (fieldType === "string") {
      if (field.minLength !== undefined && rawValue.length < field.minLength) {
        errors.push(`Output schema key "${key}" must be at least ${field.minLength} characters.`);
      }
      if (field.maxLength !== undefined && rawValue.length > field.maxLength) {
        errors.push(`Output schema key "${key}" must be at most ${field.maxLength} characters.`);
      }
      if (field.pattern) {
        try {
          const regex = new RegExp(field.pattern);
          if (!regex.test(rawValue)) {
            errors.push(`Output schema key "${key}" does not match required pattern.`);
          }
        } catch {
          errors.push(`Output schema key "${key}" has invalid pattern.`);
        }
      }
      if (field.enum && !field.enum.some((candidate) => String(candidate) === rawValue)) {
        errors.push(`Output schema key "${key}" must be one of: ${field.enum.join(", ")}.`);
      }
      normalized[key] = rawValue;
      continue;
    }

    if (fieldType === "number") {
      const asNumber = Number(rawValue);
      if (!Number.isFinite(asNumber)) {
        errors.push(`Output schema key "${key}" must be a valid number.`);
        continue;
      }
      if (field.minimum !== undefined && asNumber < field.minimum) {
        errors.push(`Output schema key "${key}" must be >= ${field.minimum}.`);
      }
      if (field.maximum !== undefined && asNumber > field.maximum) {
        errors.push(`Output schema key "${key}" must be <= ${field.maximum}.`);
      }
      if (
        field.enum &&
        !field.enum.some((candidate) => {
          if (typeof candidate === "number") return candidate === asNumber;
          return String(candidate) === String(asNumber);
        })
      ) {
        errors.push(`Output schema key "${key}" must be one of: ${field.enum.join(", ")}.`);
      }
      normalized[key] = String(asNumber);
      continue;
    }

    if (fieldType === "boolean") {
      const asBoolean = parseBooleanToken(rawValue);
      if (asBoolean === null) {
        errors.push(`Output schema key "${key}" must be "true" or "false".`);
        continue;
      }
      if (
        field.enum &&
        !field.enum.some((candidate) => {
          if (typeof candidate === "boolean") return candidate === asBoolean;
          if (typeof candidate === "string") return parseBooleanToken(candidate) === asBoolean;
          return false;
        })
      ) {
        errors.push(`Output schema key "${key}" must be one of: ${field.enum.join(", ")}.`);
      }
      normalized[key] = asBoolean ? "true" : "false";
      continue;
    }

    // type=json
    try {
      const parsedJson = JSON.parse(rawValue);
      normalized[key] = stableStringify(parsedJson);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Output schema key "${key}" must be valid JSON: ${message}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, normalized: {}, errors };
  }
  return { ok: true, normalized, errors: [] };
}

function parseJsonValue(parsed: Record<string, string>, key: string, label: string, errors: string[]): unknown | null {
  const raw = parsed[key];
  if (!raw || !raw.trim()) {
    errors.push(`${label} is required.`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`${label} is invalid JSON: ${message}`);
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function ensureArray(value: unknown, label: string, errors: string[]): unknown[] | null {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return null;
  }
  return value;
}

function validateStories(stories: unknown[] | null, errors: string[], opts?: { min?: number; max?: number }) {
  if (!stories) return;
  const min = opts?.min ?? 1;
  const max = opts?.max ?? 20;
  if (stories.length < min || stories.length > max) {
    errors.push(`STORIES_JSON must contain ${min}-${max} stories (got ${stories.length}).`);
  }
  const ids = new Set<string>();
  for (let i = 0; i < stories.length; i++) {
    const row = stories[i];
    if (!row || typeof row !== "object") {
      errors.push(`STORIES_JSON[${i}] must be an object.`);
      continue;
    }
    const rec = row as Record<string, unknown>;
    const id = rec.id;
    if (!isNonEmptyString(id)) errors.push(`STORIES_JSON[${i}].id is required.`);
    else {
      if (ids.has(id)) errors.push(`STORIES_JSON duplicate id "${id}".`);
      ids.add(id);
    }
    if (!isNonEmptyString(rec.title)) errors.push(`STORIES_JSON[${i}].title is required.`);
    if (!isNonEmptyString(rec.description)) errors.push(`STORIES_JSON[${i}].description is required.`);
    const ac = rec.acceptanceCriteria ?? rec.acceptance_criteria;
    if (!Array.isArray(ac) || ac.length === 0) {
      errors.push(`STORIES_JSON[${i}].acceptanceCriteria must be a non-empty array.`);
    }
  }
}

function validateEpics(epics: unknown[] | null, errors: string[], opts?: { min?: number; max?: number }) {
  if (!epics) return;
  const min = opts?.min ?? 1;
  const max = opts?.max ?? 10;
  if (epics.length < min || epics.length > max) {
    errors.push(`EPICS_JSON must contain ${min}-${max} epics (got ${epics.length}).`);
  }
  for (let i = 0; i < epics.length; i++) {
    const row = epics[i];
    if (!row || typeof row !== "object") {
      errors.push(`EPICS_JSON[${i}] must be an object.`);
      continue;
    }
    const rec = row as Record<string, unknown>;
    if (!isNonEmptyString(rec.title)) errors.push(`EPICS_JSON[${i}].title is required.`);
    if (!isNonEmptyString(rec.description)) errors.push(`EPICS_JSON[${i}].description is required.`);
  }
}

function validateFeatures(features: unknown[] | null, errors: string[], opts?: { min?: number }) {
  if (!features) return;
  const min = opts?.min ?? 1;
  if (features.length < min) errors.push(`FEATURES_JSON must contain at least ${min} features.`);
  for (let i = 0; i < features.length; i++) {
    const row = features[i];
    if (!row || typeof row !== "object") {
      errors.push(`FEATURES_JSON[${i}] must be an object.`);
      continue;
    }
    const rec = row as Record<string, unknown>;
    if (!isNonEmptyString(rec.title)) errors.push(`FEATURES_JSON[${i}].title is required.`);
    if (!isNonEmptyString(rec.description)) errors.push(`FEATURES_JSON[${i}].description is required.`);
  }
}

function validateFeaturesByEpic(groups: unknown[] | null, errors: string[]) {
  if (!groups) return;
  if (groups.length === 0) {
    errors.push("FEATURES_BY_EPIC_JSON must include at least one epic group.");
    return;
  }
  for (let i = 0; i < groups.length; i++) {
    const row = groups[i];
    if (!row || typeof row !== "object") {
      errors.push(`FEATURES_BY_EPIC_JSON[${i}] must be an object.`);
      continue;
    }
    const rec = row as Record<string, unknown>;
    if (!isNonEmptyString(rec.epicId) && !isNonEmptyString(rec.epicTitle)) {
      errors.push(`FEATURES_BY_EPIC_JSON[${i}] requires epicId or epicTitle.`);
    }
    if (!Array.isArray(rec.features) || rec.features.length === 0) {
      errors.push(`FEATURES_BY_EPIC_JSON[${i}].features must be a non-empty array.`);
      continue;
    }
    const featureRows = rec.features as unknown[];
    if (featureRows.length < 2 || featureRows.length > 5) {
      errors.push(`FEATURES_BY_EPIC_JSON[${i}].features must contain 2-5 features (got ${featureRows.length}).`);
    }
    for (let j = 0; j < featureRows.length; j++) {
      const f = featureRows[j];
      if (!f || typeof f !== "object") {
        errors.push(`FEATURES_BY_EPIC_JSON[${i}].features[${j}] must be an object.`);
        continue;
      }
      const feature = f as Record<string, unknown>;
      if (!isNonEmptyString(feature.title)) errors.push(`FEATURES_BY_EPIC_JSON[${i}].features[${j}].title is required.`);
      if (!isNonEmptyString(feature.description)) errors.push(`FEATURES_BY_EPIC_JSON[${i}].features[${j}].description is required.`);
      if (!Array.isArray(feature.acceptanceCriteria) || feature.acceptanceCriteria.length === 0) {
        errors.push(`FEATURES_BY_EPIC_JSON[${i}].features[${j}].acceptanceCriteria must be a non-empty array.`);
      }
    }
  }
}

function validateMissingEpics(epics: unknown[] | null, errors: string[]) {
  if (!epics) return;
  if (epics.length < 4 || epics.length > 10) {
    errors.push(`MISSING_EPICS_JSON must contain 4-10 epics (got ${epics.length}).`);
  }
  for (let i = 0; i < epics.length; i++) {
    const row = epics[i];
    if (!row || typeof row !== "object") {
      errors.push(`MISSING_EPICS_JSON[${i}] must be an object.`);
      continue;
    }
    const rec = row as Record<string, unknown>;
    if (!isNonEmptyString(rec.title)) errors.push(`MISSING_EPICS_JSON[${i}].title is required.`);
    if (!isNonEmptyString(rec.description)) errors.push(`MISSING_EPICS_JSON[${i}].description is required.`);
    if (!isNonEmptyString(rec.successMetric)) errors.push(`MISSING_EPICS_JSON[${i}].successMetric is required.`);
    if (!isNonEmptyString(rec.whyMissing)) errors.push(`MISSING_EPICS_JSON[${i}].whyMissing is required.`);
    if (!Array.isArray(rec.acceptanceCriteria) || rec.acceptanceCriteria.length === 0) {
      errors.push(`MISSING_EPICS_JSON[${i}].acceptanceCriteria must be a non-empty array.`);
    }
  }
}

function validateMissingFeaturesByEpic(groups: unknown[] | null, errors: string[]) {
  if (!groups) return;
  if (groups.length === 0) {
    errors.push("MISSING_FEATURES_BY_EPIC_JSON must include at least one epic group.");
    return;
  }
  for (let i = 0; i < groups.length; i++) {
    const row = groups[i];
    if (!row || typeof row !== "object") {
      errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}] must be an object.`);
      continue;
    }
    const rec = row as Record<string, unknown>;
    if (!isNonEmptyString(rec.epicId) && !isNonEmptyString(rec.epicTitle)) {
      errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}] requires epicId or epicTitle.`);
    }
    if (!Array.isArray(rec.features) || rec.features.length === 0) {
      errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}].features must be a non-empty array.`);
      continue;
    }
    const featureRows = rec.features as unknown[];
    if (featureRows.length < 1 || featureRows.length > 5) {
      errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}].features must contain 1-5 features (got ${featureRows.length}).`);
    }
    for (let j = 0; j < featureRows.length; j++) {
      const f = featureRows[j];
      if (!f || typeof f !== "object") {
        errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}].features[${j}] must be an object.`);
        continue;
      }
      const feature = f as Record<string, unknown>;
      if (!isNonEmptyString(feature.title)) errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}].features[${j}].title is required.`);
      if (!isNonEmptyString(feature.description)) errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}].features[${j}].description is required.`);
      if (!isNonEmptyString(feature.whyMissing)) errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}].features[${j}].whyMissing is required.`);
      if (!Array.isArray(feature.acceptanceCriteria) || feature.acceptanceCriteria.length === 0) {
        errors.push(`MISSING_FEATURES_BY_EPIC_JSON[${i}].features[${j}].acceptanceCriteria must be a non-empty array.`);
      }
    }
  }
}

function requireDoneStatus(parsed: Record<string, string>, errors: string[]) {
  const status = parsed.status?.trim().toLowerCase();
  if (status !== "done") {
    errors.push(`STATUS must be "done" (got "${parsed.status ?? ""}").`);
  }
}

export function validateAndNormalizeStepOutput(
  workflowId: string | undefined,
  stepId: string,
  parsed: Record<string, string>,
  outputSchema?: StepOutputSchema,
): ValidationResult {
  const normalized: Record<string, string> = {};
  const errors: string[] = [];
  const parsedForValidation: Record<string, string> = { ...parsed };

  if (outputSchema) {
    const structuredValidation = validateStructuredOutput(parsedForValidation, outputSchema);
    if (!structuredValidation.ok) {
      errors.push(...structuredValidation.errors);
    } else {
      for (const [key, value] of Object.entries(structuredValidation.normalized)) {
        normalized[key] = value;
        parsedForValidation[key] = value;
      }
    }
  }

  // Keep deterministic JSON formatting for known JSON output keys when present.
  const maybeJsonKeys = [
    "epics_json",
    "features_json",
    "features_by_epic_json",
    "stories_json",
    "coverage_json",
    "missing_epics_json",
    "missing_features_by_epic_json",
    "epic_gap_coverage_json",
    "prioritized_gap_backlog_json",
  ];
  for (const key of maybeJsonKeys) {
    if (parsedForValidation[key] === undefined) continue;
    try {
      normalized[key] = stableStringify(JSON.parse(parsedForValidation[key]));
      parsedForValidation[key] = normalized[key];
    } catch {
      // Leave detailed errors to step-specific validation.
    }
  }

  if (workflowId === "product-planning" && stepId === "generate-epics") {
    requireDoneStatus(parsedForValidation, errors);
    const epicsRaw = parseJsonValue(parsedForValidation, "epics_json", "EPICS_JSON", errors);
    const coverageRaw = parseJsonValue(parsedForValidation, "coverage_json", "COVERAGE_JSON", errors);
    const epics = ensureArray(epicsRaw, "EPICS_JSON", errors);
    validateEpics(epics, errors, { min: 4, max: 10 });
    if (coverageRaw && typeof coverageRaw !== "object") {
      errors.push("COVERAGE_JSON must be an object.");
    }
    if (epics) normalized.epics_json = stableStringify(epics);
    if (coverageRaw && typeof coverageRaw === "object") normalized.coverage_json = stableStringify(coverageRaw);
  }

  if (workflowId === "product-planning" && stepId === "generate-features") {
    requireDoneStatus(parsedForValidation, errors);
    const groupedRaw = parseJsonValue(parsedForValidation, "features_by_epic_json", "FEATURES_BY_EPIC_JSON", errors);
    const groups = ensureArray(groupedRaw, "FEATURES_BY_EPIC_JSON", errors);
    validateFeaturesByEpic(groups, errors);
    if (groups) normalized.features_by_epic_json = stableStringify(groups);
  }

  if (workflowId === "idea-to-project" && stepId === "ideate") {
    requireDoneStatus(parsedForValidation, errors);
    if (!isNonEmptyString(parsedForValidation.repo) || !parsedForValidation.repo.startsWith("/")) {
      errors.push("REPO must be an absolute path.");
    }
    if (!isNonEmptyString(parsedForValidation.branch)) {
      errors.push("BRANCH is required.");
    }
    const epicsRaw = parseJsonValue(parsedForValidation, "epics_json", "EPICS_JSON", errors);
    const featuresRaw = parseJsonValue(parsedForValidation, "features_json", "FEATURES_JSON", errors);
    const storiesRaw = parseJsonValue(parsedForValidation, "stories_json", "STORIES_JSON", errors);
    const epics = ensureArray(epicsRaw, "EPICS_JSON", errors);
    const features = ensureArray(featuresRaw, "FEATURES_JSON", errors);
    const stories = ensureArray(storiesRaw, "STORIES_JSON", errors);
    validateEpics(epics, errors, { min: 4, max: 8 });
    validateFeatures(features, errors, { min: 8 });
    validateStories(stories, errors, { min: 1, max: 20 });
    if (epics) normalized.epics_json = stableStringify(epics);
    if (features) normalized.features_json = stableStringify(features);
    if (stories) normalized.stories_json = stableStringify(stories);
  }

  if (workflowId === "project-gap-analysis" && stepId === "generate-missing-epics") {
    requireDoneStatus(parsedForValidation, errors);
    const missingEpicsRaw = parseJsonValue(parsedForValidation, "missing_epics_json", "MISSING_EPICS_JSON", errors);
    const coverageRaw = parseJsonValue(parsedForValidation, "epic_gap_coverage_json", "EPIC_GAP_COVERAGE_JSON", errors);
    const missingEpics = ensureArray(missingEpicsRaw, "MISSING_EPICS_JSON", errors);
    validateMissingEpics(missingEpics, errors);
    if (coverageRaw && typeof coverageRaw !== "object") {
      errors.push("EPIC_GAP_COVERAGE_JSON must be an object.");
    }
    if (missingEpics) normalized.missing_epics_json = stableStringify(missingEpics);
    if (coverageRaw && typeof coverageRaw === "object") {
      normalized.epic_gap_coverage_json = stableStringify(coverageRaw);
    }
  }

  if (workflowId === "project-gap-analysis" && stepId === "generate-missing-features") {
    requireDoneStatus(parsedForValidation, errors);
    const groupedRaw = parseJsonValue(
      parsedForValidation,
      "missing_features_by_epic_json",
      "MISSING_FEATURES_BY_EPIC_JSON",
      errors,
    );
    const groups = ensureArray(groupedRaw, "MISSING_FEATURES_BY_EPIC_JSON", errors);
    validateMissingFeaturesByEpic(groups, errors);
    if (groups) normalized.missing_features_by_epic_json = stableStringify(groups);
  }

  if (errors.length > 0) {
    return { ok: false, normalized: {}, errors };
  }
  return { ok: true, normalized, errors: [] };
}
