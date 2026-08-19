import type { ModelThinkingLevel, ThinkingLevel, ThinkingLevelMap } from "@earendil-works/pi-ai";
import type { CursorEffort, CursorModelDef, ParsedModelId } from "./types.ts";

/**
 * Last-resort catalogue used only when `agent models` is unreachable and no cache
 * exists. Deliberately just `auto`: a hand-written list of ids goes stale silently,
 * and offering models the account cannot spawn is worse than offering one that works.
 */
export const STATIC_MODELS: CursorModelDef[] = [{ id: "auto", name: "Auto" }];

const CONTEXT_WINDOW_DEFAULT = 200_000;
const CONTEXT_WINDOW_1M = 1_000_000;

/** The CLI never reports an output cap, so every model gets the same conservative value. */
const MAX_TOKENS = 32_768;

/** Longest first so `extra-high` wins over `high`. */
const EFFORTS_BY_LENGTH: CursorEffort[] = [
  "extra-high",
  "minimal",
  "medium",
  "xhigh",
  "high",
  "none",
  "low",
  "max",
];

const EFFORT_TO_THINKING_LEVEL: Record<CursorEffort, ModelThinkingLevel> = {
  none: "off",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  "extra-high": "xhigh",
  max: "max",
};

const THINKING_LEVELS: ModelThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

/** Which variant Cursor treats as the family default when no level is requested. */
const DEFAULT_LEVEL_PREFERENCE: ModelThinkingLevel[] = [
  "high",
  "medium",
  "xhigh",
  "max",
  "low",
  "minimal",
  "off",
];

function stripSuffix(id: string, suffix: string): string | undefined {
  const tail = `-${suffix}`;
  return id.length > tail.length && id.endsWith(tail) ? id.slice(0, -tail.length) : undefined;
}

/**
 * Splits a Cursor model id into its parts. Cursor spells families as
 * `base[-thinking][-effort][-fast]`, but puts `-thinking` on either side of the
 * effort word (`claude-opus-5-thinking-high` vs `claude-4.6-opus-high-thinking`).
 */
export function parseModelId(id: string): ParsedModelId {
  let rest = id;
  let fast = false;
  let thinking = false;
  let effort: CursorEffort | undefined;

  const withoutFast = stripSuffix(rest, "fast");
  if (withoutFast !== undefined) {
    rest = withoutFast;
    fast = true;
  }

  const withoutTrailingThinking = stripSuffix(rest, "thinking");
  if (withoutTrailingThinking !== undefined) {
    rest = withoutTrailingThinking;
    thinking = true;
  }

  for (const candidate of EFFORTS_BY_LENGTH) {
    const withoutEffort = stripSuffix(rest, candidate);
    if (withoutEffort !== undefined) {
      rest = withoutEffort;
      effort = candidate;
      break;
    }
  }

  if (!thinking) {
    const withoutLeadingThinking = stripSuffix(rest, "thinking");
    if (withoutLeadingThinking !== undefined) {
      rest = withoutLeadingThinking;
      thinking = true;
    }
  }

  return { base: rest, thinking, effort, fast };
}

/** The id Pi shows. Effort is dropped because Pi selects it through thinking levels. */
export function canonicalIdOf(parsed: ParsedModelId): string {
  const parts = [parsed.base];
  if (parsed.thinking) parts.push("thinking");
  if (parsed.fast) parts.push("fast");
  return parts.join("-");
}

const EFFORT_WORD_RE = /\b(none|minimal|low|medium|high|max)\b/i;

/**
 * Cursor omits the effort word from the display name of a family's default variant:
 * `claude-opus-4-7-xhigh` is "Claude Opus 4.7 1M" while its siblings say "High", "Max"…
 */
export function isDefaultVariantName(name: string): boolean {
  return !EFFORT_WORD_RE.test(name);
}

export function contextWindowFromName(name: string): number {
  return /\b1m\b/i.test(name) ? CONTEXT_WINDOW_1M : CONTEXT_WINDOW_DEFAULT;
}

export type ProviderModelConfig = {
  id: string;
  name: string;
  reasoning: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
  input: ["text"];
  cost: { input: 0; output: 0; cacheRead: 0; cacheWrite: 0 };
  contextWindow: number;
  maxTokens: number;
};

export type Catalog = {
  models: ProviderModelConfig[];
  /** Maps a Pi model id plus thinking level back to the id the CLI expects. */
  resolveCliId: (canonicalId: string, level?: ThinkingLevel) => string;
};

/**
 * `thinkingLevelMap` values are provider-specific strings that Pi only tests for
 * null, so this provider stores the CLI id each level maps to. Nothing sends them
 * as a request parameter: the CLI takes the effort as part of `--model`.
 */

type Group = {
  canonicalId: string;
  base: string;
  byLevel: Map<ModelThinkingLevel, CursorModelDef>;
  defaultDef?: CursorModelDef;
  fallbackDef: CursorModelDef;
};

function groupByFamily(defs: readonly CursorModelDef[]): Group[] {
  const groups = new Map<string, Group>();

  for (const def of defs) {
    const parsed = parseModelId(def.id);
    const canonicalId = canonicalIdOf(parsed);
    let group = groups.get(canonicalId);
    if (!group) {
      group = { canonicalId, base: parsed.base, byLevel: new Map(), fallbackDef: def };
      groups.set(canonicalId, group);
    }

    const level = parsed.effort ? EFFORT_TO_THINKING_LEVEL[parsed.effort] : "medium";
    if (!group.byLevel.has(level)) {
      group.byLevel.set(level, def);
    }
    if (isDefaultVariantName(def.name)) {
      group.defaultDef ??= def;
    }
  }

  return [...groups.values()];
}

/**
 * Cursor only marks "1M" on some variants of a family — `GPT-5.6 Sol 1M` but plain
 * `GPT-5.6 Sol Fast` — so the window is decided per base id rather than per variant.
 */
function contextWindowsByBase(defs: readonly CursorModelDef[]): Map<string, number> {
  const windows = new Map<string, number>();
  for (const def of defs) {
    const { base } = parseModelId(def.id);
    const window = contextWindowFromName(def.name);
    if (window > (windows.get(base) ?? 0)) {
      windows.set(base, window);
    }
  }
  return windows;
}

function pickDefault(group: Group): CursorModelDef {
  if (group.defaultDef) return group.defaultDef;
  for (const level of DEFAULT_LEVEL_PREFERENCE) {
    const def = group.byLevel.get(level);
    if (def) return def;
  }
  return group.fallbackDef;
}

/**
 * Turns the CLI's flat id list into Pi models. Effort variants collapse into one
 * model with a `thinkingLevelMap`, so Pi renders the levels this account actually
 * has instead of a list where every effort is a separate entry.
 */
export function buildCatalog(defs: readonly CursorModelDef[]): Catalog {
  const models: ProviderModelConfig[] = [];
  const cliIds = new Map<string, { byLevel: Map<ModelThinkingLevel, string>; fallback: string }>();
  const windows = contextWindowsByBase(defs);

  for (const group of groupByFamily(defs)) {
    const defaultDef = pickDefault(group);
    const reasoning = group.byLevel.size > 1;

    const thinkingLevelMap: ThinkingLevelMap = {};
    const byLevel = new Map<ModelThinkingLevel, string>();
    for (const level of THINKING_LEVELS) {
      const def = group.byLevel.get(level);
      // null marks a level unsupported; leaving it undefined would let Pi offer it.
      thinkingLevelMap[level] = def ? def.id : null;
      if (def) byLevel.set(level, def.id);
    }

    models.push({
      id: group.canonicalId,
      name: `${defaultDef.name} (Cursor)`,
      reasoning,
      ...(reasoning ? { thinkingLevelMap } : {}),
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: windows.get(group.base) ?? CONTEXT_WINDOW_DEFAULT,
      maxTokens: MAX_TOKENS,
    });
    cliIds.set(group.canonicalId, { byLevel, fallback: defaultDef.id });
  }

  return {
    models,
    resolveCliId: (canonicalId, level) => {
      const entry = cliIds.get(canonicalId);
      if (!entry) return canonicalId;
      if (level) {
        const mapped = entry.byLevel.get(level);
        if (mapped) return mapped;
      }
      return entry.fallback;
    },
  };
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
    const name = match[2]?.trim();
    if (!id || !name) continue;
    results.push({ id, name });
  }
  return results;
}
