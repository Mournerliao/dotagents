import assert from "node:assert/strict";
import test from "node:test";
import {
  inferReasoning,
  parseAgentModelsOutput,
  toCanonicalId,
  toCursorId,
  toProviderModels,
} from "../src/cursor-provider/models.ts";

test("parseAgentModelsOutput skips headers and captures current/default flags", () => {
  const output = [
    "Available models",
    "auto - Auto",
    "opus-4.6-thinking - Claude 4.6 Opus (Thinking)  (default)",
    "sonnet-4.6 - Claude 4.6 Sonnet  (current)",
    "Tip: use --model",
    "not a model line",
  ].join("\n");
  const models = parseAgentModelsOutput(output);
  assert.deepEqual(
    models.map((m) => m.id),
    ["auto", "opus-4.6-thinking", "sonnet-4.6"],
  );
  assert.equal(models[1]?.name, "Claude 4.6 Opus (Thinking)");
  assert.equal(models[1]?.reasoning, true);
});

test("toCanonicalId hides thinking variants and keeps unmapped ids", () => {
  assert.equal(toCanonicalId("sonnet-4.6"), "claude-sonnet-4-6");
  assert.equal(toCanonicalId("sonnet-4.6-thinking"), null);
  assert.equal(toCanonicalId("composer-1.5"), "composer-1.5");
});

test("toCursorId maps reasoning levels onto CLI variants", () => {
  assert.equal(toCursorId("claude-sonnet-4-6"), "sonnet-4.6");
  assert.equal(toCursorId("claude-sonnet-4-6", "high"), "sonnet-4.6-thinking");
  assert.equal(toCursorId("grok-4.6", "high"), "grok-4.6-high");
  assert.equal(toCursorId("unknown-model", "high"), "unknown-model");
});

test("toProviderModels omits variant-only ids and suffixes the name", () => {
  const models = toProviderModels([
    { id: "sonnet-4.6", name: "Claude 4.6 Sonnet", reasoning: false, contextWindow: 1, maxTokens: 2 },
    { id: "sonnet-4.6-thinking", name: "Claude 4.6 Sonnet (Thinking)", reasoning: true, contextWindow: 1, maxTokens: 2 },
  ]);
  assert.equal(models.length, 1);
  assert.equal(models[0]?.id, "claude-sonnet-4-6");
  assert.equal(models[0]?.name, "Claude 4.6 Sonnet (Cursor)");
});

test("inferReasoning treats high and thinking suffixes as reasoning", () => {
  assert.equal(inferReasoning("grok-4.6-high"), true);
  assert.equal(inferReasoning("grok-4.6"), false);
});
