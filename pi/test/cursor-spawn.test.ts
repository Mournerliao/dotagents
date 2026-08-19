import assert from "node:assert/strict";
import test from "node:test";
import { buildPrintArgs, resolveAgentPath, resolveApiKey } from "../src/cursor-provider/spawn.ts";

test("resolveAgentPath prefers CURSOR_AGENT_PATH then AGENT_PATH", () => {
  assert.equal(resolveAgentPath({}), "agent");
  assert.equal(resolveAgentPath({ AGENT_PATH: "/bin/agent" }), "/bin/agent");
  assert.equal(
    resolveAgentPath({ CURSOR_AGENT_PATH: "/cursor/agent", AGENT_PATH: "/bin/agent" }),
    "/cursor/agent",
  );
});

test("resolveApiKey omits empty values", () => {
  assert.equal(resolveApiKey({}), undefined);
  assert.equal(resolveApiKey({ CURSOR_API_KEY: "k" }), "k");
});

test("buildPrintArgs puts --force only when requested", () => {
  const base = buildPrintArgs({
    modelId: "auto",
    workspacePath: "/tmp/ws",
    prompt: "hi",
  });
  assert.deepEqual(base, [
    "--print",
    "--output-format",
    "stream-json",
    "--model",
    "auto",
    "--trust",
    "--workspace",
    "/tmp/ws",
    "hi",
  ]);
  assert.ok(!base.includes("--force"));

  const forced = buildPrintArgs({
    modelId: "auto",
    workspacePath: "/tmp/ws",
    prompt: "hi",
    force: true,
    apiKey: "secret",
  });
  assert.equal(forced[0], "--api-key");
  assert.equal(forced[1], "secret");
  assert.ok(forced.includes("--force"));
});
