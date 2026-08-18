import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { toCatalogRelativePath } from "./paths.js";

export type CapabilityKind = "skill" | "mcp";
export type InclusionKind = "maintained" | "delegated" | "link-only";

export interface InstallRecipe {
  install: string[];
  update?: string[];
  remove?: string[];
}

export interface MaintainedCatalogEntry {
  kind: "maintained";
  capabilityKind: CapabilityKind;
  name: string;
  version: string;
  compatibility: string[];
  description: string;
  path: string;
}

export interface DelegatedCatalogEntry {
  kind: "delegated";
  capabilityKind: CapabilityKind;
  name: string;
  upstream: string;
  author: string;
  license: string;
  compatibility: string[];
  compatibilityNotes?: string;
  description: string;
  recipe: InstallRecipe;
}

export interface LinkOnlyCatalogEntry {
  kind: "link-only";
  capabilityKind: CapabilityKind;
  name: string;
  upstream: string;
  author: string;
  license: string;
  compatibility: string[];
  compatibilityNotes?: string;
  recommendation: string;
  description: string;
}

export type CatalogEntry =
  | MaintainedCatalogEntry
  | DelegatedCatalogEntry
  | LinkOnlyCatalogEntry;

export interface Catalog {
  catalogPath: string;
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
    throw new Error('Invalid catalog: expected a non-empty "entries" array.');
  }

  const rootDirectory = dirname(absoluteCatalogPath);
  const entries: CatalogEntry[] = [];

  for (const entry of parsed.entries) {
    entries.push(await parseCatalogEntry(entry, rootDirectory));
  }

  return {
    catalogPath: absoluteCatalogPath,
    rootDirectory,
    entries,
  };
}

export async function writeCatalog(catalog: Catalog): Promise<void> {
  const serializable = {
    entries: catalog.entries.map((entry) => serializeEntry(entry, catalog.rootDirectory)),
  };
  await writeFile(
    catalog.catalogPath,
    `${JSON.stringify(serializable, null, 2)}\n`,
  );
}

export function findCatalogEntry(
  catalog: Catalog,
  name: string,
): CatalogEntry {
  const matches = catalog.entries.filter((entry) => entry.name === name);
  if (matches.length === 0) {
    throw new Error(`No catalog entry named "${name}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple catalog entries named "${name}".`);
  }
  const entry = matches[0];
  if (entry === undefined) {
    throw new Error(`No catalog entry named "${name}".`);
  }
  return entry;
}

export function formatCatalogListing(catalog: Catalog): string {
  const entries = catalog.entries.map((entry) => formatListingLine(entry));
  return `Catalog (${catalog.entries.length} entries)\n\n${entries.join("\n\n")}\n`;
}

export function formatListingLine(entry: CatalogEntry): string {
  const details = [
    `  Type: ${entry.capabilityKind} | Status: ${entry.kind}${
      entry.kind === "maintained" ? ` | Version: ${entry.version}` : ""
    }`,
    wrapListingField("Agents", entry.compatibility.join(", ")),
  ];

  if (entry.kind !== "maintained") {
    details.push(wrapListingField("Source", entry.upstream));
  }

  details.push(wrapListingField("Description", entry.description));
  return [entry.name, ...details].join("\n");
}

const LISTING_WIDTH = 100;

function wrapListingField(label: string, value: string): string {
  const prefix = `  ${label}: `;
  const continuation = " ".repeat(prefix.length);
  const availableWidth = LISTING_WIDTH - prefix.length;
  const chunks = wrapText(value, availableWidth);
  return chunks
    .map((chunk, index) => `${index === 0 ? prefix : continuation}${chunk}`)
    .join("\n");
}

function wrapText(value: string, width: number): string[] {
  const chunks: string[] = [];
  let line = "";

  for (const word of value.trim().split(/\s+/)) {
    const parts = splitLongWord(word, width);
    for (const part of parts) {
      if (line === "") {
        line = part;
      } else if (line.length + 1 + part.length <= width) {
        line += ` ${part}`;
      } else {
        chunks.push(line);
        line = part;
      }
    }
  }

  if (line !== "") {
    chunks.push(line);
  }
  return chunks;
}

function splitLongWord(word: string, width: number): string[] {
  const parts: string[] = [];
  for (let index = 0; index < word.length; index += width) {
    parts.push(word.slice(index, index + width));
  }
  return parts;
}

export function catalogToJson(catalog: Catalog): unknown {
  return {
    entries: catalog.entries.map((entry) => {
      if (entry.kind === "maintained") {
        return {
          kind: entry.kind,
          capabilityKind: entry.capabilityKind,
          name: entry.name,
          version: entry.version,
          compatibility: entry.compatibility,
          description: entry.description,
          path: entry.path,
        };
      }
      if (entry.kind === "delegated") {
        return {
          kind: entry.kind,
          capabilityKind: entry.capabilityKind,
          name: entry.name,
          upstream: entry.upstream,
          author: entry.author,
          license: entry.license,
          compatibility: entry.compatibility,
          ...(entry.compatibilityNotes === undefined
            ? {}
            : { compatibilityNotes: entry.compatibilityNotes }),
          description: entry.description,
          recipe: entry.recipe,
        };
      }
      return {
        kind: entry.kind,
        capabilityKind: entry.capabilityKind,
        name: entry.name,
        upstream: entry.upstream,
        author: entry.author,
        license: entry.license,
        compatibility: entry.compatibility,
        ...(entry.compatibilityNotes === undefined
          ? {}
          : { compatibilityNotes: entry.compatibilityNotes }),
        recommendation: entry.recommendation,
        description: entry.description,
      };
    }),
  };
}

export async function parseCatalogEntry(
  entry: unknown,
  rootDirectory: string,
): Promise<CatalogEntry> {
  if (!isRecord(entry) || typeof entry.kind !== "string") {
    throw new Error('Invalid catalog entry: "kind" is required.');
  }

  const kind = normalizeKind(entry.kind);
  const capabilityKind = parseCapabilityKind(entry.capabilityKind);

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

  if (kind === "maintained") {
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
      capabilityKind,
      name: entry.name,
      version: entry.version,
      compatibility: [...entry.compatibility] as string[],
      description: entry.description,
      path: absolutePath,
    };
  }

  if (kind === "delegated") {
    const recipe = parseRecipe(entry.recipe);
    requireUpstreamMeta(entry, "delegated");

    const delegated: DelegatedCatalogEntry = {
      kind: "delegated",
      capabilityKind,
      name: entry.name,
      upstream: entry.upstream as string,
      author: entry.author as string,
      license: entry.license as string,
      compatibility: [...entry.compatibility] as string[],
      description: entry.description,
      recipe,
    };

    assignCompatibilityNotes(entry, delegated);
    return delegated;
  }

  requireUpstreamMeta(entry, "link-only");
  if (
    typeof entry.recommendation !== "string" ||
    entry.recommendation.trim() === ""
  ) {
    throw new Error(
      'Invalid link-only catalog entry: "recommendation" is required.',
    );
  }

  const linkOnly: LinkOnlyCatalogEntry = {
    kind: "link-only",
    capabilityKind,
    name: entry.name,
    upstream: entry.upstream as string,
    author: entry.author as string,
    license: entry.license as string,
    compatibility: [...entry.compatibility] as string[],
    recommendation: entry.recommendation,
    description: entry.description,
  };
  assignCompatibilityNotes(entry, linkOnly);
  return linkOnly;
}

function normalizeKind(kind: string): InclusionKind {
  if (kind === "catalog-only") {
    return "link-only";
  }
  if (kind === "maintained" || kind === "delegated" || kind === "link-only") {
    return kind;
  }
  throw new Error(
    `Invalid catalog entry kind "${kind}". Expected "maintained", "delegated", or "link-only".`,
  );
}

function parseCapabilityKind(value: unknown): CapabilityKind {
  if (value === undefined) {
    return "skill";
  }
  if (value === "skill" || value === "mcp") {
    return value;
  }
  throw new Error(
    'Invalid catalog entry: "capabilityKind" must be "skill" or "mcp" when present.',
  );
}

function parseRecipe(value: unknown): InstallRecipe {
  if (!isRecord(value) || !isArgv(value.install)) {
    throw new Error(
      'Invalid delegated catalog entry: "recipe.install" must be a non-empty argv array.',
    );
  }

  const recipe: InstallRecipe = {
    install: [...value.install],
  };

  if (value.update !== undefined) {
    if (!isArgv(value.update)) {
      throw new Error(
        'Invalid delegated catalog entry: "recipe.update" must be a non-empty argv array when present.',
      );
    }
    recipe.update = [...value.update];
  }

  if (value.remove !== undefined) {
    if (!isArgv(value.remove)) {
      throw new Error(
        'Invalid delegated catalog entry: "recipe.remove" must be a non-empty argv array when present.',
      );
    }
    recipe.remove = [...value.remove];
  }

  return recipe;
}

function requireUpstreamMeta(
  entry: Record<string, unknown>,
  label: string,
): asserts entry is Record<string, unknown> & {
  upstream: string;
  author: string;
  license: string;
} {
  if (typeof entry.upstream !== "string" || entry.upstream.trim() === "") {
    throw new Error(`Invalid ${label} catalog entry: "upstream" is required.`);
  }
  if (!isHttpsUrl(entry.upstream)) {
    throw new Error(
      `Invalid ${label} catalog entry: "upstream" must be an https URL.`,
    );
  }
  if (
    typeof entry.author !== "string" ||
    entry.author.trim() === "" ||
    typeof entry.license !== "string" ||
    entry.license.trim() === ""
  ) {
    throw new Error(
      `Invalid ${label} catalog entry: "author" and "license" are required.`,
    );
  }
}

function assignCompatibilityNotes(
  entry: Record<string, unknown>,
  target: { compatibilityNotes?: string },
): void {
  if (
    "compatibilityNotes" in entry &&
    entry.compatibilityNotes !== undefined
  ) {
    if (
      typeof entry.compatibilityNotes !== "string" ||
      entry.compatibilityNotes.trim() === ""
    ) {
      throw new Error(
        'Invalid catalog entry: "compatibilityNotes" must be a non-empty string when present.',
      );
    }
    target.compatibilityNotes = entry.compatibilityNotes;
  }
}

function serializeEntry(
  entry: CatalogEntry,
  rootDirectory: string,
): Record<string, unknown> {
  if (entry.kind === "maintained") {
    return {
      kind: "maintained",
      capabilityKind: entry.capabilityKind,
      name: entry.name,
      version: entry.version,
      compatibility: entry.compatibility,
      description: entry.description,
      path: toCatalogRelativePath(rootDirectory, entry.path),
    };
  }

  if (entry.kind === "delegated") {
    return {
      kind: "delegated",
      capabilityKind: entry.capabilityKind,
      name: entry.name,
      upstream: entry.upstream,
      author: entry.author,
      license: entry.license,
      compatibility: entry.compatibility,
      ...(entry.compatibilityNotes === undefined
        ? {}
        : { compatibilityNotes: entry.compatibilityNotes }),
      description: entry.description,
      recipe: entry.recipe,
    };
  }

  return {
    kind: "link-only",
    capabilityKind: entry.capabilityKind,
    name: entry.name,
    upstream: entry.upstream,
    author: entry.author,
    license: entry.license,
    compatibility: entry.compatibility,
    ...(entry.compatibilityNotes === undefined
      ? {}
      : { compatibilityNotes: entry.compatibilityNotes }),
    recommendation: entry.recommendation,
    description: entry.description,
  };
}

function isArgv(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((part) => typeof part === "string" && part.trim() !== "")
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
