import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  resolveWorkflowDir,
  resolveWorkflowRoot,
  resolveWorkflowWorkspaceDir,
  resolveWorkflowWorkspaceRoot,
  resolveBundledWorkflowDir,
  resolveBundledWorkflowsDir,
} from "../dist/installer/paths.js";
import { fetchWorkflow } from "../dist/installer/workflow-fetch.js";

function assertWithinRoot(candidate: string, root: string): void {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  assert.ok(
    resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(prefix),
    `Expected ${resolvedCandidate} to be within ${resolvedRoot}`,
  );
}

describe("workflow path safety", () => {
  it("keeps workflow install paths within managed roots", () => {
    assertWithinRoot(resolveWorkflowDir("feature-dev"), resolveWorkflowRoot());
    assertWithinRoot(resolveWorkflowWorkspaceDir("feature-dev"), resolveWorkflowWorkspaceRoot());
    assertWithinRoot(resolveBundledWorkflowDir("feature-dev"), resolveBundledWorkflowsDir());
  });

  it("rejects unsafe workflow ids in path resolvers", () => {
    assert.throws(() => resolveWorkflowDir("../../etc"), /invalid workflow id/i);
    assert.throws(() => resolveWorkflowWorkspaceDir(".."), /invalid workflow id/i);
    assert.throws(() => resolveBundledWorkflowDir("feature_dev"), /invalid workflow id/i);
  });

  it("rejects unsafe workflow ids before fetch/copy", async () => {
    await assert.rejects(() => fetchWorkflow("../../tmp/evil"), /invalid workflow id/i);
  });
});
