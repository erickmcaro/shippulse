import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function ensurePathWithinRoot(root: string, candidate: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(prefix)) {
    throw new Error(`${label} resolves outside managed root: ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

export function assertSafeWorkflowId(workflowId: string): string {
  const trimmed = workflowId.trim();
  if (!WORKFLOW_ID_RE.test(trimmed)) {
    throw new Error(
      `Invalid workflow id "${workflowId}". Workflow ids must match ${WORKFLOW_ID_RE.toString()}`
    );
  }
  return trimmed;
}

// Bundled workflows ship with shippulse (in the repo's workflows/ directory)
export function resolveBundledWorkflowsDir(): string {
  // From dist/installer/paths.js -> ../../workflows
  return path.resolve(__dirname, "..", "..", "workflows");
}

export function resolveBundledWorkflowDir(workflowId: string): string {
  const safeId = assertSafeWorkflowId(workflowId);
  const root = resolveBundledWorkflowsDir();
  return ensurePathWithinRoot(root, path.join(root, safeId), "Bundled workflow path");
}

export function resolveBundledSeedDir(): string {
  // From dist/installer/paths.js -> ../../infra/seed
  return path.resolve(__dirname, "..", "..", "infra", "seed");
}

export function resolveOpenClawStateDir(): string {
  const env = process.env.OPENCLAW_STATE_DIR?.trim();
  if (env) {
    return env;
  }
  return path.join(os.homedir(), ".openclaw");
}

export function resolveOpenClawConfigPath(): string {
  const env = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (env) {
    return env;
  }
  return path.join(resolveOpenClawStateDir(), "openclaw.json");
}

export function resolveShipPulseRoot(): string {
  return path.join(resolveOpenClawStateDir(), "shippulse");
}

export function resolveWorkflowRoot(): string {
  return path.join(resolveShipPulseRoot(), "workflows");
}

export function resolveWorkflowDir(workflowId: string): string {
  const safeId = assertSafeWorkflowId(workflowId);
  const root = resolveWorkflowRoot();
  return ensurePathWithinRoot(root, path.join(root, safeId), "Workflow path");
}

export function resolveWorkflowWorkspaceRoot(): string {
  return path.join(resolveOpenClawStateDir(), "workspaces", "workflows");
}

export function resolveWorkflowWorkspaceDir(workflowId: string): string {
  const safeId = assertSafeWorkflowId(workflowId);
  const root = resolveWorkflowWorkspaceRoot();
  return ensurePathWithinRoot(root, path.join(root, safeId), "Workflow workspace path");
}

export function resolveRunRoot(): string {
  return path.join(resolveShipPulseRoot(), "runs");
}

export function resolveShipPulseCli(): string {
  // From dist/installer/paths.js -> ../../dist/cli/cli.js
  return path.resolve(__dirname, "..", "cli", "cli.js");
}
