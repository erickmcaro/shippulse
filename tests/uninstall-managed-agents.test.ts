import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type UninstallModule = typeof import("../dist/installer/uninstall.js");

let uninstallMod: UninstallModule;
let tmpRoot = "";
let stateDir = "";
let originalStateDir: string | undefined;

describe("uninstall managed agent filter", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-uninstall-managed-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    uninstallMod = await import("../dist/installer/uninstall.js");
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("matches a valid shippulse-managed agent entry", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const agentId = "feature-dev_developer";
    const entry = {
      id: agentId,
      agentDir: path.join(stateDir, "agents", agentId, "agent"),
      workspace: path.join(stateDir, "workspaces", "workflows", "feature-dev", "developer"),
    };
    assert.equal(uninstallMod.isShipPulseManagedAgent(entry, knownWorkflowIds), true);
  });

  it("accepts canonical managed entries even when workflow prefix is unknown", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const agentId = "customflow_developer";
    const entry = {
      id: agentId,
      agentDir: path.join(stateDir, "agents", agentId, "agent"),
      workspace: path.join(stateDir, "workspaces", "workflows", "customflow", "developer"),
    };
    assert.equal(uninstallMod.isShipPulseManagedAgent(entry, knownWorkflowIds), true);
  });

  it("still rejects unknown-prefix entries when canonical paths do not match", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const agentId = "customflow_developer";
    const entry = {
      id: agentId,
      agentDir: path.join(stateDir, "agents", "other", "agent"),
      workspace: path.join(stateDir, "workspaces", "workflows", "customflow", "developer"),
    };
    assert.equal(uninstallMod.isShipPulseManagedAgent(entry, knownWorkflowIds), false);
  });

  it("rejects entries with non-canonical agentDir", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const agentId = "feature-dev_developer";
    const entry = {
      id: agentId,
      agentDir: path.join(stateDir, "agents", "other", "agent"),
      workspace: path.join(stateDir, "workspaces", "workflows", "feature-dev", "developer"),
    };
    assert.equal(uninstallMod.isShipPulseManagedAgent(entry, knownWorkflowIds), false);
  });

  it("rejects entries with workspace outside workflow workspace root", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const agentId = "feature-dev_developer";
    const entry = {
      id: agentId,
      agentDir: path.join(stateDir, "agents", agentId, "agent"),
      workspace: path.join(stateDir, "workspaces", "other", "feature-dev", "developer"),
    };
    assert.equal(uninstallMod.isShipPulseManagedAgent(entry, knownWorkflowIds), false);
  });

  it("keeps prefixed agents that are not shippulse-managed when canonical paths differ", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const entry = {
      id: "feature-dev_developer",
      agentDir: path.join(stateDir, "agents", "custom", "agent"),
      workspace: path.join(stateDir, "custom-workspaces", "feature-dev", "developer"),
    };
    assert.equal(uninstallMod.shouldRemoveWorkflowAgent(entry, "feature-dev", knownWorkflowIds), false);
  });

  it("removes legacy prefixed entries with missing path metadata", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const legacyEntry = { id: "feature-dev_developer" };
    assert.equal(uninstallMod.shouldRemoveWorkflowAgent(legacyEntry, "feature-dev", knownWorkflowIds), true);
  });

  it("removes legacy prefixed entries via set-based workflow matcher", () => {
    const knownWorkflowIds = new Set(["feature-dev", "bug-fix"]);
    const legacyEntry = { id: "feature-dev_developer" };
    assert.equal(uninstallMod.shouldRemoveAnyWorkflowAgent(legacyEntry, knownWorkflowIds), true);
  });

  it("removes canonical managed entries via set-based matcher even when workflow id is unknown", () => {
    const knownWorkflowIds = new Set(["feature-dev"]);
    const agentId = "customflow_developer";
    const entry = {
      id: agentId,
      agentDir: path.join(stateDir, "agents", agentId, "agent"),
      workspace: path.join(stateDir, "workspaces", "workflows", "customflow", "developer"),
    };
    assert.equal(uninstallMod.shouldRemoveAnyWorkflowAgent(entry, knownWorkflowIds), true);
  });

  it("does not remove non-workflow entries via set-based workflow matcher", () => {
    const knownWorkflowIds = new Set(["feature-dev", "bug-fix"]);
    const customEntry = { id: "custom-agent" };
    assert.equal(uninstallMod.shouldRemoveAnyWorkflowAgent(customEntry, knownWorkflowIds), false);
  });

  it("returns cleanup parent for canonical managed agent paths only", () => {
    const agentId = "feature-dev_reviewer";
    const entry = {
      id: agentId,
      agentDir: path.join(stateDir, "agents", agentId, "agent"),
      workspace: path.join(stateDir, "workspaces", "workflows", "feature-dev", "reviewer"),
    };
    assert.equal(
      uninstallMod.managedAgentParentDirForCleanup(entry),
      path.join(stateDir, "agents", agentId),
    );
  });

  it("does not return cleanup parent for non-canonical legacy entries", () => {
    const entry = {
      id: "feature-dev_reviewer",
      agentDir: path.join(stateDir, "custom", "danger", "agent"),
      workspace: path.join(stateDir, "workspaces", "workflows", "feature-dev", "reviewer"),
    };
    assert.equal(uninstallMod.managedAgentParentDirForCleanup(entry), null);
  });
});
