import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkText,
  formatRejected,
  formatToolActivity,
  isTranscriptMarkerLine,
  thoughtText,
  toolMarker,
  windowUsage,
} from "../src/cursor-provider/events.ts";

test("chunk and thought extractors only fire for their sessionUpdate", () => {
  assert.equal(chunkText({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } }), "hi");
  assert.equal(thoughtText({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } }), undefined);
  assert.equal(thoughtText({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "hmm" } }), "hmm");
  assert.equal(chunkText({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "hmm" } }), undefined);
});

test("tool markers come from tool_call titles, not from later status-only updates", () => {
  assert.equal(
    toolMarker({ sessionUpdate: "tool_call", title: "`echo hello`", status: "pending", kind: "execute" }),
    "\n⏳ `echo hello`\n",
  );
  assert.equal(toolMarker({ sessionUpdate: "tool_call_update", status: "completed", toolCallId: "x" }), undefined);
  assert.match(
    toolMarker({ sessionUpdate: "tool_call_update", title: "`echo hello`", status: "completed" }) ?? "",
    /⏳ `echo hello` completed/,
  );
});

test("every marker the provider emits is recognised as transcript decoration", () => {
  const emitted = [formatToolActivity("`ls`"), formatRejected("`cat /etc/hostname`", "Not in allowlist: cat")];
  for (const text of emitted) {
    const lines = text.split("\n").filter((line) => line.length > 0);
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.ok(isTranscriptMarkerLine(line), `expected a marker line: ${line}`);
    }
  }
  assert.equal(isTranscriptMarkerLine("Deleted the file."), false);
  assert.ok(isTranscriptMarkerLine("↻ Retrying this turn with --force (Cursor will auto-approve tools)."));
});

test("usage_update is captured for observation and not treated as text", () => {
  assert.deepEqual(windowUsage({ sessionUpdate: "usage_update", size: 200000, used: 1200 }), {
    size: 200000,
    used: 1200,
  });
  assert.equal(chunkText({ sessionUpdate: "usage_update", size: 200000, used: 1200 }), undefined);
});
