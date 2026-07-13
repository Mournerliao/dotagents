import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

export interface CanonicalSkill {
  name: string;
  version: string;
  description: string;
  license: string;
  compatibility: string[];
  files: string[];
}

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

  for (const file of metadata.files as string[]) {
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

  return {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    license: metadata.license,
    compatibility: [...metadata.compatibility] as string[],
    files: [...metadata.files] as string[],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
