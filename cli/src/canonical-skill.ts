import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

export interface SkillResources {
  scripts: string[];
  references: string[];
  templates: string[];
  assets: string[];
}

export interface OriginalProvenance {
  kind: "original";
}

export interface MaintainedForkProvenance {
  kind: "maintained-fork";
  upstream: string;
  baseline: string;
  reason: string;
  changes: string[];
  attribution: string;
}

export type SkillProvenance = OriginalProvenance | MaintainedForkProvenance;

export interface CanonicalSkill {
  name: string;
  version: string;
  description: string;
  license: string;
  compatibility: string[];
  files: string[];
  resources: SkillResources;
  provenance: SkillProvenance;
  runtime: string[];
  commands: string[];
  dependencies: string[];
  network: string[];
  secrets: string[];
  permissions: string[];
  writeLocations: string[];
}

const RESOURCE_KINDS = ["scripts", "references", "templates", "assets"] as const;
const KNOWN_PERMISSIONS = new Set([
  "execute",
  "network",
  "secrets",
  "filesystem-write",
]);

export async function readCanonicalSkill(
  sourceDirectory: string,
): Promise<CanonicalSkill> {
  const contents = await readFile(join(sourceDirectory, "skill.json"), "utf8");
  const metadata: unknown = JSON.parse(contents);

  if (
    !isRecord(metadata) ||
    !("name" in metadata) ||
    typeof metadata.name !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name)
  ) {
    throw new Error(
      'Invalid canonical metadata: "name" must be a lowercase kebab-case identifier.',
    );
  }

  if (
    !("files" in metadata) ||
    !Array.isArray(metadata.files) ||
    metadata.files.length === 0 ||
    metadata.files.some(
      (file) =>
        typeof file !== "string" ||
        file === "" ||
        isAbsolute(file) ||
        file.split(/[\\/]/).includes(".."),
    ) ||
    !metadata.files.includes("SKILL.md")
  ) {
    throw new Error(
      'Invalid canonical metadata: "files" must contain safe relative paths including "SKILL.md".',
    );
  }

  const files = [...(metadata.files as string[])];

  for (const file of files) {
    try {
      const fileStat = await stat(join(sourceDirectory, file));
      if (!fileStat.isFile()) {
        throw new Error("not a file");
      }
    } catch {
      throw new Error(`Required skill content is missing: ${file}.`);
    }
  }

  if (
    !("version" in metadata) ||
    typeof metadata.version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      metadata.version,
    )
  ) {
    throw new Error(
      'Invalid canonical metadata: "version" must be a semantic version.',
    );
  }

  if (
    !("description" in metadata) ||
    typeof metadata.description !== "string" ||
    metadata.description.trim() === ""
  ) {
    throw new Error(
      'Invalid canonical metadata: "description" must be a non-empty string.',
    );
  }

  if (
    !("compatibility" in metadata) ||
    !Array.isArray(metadata.compatibility) ||
    metadata.compatibility.length === 0 ||
    metadata.compatibility.some(
      (agent) => typeof agent !== "string" || agent.trim() === "",
    )
  ) {
    throw new Error(
      'Invalid canonical metadata: "compatibility" must list at least one supported agent.',
    );
  }

  if (
    !("license" in metadata) ||
    typeof metadata.license !== "string" ||
    metadata.license.trim() === ""
  ) {
    throw new Error(
      'Invalid canonical metadata: "license" must be a non-empty string.',
    );
  }

  const provenance = parseProvenance(metadata.provenance);
  const resources = parseResources(metadata.resources, files);
  const runtime = parseOptionalStringList(metadata, "runtime", {
    allowScalar: true,
  });
  const commands = parseOptionalStringList(metadata, "commands");
  const dependencies = parseOptionalStringList(metadata, "dependencies");
  const network = parseOptionalStringList(metadata, "network");
  const secrets = parseOptionalStringList(metadata, "secrets");
  const permissions = parseOptionalStringList(metadata, "permissions");
  const writeLocations = parseOptionalStringList(metadata, "writeLocations", {
    requireSafeRelativePaths: true,
  });

  for (const permission of permissions) {
    if (!KNOWN_PERMISSIONS.has(permission)) {
      throw new Error(
        `Invalid canonical metadata: unknown permission "${permission}".`,
      );
    }
  }

  assertRequiredCapabilities({
    resources,
    commands,
    network,
    secrets,
    writeLocations,
    permissions,
  });

  const skillMarkdown = await readFile(
    join(sourceDirectory, "SKILL.md"),
    "utf8",
  );
  assertLocalReferences(skillMarkdown, files);

  return {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    license: metadata.license,
    compatibility: [...metadata.compatibility] as string[],
    files,
    resources,
    provenance,
    runtime,
    commands,
    dependencies,
    network,
    secrets,
    permissions,
    writeLocations,
  };
}

function parseProvenance(value: unknown): SkillProvenance {
  if (value === undefined) {
    throw new Error('Invalid canonical metadata: "provenance" is required.');
  }

  if (!isRecord(value) || typeof value.kind !== "string") {
    throw new Error(
      'Invalid canonical metadata: "provenance.kind" must be "original" or "maintained-fork".',
    );
  }

  if (value.kind === "original") {
    if (
      "upstream" in value ||
      "baseline" in value ||
      "reason" in value ||
      "changes" in value ||
      "attribution" in value
    ) {
      throw new Error(
        "Invalid canonical metadata: original provenance must not declare upstream fields.",
      );
    }

    return { kind: "original" };
  }

  if (value.kind === "maintained-fork") {
    const upstream = value.upstream;
    const baseline = value.baseline;
    const reason = value.reason;
    const changes = value.changes;
    const attribution = value.attribution;

    if (
      typeof upstream !== "string" ||
      upstream.trim() === "" ||
      typeof baseline !== "string" ||
      baseline.trim() === "" ||
      typeof reason !== "string" ||
      reason.trim() === "" ||
      typeof attribution !== "string" ||
      attribution.trim() === "" ||
      !Array.isArray(changes) ||
      changes.length === 0 ||
      changes.some(
        (entry) => typeof entry !== "string" || entry.trim() === "",
      )
    ) {
      throw new Error(
        'Invalid canonical metadata: maintained-fork provenance requires "upstream", "baseline", "reason", "changes", and "attribution".',
      );
    }

    if (!isHttpsUrl(upstream)) {
      throw new Error(
        'Invalid canonical metadata: "provenance.upstream" must be an https URL.',
      );
    }

    return {
      kind: "maintained-fork",
      upstream,
      baseline,
      reason,
      changes: [...(changes as string[])],
      attribution,
    };
  }

  throw new Error(
    'Invalid canonical metadata: "provenance.kind" must be "original" or "maintained-fork".',
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

export function hasSensitiveCapabilities(skill: CanonicalSkill): boolean {
  return (
    skill.resources.scripts.length > 0 ||
    skill.commands.length > 0 ||
    skill.dependencies.length > 0 ||
    skill.network.length > 0 ||
    skill.secrets.length > 0 ||
    skill.permissions.length > 0 ||
    skill.writeLocations.length > 0
  );
}

export function formatPermissionReview(skill: CanonicalSkill): string {
  const lines = [
    `Permission review for ${skill.name}@${skill.version}`,
    `runtime: ${formatList(skill.runtime)}`,
    `commands: ${formatList(skill.commands)}`,
    `dependencies: ${formatList(skill.dependencies)}`,
    `network: ${formatList(skill.network)}`,
    `secrets: ${formatList(skill.secrets)}`,
    `permissions: ${formatList(skill.permissions)}`,
    `writeLocations: ${formatList(skill.writeLocations)}`,
    `resources.scripts: ${formatList(skill.resources.scripts)}`,
    `resources.references: ${formatList(skill.resources.references)}`,
    `resources.templates: ${formatList(skill.resources.templates)}`,
    `resources.assets: ${formatList(skill.resources.assets)}`,
  ];
  return `${lines.join("\n")}\n`;
}

function parseResources(
  value: unknown,
  files: string[],
): SkillResources {
  if (value === undefined) {
    return { scripts: [], references: [], templates: [], assets: [] };
  }

  if (!isRecord(value)) {
    throw new Error(
      'Invalid canonical metadata: "resources" must be an object.',
    );
  }

  const resources: SkillResources = {
    scripts: [],
    references: [],
    templates: [],
    assets: [],
  };

  for (const kind of RESOURCE_KINDS) {
    if (!(kind in value) || value[kind] === undefined) {
      continue;
    }

    const entries = value[kind];
    if (
      !Array.isArray(entries) ||
      entries.some(
        (entry) =>
          typeof entry !== "string" ||
          entry === "" ||
          isAbsolute(entry) ||
          entry.split(/[\\/]/).includes(".."),
      )
    ) {
      throw new Error(
        `Invalid canonical metadata: "resources.${kind}" must be an array of safe relative paths.`,
      );
    }

    for (const entry of entries as string[]) {
      if (!files.includes(entry)) {
        throw new Error(
          `Invalid canonical metadata: resource "${entry}" must also be listed in "files".`,
        );
      }
    }

    resources[kind] = [...(entries as string[])];
  }

  return resources;
}

function parseOptionalStringList(
  metadata: Record<string, unknown>,
  field: string,
  options: {
    allowScalar?: boolean;
    requireSafeRelativePaths?: boolean;
  } = {},
): string[] {
  if (!(field in metadata) || metadata[field] === undefined) {
    return [];
  }

  const value = metadata[field];
  if (options.allowScalar === true && typeof value === "string") {
    if (value.trim() === "") {
      throw new Error(
        `Invalid canonical metadata: "${field}" must be a non-empty string or string array.`,
      );
    }
    return [value];
  }

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.trim() === "")
  ) {
    throw new Error(
      `Invalid canonical metadata: "${field}" must be an array of non-empty strings.`,
    );
  }

  const entries = value as string[];
  if (options.requireSafeRelativePaths === true) {
    if (
      entries.some(
        (entry) => isAbsolute(entry) || entry.split(/[\\/]/).includes(".."),
      )
    ) {
      throw new Error(
        `Invalid canonical metadata: "${field}" must contain safe relative paths.`,
      );
    }
  }

  return [...entries];
}

function assertRequiredCapabilities(input: {
  resources: SkillResources;
  commands: string[];
  network: string[];
  secrets: string[];
  writeLocations: string[];
  permissions: string[];
}): void {
  const required: string[] = [];
  if (
    input.resources.scripts.length > 0 ||
    input.commands.length > 0
  ) {
    required.push("execute");
  }
  if (input.network.length > 0) {
    required.push("network");
  }
  if (input.secrets.length > 0) {
    required.push("secrets");
  }
  if (input.writeLocations.length > 0) {
    required.push("filesystem-write");
  }

  for (const capability of required) {
    if (!input.permissions.includes(capability)) {
      throw new Error(
        `Invalid canonical metadata: undeclared required capability "${capability}".`,
      );
    }
  }
}

function assertLocalReferences(markdown: string, files: string[]): void {
  const fileSet = new Set(files);
  const linkPattern = /\[[^\]]*]\(([^)]+)\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    const target = match[1]?.trim();
    if (target === undefined || target === "") {
      continue;
    }

    if (
      /^[a-z][a-z0-9+.-]*:/i.test(target) ||
      target.startsWith("#") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }

    const pathOnly = target.split(/[?#]/, 1)[0] ?? target;
    if (
      pathOnly === "" ||
      isAbsolute(pathOnly) ||
      pathOnly.split(/[\\/]/).includes("..")
    ) {
      throw new Error(`Broken skill reference: "${pathOnly}".`);
    }

    if (!fileSet.has(pathOnly)) {
      throw new Error(`Broken skill reference: "${pathOnly}".`);
    }
  }
}

function formatList(values: string[]): string {
  return values.length === 0 ? "(none)" : values.join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
