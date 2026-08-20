import assert from "node:assert/strict";
import test from "node:test";
import type { Api, AssistantMessageEvent, Context, Model } from "@earendil-works/pi-ai";
import { streamCursorCli, toPiUsage } from "../src/cursor-provider/stream.ts";
import type { PermissionParams } from "../src/cursor-provider/consent.ts";
import { scriptedAcp } from "./acp-harness.ts";

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
  messages: [{ role: "user", content: "hello", timestamp: 1 }],
};

const shellPermission: PermissionParams = {
  sessionId: "sess-1",
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

function thinkingOf(events: AssistantMessageEvent[]): string {
  return events
    .filter((e) => e.type === "thinking_delta")
    .map((e) => (e.type === "thinking_delta" ? e.delta : ""))
    .join("");
}

test("toPiUsage keeps cache tokens disjoint from input and leaves cost at zero", () => {
  assert.deepEqual(
    toPiUsage({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedReadTokens: 40,
      cachedWriteTokens: 10,
      thoughtTokens: 5,
    }),
    {
      input: 50,
      output: 20,
      cacheRead: 40,
      cacheWrite: 10,
      reasoning: 5,
      totalTokens: 120,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  );
});

test("streamCursorCli renders text and thinking from session/update", async () => {
  const { spawn, argv, methods } = scriptedAcp({
    updates: [
      { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "considering" } },
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello from acp" } },
    ],
  });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  assert.deepEqual(argv, [["acp"]]);
  assert.deepEqual(methods, [
    "initialize",
    "authenticate",
    "session/new",
    "session/set_model",
    "session/prompt",
  ]);
  assert.equal(thinkingOf(events), "considering");
  assert.match(textOf(events), /hello from acp/);
  assert.equal(events.at(-1)?.type, "done");
});

test("tool_call titles become transcript decoration; status-only updates do not", async () => {
  const { spawn } = scriptedAcp({
    updates: [
      { sessionUpdate: "tool_call", title: "`echo hello`", status: "pending", kind: "execute" },
      { sessionUpdate: "tool_call_update", status: "completed", toolCallId: "x" },
      { sessionUpdate: "tool_call_update", title: "`echo hello`", status: "completed" },
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "done" } },
    ],
  });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  const text = textOf(events);
  assert.match(text, /⏳ `echo hello`/);
  assert.match(text, /⏳ `echo hello` completed/);
  assert.match(text, /done/);
});

test("streamCursorCli asks resolveCliId for session/set_model", async () => {
  const { spawn, methods } = scriptedAcp({
    updates: [{ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "ok" } }],
  });
  await collect(
    streamCursorCli(testModel(), context, { reasoning: "max" }, {
      spawn,
      workspacePath: "/tmp/ws",
      resolveCliId: (id, level) => `${id}-${level ?? "default"}`,
    }),
  );
  assert.ok(methods.includes("session/set_model"));
});

test("a set_model failure does not fail the turn", async () => {
  const { spawn } = scriptedAcp({
    setModelError: "unstable",
    updates: [{ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "still works" } }],
  });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  assert.equal(events.at(-1)?.type, "done");
  assert.match(textOf(events), /still works/);
});

test("authenticate failure fails the turn", async () => {
  const { spawn } = scriptedAcp({ authenticateError: "login required" });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  const last = events.at(-1);
  assert.equal(last?.type, "error");
  assert.match(last?.type === "error" ? (last.error.errorMessage ?? "") : "", /login required/);
});

test("a TUI permission prompt is answered with the selected optionId", async () => {
  const { spawn, permissionOptionIds } = scriptedAcp({
    permission: shellPermission,
    afterPermission: [{ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "done" } }],
  });
  const titles: string[] = [];
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, {
      spawn,
      workspacePath: "/tmp/ws",
      hasUI: true,
      select: async (title, choices) => {
        titles.push(title);
        assert.ok(choices.includes("Allow always (writes ~/.cursor/cli-config.json)"));
        return "Allow once";
      },
    }),
  );
  assert.deepEqual(permissionOptionIds, ["allow-once"]);
  assert.match(titles[0] ?? "", /echo hello/);
  assert.match(titles[0] ?? "", /Not in allowlist: echo/);
  assert.match(textOf(events), /done/);
});

test("a TUI reject writes a blocked decoration line", async () => {
  const { spawn, permissionOptionIds } = scriptedAcp({
    permission: shellPermission,
    afterPermission: [{ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "stopped" } }],
  });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, {
      spawn,
      workspacePath: "/tmp/ws",
      hasUI: true,
      select: async () => "Reject",
    }),
  );
  assert.deepEqual(permissionOptionIds, ["reject-once"]);
  assert.match(textOf(events), /⛔ `echo hello` blocked/);
  assert.match(textOf(events), /stopped/);
});

test("without a UI the permission is rejected and a hint is streamed", async () => {
  const { spawn, permissionOptionIds } = scriptedAcp({
    permission: shellPermission,
    afterPermission: [{ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "refused" } }],
  });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws", hasUI: false }),
  );
  assert.deepEqual(permissionOptionIds, ["reject-once"]);
  assert.match(textOf(events), /\/cursor-allow/);
});

test("without a UI, autoAllow answers allow-once", async () => {
  const { spawn, permissionOptionIds } = scriptedAcp({ permission: shellPermission });
  await collect(
    streamCursorCli(testModel(), context, undefined, {
      spawn,
      workspacePath: "/tmp/ws",
      hasUI: false,
      autoAllow: true,
    }),
  );
  assert.deepEqual(permissionOptionIds, ["allow-once"]);
});

test("abort during a hung prompt ends as aborted", async () => {
  const { spawn } = scriptedAcp({ hangUntilAbort: true });
  const ac = new AbortController();
  const stream = streamCursorCli(testModel(), context, { signal: ac.signal }, {
    spawn,
    workspacePath: "/tmp/ws",
  });
  const pending = collect(stream);
  setTimeout(() => ac.abort(), 20);
  const events = await pending;
  const last = events.at(-1);
  assert.equal(last?.type, "error");
  assert.equal(last?.type === "error" ? last.reason : "", "aborted");
});

test("usage from session/prompt is copied onto the assistant message", async () => {
  const { spawn } = scriptedAcp({
    updates: [{ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "ok" } }],
    usage: { inputTokens: 80, outputTokens: 10, totalTokens: 90, cachedReadTokens: 20 },
  });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  const done = events.at(-1);
  assert.equal(done?.type, "done");
  if (done?.type === "done") {
    assert.equal(done.message.usage.input, 60);
    assert.equal(done.message.usage.output, 10);
    assert.equal(done.message.usage.cacheRead, 20);
    assert.equal(done.message.usage.totalTokens, 90);
  }
});

test("malformed session/update frames are ignored", async () => {
  const { spawn } = scriptedAcp({
    junkParams: [{ notAnUpdate: true }, { sessionId: "sess-1", update: { sessionUpdate: 1 } }, { update: { sessionUpdate: "nope" } }],
    updates: [{ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "ok" } }],
  });
  const events = await collect(
    streamCursorCli(testModel(), context, undefined, { spawn, workspacePath: "/tmp/ws" }),
  );
  assert.equal(events.at(-1)?.type, "done");
  assert.equal(textOf(events), "ok");
});

test("PI_CURSOR_ACP_DEBUG on host.env logs usage_update to stderr", async () => {
  const { spawn } = scriptedAcp({
    updates: [
      { sessionUpdate: "usage_update", size: 200000, used: 1200 },
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "ok" } },
    ],
  });
  const chunks: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    const events = await collect(
      streamCursorCli(testModel(), context, undefined, {
        spawn,
        workspacePath: "/tmp/ws",
        env: { PI_CURSOR_ACP_DEBUG: "1" },
      }),
    );
    assert.equal(events.at(-1)?.type, "done");
    assert.match(chunks.join(""), /usage_update/);
    assert.match(chunks.join(""), /200000/);
  } finally {
    process.stderr.write = orig;
  }
});
