import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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
  author: string;
  license: string;
  compatibility: string[];
  compatibilityNotes?: string;
  recommendation: string;
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
    entries.push(await parseCatalogEntry(entry, rootDirectory));
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

async function parseCatalogEntry(
  entry: unknown,
  rootDirectory: string,
): Promise<CatalogEntry> {
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

    const relativePath = entry.path;
    const absolutePath = resolve(rootDirectory, relativePath);
    try {
      await access(join(absolutePath, "skill.json"));
    } catch {
      throw new Error(
        `Invalid maintained catalog entry: path "${relativePath}" does not resolve to a skill directory.`,
      );
    }

    return {
      kind: "maintained",
      name: entry.name,
      version: entry.version,
      compatibility: [...entry.compatibility] as string[],
      description: entry.description,
      path: absolutePath,
    };
  }

  if (entry.kind === "catalog-only") {
    if (typeof entry.upstream !== "string" || entry.upstream.trim() === "") {
      throw new Error(
        'Invalid catalog-only entry: "upstream" is required.',
      );
    }

    if (!isHttpsUrl(entry.upstream)) {
      throw new Error(
        'Invalid catalog-only entry: "upstream" must be an https URL.',
      );
    }

    if (
      typeof entry.author !== "string" ||
      entry.author.trim() === "" ||
      typeof entry.license !== "string" ||
      entry.license.trim() === "" ||
      typeof entry.recommendation !== "string" ||
      entry.recommendation.trim() === ""
    ) {
      throw new Error(
        'Invalid catalog-only entry: "author", "license", and "recommendation" are required.',
      );
    }

    const catalogOnly: CatalogOnlyEntry = {
      kind: "catalog-only",
      name: entry.name,
      upstream: entry.upstream,
      author: entry.author,
      license: entry.license,
      compatibility: [...entry.compatibility] as string[],
      recommendation: entry.recommendation,
      description: entry.description,
    };

    if (
      "compatibilityNotes" in entry &&
      entry.compatibilityNotes !== undefined
    ) {
      if (
        typeof entry.compatibilityNotes !== "string" ||
        entry.compatibilityNotes.trim() === ""
      ) {
        throw new Error(
          'Invalid catalog-only entry: "compatibilityNotes" must be a non-empty string when present.',
        );
      }
      catalogOnly.compatibilityNotes = entry.compatibilityNotes;
    }

    return catalogOnly;
  }

  throw new Error(
    `Invalid catalog entry kind "${entry.kind}". Expected "maintained" or "catalog-only".`,
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
