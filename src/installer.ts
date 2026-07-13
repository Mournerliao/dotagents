import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { readCanonicalSkill } from "./canonical-skill.js";
import { codexAdapter } from "./codex-adapter.js";

interface InstallOptions {
  source: string;
  projectDirectory: string;
  agent: "codex";
}

interface LockInstallation {
  name: string;
  source: { type: "local"; path: string };
  version: string;
  agent: "codex";
  scope: "project";
  files: string[];
}

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

  const plannedFiles = codexAdapter.planInstallation(skill, sourceDirectory);

  for (const file of plannedFiles) {
    const destination = join(options.projectDirectory, file.destination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file.source, destination);
  }

  const installation: LockInstallation = {
    name: skill.name,
    source: { type: "local", path: sourceDirectory },
    version: skill.version,
    agent: options.agent,
    scope: "project",
    files: plannedFiles.map((file) => file.ownedPath),
  };

  await writeFile(
    join(options.projectDirectory, "agent-skills.lock.json"),
    `${JSON.stringify({ lockfileVersion: 1, installations: [installation] }, null, 2)}\n`,
  );

  return installation;
}
