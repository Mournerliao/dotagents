import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalog,
  canonicalIdOf,
  contextWindowFromName,
  isDefaultVariantName,
  parseAgentModelsOutput,
  parseModelId,
} from "../src/models.ts";

test("parseAgentModelsOutput skips headers and strips current/default flags", () => {
  const output = [
    "Available models",
    "auto - Auto (default)",
    "claude-opus-5-thinking-high - Claude Opus 5 1M Thinking",
    "claude-fable-5-thinking-high - Claude Fable 5 1M Thinking (NO ZDR)",
    "Tip: use --model <id>",
    "not a model line",
  ].join("\n");
  const models = parseAgentModelsOutput(output);
  assert.deepEqual(models, [
    { id: "auto", name: "Auto" },
    { id: "claude-opus-5-thinking-high", name: "Claude Opus 5 1M Thinking" },
    { id: "claude-fable-5-thinking-high", name: "Claude Fable 5 1M Thinking (NO ZDR)" },
  ]);
});

test("parseModelId splits effort, thinking and fast in either order", () => {
  assert.deepEqual(parseModelId("claude-opus-5-thinking-high-fast"), {
    base: "claude-opus-5",
    thinking: true,
    effort: "high",
    fast: true,
  });
  assert.deepEqual(parseModelId("claude-4.6-sonnet-medium-thinking"), {
    base: "claude-4.6-sonnet",
    thinking: true,
    effort: "medium",
    fast: false,
  });
  assert.deepEqual(parseModelId("gpt-5.5-extra-high-fast"), {
    base: "gpt-5.5",
    thinking: false,
    effort: "extra-high",
    fast: true,
  });
  assert.deepEqual(parseModelId("gpt-5.6-sol-none"), {
    base: "gpt-5.6-sol",
    thinking: false,
    effort: "none",
    fast: false,
  });
});

test("parseModelId leaves ids without an effort word alone", () => {
  for (const id of ["auto", "composer-2.5", "kimi-k2.7-code", "gpt-5-mini", "gemini-3.1-pro"]) {
    assert.deepEqual(parseModelId(id), { base: id, thinking: false, effort: undefined, fast: false });
  }
});

test("canonicalIdOf keeps the thinking and fast axes but drops effort", () => {
  assert.equal(canonicalIdOf(parseModelId("claude-opus-5-thinking-high-fast")), "claude-opus-5-thinking-fast");
  assert.equal(canonicalIdOf(parseModelId("gpt-5.6-sol-xhigh")), "gpt-5.6-sol");
  assert.equal(canonicalIdOf(parseModelId("composer-2.5")), "composer-2.5");
});

test("isDefaultVariantName detects the variant Cursor names without an effort word", () => {
  assert.equal(isDefaultVariantName("Claude Opus 4.7 1M"), true);
  assert.equal(isDefaultVariantName("Claude Opus 5 1M Thinking"), true);
  assert.equal(isDefaultVariantName("Claude Opus 4.7 1M High"), false);
  assert.equal(isDefaultVariantName("GPT-5.5 Extra High"), false);
  assert.equal(isDefaultVariantName("Claude Opus 5 1M Max Thinking"), false);
});

test("contextWindowFromName reads Cursor's 1M marker", () => {
  assert.equal(contextWindowFromName("Claude Opus 5 1M Thinking"), 1_000_000);
  assert.equal(contextWindowFromName("Codex 5.3"), 200_000);
});

test("buildCatalog collapses effort variants into one model with a thinking map", () => {
  const catalog = buildCatalog([
    { id: "claude-opus-5-thinking-low", name: "Claude Opus 5 1M Low Thinking" },
    { id: "claude-opus-5-thinking-medium", name: "Claude Opus 5 1M Medium Thinking" },
    { id: "claude-opus-5-thinking-high", name: "Claude Opus 5 1M Thinking" },
    { id: "claude-opus-5-thinking-max", name: "Claude Opus 5 1M Max Thinking" },
  ]);

  assert.equal(catalog.models.length, 1);
  const model = catalog.models[0];
  assert.equal(model?.id, "claude-opus-5-thinking");
  assert.equal(model?.name, "Claude Opus 5 1M Thinking (Cursor)");
  assert.equal(model?.reasoning, true);
  assert.equal(model?.contextWindow, 1_000_000);

  // Levels this family lacks must be null so Pi does not offer them.
  assert.equal(model?.thinkingLevelMap?.off, null);
  assert.equal(model?.thinkingLevelMap?.minimal, null);
  assert.equal(model?.thinkingLevelMap?.xhigh, null);
  assert.equal(model?.thinkingLevelMap?.high, "claude-opus-5-thinking-high");
  assert.equal(model?.thinkingLevelMap?.max, "claude-opus-5-thinking-max");

  assert.equal(catalog.resolveCliId("claude-opus-5-thinking", "low"), "claude-opus-5-thinking-low");
  assert.equal(catalog.resolveCliId("claude-opus-5-thinking", "max"), "claude-opus-5-thinking-max");
  // Cursor's own default wins when no level is asked for, or the level is absent.
  assert.equal(catalog.resolveCliId("claude-opus-5-thinking"), "claude-opus-5-thinking-high");
  assert.equal(catalog.resolveCliId("claude-opus-5-thinking", "minimal"), "claude-opus-5-thinking-high");
});

test("buildCatalog shares the context window across a base id's variants", () => {
  // Cursor labels "1M" on the plain variant but not on the fast one.
  const catalog = buildCatalog([
    { id: "gpt-5.6-sol-medium", name: "GPT-5.6 Sol 1M" },
    { id: "gpt-5.6-sol-medium-fast", name: "GPT-5.6 Sol Fast" },
  ]);
  assert.deepEqual(
    catalog.models.map((m) => [m.id, m.contextWindow]).sort(),
    [
      ["gpt-5.6-sol", 1_000_000],
      ["gpt-5.6-sol-fast", 1_000_000],
    ],
  );
});

test("buildCatalog keeps thinking and fast as separate models", () => {
  const catalog = buildCatalog([
    { id: "claude-opus-5-high", name: "Claude Opus 5 1M" },
    { id: "claude-opus-5-high-fast", name: "Claude Opus 5 1M Fast" },
    { id: "claude-opus-5-thinking-high", name: "Claude Opus 5 1M Thinking" },
    { id: "claude-opus-5-thinking-high-fast", name: "Claude Opus 5 1M Thinking Fast" },
  ]);
  assert.deepEqual(catalog.models.map((m) => m.id).sort(), [
    "claude-opus-5",
    "claude-opus-5-fast",
    "claude-opus-5-thinking",
    "claude-opus-5-thinking-fast",
  ]);
});

test("buildCatalog marks single-variant families as non-reasoning", () => {
  const catalog = buildCatalog([
    { id: "auto", name: "Auto" },
    { id: "composer-2.5", name: "Composer 2.5" },
  ]);
  for (const model of catalog.models) {
    assert.equal(model.reasoning, false);
    assert.equal(model.thinkingLevelMap, undefined);
  }
  assert.equal(catalog.resolveCliId("auto"), "auto");
});

test("resolveCliId passes through ids it never saw", () => {
  const catalog = buildCatalog([{ id: "auto", name: "Auto" }]);
  assert.equal(catalog.resolveCliId("something-else", "high"), "something-else");
});

test("buildCatalog picks a default when no variant name is effort-free", () => {
  const catalog = buildCatalog([
    { id: "kimi-k3-low", name: "Kimi K3 Low" },
    { id: "kimi-k3-high", name: "Kimi K3 High" },
  ]);
  assert.equal(catalog.resolveCliId("kimi-k3"), "kimi-k3-high");
});
