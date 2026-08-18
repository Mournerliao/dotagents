import { join, posix } from "node:path";

import type { CanonicalSkill } from "./canonical-skill.js";
import type { SupportedAgent } from "./supported-options.js";

export interface PlannedFile {
  source: string;
  ownedPath: string;
}

export interface AgentAdapter {
  readonly name: SupportedAgent;
  planInstallation(skill: CanonicalSkill, sourceDirectory: string): PlannedFile[];
}

export function createPlannedFiles(
  skill: CanonicalSkill,
  sourceDirectory: string,
  skillRootSegments: string[],
): PlannedFile[] {
  return skill.files.map((file) => ({
    source: join(sourceDirectory, file),
    ownedPath: posix.join(...skillRootSegments, skill.name, file),
  }));
}
