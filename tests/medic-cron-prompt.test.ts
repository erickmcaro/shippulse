import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMedicPrompt } from "../dist/medic/medic-cron.js";
import { resolveShipPulseCli } from "../dist/installer/paths.js";

describe("medic cron prompt", () => {
  it("quotes the CLI path for shell safety", () => {
    const cli = resolveShipPulseCli();
    const prompt = buildMedicPrompt();
    assert.ok(prompt.includes(`node "${cli}" medic run`));
    assert.ok(!prompt.includes(`node ${cli} medic run`));
  });
});
