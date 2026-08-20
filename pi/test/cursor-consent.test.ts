import assert from "node:assert/strict";
import test from "node:test";
import {
  createAllowGrant,
  decidePermission,
  parseAllowArg,
  permissionLabels,
  permissionTitle,
  takeAllow,
  type PermissionParams,
} from "../src/cursor-provider/consent.ts";

const shellAsk: PermissionParams = {
  sessionId: "s",
  toolCall: {
    toolCallId: "t1",
    title: "`echo hello`",
    kind: "execute",
    status: "pending",
    content: [{ type: "content", content: { type: "text", text: "Not in allowlist: echo" } }],
  },
  options: [
    { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
    { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
    { optionId: "reject-once", name: "Reject", kind: "reject_once" },
  ],
};

test("takeAllow consumes once and keeps session", () => {
  assert.deepEqual(takeAllow("off"), { autoAllow: false, next: "off" });
  assert.deepEqual(takeAllow("once"), { autoAllow: true, next: "off" });
  assert.deepEqual(takeAllow("session"), { autoAllow: true, next: "session" });
});

test("a once grant lasts one claimForTurn; a second claim cannot spend it", () => {
  const grant = createAllowGrant();
  grant.set("once");
  assert.equal(grant.claimForTurn(), true);
  assert.equal(grant.claimForTurn(), false);
});

test("a session grant survives a later claimForTurn", () => {
  const grant = createAllowGrant();
  grant.set("session");
  assert.equal(grant.claimForTurn(), true);
  assert.equal(grant.claimForTurn(), true);
  grant.set("off");
  assert.equal(grant.claimForTurn(), false);
});

test("parseAllowArg accepts once session off", () => {
  assert.equal(parseAllowArg(""), "once");
  assert.equal(parseAllowArg("session"), "session");
  assert.equal(parseAllowArg("off"), "off");
  assert.equal(parseAllowArg("nope"), undefined);
});

test("permission labels keep CLI option names and warn that allow-always persists", () => {
  const labels = permissionLabels(shellAsk.options);
  assert.deepEqual(labels, [
    "Allow once",
    "Allow always (writes ~/.cursor/cli-config.json)",
    "Reject",
  ]);
});

test("permissionTitle names the tool and the CLI reason", () => {
  assert.equal(permissionTitle(shellAsk), "`echo hello`\nNot in allowlist: echo");
});

test("with a UI the user is always asked, even if /cursor-allow is on", () => {
  const decision = decidePermission({ hasUI: true, autoAllow: true, request: shellAsk });
  assert.equal(decision.kind, "ask");
  if (decision.kind === "ask") {
    assert.equal(decision.optionIdFor("Allow once"), "allow-once");
    assert.equal(decision.optionIdFor("Allow always (writes ~/.cursor/cli-config.json)"), "allow-always");
    assert.equal(decision.optionIdFor("Reject"), "reject-once");
  }
});

test("without a UI, /cursor-allow auto-answers allow-once", () => {
  const decision = decidePermission({ hasUI: false, autoAllow: true, request: shellAsk });
  assert.deepEqual(decision, { kind: "selected", optionId: "allow-once" });
});

test("without a UI and no grant, the call is rejected with a hint", () => {
  const decision = decidePermission({ hasUI: false, autoAllow: false, request: shellAsk });
  assert.equal(decision.kind, "selected");
  if (decision.kind === "selected") {
    assert.equal(decision.optionId, "reject-once");
    assert.ok(decision.hint);
    assert.match(decision.hint ?? "", /\/cursor-allow/);
    assert.match(decision.hint ?? "", /echo hello/);
  }
});

test("model-authored askQuestion options pass through unchanged", () => {
  const ask: PermissionParams = {
    sessionId: "s",
    toolCall: { toolCallId: "q1", title: "Which approach?", kind: "other", status: "pending" },
    options: [
      { optionId: "a", name: "Rewrite in place", kind: "allow_once" },
      { optionId: "b", name: "Add a wrapper", kind: "allow_once" },
      { optionId: "__ask_question_skip__", name: "Skip", kind: "reject_once" },
    ],
  };
  const decision = decidePermission({ hasUI: true, autoAllow: false, request: ask });
  assert.equal(decision.kind, "ask");
  if (decision.kind === "ask") {
    assert.deepEqual(decision.labels, ["Rewrite in place", "Add a wrapper", "Skip"]);
    assert.equal(decision.optionIdFor("Add a wrapper"), "b");
  }
});
