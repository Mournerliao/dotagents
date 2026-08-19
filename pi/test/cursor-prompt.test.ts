import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantMessage, Context } from "@earendil-works/pi-ai";
import { serializeContext } from "../src/cursor-provider/prompt.ts";

test("serializeContext prefixes roles and placeholders images", () => {
  const context: Context = {
    systemPrompt: "You are an expert.",
    messages: [
      { role: "user", content: "hello", timestamp: 1 },
      {
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        api: "cursor-cli",
        provider: "cursor",
        model: "auto",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: 2,
      } satisfies AssistantMessage,
      {
        role: "user",
        content: [{ type: "image", data: "aaaa", mimeType: "image/png" }],
        timestamp: 3,
      },
      {
        role: "toolResult",
        toolCallId: "1",
        toolName: "Read",
        content: [{ type: "text", text: "file body" }],
        isError: false,
        timestamp: 4,
      },
    ],
  };
  const text = serializeContext(context);
  assert.match(text, /\[System\]\nYou are an expert\./);
  assert.match(text, /\[User\]\nhello/);
  assert.match(text, /\[Assistant\]\nhi/);
  assert.match(text, /\[Image: image\/png,/);
  assert.match(text, /\[Tool result: Read\]\nfile body/);
});

function assistantMessage(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "cursor-cli",
    provider: "cursor",
    model: "auto",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 1,
  };
}

test("serializeContext drops the tool markers this provider added for display", () => {
  const context: Context = {
    messages: [
      assistantMessage(
        ['⏳ [Shell] {"command":"ls"}', "Listed the directory.", "⛔ [Delete] blocked: Auto-review", "↻ Retrying this turn with --force"].join(
          "\n",
        ),
      ),
    ],
  };
  const text = serializeContext(context);
  assert.match(text, /\[Assistant\]\nListed the directory\./);
  assert.doesNotMatch(text, /⏳/);
  assert.doesNotMatch(text, /⛔/);
  assert.doesNotMatch(text, /↻/);
});

test("serializeContext omits an assistant turn that was only tool markers", () => {
  const context: Context = {
    messages: [assistantMessage('⏳ [Shell] {"command":"ls"}')],
  };
  assert.equal(serializeContext(context), "");
});
