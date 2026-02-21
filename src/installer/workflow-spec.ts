import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { LoopConfig, ModelConfig, PollingConfig, WorkflowAgent, WorkflowSpec, WorkflowStep } from "./types.js";

const WORKFLOW_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
    const rawStep = step as any;
    if (rawStep.type) {
      step.type = rawStep.type;
    }
    if (rawStep.loop) {
      step.loop = parseLoopConfig(rawStep.loop);
    }
  }
  validateSteps(parsed.steps, workflowDir);
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

function validateSteps(steps: WorkflowStep[], workflowDir: string) {
  const ids = new Set<string>();
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
    if (!step.agent?.trim()) {
      throw new Error(`workflow.yml missing step.agent for step "${step.id}"`);
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
  }

  // Validate loop config references
  for (const step of steps) {
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
      if (step.loop.verifyEach && step.loop.verifyStep) {
        if (!ids.has(step.loop.verifyStep)) {
          throw new Error(`workflow.yml step "${step.id}" loop.verify_step references unknown step "${step.loop.verifyStep}"`);
        }
      }
    }
  }
}
