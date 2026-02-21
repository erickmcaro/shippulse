import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildKnowledgebaseIndex, collectSeedDocuments, searchKnowledgebaseIndex } from "../dist/kb/index.js";

describe("kb hybrid search", () => {
  it("collects docs from seed root and builds lexical index", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-kb-"));
    const seedRoot = path.join(tmpDir, "seed");
    const azureRoot = path.join(seedRoot, "azure-search");
    const cosmosRoot = path.join(seedRoot, "cosmos", "definitions");
    const indexPath = path.join(tmpDir, "kb-index.json");

    await fs.mkdir(azureRoot, { recursive: true });
    await fs.mkdir(cosmosRoot, { recursive: true });

    await fs.writeFile(
      path.join(azureRoot, "golden-examples.json"),
      JSON.stringify({
        value: [
          { id: "ge-1", title: "Realtime Dashboard", description: "Build realtime analytics dashboard", workItemType: "Epic" },
        ],
      }),
      "utf-8",
    );
    await fs.writeFile(path.join(azureRoot, "domain-context.json"), JSON.stringify({ value: [] }), "utf-8");
    await fs.writeFile(path.join(azureRoot, "templates.json"), JSON.stringify({ value: [] }), "utf-8");
    await fs.writeFile(path.join(azureRoot, "feedback.json"), JSON.stringify({ value: [] }), "utf-8");
    await fs.writeFile(
      path.join(cosmosRoot, "acceptance.md"),
      "# Acceptance Criteria Standards\nUse Given/When/Then for all stories.",
      "utf-8",
    );

    const docs = await collectSeedDocuments(seedRoot);
    assert.ok(docs.length >= 2, `expected at least 2 docs, got ${docs.length}`);

    const built = await buildKnowledgebaseIndex({ seedRoot, indexPath, withEmbeddings: false });
    assert.equal(built.withEmbeddings, false);
    assert.ok(built.docCount >= 2);

    const result = await searchKnowledgebaseIndex({ query: "realtime analytics dashboard", indexPath, topK: 3 });
    assert.ok(result.hits.length > 0, "should return at least one hit");
    assert.ok(
      result.hits.some((h) => h.title.toLowerCase().includes("realtime dashboard")),
      "top hits should include the matching golden example",
    );
  });

  it("uses OpenClaw auth profile key for embeddings when OPENAI_API_KEY is unset", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-kb-auth-"));
    const seedRoot = path.join(tmpDir, "seed");
    const azureRoot = path.join(seedRoot, "azure-search");
    const cosmosRoot = path.join(seedRoot, "cosmos", "playbook");
    const indexPath = path.join(tmpDir, "kb-index.json");
    const openclawState = path.join(tmpDir, "openclaw");
    const authProfilesPath = path.join(openclawState, "agents", "main", "agent", "auth-profiles.json");

    await fs.mkdir(azureRoot, { recursive: true });
    await fs.mkdir(cosmosRoot, { recursive: true });
    await fs.mkdir(path.dirname(authProfilesPath), { recursive: true });

    await fs.writeFile(
      path.join(azureRoot, "golden-examples.json"),
      JSON.stringify({
        value: [
          { id: "ge-embed-1", title: "Incident Playbook", description: "Alert triage and rollback workflow", workItemType: "Epic" },
        ],
      }),
      "utf-8",
    );
    await fs.writeFile(path.join(azureRoot, "domain-context.json"), JSON.stringify({ value: [] }), "utf-8");
    await fs.writeFile(path.join(azureRoot, "templates.json"), JSON.stringify({ value: [] }), "utf-8");
    await fs.writeFile(path.join(azureRoot, "feedback.json"), JSON.stringify({ value: [] }), "utf-8");
    await fs.writeFile(path.join(cosmosRoot, "runbook.md"), "# Incident runbook\nEscalation matrix and rollback steps.", "utf-8");

    await fs.writeFile(
      authProfilesPath,
      JSON.stringify({
        version: 1,
        profiles: {
          "openai:default": {
            type: "token",
            provider: "openai",
            token: "oc-test-key",
          },
        },
      }),
      "utf-8",
    );

    const originalFetch = globalThis.fetch;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalOpenAIBaseUrl = process.env.OPENAI_BASE_URL;
    const originalStateDir = process.env.OPENCLAW_STATE_DIR;
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_BASE_URL = "https://example-embeddings.test/v1";
    process.env.OPENCLAW_STATE_DIR = openclawState;

    let capturedAuth = "";

    globalThis.fetch = mock.fn(async (_url: string, init: any) => {
      const headers = init?.headers ?? {};
      capturedAuth = headers.Authorization ?? headers.authorization ?? "";
      const body = JSON.parse(init.body ?? "{}");
      const inputs: unknown[] = Array.isArray(body.input) ? body.input : [];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: inputs.map((_: unknown, idx: number) => ({
            embedding: [0.1 + idx, 0.2 + idx, 0.3 + idx],
          })),
        }),
      };
    }) as any;

    try {
      const built = await buildKnowledgebaseIndex({ seedRoot, indexPath, withEmbeddings: true });
      assert.equal(built.withEmbeddings, true);
      assert.equal(capturedAuth, "Bearer oc-test-key");

      const result = await searchKnowledgebaseIndex({ query: "rollback workflow", indexPath, topK: 3 });
      assert.equal(result.withEmbeddings, true);
      assert.ok(result.hits.length > 0);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalOpenAIKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAIKey;
      }
      if (originalOpenAIBaseUrl === undefined) {
        delete process.env.OPENAI_BASE_URL;
      } else {
        process.env.OPENAI_BASE_URL = originalOpenAIBaseUrl;
      }
      if (originalStateDir === undefined) {
        delete process.env.OPENCLAW_STATE_DIR;
      } else {
        process.env.OPENCLAW_STATE_DIR = originalStateDir;
      }
    }
  });
});
