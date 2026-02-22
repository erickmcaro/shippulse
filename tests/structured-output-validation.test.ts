import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateAndNormalizeStepOutput } from "../dist/installer/output-validation.js";

describe("structured output schema validation", () => {
  it("validates and normalizes number/boolean/json fields", () => {
    const parsed = {
      status: "done",
      attempts: "2",
      passed: "true",
      payload: "{\"b\":2,\"a\":1}",
    };

    const result = validateAndNormalizeStepOutput(undefined, "custom-step", parsed, {
      required: ["status", "attempts", "passed", "payload"],
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["done", "retry"] },
        attempts: { type: "number", minimum: 1, maximum: 5 },
        passed: { type: "boolean" },
        payload: { type: "json" },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.normalized.attempts, "2");
    assert.equal(result.normalized.passed, "true");
    assert.equal(result.normalized.payload, "{\"a\":1,\"b\":2}");
  });

  it("rejects missing required keys and unknown keys when additionalProperties=false", () => {
    const parsed = {
      status: "done",
      unknown_field: "oops",
    };

    const result = validateAndNormalizeStepOutput(undefined, "custom-step", parsed, {
      required: ["status", "tests"],
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["done"] },
        tests: { type: "string", minLength: 1 },
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" | "), /requires key "tests"/i);
    assert.match(result.errors.join(" | "), /does not allow key "unknown_field"/i);
  });
});
