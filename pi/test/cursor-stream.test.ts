import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { Api, AssistantMessageEvent, Context, Model } from "@earendil-works/pi-ai";
import type { ChildProcess } from "node:child_process";
import { MAX_PROMPT_BYTES } from "../src/cursor-provider/spawn.ts";
import { streamCursorCli, type SpawnFn } from "../src/cursor-provider/stream.ts";

function testModel(): Model<Api> {
  return {
    id: "auto",
    name: "Auto",
    api: "cursor-cli",
    provider: "cursor",
    baseUrl: "cli://cursor-agent",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 32768,
  };
}

const context: Context = {
  messages: [{ role: "user", content: "delete the secret file", timestamp: 1 }],
};

function assistantLine(text: string): string {
  return JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
    session_id: "s",
  });
}

function toolLine(
  subtype: "started" | "completed",
  key: string,
  payload: Record<string, unknown>,
): string {
  return JSON.stringify({
    type: "tool_call",
    subtype,
    tool_call: { [key]: payload },
  });
}

function fakeChild(lines: string[], exitCode = 0): ChildProcess {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as ChildProcess;
  child.stdout = stdout;
  child.stderr = stderr;
  child.kill = () => true;
  stdout.on("end", () => {
    setImmediate(() => child.emit("close", exitCode));
  });
  queueMicrotask(() => {
    for (const line of lines) stdout.write(`${line}\n`);
    stdout.end();
    stderr.end();
  });
  return child;
}

function spawnFrom(runs: Array<{ lines: string[]; exitCode?: number }>): { spawn: SpawnFn; args: string[][] } {
  const captured: string[][] = [];
  let i = 0;
  const spawn: SpawnFn = (_cmd, args) => {
    const run = runs[i];
    i += 1;
    if (!run) throw new Error("unexpected spawn");
    captured.push([...args]);
    return fakeChild(run.lines, run.exitCode ?? 0);
  };
  return { spawn, args: captured };
}

async function collect(stream: AsyncIterable<AssistantMessageEvent>): Promise<AssistantMessageEvent[]> {
  const events: AssistantMessageEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function textOf(events: AssistantMessageEvent[]): string {
  return events
    .filter((e) => e.type === "text_delta")
    .map((e) => (e.type === "text_delta" ? e.delta : ""))
    .join("");
}

test("streamCursorCli renders assistant text from NDJSON", async () => {
  const { spawn } = spawnFrom([{ lines: [assistantLine("hello from cursor")] }]);
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  assert.equal(events.at(-1)?.type, "done");
  assert.match(textOf(events), /hello from cursor/);
});

test("streamCursorCli asks resolveCliId for the id the CLI should run", async () => {
  const { spawn, args } = spawnFrom([{ lines: [assistantLine("ok")] }]);
  await collect(
    streamCursorCli(testModel(), context, { reasoning: "max" }, {
      spawn,
      workspacePath: "/tmp/ws",
      resolveCliId: (id, level) => `${id}-${level ?? "default"}`,
    }),
  );
  const modelIndex = args[0]?.indexOf("--model") ?? -1;
  assert.ok(modelIndex >= 0);
  assert.equal(args[0]?.[modelIndex + 1], "auto-max");
});

test("streamCursorCli spawns with --force when the turn was already granted it", async () => {
  const { spawn, args } = spawnFrom([{ lines: [assistantLine("ok")] }]);
  await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws", force: true }),
  );
  assert.equal(args.length, 1);
  assert.ok(args[0]?.includes("--force"));
});

test("streamCursorCli refuses a context too large for the command line", async () => {
  const { spawn, args } = spawnFrom([]);
  const huge: Context = {
    messages: [{ role: "user", content: "a".repeat(MAX_PROMPT_BYTES + 1), timestamp: 1 }],
  };
  const events = await collect(
    streamCursorCli(testModel(), huge, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  assert.equal(args.length, 0);
  const last = events.at(-1);
  assert.equal(last?.type, "error");
  assert.match(last?.type === "error" ? (last.error.errorMessage ?? "") : "", /\/compact/);
});

test("streamCursorCli reports a non-zero exit even when some text arrived", async () => {
  const { spawn } = spawnFrom([{ lines: [assistantLine("partial answer")], exitCode: 1 }]);
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  const last = events.at(-1);
  assert.equal(last?.type, "error");
  assert.match(last?.type === "error" ? (last.error.errorMessage ?? "") : "", /exited with code 1/);
});

test("streamCursorCli retries with --force after a confirmed rejection", async () => {
  // A blocked tool makes the CLI exit non-zero; that must still reach the retry prompt.
  const { spawn, args } = spawnFrom([
    {
      lines: [
        toolLine("started", "deleteToolCall", { args: { path: ".env" } }),
        toolLine("completed", "deleteToolCall", {
          args: { path: ".env" },
          result: { rejected: { reason: "Auto-review blocked this tool" } },
        }),
      ],
      exitCode: 1,
    },
    { lines: [assistantLine("deleted")] },
  ]);

  const events = await collect(
    streamCursorCli(testModel(), context, undefined, {
      spawn,
      workspacePath: "/tmp/ws",
      hasUI: true,
      confirm: async () => true,
    }),
  );

  assert.equal(args.length, 2);
  assert.ok(!args[0]?.includes("--force"));
  assert.ok(args[1]?.includes("--force"));
  assert.match(textOf(events), /blocked: Auto-review blocked this tool/);
  assert.match(textOf(events), /Retrying this turn with --force/);
  assert.match(textOf(events), /deleted/);
});

test("streamCursorCli does not retry when confirm is declined", async () => {
  const { spawn, args } = spawnFrom([
    {
      lines: [
        toolLine("completed", "deleteToolCall", {
          args: { path: ".env" },
          result: { rejected: { reason: "blocked" } },
        }),
      ],
    },
  ]);
  await collect(
    streamCursorCli(testModel(), context, undefined, {
      spawn,
      workspacePath: "/tmp/ws",
      hasUI: true,
      confirm: async () => false,
    }),
  );
  assert.equal(args.length, 1);
});
