import { spawnSync } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  rm,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  claudeCodeAdapter,
  codexAdapter,
  type AgentAdapter,
  type PlannedFile,
} from "./adapter.js";
import {
  formatPermissionReview,
  hasSensitiveCapabilities,
  readCanonicalSkill,
  type CanonicalSkill,
} from "./canonical-skill.js";
import type { SupportedAgent, SupportedScope } from "./supported-options.js";

export interface MaintainedLifecycleOptions {
  source: string;
  projectDirectory: string;
  agent: SupportedAgent;
  scope: SupportedScope;
  dryRun?: boolean;
  acceptPermissions?: boolean;
  force?: boolean;
}

export interface MaintainedLifecycleResult {
  skill: CanonicalSkill;
  permissionReview?: string;
  preview?: string;
  plannedFiles: PlannedFile[];
  installRoot: string;
}

const adapters: Record<SupportedAgent, AgentAdapter> = {
  "claude-code": claudeCodeAdapter,
  codex: codexAdapter,
};

export async function installMaintainedSkill(
  options: MaintainedLifecycleOptions,
): Promise<MaintainedLifecycleResult> {
  const prepared = await prepareMaintained(options);

  if (options.dryRun === true) {
    return {
      ...prepared,
      preview: formatDryRun("install", prepared.skill, prepared.plannedFiles),
    };
  }

  await assertPermissionsAccepted(prepared.skill, options.acceptPermissions);
  assertDependenciesAvailable(prepared.skill.dependencies);

  for (const file of prepared.plannedFiles) {
    const destination = join(prepared.installRoot, file.ownedPath);
    if (options.force !== true) {
      await assertDestinationAvailable(destination);
    }
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file.source, destination);
  }

  return prepared;
}

export async function updateMaintainedSkill(
  options: MaintainedLifecycleOptions,
): Promise<MaintainedLifecycleResult> {
  const prepared = await prepareMaintained(options);

  if (options.dryRun === true) {
    return {
      ...prepared,
      preview: formatDryRun("update", prepared.skill, prepared.plannedFiles),
    };
  }

  await assertPermissionsAccepted(prepared.skill, options.acceptPermissions);
  assertDependenciesAvailable(prepared.skill.dependencies);

  for (const file of prepared.plannedFiles) {
    const destination = join(prepared.installRoot, file.ownedPath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file.source, destination);
  }

  return prepared;
}

export async function removeMaintainedSkill(
  options: MaintainedLifecycleOptions,
): Promise<MaintainedLifecycleResult> {
  const prepared = await prepareMaintained(options);
  const ownedRoot = join(
    prepared.installRoot,
    ...skillRootSegments(options.agent),
    prepared.skill.name,
  );

  if (options.dryRun === true) {
    return {
      ...prepared,
      preview: `Dry run: remove ${prepared.skill.name}\nremove: ${ownedRoot}\n`,
    };
  }

  await rm(ownedRoot, { recursive: true, force: true });
  return prepared;
}

function skillRootSegments(agent: SupportedAgent): string[] {
  if (agent === "codex") {
    return [".agents", "skills"];
  }
  return [".claude", "skills"];
}

async function prepareMaintained(
  options: MaintainedLifecycleOptions,
): Promise<MaintainedLifecycleResult> {
  const sourceDirectory = resolve(options.source);
  const skill = await readCanonicalSkill(sourceDirectory);
  const permissionReview = hasSensitiveCapabilities(skill)
    ? formatPermissionReview(skill)
    : undefined;

  if (!skill.compatibility.includes(options.agent)) {
    throw new Error(
      `Skill "${skill.name}" does not support agent "${options.agent}".`,
    );
  }

  const adapter = adapters[options.agent];
  const installRoot = resolveInstallRoot(options);
  const plannedFiles = adapter.planInstallation(skill, sourceDirectory);

  return {
    skill,
    plannedFiles,
    installRoot,
    ...(permissionReview === undefined ? {} : { permissionReview }),
  };
}

async function assertPermissionsAccepted(
  skill: CanonicalSkill,
  acceptPermissions: boolean | undefined,
): Promise<void> {
  if (!hasSensitiveCapabilities(skill)) {
    return;
  }
  if (acceptPermissions === true) {
    return;
  }
  const error = new Error(
    "Sensitive capabilities require --accept-permissions.",
  );
  Object.assign(error, {
    permissionReview: formatPermissionReview(skill),
  });
  throw error;
}

function formatDryRun(
  action: "install" | "update",
  skill: CanonicalSkill,
  plannedFiles: PlannedFile[],
): string {
  const lines = [
    `Dry run: ${action} ${skill.name}@${skill.version}`,
    ...plannedFiles.map((file) => `copy: ${file.ownedPath}`),
    ...skill.commands.map((command) => `effect: command ${command}`),
    ...skill.network.map((endpoint) => `effect: network ${endpoint}`),
    ...skill.secrets.map((secret) => `effect: secret ${secret}`),
    ...skill.writeLocations.map(
      (location) => `effect: writeLocation ${location}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function assertDependenciesAvailable(dependencies: string[]): void {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  for (const dependency of dependencies) {
    const result = spawnSync(locator, [dependency], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`Missing required dependency: ${dependency}.`);
    }
  }
}

export function getPermissionReview(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    "permissionReview" in error &&
    typeof (error as { permissionReview?: unknown }).permissionReview ===
      "string"
  ) {
    return (error as { permissionReview: string }).permissionReview;
  }

  return undefined;
}

function resolveInstallRoot(options: MaintainedLifecycleOptions): string {
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

  throw new Error(
    `Destination already exists: ${destination}. Re-run with --force to overwrite.`,
  );
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
