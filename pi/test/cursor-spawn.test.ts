import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAcpArgs,
  buildSpawnEnv,
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

test("buildAcpArgs is only the acp subcommand", () => {
  assert.deepEqual(buildAcpArgs(), ["acp"]);
});
