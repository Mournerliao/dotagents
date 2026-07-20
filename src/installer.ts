import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { AgentAdapter } from "./adapter.js";
import { readCanonicalSkill } from "./canonical-skill.js";
import { claudeCodeAdapter } from "./claude-code-adapter.js";
import { codexAdapter } from "./codex-adapter.js";
import type { SupportedAgent, SupportedScope } from "./supported-options.js";

interface InstallOptions {
  source: string;
  projectDirectory: string;
  agent: SupportedAgent;
  scope: SupportedScope;
}

interface LockInstallation {
  name: string;
  source: { type: "local"; path: string };
  version: string;
  agent: SupportedAgent;
  scope: SupportedScope;
  files: string[];
}

interface LockManifest {
  lockfileVersion: 1;
  installations: LockInstallation[];
}

const adapters: Record<SupportedAgent, AgentAdapter> = {
  "claude-code": claudeCodeAdapter,
  codex: codexAdapter,
};

export async function installLocalSkill(
  options: InstallOptions,
): Promise<LockInstallation> {
  const sourceDirectory = resolve(options.source);
  const skill = await readCanonicalSkill(sourceDirectory);

  if (!skill.compatibility.includes(options.agent)) {
    throw new Error(
      `Skill "${skill.name}" does not support agent "${options.agent}".`,
    );
  }

  const adapter = adapters[options.agent];
  const installRoot = resolveInstallRoot(options);
  const plannedFiles = adapter.planInstallation(skill, sourceDirectory);
  const destinations = plannedFiles.map((file) =>
    join(installRoot, file.ownedPath),
  );

  for (const destination of destinations) {
    await assertDestinationAvailable(destination);
  }

  for (const [index, file] of plannedFiles.entries()) {
    const destination = destinations[index];
    if (destination === undefined) {
      throw new Error(`Missing destination for planned file ${file.ownedPath}.`);
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file.source, destination);
  }

  const installation: LockInstallation = {
    name: skill.name,
    source: { type: "local", path: sourceDirectory },
    version: skill.version,
    agent: options.agent,
    scope: options.scope,
    files: plannedFiles.map((file) => file.ownedPath),
  };

  const lockPath = join(options.projectDirectory, "agent-skills.lock.json");
  const lock = await readLockManifest(lockPath);
  const existingIndex = lock.installations.findIndex(
    (entry) =>
      entry.name === installation.name &&
      entry.agent === installation.agent &&
      entry.scope === installation.scope,
  );

  if (existingIndex === -1) {
    lock.installations.push(installation);
  } else {
    lock.installations[existingIndex] = installation;
  }

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  return installation;
}

function resolveInstallRoot(options: InstallOptions): string {
  if (options.scope === "project") {
    return resolve(options.projectDirectory);
  }

  return resolve(homedir());
}

async function assertDestinationAvailable(destination: string): Promise<void> {
  try {
    await access(destination);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }

  throw new Error(`Destination already exists: ${destination}`);
}

async function readLockManifest(lockPath: string): Promise<LockManifest> {
  try {
    const contents = await readFile(lockPath, "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (
      !isRecord(parsed) ||
      parsed.lockfileVersion !== 1 ||
      !Array.isArray(parsed.installations)
    ) {
      throw new Error("lockfileVersion must be 1 with an installations array");
    }

    return {
      lockfileVersion: 1,
      installations: parsed.installations as LockInstallation[],
    };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { lockfileVersion: 1, installations: [] };
    }

    throw new Error(
      `Invalid lock manifest at ${lockPath}: expected lockfileVersion 1 with an installations array.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
