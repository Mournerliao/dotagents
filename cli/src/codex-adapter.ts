import type { AgentAdapter } from "./adapter.js";
import { createPlannedFiles } from "./adapter.js";

export const codexAdapter: AgentAdapter = {
  name: "codex",
  planInstallation(skill, sourceDirectory) {
    return createPlannedFiles(skill, sourceDirectory, [".agents", "skills"]);
  },
};
