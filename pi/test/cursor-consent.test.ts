import assert from "node:assert/strict";
import test from "node:test";
import { decideRetry, parseForceArg, takeForce } from "../src/cursor-provider/consent.ts";

test("takeForce consumes once and keeps session", () => {
  assert.deepEqual(takeForce("off"), { force: false, next: "off" });
  assert.deepEqual(takeForce("once"), { force: true, next: "off" });
  assert.deepEqual(takeForce("session"), { force: true, next: "session" });
});

test("parseForceArg accepts once session off", () => {
  assert.equal(parseForceArg(""), "once");
  assert.equal(parseForceArg("session"), "session");
  assert.equal(parseForceArg("off"), "off");
  assert.equal(parseForceArg("nope"), undefined);
});

test("decideRetry asks in TUI and hints without UI", () => {
  const rejections = [
    { toolName: "Delete", args: { path: ".env" }, reason: "Auto-review blocked this tool" },
  ];
  assert.deepEqual(decideRetry({ alreadyForced: true, rejections, hasUI: true }), { kind: "skip" });
  assert.deepEqual(decideRetry({ alreadyForced: false, rejections: [], hasUI: true }), { kind: "skip" });

  const ask = decideRetry({ alreadyForced: false, rejections, hasUI: true });
  assert.equal(ask.kind, "ask");
  if (ask.kind === "ask") {
    assert.match(ask.summary, /Delete \.env/);
    assert.match(ask.summary, /does not change ~\/\.cursor\/cli-config\.json/);
  }

  const skip = decideRetry({ alreadyForced: false, rejections, hasUI: false });
  assert.equal(skip.kind, "skip");
  if (skip.kind === "skip" && "hint" in skip) {
    assert.match(skip.hint, /\/cursor-allow/);
  }
});
