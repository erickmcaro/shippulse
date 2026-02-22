import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type {
  LoopConfig,
  ModelConfig,
  OutputSchemaField,
  OutputSchemaFieldType,
  PollingConfig,
  StepOutputSchema,
  WorkflowAgent,
  WorkflowSpec,
  WorkflowStep,
} from "./types.js";

const WORKFLOW_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const OUTPUT_FIELD_TYPES = new Set<OutputSchemaFieldType>(["string", "number", "boolean", "json"]);

export async function loadWorkflowSpec(workflowDir: string): Promise<WorkflowSpec> {
  const filePath = path.join(workflowDir, "workflow.yml");
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = YAML.parse(raw) as WorkflowSpec;
  if (!parsed?.id) {
    throw new Error(`workflow.yml missing id in ${workflowDir}`);
  }
  if (!WORKFLOW_ID_RE.test(parsed.id)) {
    throw new Error(
      `workflow.yml id "${parsed.id}" must match ${WORKFLOW_ID_RE.toString()}`
    );
  }
  if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) {
    throw new Error(`workflow.yml missing agents list in ${workflowDir}`);
  }
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error(`workflow.yml missing steps list in ${workflowDir}`);
  }
  if (parsed.polling) {
    validatePollingConfig(parsed.polling, workflowDir);
  }
  validateAgents(parsed.agents, workflowDir);
  // Parse type/loop from raw YAML before validation
  for (const step of parsed.steps) {
    const rawStep = step as WorkflowStep & {
      type?: WorkflowStep["type"];
      loop?: unknown;
      output_schema?: unknown;
      outputSchema?: unknown;
    };
    if (rawStep.type !== undefined) {
      step.type = rawStep.type;
    }
    if (rawStep.loop) {
      step.loop = parseLoopConfig(rawStep.loop);
    }
    const rawSchema = rawStep.output_schema ?? rawStep.outputSchema;
    if (rawSchema !== undefined) {
      step.outputSchema = parseOutputSchema(rawSchema, step.id, workflowDir);
    }
  }
  validateSteps(parsed.steps, parsed.agents, workflowDir);
  return parsed;
}

function validatePollingConfig(polling: PollingConfig, workflowDir: string) {
  if (polling.timeoutSeconds !== undefined && polling.timeoutSeconds <= 0) {
    throw new Error(`workflow.yml polling.timeoutSeconds must be positive in ${workflowDir}`);
  }
}

function validateAgentModel(model: string | ModelConfig, agentId: string) {
  if (typeof model === "string") return;
  if (typeof model !== "object" || model === null) {
    throw new Error(`workflow.yml agent "${agentId}" model must be a string or object with primary`);
  }
  if (typeof model.primary !== "string" || model.primary.trim() === "") {
    throw new Error(`workflow.yml agent "${agentId}" model.primary must be a non-empty string`);
  }
  if (model.fallbacks !== undefined) {
    if (!Array.isArray(model.fallbacks)) {
      throw new Error(`workflow.yml agent "${agentId}" model.fallbacks must be a list`);
    }
    for (const fb of model.fallbacks) {
      if (typeof fb !== "string" || !fb.trim()) {
        throw new Error(`workflow.yml agent "${agentId}" model.fallbacks must contain non-empty strings`);
      }
    }
  }
}

function validateAgents(agents: WorkflowAgent[], workflowDir: string) {
  const ids = new Set<string>();
  for (const agent of agents) {
    const rawAgent = agent as WorkflowAgent & { polling_timeout_seconds?: number };
    if (rawAgent.polling_timeout_seconds !== undefined && rawAgent.pollingTimeoutSeconds === undefined) {
      rawAgent.pollingTimeoutSeconds = rawAgent.polling_timeout_seconds;
    }
    if (!agent.id?.trim()) {
      throw new Error(`workflow.yml missing agent id in ${workflowDir}`);
    }
    if (agent.id.includes("_")) {
      throw new Error(`workflow.yml agent "${agent.id}" must not contain underscores (reserved as namespace separator)`);
    }
    if (ids.has(agent.id)) {
      throw new Error(`workflow.yml has duplicate agent id "${agent.id}" in ${workflowDir}`);
    }
    ids.add(agent.id);
    if (!agent.workspace?.baseDir?.trim()) {
      throw new Error(`workflow.yml missing workspace.baseDir for agent "${agent.id}"`);
    }
    if (!agent.workspace?.files || Object.keys(agent.workspace.files).length === 0) {
      throw new Error(`workflow.yml missing workspace.files for agent "${agent.id}"`);
    }
    if (agent.workspace.skills && !Array.isArray(agent.workspace.skills)) {
      throw new Error(`workflow.yml workspace.skills must be a list for agent "${agent.id}"`);
    }
    if (agent.timeoutSeconds !== undefined && agent.timeoutSeconds <= 0) {
      throw new Error(`workflow.yml agent "${agent.id}" timeoutSeconds must be positive`);
    }
    if (agent.pollingTimeoutSeconds !== undefined && agent.pollingTimeoutSeconds <= 0) {
      throw new Error(`workflow.yml agent "${agent.id}" pollingTimeoutSeconds must be positive`);
    }
    if (agent.model !== undefined) {
      validateAgentModel(agent.model, agent.id);
    }
  }
}

function parseLoopConfig(raw: any): LoopConfig {
  return {
    over: raw.over,
    completion: raw.completion,
    freshSession: raw.fresh_session ?? raw.freshSession,
    verifyEach: raw.verify_each ?? raw.verifyEach,
    verifyStep: raw.verify_step ?? raw.verifyStep,
  };
}

function parseOptionalNonNegativeInteger(value: unknown, label: string, workflowDir: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer in ${workflowDir}`);
  }
  return value;
}

function parseOptionalNumber(value: unknown, label: string, workflowDir: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number in ${workflowDir}`);
  }
  return value;
}

function parseOutputSchema(raw: unknown, stepId: string, workflowDir: string): StepOutputSchema {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`workflow.yml step "${stepId}" output_schema must be an object in ${workflowDir}`);
  }
  const schemaRaw = raw as Record<string, unknown>;
  const propertiesRaw = schemaRaw.properties;
  if (!propertiesRaw || typeof propertiesRaw !== "object" || Array.isArray(propertiesRaw)) {
    throw new Error(`workflow.yml step "${stepId}" output_schema.properties must be an object in ${workflowDir}`);
  }
  const propertyEntries = Object.entries(propertiesRaw as Record<string, unknown>);
  if (propertyEntries.length === 0) {
    throw new Error(`workflow.yml step "${stepId}" output_schema.properties must not be empty in ${workflowDir}`);
  }

  const properties: Record<string, OutputSchemaField> = {};
  for (const [rawName, rawField] of propertyEntries) {
    const name = rawName.trim().toLowerCase();
    if (!name) {
      throw new Error(`workflow.yml step "${stepId}" output_schema property names must be non-empty in ${workflowDir}`);
    }
    if (name in properties) {
      throw new Error(`workflow.yml step "${stepId}" output_schema has duplicate property "${name}" in ${workflowDir}`);
    }
    if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) {
      throw new Error(`workflow.yml step "${stepId}" output_schema.properties.${rawName} must be an object in ${workflowDir}`);
    }
    const fieldRaw = rawField as Record<string, unknown>;
    const typeRaw = fieldRaw.type;
    let type: OutputSchemaFieldType | undefined;
    if (typeRaw !== undefined) {
      if (typeof typeRaw !== "string" || !OUTPUT_FIELD_TYPES.has(typeRaw as OutputSchemaFieldType)) {
        throw new Error(
          `workflow.yml step "${stepId}" output_schema.properties.${rawName}.type must be one of ${Array.from(OUTPUT_FIELD_TYPES).join(", ")} in ${workflowDir}`,
        );
      }
      type = typeRaw as OutputSchemaFieldType;
    }

    const enumRaw = fieldRaw.enum;
    let enumValues: Array<string | number | boolean> | undefined;
    if (enumRaw !== undefined) {
      if (!Array.isArray(enumRaw) || enumRaw.length === 0) {
        throw new Error(`workflow.yml step "${stepId}" output_schema.properties.${rawName}.enum must be a non-empty array in ${workflowDir}`);
      }
      for (const v of enumRaw) {
        if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
          throw new Error(
            `workflow.yml step "${stepId}" output_schema.properties.${rawName}.enum values must be string/number/boolean in ${workflowDir}`,
          );
        }
      }
      enumValues = enumRaw as Array<string | number | boolean>;
    }

    const minLength = parseOptionalNonNegativeInteger(
      fieldRaw.minLength ?? fieldRaw.min_length,
      `workflow.yml step "${stepId}" output_schema.properties.${rawName}.minLength`,
      workflowDir,
    );
    const maxLength = parseOptionalNonNegativeInteger(
      fieldRaw.maxLength ?? fieldRaw.max_length,
      `workflow.yml step "${stepId}" output_schema.properties.${rawName}.maxLength`,
      workflowDir,
    );
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      throw new Error(
        `workflow.yml step "${stepId}" output_schema.properties.${rawName} minLength cannot exceed maxLength in ${workflowDir}`,
      );
    }
    const minimum = parseOptionalNumber(
      fieldRaw.minimum,
      `workflow.yml step "${stepId}" output_schema.properties.${rawName}.minimum`,
      workflowDir,
    );
    const maximum = parseOptionalNumber(
      fieldRaw.maximum,
      `workflow.yml step "${stepId}" output_schema.properties.${rawName}.maximum`,
      workflowDir,
    );
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      throw new Error(
        `workflow.yml step "${stepId}" output_schema.properties.${rawName} minimum cannot exceed maximum in ${workflowDir}`,
      );
    }

    let pattern: string | undefined;
    const patternRaw = fieldRaw.pattern;
    if (patternRaw !== undefined) {
      if (typeof patternRaw !== "string" || !patternRaw) {
        throw new Error(`workflow.yml step "${stepId}" output_schema.properties.${rawName}.pattern must be a non-empty string in ${workflowDir}`);
      }
      try {
        void new RegExp(patternRaw);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `workflow.yml step "${stepId}" output_schema.properties.${rawName}.pattern is invalid regex (${message}) in ${workflowDir}`,
        );
      }
      pattern = patternRaw;
    }

    if (type !== "string" && (minLength !== undefined || maxLength !== undefined || pattern !== undefined)) {
      throw new Error(
        `workflow.yml step "${stepId}" output_schema.properties.${rawName} string constraints require type=string in ${workflowDir}`,
      );
    }
    if (type !== "number" && (minimum !== undefined || maximum !== undefined)) {
      throw new Error(
        `workflow.yml step "${stepId}" output_schema.properties.${rawName} numeric constraints require type=number in ${workflowDir}`,
      );
    }

    properties[name] = {
      type,
      enum: enumValues,
      pattern,
      minLength,
      maxLength,
      minimum,
      maximum,
    };
  }

  let required: string[] | undefined;
  const requiredRaw = schemaRaw.required;
  if (requiredRaw !== undefined) {
    if (!Array.isArray(requiredRaw)) {
      throw new Error(`workflow.yml step "${stepId}" output_schema.required must be an array in ${workflowDir}`);
    }
    const uniqueRequired = new Set<string>();
    for (const rawKey of requiredRaw) {
      if (typeof rawKey !== "string" || !rawKey.trim()) {
        throw new Error(`workflow.yml step "${stepId}" output_schema.required must contain non-empty strings in ${workflowDir}`);
      }
      const key = rawKey.trim().toLowerCase();
      if (!(key in properties)) {
        throw new Error(
          `workflow.yml step "${stepId}" output_schema.required references unknown property "${rawKey}" in ${workflowDir}`,
        );
      }
      uniqueRequired.add(key);
    }
    required = Array.from(uniqueRequired);
  }

  const additionalPropertiesRaw = schemaRaw.additionalProperties ?? schemaRaw.additional_properties;
  let additionalProperties: boolean | undefined;
  if (additionalPropertiesRaw !== undefined) {
    if (typeof additionalPropertiesRaw !== "boolean") {
      throw new Error(`workflow.yml step "${stepId}" output_schema.additionalProperties must be boolean in ${workflowDir}`);
    }
    additionalProperties = additionalPropertiesRaw;
  }

  return {
    required,
    additionalProperties,
    properties,
  };
}

function validateEscalationTarget(
  targetRaw: unknown,
  agentIds: Set<string>,
  workflowDir: string,
  stepId: string,
  sourcePath: string,
) {
  if (targetRaw === undefined || targetRaw === null) return;
  if (typeof targetRaw !== "string" || !targetRaw.trim()) {
    throw new Error(`workflow.yml step "${stepId}" ${sourcePath} must be a non-empty string in ${workflowDir}`);
  }
  const target = targetRaw.trim();
  if (target !== "human" && !agentIds.has(target)) {
    throw new Error(
      `workflow.yml step "${stepId}" ${sourcePath} must target "human" or an existing agent id (got "${target}") in ${workflowDir}`,
    );
  }
}

function validateSteps(steps: WorkflowStep[], agents: WorkflowAgent[], workflowDir: string) {
  const ids = new Set<string>();
  const agentIds = new Set(agents.map((a) => a.id));
  for (const step of steps) {
    const rawStep = step as WorkflowStep & { polling_timeout_seconds?: number };
    if (rawStep.polling_timeout_seconds !== undefined && rawStep.pollingTimeoutSeconds === undefined) {
      rawStep.pollingTimeoutSeconds = rawStep.polling_timeout_seconds;
    }
    if (!step.id?.trim()) {
      throw new Error(`workflow.yml missing step id in ${workflowDir}`);
    }
    if (ids.has(step.id)) {
      throw new Error(`workflow.yml has duplicate step id "${step.id}" in ${workflowDir}`);
    }
    ids.add(step.id);
    const typeRaw = (step as { type?: unknown }).type;
    if (typeRaw !== undefined && typeRaw !== "single" && typeRaw !== "loop") {
      throw new Error(`workflow.yml step "${step.id}" type must be "single" or "loop" in ${workflowDir}`);
    }
    if (!step.agent?.trim()) {
      throw new Error(`workflow.yml missing step.agent for step "${step.id}"`);
    }
    if (!agentIds.has(step.agent)) {
      throw new Error(`workflow.yml step "${step.id}" references unknown agent "${step.agent}" in ${workflowDir}`);
    }
    if (!step.input?.trim()) {
      throw new Error(`workflow.yml missing step.input for step "${step.id}"`);
    }
    if (!step.expects?.trim()) {
      throw new Error(`workflow.yml missing step.expects for step "${step.id}"`);
    }
    if (step.pollingTimeoutSeconds !== undefined && step.pollingTimeoutSeconds <= 0) {
      throw new Error(`workflow.yml step "${step.id}" pollingTimeoutSeconds must be positive`);
    }
    if (step.max_retries !== undefined && (!Number.isInteger(step.max_retries) || step.max_retries < 0)) {
      throw new Error(`workflow.yml step "${step.id}" max_retries must be a non-negative integer in ${workflowDir}`);
    }
    if (step.on_fail?.max_retries !== undefined && (!Number.isInteger(step.on_fail.max_retries) || step.on_fail.max_retries < 0)) {
      throw new Error(`workflow.yml step "${step.id}" on_fail.max_retries must be a non-negative integer in ${workflowDir}`);
    }
    validateEscalationTarget(step.on_fail?.escalate_to, agentIds, workflowDir, step.id, "on_fail.escalate_to");
    validateEscalationTarget(step.on_fail?.on_exhausted?.escalate_to, agentIds, workflowDir, step.id, "on_fail.on_exhausted.escalate_to");
    if (step.type !== "loop" && step.loop) {
      throw new Error(`workflow.yml step "${step.id}" has loop config but type is not "loop" in ${workflowDir}`);
    }
  }

  // Validate loop config references
  for (const step of steps) {
    const retryStepRaw = step.on_fail?.retry_step;
    if (retryStepRaw !== undefined) {
      if (typeof retryStepRaw !== "string" || !retryStepRaw.trim()) {
        throw new Error(`workflow.yml step "${step.id}" on_fail.retry_step must be a non-empty string in ${workflowDir}`);
      }
      const retryStep = retryStepRaw.trim();
      if (!ids.has(retryStep)) {
        throw new Error(`workflow.yml step "${step.id}" on_fail.retry_step references unknown step "${retryStep}" in ${workflowDir}`);
      }
      if (retryStep === step.id) {
        throw new Error(`workflow.yml step "${step.id}" on_fail.retry_step must reference a different step in ${workflowDir}`);
      }
    }

    if (step.type === "loop") {
      if (!step.loop) {
        throw new Error(`workflow.yml step "${step.id}" has type=loop but no loop config`);
      }
      if (step.loop.over !== "stories") {
        throw new Error(`workflow.yml step "${step.id}" loop.over must be "stories"`);
      }
      if (step.loop.completion !== "all_done") {
        throw new Error(`workflow.yml step "${step.id}" loop.completion must be "all_done"`);
      }
      if (step.loop.verifyEach && !step.loop.verifyStep) {
        throw new Error(`workflow.yml step "${step.id}" loop.verify_step is required when verify_each is enabled`);
      }
      if (step.loop.verifyStep) {
        if (!ids.has(step.loop.verifyStep)) {
          throw new Error(`workflow.yml step "${step.id}" loop.verify_step references unknown step "${step.loop.verifyStep}"`);
        }
        if (step.loop.verifyStep === step.id) {
          throw new Error(`workflow.yml step "${step.id}" loop.verify_step must reference a different step`);
        }
      }
    }
  }
}
