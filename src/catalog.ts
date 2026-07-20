import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface MaintainedCatalogEntry {
  kind: "maintained";
  name: string;
  version: string;
  compatibility: string[];
  description: string;
  path: string;
}

export interface CatalogOnlyEntry {
  kind: "catalog-only";
  name: string;
  upstream: string;
  compatibility: string[];
  description: string;
}

export type CatalogEntry = MaintainedCatalogEntry | CatalogOnlyEntry;

export interface Catalog {
  rootDirectory: string;
  entries: CatalogEntry[];
}

export async function readCatalog(catalogPath: string): Promise<Catalog> {
  const absoluteCatalogPath = resolve(catalogPath);
  const contents = await readFile(absoluteCatalogPath, "utf8");
  const parsed: unknown = JSON.parse(contents);

  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.entries) ||
    parsed.entries.length === 0
  ) {
    throw new Error(
      'Invalid catalog: expected a non-empty "entries" array.',
    );
  }

  const rootDirectory = dirname(absoluteCatalogPath);
  const entries: CatalogEntry[] = [];

  for (const entry of parsed.entries) {
    entries.push(parseCatalogEntry(entry, rootDirectory));
  }

  return { rootDirectory, entries };
}

export function formatCatalogListing(catalog: Catalog): string {
  const lines = catalog.entries.map((entry) => formatListingLine(entry));
  return `${lines.join("\n")}\n`;
}

export function formatListingLine(entry: CatalogEntry): string {
  if (entry.kind === "maintained") {
    return [
      entry.name,
      entry.version,
      entry.kind,
      entry.compatibility.join(","),
      entry.description,
    ].join("\t");
  }

  return [
    entry.name,
    entry.upstream,
    entry.kind,
    entry.compatibility.join(","),
    entry.description,
  ].join("\t");
}

export function maintainedEntries(
  catalog: Catalog,
): MaintainedCatalogEntry[] {
  return catalog.entries.filter(
    (entry): entry is MaintainedCatalogEntry => entry.kind === "maintained",
  );
}

export function catalogOnlyEntries(catalog: Catalog): CatalogOnlyEntry[] {
  return catalog.entries.filter(
    (entry): entry is CatalogOnlyEntry => entry.kind === "catalog-only",
  );
}

function parseCatalogEntry(
  entry: unknown,
  rootDirectory: string,
): CatalogEntry {
  if (!isRecord(entry) || typeof entry.kind !== "string") {
    throw new Error('Invalid catalog entry: "kind" is required.');
  }

  if (
    typeof entry.name !== "string" ||
    entry.name.trim() === "" ||
    typeof entry.description !== "string" ||
    entry.description.trim() === "" ||
    !Array.isArray(entry.compatibility) ||
    entry.compatibility.length === 0 ||
    entry.compatibility.some(
      (agent) => typeof agent !== "string" || agent.trim() === "",
    )
  ) {
    throw new Error(
      'Invalid catalog entry: "name", "description", and "compatibility" are required.',
    );
  }

  if (entry.kind === "maintained") {
    if (
      typeof entry.version !== "string" ||
      entry.version.trim() === "" ||
      typeof entry.path !== "string" ||
      entry.path.trim() === ""
    ) {
      throw new Error(
        'Invalid maintained catalog entry: "version" and "path" are required.',
      );
    }

    return {
      kind: "maintained",
      name: entry.name,
      version: entry.version,
      compatibility: [...entry.compatibility] as string[],
      description: entry.description,
      path: resolve(rootDirectory, entry.path),
    };
  }

  if (entry.kind === "catalog-only") {
    if (typeof entry.upstream !== "string" || entry.upstream.trim() === "") {
      throw new Error(
        'Invalid catalog-only entry: "upstream" is required.',
      );
    }

    return {
      kind: "catalog-only",
      name: entry.name,
      upstream: entry.upstream,
      compatibility: [...entry.compatibility] as string[],
      description: entry.description,
    };
  }

  throw new Error(
    `Invalid catalog entry kind "${entry.kind}". Expected "maintained" or "catalog-only".`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
