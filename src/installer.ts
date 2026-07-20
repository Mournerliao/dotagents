import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { AgentAdapter, PlannedFile } from "./adapter.js";
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

interface UpdateOptions {
  name: string;
  projectDirectory: string;
  source?: string;
  agent?: SupportedAgent;
  scope?: SupportedScope;
  dryRun?: boolean;
  force?: boolean;
}

interface RemoveOptions {
  name: string;
  projectDirectory: string;
  agent?: SupportedAgent;
  scope?: SupportedScope;
  dryRun?: boolean;
  force?: boolean;
}

export interface LockInstallation {
  name: string;
  source: { type: "local"; path: string };
  version: string;
  agent: SupportedAgent;
  scope: SupportedScope;
  files: string[];
  digests: Record<string, string>;
}

export interface LockManifest {
  lockfileVersion: 1;
  installations: LockInstallation[];
}

export interface InstalledSkillListing {
  name: string;
  source: string;
  version: string;
  agent: SupportedAgent;
  scope: SupportedScope;
  updateStatus: string;
}

interface MutationPlan {
  current: LockInstallation;
  next: LockInstallation | undefined;
  installRoot: string;
  plannedFiles: PlannedFile[];
  writes: string[];
  replacements: string[];
  removals: string[];
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
    digests: await digestsForPlannedFiles(plannedFiles),
  };

  const lockPath = join(options.projectDirectory, "agent-skills.lock.json");
  const lock = await readLockManifest(lockPath);
  const existingIndex = findInstallationIndex(lock, installation);
  if (existingIndex === -1) {
    lock.installations.push(installation);
  } else {
    lock.installations[existingIndex] = installation;
  }

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  return installation;
}

export async function listInstalledSkills(
  projectDirectory: string,
): Promise<InstalledSkillListing[]> {
  const lockPath = join(projectDirectory, "agent-skills.lock.json");
  const lock = await readLockManifest(lockPath);
  const listings: InstalledSkillListing[] = [];

  for (const installation of lock.installations) {
    listings.push({
      name: installation.name,
      source: `local:${installation.source.path}`,
      version: installation.version,
      agent: installation.agent,
      scope: installation.scope,
      updateStatus: await resolveUpdateStatus(installation),
    });
  }

  return listings;
}

export function formatInstalledListing(
  listings: InstalledSkillListing[],
): string {
  if (listings.length === 0) {
    return "No managed skills installed.\n";
  }

  return `${listings
    .map((listing) =>
      [
        listing.name,
        listing.source,
        listing.version,
        listing.agent,
        listing.scope,
        listing.updateStatus,
      ].join("\t"),
    )
    .join("\n")}\n`;
}

export async function updateLocalSkill(
  options: UpdateOptions,
): Promise<string> {
  const lockPath = join(options.projectDirectory, "agent-skills.lock.json");
  const lock = await readLockManifest(lockPath);
  const current = findInstallation(lock, options);
  const sourceDirectory = resolve(options.source ?? current.source.path);
  const skill = await readCanonicalSkill(sourceDirectory);

  if (skill.name !== current.name) {
    throw new Error(
      `Source skill "${skill.name}" does not match installed skill "${current.name}".`,
    );
  }

  if (!skill.compatibility.includes(current.agent)) {
    throw new Error(
      `Skill "${skill.name}" does not support agent "${current.agent}".`,
    );
  }

  if (skill.version === current.version) {
    return `Already up to date: ${current.name}@${current.version}`;
  }

  const adapter = adapters[current.agent];
  const installRoot = resolveInstallRoot({
    projectDirectory: options.projectDirectory,
    agent: current.agent,
    scope: current.scope,
    source: sourceDirectory,
  });
  const plannedFiles = adapter.planInstallation(skill, sourceDirectory);
  const next: LockInstallation = {
    name: skill.name,
    source: { type: "local", path: sourceDirectory },
    version: skill.version,
    agent: current.agent,
    scope: current.scope,
    files: plannedFiles.map((file) => file.ownedPath),
    digests: await digestsForPlannedFiles(plannedFiles),
  };
  const plan = buildMutationPlan({
    current,
    next,
    installRoot,
    plannedFiles,
  });

  await assertSafeMutation(plan, options.force === true);

  if (options.dryRun === true) {
    return formatDryRunUpdate(plan);
  }

  await applyMutationAtomically({
    lockPath,
    lock,
    plan,
    mode: "update",
  });

  return `Updated ${current.name}@${current.version} -> ${next.version}`;
}

export async function removeLocalSkill(
  options: RemoveOptions,
): Promise<string> {
  const lockPath = join(options.projectDirectory, "agent-skills.lock.json");
  const lock = await readLockManifest(lockPath);
  const current = findInstallation(lock, options);
  const installRoot = resolveInstallRoot({
    projectDirectory: options.projectDirectory,
    agent: current.agent,
    scope: current.scope,
    source: current.source.path,
  });
  const plan = buildMutationPlan({
    current,
    next: undefined,
    installRoot,
    plannedFiles: [],
  });

  await assertSafeMutation(plan, options.force === true);

  if (options.dryRun === true) {
    return formatDryRunRemove(plan);
  }

  await applyMutationAtomically({
    lockPath,
    lock,
    plan,
    mode: "remove",
  });

  return `Removed ${current.name}@${current.version} for ${current.agent} (${current.scope})`;
}

function buildMutationPlan(input: {
  current: LockInstallation;
  next: LockInstallation | undefined;
  installRoot: string;
  plannedFiles: PlannedFile[];
}): MutationPlan {
  const owned = new Set(input.current.files);
  const nextFiles = new Set(input.plannedFiles.map((file) => file.ownedPath));
  const writes: string[] = [];
  const replacements: string[] = [];
  const removals: string[] = [];

  for (const file of input.plannedFiles) {
    if (owned.has(file.ownedPath)) {
      replacements.push(file.ownedPath);
    } else {
      writes.push(file.ownedPath);
    }
  }

  for (const ownedPath of input.current.files) {
    if (!nextFiles.has(ownedPath)) {
      removals.push(ownedPath);
    }
  }

  return {
    current: input.current,
    next: input.next,
    installRoot: input.installRoot,
    plannedFiles: input.plannedFiles,
    writes,
    replacements,
    removals,
  };
}

function formatDryRunUpdate(plan: MutationPlan): string {
  const next = plan.next;
  if (next === undefined) {
    throw new Error("Update dry-run requires a next installation.");
  }

  const lines = [
    `Dry run: update ${plan.current.name}@${plan.current.version} -> ${next.version}`,
    ...plan.replacements.map((path) => `replace: ${path}`),
    ...plan.writes.map((path) => `write: ${path}`),
    ...plan.removals.map((path) => `remove: ${path}`),
    `lock: version ${plan.current.version} -> ${next.version}`,
  ];
  return lines.join("\n");
}

function formatDryRunRemove(plan: MutationPlan): string {
  const lines = [
    `Dry run: remove ${plan.current.name}@${plan.current.version}`,
    ...plan.removals.map((path) => `remove: ${path}`),
    "lock: remove installation",
  ];
  return lines.join("\n");
}

async function assertSafeMutation(
  plan: MutationPlan,
  force: boolean,
): Promise<void> {
  if (!force) {
    await assertOwnedFilesUnmodified(plan);
  }

  for (const ownedPath of plan.writes) {
    const destination = join(plan.installRoot, ownedPath);
    try {
      await access(destination);
    } catch (error) {
      if (isNotFound(error)) {
        continue;
      }
      throw error;
    }

    if (!force) {
      throw new Error(
        `Destination conflict for unmanaged file: ${destination}. Re-run with --force to override.`,
      );
    }
  }
}

async function assertOwnedFilesUnmodified(plan: MutationPlan): Promise<void> {
  for (const ownedPath of plan.current.files) {
    const destination = join(plan.installRoot, ownedPath);
    const expectedDigest = plan.current.digests[ownedPath];
    if (expectedDigest === undefined) {
      throw new Error(
        `Managed file is missing a recorded digest: ${ownedPath}. Re-run with --force to override.`,
      );
    }

    let actualDigest: string;
    try {
      actualDigest = await digestFile(destination);
    } catch (error) {
      if (isNotFound(error)) {
        throw new Error(
          `Managed file is missing: ${destination}. Re-run with --force to override.`,
        );
      }
      throw error;
    }

    if (actualDigest !== expectedDigest) {
      throw new Error(
        `Managed file was modified: ${destination}. Re-run with --force to override.`,
      );
    }
  }
}

async function applyMutationAtomically(input: {
  lockPath: string;
  lock: LockManifest;
  plan: MutationPlan;
  mode: "update" | "remove";
}): Promise<void> {
  const backups = new Map<string, Buffer | undefined>();
  const createdWrites: string[] = [];
  const previousLock = Buffer.from(
    `${JSON.stringify(input.lock, null, 2)}\n`,
    "utf8",
  );
  const writeSet = new Set(input.plan.writes);

  for (const ownedPath of [
    ...input.plan.replacements,
    ...input.plan.removals,
  ]) {
    const destination = join(input.plan.installRoot, ownedPath);
    try {
      backups.set(destination, await readFile(destination));
    } catch (error) {
      if (isNotFound(error)) {
        backups.set(destination, undefined);
        continue;
      }
      throw error;
    }
  }

  try {
    for (const file of input.plan.plannedFiles) {
      const destination = join(input.plan.installRoot, file.ownedPath);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(file.source, destination);
      if (writeSet.has(file.ownedPath)) {
        createdWrites.push(destination);
      }
    }

    for (const ownedPath of input.plan.removals) {
      const destination = join(input.plan.installRoot, ownedPath);
      try {
        await unlink(destination);
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
      }
    }

    const nextLock: LockManifest = {
      lockfileVersion: 1,
      installations: [...input.lock.installations],
    };
    const index = findInstallationIndex(nextLock, input.plan.current);
    if (index === -1) {
      throw new Error(
        `Installation disappeared during ${input.mode}: ${input.plan.current.name}.`,
      );
    }

    if (input.mode === "remove" || input.plan.next === undefined) {
      nextLock.installations.splice(index, 1);
    } else {
      nextLock.installations[index] = input.plan.next;
    }

    await writeFile(input.lockPath, `${JSON.stringify(nextLock, null, 2)}\n`);
  } catch (error) {
    for (const destination of createdWrites) {
      try {
        await unlink(destination);
      } catch (restoreError) {
        if (!isNotFound(restoreError)) {
          throw restoreError;
        }
      }
    }

    for (const [destination, contents] of backups) {
      if (contents === undefined) {
        try {
          await unlink(destination);
        } catch (restoreError) {
          if (!isNotFound(restoreError)) {
            throw restoreError;
          }
        }
        continue;
      }

      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, contents);
    }

    await writeFile(input.lockPath, previousLock);
    throw error;
  }
}

async function digestsForPlannedFiles(
  plannedFiles: PlannedFile[],
): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  for (const file of plannedFiles) {
    digests[file.ownedPath] = await digestFile(file.source);
  }
  return digests;
}

async function digestFile(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function findInstallation(
  lock: LockManifest,
  query: {
    name: string;
    agent?: SupportedAgent;
    scope?: SupportedScope;
  },
): LockInstallation {
  const matches = lock.installations.filter((installation) => {
    if (installation.name !== query.name) {
      return false;
    }
    if (query.agent !== undefined && installation.agent !== query.agent) {
      return false;
    }
    if (query.scope !== undefined && installation.scope !== query.scope) {
      return false;
    }
    return true;
  });

  if (matches.length === 0) {
    throw new Error(`No managed installation named "${query.name}" was found.`);
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple installations named "${query.name}" found. Specify --agent and --scope.`,
    );
  }

  const match = matches[0];
  if (match === undefined) {
    throw new Error(`No managed installation named "${query.name}" was found.`);
  }

  return match;
}

function findInstallationIndex(
  lock: LockManifest,
  installation: Pick<LockInstallation, "name" | "agent" | "scope">,
): number {
  return lock.installations.findIndex(
    (entry) =>
      entry.name === installation.name &&
      entry.agent === installation.agent &&
      entry.scope === installation.scope,
  );
}

async function resolveUpdateStatus(
  installation: LockInstallation,
): Promise<string> {
  try {
    const skill = await readCanonicalSkill(installation.source.path);
    if (skill.version === installation.version) {
      return "up-to-date";
    }

    if (isNewerSemver(skill.version, installation.version)) {
      return `update-available:${skill.version}`;
    }

    return `source-version:${skill.version}`;
  } catch {
    return "source-unavailable";
  }
}

function isNewerSemver(candidate: string, current: string): boolean {
  const left = parseSemver(candidate);
  const right = parseSemver(current);
  if (left === undefined || right === undefined) {
    return candidate !== current;
  }

  for (let index = 0; index < 3; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart > rightPart) {
      return true;
    }
    if (leftPart < rightPart) {
      return false;
    }
  }

  return false;
}

function parseSemver(version: string): [number, number, number] | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/.exec(version);
  if (match === null) {
    return undefined;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
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
    if (isNotFound(error)) {
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
    if (isNotFound(error)) {
      return { lockfileVersion: 1, installations: [] };
    }

    throw new Error(
      `Invalid lock manifest at ${lockPath}: expected lockfileVersion 1 with an installations array.`,
    );
  }
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
