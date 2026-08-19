import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PROMPT_BYTES,
  buildPrintArgs,
  buildSpawnEnv,
  checkPromptSize,
  resolveAgentPath,
  resolveApiKey,
} from "../src/cursor-provider/spawn.ts";

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

test("buildSpawnEnv carries the key in the environment, never on argv", () => {
  assert.deepEqual(buildSpawnEnv({ PATH: "/bin" }, "secret"), { PATH: "/bin", CURSOR_API_KEY: "secret" });
  assert.deepEqual(buildSpawnEnv({ PATH: "/bin" }), { PATH: "/bin" });
});

test("buildPrintArgs puts --force only when requested and never the api key", () => {
  const base = buildPrintArgs({ modelId: "auto", workspacePath: "/tmp/ws", prompt: "hi" });
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

  const forced = buildPrintArgs({
    modelId: "auto",
    workspacePath: "/tmp/ws",
    prompt: "hi",
    force: true,
  });
  assert.ok(forced.includes("--force"));
  assert.ok(!forced.includes("--api-key"));
});

test("checkPromptSize only complains past the limit and says what to do", () => {
  assert.equal(checkPromptSize("hi"), undefined);
  assert.equal(checkPromptSize("a".repeat(MAX_PROMPT_BYTES)), undefined);

  const message = checkPromptSize("a".repeat(MAX_PROMPT_BYTES + 1));
  assert.match(message ?? "", /\/compact/);
  assert.match(message ?? "", /command-line argument/);
});

test("checkPromptSize measures bytes, not characters", () => {
  // Three bytes per character in UTF-8, so a third of the limit in characters fits.
  const justUnder = "字".repeat(Math.floor(MAX_PROMPT_BYTES / 3));
  assert.equal(checkPromptSize(justUnder), undefined);
  assert.ok(checkPromptSize("字".repeat(Math.floor(MAX_PROMPT_BYTES / 3) + 1)));
});
