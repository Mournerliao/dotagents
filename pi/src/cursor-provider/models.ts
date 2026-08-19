import type { CursorModelDef, ModelVariants, ReasoningLevel } from "./types.ts";

/**
 * Fallback list when `agent models` fails. Also supplies contextWindow / maxTokens
 * for discovered ids. Source: Cursor Agent CLI model catalogue, plus grok-4.6
 * variants used by this repo's owner.
 */
export const STATIC_MODELS: CursorModelDef[] = [
  { id: "auto", name: "Auto", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "composer-1.5", name: "Composer 1.5", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "composer-1", name: "Composer 1", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "opus-4.6-thinking", name: "Claude 4.6 Opus (Thinking)", reasoning: true, contextWindow: 200000, maxTokens: 32000 },
  { id: "opus-4.6", name: "Claude 4.6 Opus", reasoning: false, contextWindow: 200000, maxTokens: 32000 },
  { id: "opus-4.5-thinking", name: "Claude 4.5 Opus (Thinking)", reasoning: true, contextWindow: 200000, maxTokens: 32000 },
  { id: "opus-4.5", name: "Claude 4.5 Opus", reasoning: false, contextWindow: 200000, maxTokens: 32000 },
  { id: "sonnet-4.6-thinking", name: "Claude 4.6 Sonnet (Thinking)", reasoning: true, contextWindow: 200000, maxTokens: 32000 },
  { id: "sonnet-4.6", name: "Claude 4.6 Sonnet", reasoning: false, contextWindow: 200000, maxTokens: 32000 },
  { id: "sonnet-4.5-thinking", name: "Claude 4.5 Sonnet (Thinking)", reasoning: true, contextWindow: 200000, maxTokens: 32000 },
  { id: "sonnet-4.5", name: "Claude 4.5 Sonnet", reasoning: false, contextWindow: 200000, maxTokens: 32000 },
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.3-codex-low", name: "GPT-5.3 Codex Low", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.3-codex-high", name: "GPT-5.3 Codex High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.3-codex-xhigh", name: "GPT-5.3 Codex Extra High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.3-codex-fast", name: "GPT-5.3 Codex Fast", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.3-codex-low-fast", name: "GPT-5.3 Codex Low Fast", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.3-codex-high-fast", name: "GPT-5.3 Codex High Fast", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.3-codex-xhigh-fast", name: "GPT-5.3 Codex Extra High Fast", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2", name: "GPT-5.2", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-high", name: "GPT-5.2 High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex-high", name: "GPT-5.2 Codex High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex-low", name: "GPT-5.2 Codex Low", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex-xhigh", name: "GPT-5.2 Codex Extra High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex-fast", name: "GPT-5.2 Codex Fast", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex-high-fast", name: "GPT-5.2 Codex High Fast", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex-low-fast", name: "GPT-5.2 Codex Low Fast", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.2-codex-xhigh-fast", name: "GPT-5.2 Codex Extra High Fast", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.1-high", name: "GPT-5.1 High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.1-codex-max", name: "GPT-5.1 Codex Max", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.1-codex-max-high", name: "GPT-5.1 Codex Max High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
  { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "gemini-3-pro", name: "Gemini 3 Pro", reasoning: false, contextWindow: 1000000, maxTokens: 65536 },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", reasoning: false, contextWindow: 1000000, maxTokens: 65536 },
  { id: "grok", name: "Grok", reasoning: false, contextWindow: 131072, maxTokens: 32768 },
  { id: "grok-4.6", name: "Grok 4.6", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  { id: "grok-4.6-high", name: "Grok 4.6 High", reasoning: true, contextWindow: 200000, maxTokens: 32768 },
];

export const STATIC_MODELS_MAP = new Map<string, CursorModelDef>(
  STATIC_MODELS.map((m) => [m.id, m]),
);

export const MODEL_MAP: Record<string, ModelVariants> = {
  "claude-sonnet-4-5": {
    default: "sonnet-4.5",
    minimal: "sonnet-4.5-thinking",
    low: "sonnet-4.5-thinking",
    medium: "sonnet-4.5-thinking",
    high: "sonnet-4.5-thinking",
    xhigh: "sonnet-4.5-thinking",
  },
  "claude-sonnet-4-6": {
    default: "sonnet-4.6",
    minimal: "sonnet-4.6-thinking",
    low: "sonnet-4.6-thinking",
    medium: "sonnet-4.6-thinking",
    high: "sonnet-4.6-thinking",
    xhigh: "sonnet-4.6-thinking",
  },
  "claude-opus-4-5": {
    default: "opus-4.5",
    minimal: "opus-4.5-thinking",
    low: "opus-4.5-thinking",
    medium: "opus-4.5-thinking",
    high: "opus-4.5-thinking",
    xhigh: "opus-4.5-thinking",
  },
  "claude-opus-4-6": {
    default: "opus-4.6",
    minimal: "opus-4.6-thinking",
    low: "opus-4.6-thinking",
    medium: "opus-4.6-thinking",
    high: "opus-4.6-thinking",
    xhigh: "opus-4.6-thinking",
  },
  "gpt-5.2": {
    default: "gpt-5.2",
    high: "gpt-5.2-high",
    xhigh: "gpt-5.2-high",
  },
  "gpt-5.2-codex": {
    default: "gpt-5.2-codex",
    minimal: "gpt-5.2-codex-low",
    low: "gpt-5.2-codex-low",
    high: "gpt-5.2-codex-high",
    xhigh: "gpt-5.2-codex-xhigh",
  },
  "gpt-5.2-codex-fast": {
    default: "gpt-5.2-codex-fast",
    minimal: "gpt-5.2-codex-low-fast",
    low: "gpt-5.2-codex-low-fast",
    high: "gpt-5.2-codex-high-fast",
    xhigh: "gpt-5.2-codex-xhigh-fast",
  },
  "gpt-5.3-codex": {
    default: "gpt-5.3-codex",
    minimal: "gpt-5.3-codex-low",
    low: "gpt-5.3-codex-low",
    high: "gpt-5.3-codex-high",
    xhigh: "gpt-5.3-codex-xhigh",
  },
  "gpt-5.3-codex-fast": {
    default: "gpt-5.3-codex-fast",
    minimal: "gpt-5.3-codex-low-fast",
    low: "gpt-5.3-codex-low-fast",
    high: "gpt-5.3-codex-high-fast",
    xhigh: "gpt-5.3-codex-xhigh-fast",
  },
  "gpt-5.1": {
    default: "gpt-5.1-high",
  },
  "gpt-5.1-codex-max": {
    default: "gpt-5.1-codex-max",
    high: "gpt-5.1-codex-max-high",
    xhigh: "gpt-5.1-codex-max-high",
  },
  "gemini-3-pro-preview": { default: "gemini-3-pro" },
  "gemini-3-flash-preview": { default: "gemini-3-flash" },
  "grok-code-fast-1": { default: "grok" },
  "grok-4.6": {
    default: "grok-4.6",
    high: "grok-4.6-high",
    xhigh: "grok-4.6-high",
  },
};

const REASONING_LEVELS = new Set<string>(["minimal", "low", "medium", "high", "xhigh"]);

const cursorDefaultToCanonical = new Map<string, string>();
const allMappedCursorIds = new Set<string>();
for (const [canonicalId, variants] of Object.entries(MODEL_MAP)) {
  cursorDefaultToCanonical.set(variants.default, canonicalId);
  for (const cursorId of Object.values(variants)) {
    if (cursorId) allMappedCursorIds.add(cursorId);
  }
}

export function inferReasoning(id: string): boolean {
  return /(-thinking|-high|-xhigh|-max-high)$/.test(id);
}

export function toCanonicalId(cursorId: string): string | null {
  const canonical = cursorDefaultToCanonical.get(cursorId);
  if (canonical) return canonical;
  if (allMappedCursorIds.has(cursorId)) return null;
  return cursorId;
}

export function toCursorId(canonicalId: string, reasoning?: string): string {
  const family = MODEL_MAP[canonicalId];
  if (!family) return canonicalId;
  if (reasoning && REASONING_LEVELS.has(reasoning)) {
    const variant = family[reasoning as ReasoningLevel];
    if (variant) return variant;
  }
  return family.default;
}

const MODEL_LINE_RE =
  /^([a-zA-Z0-9][a-zA-Z0-9._-]*)\s+-\s+(.+?)(?:\s+\((?:current|default|current,\s*default)\))?$/;

export function parseAgentModelsOutput(output: string): CursorModelDef[] {
  const results: CursorModelDef[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Available") || trimmed.startsWith("Tip:")) continue;
    const match = MODEL_LINE_RE.exec(trimmed);
    if (!match) continue;
    const id = match[1]?.trim();
    const rawName = match[2]?.trim();
    if (!id || !rawName) continue;
    const known = STATIC_MODELS_MAP.get(id);
    results.push({
      id,
      name: rawName,
      reasoning: known?.reasoning ?? inferReasoning(id),
      contextWindow: known?.contextWindow ?? 200000,
      maxTokens: known?.maxTokens ?? 32768,
    });
  }
  return results;
}

export type ProviderModelConfig = {
  id: string;
  name: string;
  reasoning: boolean;
  input: ["text"];
  cost: { input: 0; output: 0; cacheRead: 0; cacheWrite: 0 };
  contextWindow: number;
  maxTokens: number;
};

export function toProviderModels(defs: CursorModelDef[]): ProviderModelConfig[] {
  const seen = new Set<string>();
  const models: ProviderModelConfig[] = [];
  for (const m of defs) {
    const canonicalId = toCanonicalId(m.id);
    if (canonicalId === null) continue;
    const id = canonicalId !== m.id ? canonicalId : m.id;
    if (seen.has(id)) continue;
    seen.add(id);
    models.push({
      id,
      name: `${m.name} (Cursor)`,
      reasoning: m.reasoning,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
    });
  }
  return models;
}
