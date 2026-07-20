import type { AgentAdapter } from "./adapter.js";
import { createPlannedFiles } from "./adapter.js";

export const claudeCodeAdapter: AgentAdapter = {
  name: "claude-code",
  planInstallation(skill, sourceDirectory) {
    return createPlannedFiles(skill, sourceDirectory, [".claude", "skills"]);
  },
};
