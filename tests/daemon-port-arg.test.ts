import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDaemonPortArg } from "../dist/server/daemon-port.js";

describe("parseDaemonPortArg", () => {
  it("accepts valid ports including 0", () => {
    assert.equal(parseDaemonPortArg("0"), 0);
    assert.equal(parseDaemonPortArg("65535"), 65535);
    assert.equal(parseDaemonPortArg(" 42 "), 42);
  });

  it("falls back for malformed or out-of-range input", () => {
    assert.equal(parseDaemonPortArg(undefined, 3333), 3333);
    assert.equal(parseDaemonPortArg("12abc", 3333), 3333);
    assert.equal(parseDaemonPortArg("-1", 3333), 3333);
    assert.equal(parseDaemonPortArg("65536", 3333), 3333);
  });
});
