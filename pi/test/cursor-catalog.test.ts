import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_TTL_MS,
  catalogCachePath,
  isFresh,
  loadModelDefs,
  parseCatalog,
  serializeCatalog,
  type CatalogIo,
} from "../src/cursor-provider/catalog.ts";
import type { CursorModelDef } from "../src/cursor-provider/types.ts";

const models: CursorModelDef[] = [{ id: "auto", name: "Auto" }];

function io(overrides: Partial<CatalogIo> = {}): { io: CatalogIo; written: string[] } {
  const written: string[] = [];
  return {
    written,
    io: {
      readCache: async () => undefined,
      writeCache: async (contents) => {
        written.push(contents);
      },
      fetchModels: async () => models,
      now: () => 1000,
      ...overrides,
    },
  };
}

test("catalogCachePath honours XDG_CACHE_HOME then HOME", () => {
  assert.equal(
    catalogCachePath({ XDG_CACHE_HOME: "/x/cache", HOME: "/home/me" }),
    "/x/cache/dotagents-pi/cursor-models.json",
  );
  assert.equal(catalogCachePath({ HOME: "/home/me" }), "/home/me/.cache/dotagents-pi/cursor-models.json");
});

test("serializeCatalog round-trips through parseCatalog", () => {
  const parsed = parseCatalog(serializeCatalog(models, 42));
  assert.equal(parsed?.fetchedAt, 42);
  assert.deepEqual(parsed?.models, models);
});

test("parseCatalog rejects junk, wrong versions and empty model lists", () => {
  assert.equal(parseCatalog("not json"), undefined);
  assert.equal(parseCatalog(JSON.stringify({ version: 99, fetchedAt: 1, models })), undefined);
  assert.equal(parseCatalog(JSON.stringify({ version: 1, fetchedAt: 1, models: [] })), undefined);
  assert.equal(parseCatalog(JSON.stringify({ version: 1, models })), undefined);
});

test("isFresh rejects expired and future-dated entries", () => {
  assert.equal(isFresh({ version: 1, fetchedAt: 0, models }, 10), true);
  assert.equal(isFresh({ version: 1, fetchedAt: 0, models }, CATALOG_TTL_MS), false);
  assert.equal(isFresh({ version: 1, fetchedAt: 100, models }, 10), false);
});

test("loadModelDefs uses a fresh cache without calling the CLI", async () => {
  let fetched = 0;
  const { io: catalogIo } = io({
    readCache: async () => serializeCatalog([{ id: "cached", name: "Cached" }], 900),
    fetchModels: async () => {
      fetched += 1;
      return models;
    },
  });
  const result = await loadModelDefs(catalogIo);
  assert.equal(result.source, "cache");
  assert.deepEqual(result.models, [{ id: "cached", name: "Cached" }]);
  assert.equal(fetched, 0);
});

test("loadModelDefs refreshes a stale cache and writes the result", async () => {
  const { io: catalogIo, written } = io({
    readCache: async () => serializeCatalog([{ id: "cached", name: "Cached" }], -CATALOG_TTL_MS),
  });
  const result = await loadModelDefs(catalogIo);
  assert.equal(result.source, "cli");
  assert.deepEqual(result.models, models);
  assert.equal(written.length, 1);
  assert.deepEqual(parseCatalog(written[0]!)?.models, models);
});

test("loadModelDefs falls back to a stale cache when the CLI fails", async () => {
  const { io: catalogIo } = io({
    readCache: async () => serializeCatalog([{ id: "cached", name: "Cached" }], -CATALOG_TTL_MS),
    fetchModels: async () => {
      throw new Error("agent models exited with code 1");
    },
  });
  const result = await loadModelDefs(catalogIo);
  assert.equal(result.source, "stale-cache");
  assert.deepEqual(result.models, [{ id: "cached", name: "Cached" }]);
});

test("loadModelDefs falls back to the static list with no cache and no CLI", async () => {
  const { io: catalogIo } = io({
    fetchModels: async () => {
      throw new Error("spawn agent ENOENT");
    },
  });
  const result = await loadModelDefs(catalogIo);
  assert.equal(result.source, "static");
  assert.deepEqual(result.models, [{ id: "auto", name: "Auto" }]);
});

test("loadModelDefs survives an unreadable cache file", async () => {
  const { io: catalogIo } = io({
    readCache: async () => {
      throw new Error("EACCES");
    },
  });
  const result = await loadModelDefs(catalogIo);
  assert.equal(result.source, "cli");
});
