import { join } from "node:path";
import type { EnvMap } from "./agent-cli.ts";
import { buildCatalog, STATIC_MODELS, type Catalog, type CursorModelDef } from "./models.ts";

export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_VERSION = 1;

export type CachedCatalog = {
  version: number;
  fetchedAt: number;
  models: CursorModelDef[];
};

export function catalogCachePath(env: EnvMap = process.env): string {
  const base = env["XDG_CACHE_HOME"] || join(env["HOME"] ?? ".", ".cache");
  return join(base, "dotagents-pi", "cursor-models.json");
}

export function serializeCatalog(models: readonly CursorModelDef[], now: number): string {
  const payload: CachedCatalog = { version: CACHE_VERSION, fetchedAt: now, models: [...models] };
  return JSON.stringify(payload);
}

export function parseCatalog(raw: string): CachedCatalog | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const candidate = parsed as Partial<CachedCatalog>;
  if (candidate.version !== CACHE_VERSION) return undefined;
  if (typeof candidate.fetchedAt !== "number" || !Array.isArray(candidate.models)) return undefined;
  const models = candidate.models.filter(
    (m): m is CursorModelDef =>
      typeof m === "object" && m !== null && typeof m.id === "string" && typeof m.name === "string",
  );
  if (models.length === 0) return undefined;
  return { version: CACHE_VERSION, fetchedAt: candidate.fetchedAt, models };
}

export function isFresh(cached: CachedCatalog, now: number, ttlMs = CATALOG_TTL_MS): boolean {
  const age = now - cached.fetchedAt;
  return age >= 0 && age < ttlMs;
}

export type CatalogIo = {
  readCache: () => Promise<string | undefined>;
  writeCache: (contents: string) => Promise<void>;
  fetchModels: () => Promise<CursorModelDef[]>;
  now: () => number;
};

export type CatalogSource = "cache" | "cli" | "stale-cache" | "static";

/**
 * Resolves the model catalogue without making Pi wait on the CLI at every start.
 * `agent models` takes seconds, so a fresh cache short-circuits it, and a stale
 * cache still beats the static fallback when the CLI is unreachable.
 */
export async function loadModelDefs(
  io: CatalogIo,
  ttlMs = CATALOG_TTL_MS,
): Promise<{ models: CursorModelDef[]; source: CatalogSource }> {
  const raw = await io.readCache().catch(() => undefined);
  const cached = raw ? parseCatalog(raw) : undefined;

  if (cached && isFresh(cached, io.now(), ttlMs)) {
    return { models: cached.models, source: "cache" };
  }

  try {
    const models = await io.fetchModels();
    if (models.length > 0) {
      await io.writeCache(serializeCatalog(models, io.now())).catch(() => undefined);
      return { models, source: "cli" };
    }
  } catch {
    // Fall through to whatever we already have.
  }

  if (cached) return { models: cached.models, source: "stale-cache" };
  return { models: STATIC_MODELS, source: "static" };
}

/** Cache, CLI fetch, and id folding behind one interface for Pi start. */
export async function loadCatalog(io: CatalogIo, ttlMs = CATALOG_TTL_MS): Promise<Catalog> {
  const { models } = await loadModelDefs(io, ttlMs);
  return buildCatalog(models);
}
