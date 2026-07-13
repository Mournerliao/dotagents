import { join, posix } from "node:path";

import type { CanonicalSkill } from "./canonical-skill.js";

export interface PlannedFile {
  source: string;
  destination: string;
  ownedPath: string;
}

export interface AgentAdapter {
  readonly name: "codex";
  planInstallation(skill: CanonicalSkill, sourceDirectory: string): PlannedFile[];
}

export const codexAdapter: AgentAdapter = {
  name: "codex",
  planInstallation(skill, sourceDirectory) {
    return skill.files.map((file) => ({
      source: join(sourceDirectory, file),
      destination: join(".agents", "skills", skill.name, file),
      ownedPath: posix.join(".agents", "skills", skill.name, file),
    }));
  },
};
