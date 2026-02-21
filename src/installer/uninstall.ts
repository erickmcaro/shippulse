import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { readOpenClawConfig, writeOpenClawConfig } from "./openclaw-config.js";
import { removeMainAgentGuidance } from "./main-agent-guidance.js";
import {
  resolveOpenClawStateDir,
  resolveBundledWorkflowsDir,
  resolveShipPulseRoot,
  resolveRunRoot,
  resolveWorkflowDir,
  resolveWorkflowWorkspaceDir,
  resolveWorkflowWorkspaceRoot,
  resolveWorkflowRoot,
} from "./paths.js";
import { removeSubagentAllowlist } from "./subagent-allowlist.js";
import { uninstallShipPulseSkill } from "./skill-install.js";
import { removeAgentCrons } from "./agent-cron.js";
import { deleteAgentCronJobs } from "./gateway-api.js";
import { closeDb, getDb } from "../db.js";
import { stopDaemon } from "../server/daemonctl.js";
import type { WorkflowInstallResult } from "./types.js";

function filterAgentList(
  list: Array<Record<string, unknown>>,
  workflowId: string,
): Array<Record<string, unknown>> {
  const knownWorkflowIds = new Set([workflowId]);
  return list.filter((entry) => !shouldRemoveWorkflowAgent(entry, workflowId, knownWorkflowIds));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_CRON_SESSION_RETENTION = "24h";
const DEFAULT_SESSION_MAINTENANCE = {
  mode: "enforce",
  pruneAfter: "7d",
  maxEntries: 500,
  rotateBytes: "10mb",
} as const;
export const SHIPPULSE_RUNTIME_ARTIFACTS = [
  "dashboard.pid",
  "dashboard.port",
  "dashboard.log",
  "dashboard.token",
  "events.jsonl",
  "kb-index.json",
  "runs",
  "logs",
] as const;

function pathWithin(parent: string, candidate: string): boolean {
  const resolvedParent = path.resolve(parent);
  const resolvedCandidate = path.resolve(candidate);
  const prefix = resolvedParent.endsWith(path.sep) ? resolvedParent : `${resolvedParent}${path.sep}`;
  return resolvedCandidate === resolvedParent || resolvedCandidate.startsWith(prefix);
}

function extractWorkflowPrefix(agentId: string): string | null {
  const idx = agentId.indexOf("_");
  if (idx <= 0) return null;
  return agentId.slice(0, idx);
}

function expectedAgentDirForId(agentId: string): string {
  const safeId = agentId.replace(/[^a-zA-Z0-9_-]/g, "__");
  return path.join(resolveOpenClawStateDir(), "agents", safeId, "agent");
}

async function collectKnownWorkflowIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const roots = [resolveWorkflowRoot(), resolveBundledWorkflowsDir()];

  for (const root of roots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) ids.add(entry.name);
      }
    } catch {
      // best-effort only
    }
  }

  return ids;
}

export function isShipPulseManagedAgent(
  entry: Record<string, unknown>,
  knownWorkflowIds: ReadonlySet<string>,
): boolean {
  const id = typeof entry.id === "string" ? entry.id : "";
  if (!id || id === "main") return false;

  const workflowId = extractWorkflowPrefix(id);
  if (!workflowId) return false;

  const agentDir = typeof entry.agentDir === "string" ? entry.agentDir : "";
  if (!agentDir) return false;
  if (path.resolve(agentDir) !== path.resolve(expectedAgentDirForId(id))) return false;

  const workspace = typeof entry.workspace === "string" ? entry.workspace : "";
  if (!workspace) return false;
  try {
    const workflowWorkspaceDir = resolveWorkflowWorkspaceDir(workflowId);
    if (!pathWithin(workflowWorkspaceDir, workspace)) return false;
  } catch {
    return false;
  }

  // Known IDs come from installed/bundled workflow dirs. Keep accepting canonical
  // agent/workspace paths even when a workflow id is no longer present on disk.
  void knownWorkflowIds;
  return true;
}

export function shouldRemoveWorkflowAgent(
  entry: Record<string, unknown>,
  workflowId: string,
  knownWorkflowIds: ReadonlySet<string>,
): boolean {
  const id = typeof entry.id === "string" ? entry.id : "";
  if (!id.startsWith(`${workflowId}_`)) return false;
  if (isShipPulseManagedAgent(entry, knownWorkflowIds)) return true;

  // Backward-compat fallback: legacy entries may omit canonical paths.
  const hasAgentDir = typeof entry.agentDir === "string" && entry.agentDir.trim().length > 0;
  const hasWorkspace = typeof entry.workspace === "string" && entry.workspace.trim().length > 0;
  return !hasAgentDir || !hasWorkspace;
}

export function shouldRemoveAnyWorkflowAgent(
  entry: Record<string, unknown>,
  workflowIds: ReadonlySet<string>,
): boolean {
  // Always remove canonical ShipPulse-managed entries regardless of workflow id
  // presence on disk (ids can disappear after partial/manual cleanup).
  if (isShipPulseManagedAgent(entry, workflowIds)) {
    return true;
  }
  for (const workflowId of workflowIds) {
    if (shouldRemoveWorkflowAgent(entry, workflowId, workflowIds)) {
      return true;
    }
  }
  return false;
}

export function managedAgentParentDirForCleanup(entry: Record<string, unknown>): string | null {
  const id = typeof entry.id === "string" ? entry.id : "";
  const agentDir = typeof entry.agentDir === "string" ? entry.agentDir : "";
  if (!id || !agentDir) return null;

  // Cleanup must only touch canonical shippulse-managed agent paths.
  const expectedAgentDir = expectedAgentDirForId(id);
  if (path.resolve(agentDir) !== path.resolve(expectedAgentDir)) return null;

  const parentDir = path.dirname(agentDir);
  const agentsRoot = path.join(resolveOpenClawStateDir(), "agents");
  if (!pathWithin(agentsRoot, parentDir)) return null;
  return parentDir;
}

function getActiveRuns(workflowId?: string): Array<{ id: string; workflow_id: string; task: string }> {
  try {
    const db = getDb();
    if (workflowId) {
      return db.prepare("SELECT id, workflow_id, task FROM runs WHERE workflow_id = ? AND status = 'running'").all(workflowId) as Array<{ id: string; workflow_id: string; task: string }>;
    }
    return db.prepare("SELECT id, workflow_id, task FROM runs WHERE status = 'running'").all() as Array<{ id: string; workflow_id: string; task: string }>;
  } catch {
    return [];
  }
}

export function checkActiveRuns(workflowId?: string): Array<{ id: string; workflow_id: string; task: string }> {
  return getActiveRuns(workflowId);
}

function removeRunRecords(workflowId: string): void {
  try {
    const db = getDb();
    const runs = db.prepare("SELECT id FROM runs WHERE workflow_id = ?").all(workflowId) as Array<{ id: string }>;
    for (const run of runs) {
      db.prepare("DELETE FROM stories WHERE run_id = ?").run(run.id);
      db.prepare("DELETE FROM steps WHERE run_id = ?").run(run.id);
    }
    db.prepare("DELETE FROM runs WHERE workflow_id = ?").run(workflowId);
  } catch {
    // DB might not exist yet
  }
}

export async function uninstallWorkflow(params: {
  workflowId: string;
  removeGuidance?: boolean;
}): Promise<WorkflowInstallResult> {
  const workflowDir = resolveWorkflowDir(params.workflowId);
  const workflowWorkspaceDir = resolveWorkflowWorkspaceDir(params.workflowId);
  const { path: configPath, config } = await readOpenClawConfig();
  const list = Array.isArray(config.agents?.list) ? config.agents?.list : [];
  const nextList = filterAgentList(list, params.workflowId);
  const removedAgents = list.filter((entry) => !nextList.includes(entry));
  if (config.agents) {
    config.agents.list = nextList;
  }
  removeSubagentAllowlist(
    config,
    removedAgents
      .map((entry) => (typeof entry.id === "string" ? entry.id : ""))
      .filter(Boolean),
  );
  await writeOpenClawConfig(configPath, config);

  if (params.removeGuidance !== false) {
    await removeMainAgentGuidance();
  }

  if (await pathExists(workflowDir)) {
    await fs.rm(workflowDir, { recursive: true, force: true });
  }

  if (await pathExists(workflowWorkspaceDir)) {
    await fs.rm(workflowWorkspaceDir, { recursive: true, force: true });
  }

  removeRunRecords(params.workflowId);
  await removeAgentCrons(params.workflowId);

  for (const entry of removedAgents) {
    // Remove the entire parent directory (e.g. ~/.openclaw/agents/bug-fix_triager/)
    // since both agent/ and sessions/ inside it are shippulse-managed.
    // Never recurse into non-canonical agent paths from config.
    const parentDir = managedAgentParentDirForCleanup(entry);
    if (!parentDir) continue;
    if (await pathExists(parentDir)) {
      await fs.rm(parentDir, { recursive: true, force: true });
    }
  }

  return { workflowId: params.workflowId, workflowDir };
}

export async function uninstallAllWorkflows(): Promise<void> {
  // Stop the dashboard daemon before cleaning up files
  stopDaemon();

  const { path: configPath, config } = await readOpenClawConfig();
  const list = Array.isArray(config.agents?.list) ? config.agents?.list : [];
  const knownWorkflowIds = await collectKnownWorkflowIds();
  const removedAgents = list.filter((entry) => shouldRemoveAnyWorkflowAgent(entry, knownWorkflowIds));
  if (config.agents) {
    config.agents.list = list.filter((entry) => !removedAgents.includes(entry));
  }
  removeSubagentAllowlist(
    config,
    removedAgents
      .map((entry) => (typeof entry.id === "string" ? entry.id : ""))
      .filter(Boolean),
  );
  if (config.cron?.sessionRetention === DEFAULT_CRON_SESSION_RETENTION) {
    delete config.cron.sessionRetention;
    if (Object.keys(config.cron).length === 0) {
      delete config.cron;
    }
  }
  if (config.session?.maintenance) {
    const maintenance = config.session.maintenance;
    const matchesDefaults =
      maintenance.mode === DEFAULT_SESSION_MAINTENANCE.mode &&
      (maintenance.pruneAfter === DEFAULT_SESSION_MAINTENANCE.pruneAfter ||
        maintenance.pruneDays === undefined) &&
      maintenance.maxEntries === DEFAULT_SESSION_MAINTENANCE.maxEntries &&
      maintenance.rotateBytes === DEFAULT_SESSION_MAINTENANCE.rotateBytes;
    if (matchesDefaults) {
      delete config.session.maintenance;
      if (Object.keys(config.session).length === 0) {
        delete config.session;
      }
    }
  }
  await writeOpenClawConfig(configPath, config);

  await removeMainAgentGuidance();
  await uninstallShipPulseSkill();

  // Remove all shippulse cron jobs
  await deleteAgentCronJobs("shippulse/");

  const workflowRoot = resolveWorkflowRoot();
  if (await pathExists(workflowRoot)) {
    await fs.rm(workflowRoot, { recursive: true, force: true });
  }

  const workflowWorkspaceRoot = resolveWorkflowWorkspaceRoot();
  if (await pathExists(workflowWorkspaceRoot)) {
    await fs.rm(workflowWorkspaceRoot, { recursive: true, force: true });
  }

  // Remove the SQLite database file
  closeDb();
  const { getDbPath } = await import("../db.js");
  const dbPath = getDbPath();
  if (await pathExists(dbPath)) {
    await fs.rm(dbPath, { force: true });
  }
  // WAL and SHM files
  for (const suffix of ["-wal", "-shm"]) {
    const p = dbPath + suffix;
    if (await pathExists(p)) {
      await fs.rm(p, { force: true });
    }
  }

  for (const entry of removedAgents) {
    // Remove the entire parent directory (e.g. ~/.openclaw/agents/bug-fix_triager/)
    // since both agent/ and sessions/ inside it are shippulse-managed.
    // Never recurse into non-canonical agent paths from config.
    const parentDir = managedAgentParentDirForCleanup(entry);
    if (!parentDir) continue;
    if (await pathExists(parentDir)) {
      await fs.rm(parentDir, { recursive: true, force: true });
    }
  }

  const shippulseRoot = resolveShipPulseRoot();
  if (await pathExists(shippulseRoot)) {
    // Clean up remaining runtime artifacts under the ShipPulse root.
    for (const name of SHIPPULSE_RUNTIME_ARTIFACTS) {
      const p = path.join(shippulseRoot, name);
      if (await pathExists(p)) {
        await fs.rm(p, { recursive: true, force: true });
      }
    }
    // Remove the directory if now empty
    const entries = await fs.readdir(shippulseRoot).catch(() => ["placeholder"] as string[]);
    if (entries.length === 0) {
      await fs.rm(shippulseRoot, { recursive: true, force: true });
    }
  }

  // Remove CLI symlink from ~/.local/bin
  const { removeCliSymlink } = await import("./symlink.js");
  removeCliSymlink();

  // Remove npm link, build output, and node_modules.
  // Note: this deletes dist/ which contains the currently running code.
  // Safe because this is the final operation in the function.
  const projectRoot = path.resolve(import.meta.dirname, "..", "..");
  try {
    execSync("npm unlink -g", { cwd: projectRoot, stdio: "ignore" });
  } catch {
    // link may not exist
  }
  const distDir = path.join(projectRoot, "dist");
  if (await pathExists(distDir)) {
    await fs.rm(distDir, { recursive: true, force: true });
  }
  const nodeModulesDir = path.join(projectRoot, "node_modules");
  if (await pathExists(nodeModulesDir)) {
    await fs.rm(nodeModulesDir, { recursive: true, force: true });
  }
}
