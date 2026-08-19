import assert from "node:assert/strict";
import test from "node:test";
import {
  extractRejection,
  formatRejected,
  formatToolStarted,
  parseLine,
  toPiToolName,
} from "../src/cursor-provider/events.ts";
import type { CursorToolCallEvent } from "../src/cursor-provider/types.ts";

test("toPiToolName maps known CLI keys and strips ToolCall", () => {
  assert.equal(toPiToolName("deleteToolCall"), "Delete");
  assert.equal(toPiToolName("mysteryToolCall"), "mystery");
});

test("parseLine ignores junk and returns objects", () => {
  assert.equal(parseLine(""), null);
  assert.equal(parseLine("not-json"), null);
  assert.deepEqual(parseLine('{"type":"result","subtype":"success","duration_ms":1}'), {
    type: "result",
    subtype: "success",
    duration_ms: 1,
  });
});

test("extractRejection reads completed rejected payloads", () => {
  const started: CursorToolCallEvent = {
    type: "tool_call",
    subtype: "started",
    tool_call: { deleteToolCall: { args: { path: ".env" } } },
  };
  assert.equal(extractRejection(started), undefined);

  const rejected: CursorToolCallEvent = {
    type: "tool_call",
    subtype: "completed",
    tool_call: {
      deleteToolCall: {
        args: { path: ".env" },
        result: { rejected: { reason: "Auto-review blocked this tool" } },
      },
    },
  };
  assert.deepEqual(extractRejection(rejected), {
    toolName: "Delete",
    args: { path: ".env" },
    reason: "Auto-review blocked this tool",
  });
});

test("formatters keep a short tool marker", () => {
  assert.match(formatToolStarted("Delete", { path: ".env" }), /⏳ \[Delete\]/);
  assert.equal(
    formatRejected({ toolName: "Delete", args: { path: ".env" }, reason: "blocked" }),
    "\n⛔ [Delete] blocked: blocked\n",
  );
});
