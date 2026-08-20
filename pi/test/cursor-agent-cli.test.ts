import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  runAgentLogin,
  runAgentLogout,
  runAgentModels,
  runAgentStatus,
  type SpawnFn,
} from "../src/cursor-provider/agent-cli.ts";

function scriptedCli(script: {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  hang?: boolean;
}): {
  spawn: SpawnFn;
  calls: { command: string; args: string[]; env?: NodeJS.ProcessEnv }[];
} {
  const calls: { command: string; args: string[]; env?: NodeJS.ProcessEnv }[] = [];
  const spawn: SpawnFn = (command, args, options) => {
    calls.push({ command, args: [...args], ...(options?.env ? { env: options.env } : {}) });
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const child = new EventEmitter() as ChildProcess;
    child.stdin = stdin;
    child.stdout = stdout;
    child.stderr = stderr;

    let closed = false;
    const finish = (code: number | null = 0): void => {
      if (closed) return;
      closed = true;
      stdin.end();
      stdout.end();
      stderr.end();
      setImmediate(() => child.emit("close", code));
    };

    child.kill = () => {
      finish(0);
      return true;
    };

    if (script.stdout) stdout.write(script.stdout);
    if (script.stderr) stderr.write(script.stderr);
    if (!script.hang) setImmediate(() => finish(script.code ?? 0));
    return child;
  };
  return { spawn, calls };
}

test("package metadata matches package.json", () => {
  assert.equal(PACKAGE_NAME, "@mournerliao/pi-cursor-provider");
  assert.match(PACKAGE_VERSION, /^\d+\.\d+\.\d+/);
});

test("runAgentModels parses stdout and prefers CURSOR_AGENT_PATH", async () => {
  const { spawn, calls } = scriptedCli({
    stdout: "Available models\nauto - Auto (default)\n",
  });
  const models = await runAgentModels({ CURSOR_AGENT_PATH: "/cursor/agent", PATH: "/bin" }, spawn);
  assert.deepEqual(models, [{ id: "auto", name: "Auto" }]);
  assert.equal(calls[0]?.command, "/cursor/agent");
  assert.deepEqual(calls[0]?.args, ["models"]);
});

test("runAgentModels puts CURSOR_API_KEY in the child env, not argv", async () => {
  const { spawn, calls } = scriptedCli({ stdout: "auto - Auto\n" });
  await runAgentModels({ PATH: "/bin", CURSOR_API_KEY: "secret" }, spawn);
  assert.equal(calls[0]?.env?.["CURSOR_API_KEY"], "secret");
  assert.ok(!(calls[0]?.args ?? []).includes("secret"));
});

test("runAgentModels throws on a non-zero exit", async () => {
  const { spawn } = scriptedCli({ code: 1, stderr: "not logged in" });
  await assert.rejects(() => runAgentModels({}, spawn), /exited with code 1/);
});

test("runAgentModels times out a hung CLI", async () => {
  const { spawn } = scriptedCli({ hang: true });
  await assert.rejects(() => runAgentModels({}, spawn, 20), /timed out after 20ms/);
});

test("runAgentStatus concatenates stdout and stderr", async () => {
  const { spawn } = scriptedCli({ stdout: "logged in\n", stderr: "ok" });
  assert.equal(await runAgentStatus({}, spawn), "logged in\nok");
});

test("runAgentLogin and runAgentLogout fail on non-zero exit", async () => {
  const { spawn } = scriptedCli({ code: 2 });
  await assert.rejects(() => runAgentLogin({}, spawn), /exited with code 2/);
  await assert.rejects(() => runAgentLogout({}, spawn), /exited with code 2/);
});
