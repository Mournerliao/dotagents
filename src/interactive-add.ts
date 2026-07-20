import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

import {
  catalogOnlyEntries,
  maintainedEntries,
  type Catalog,
  type CatalogOnlyEntry,
  type MaintainedCatalogEntry,
} from "./catalog.js";
import { installLocalSkill } from "./installer.js";
import {
  parseSupportedAgent,
  parseSupportedScope,
} from "./supported-options.js";

export interface InteractiveAddResult {
  cancelled: boolean;
  message: string;
}

export async function runInteractiveAdd(options: {
  catalog: Catalog;
  projectDirectory: string;
}): Promise<InteractiveAddResult> {
  const rl = createInterface({ input, output, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const installable = maintainedEntries(options.catalog);
  const recommendations = catalogOnlyEntries(options.catalog);

  try {
    output.write("Select a skill to install:\n");
    installable.forEach((entry, index) => {
      output.write(`  ${index + 1}) ${formatMaintainedChoice(entry)}\n`);
    });

    if (recommendations.length > 0) {
      output.write("Catalog-only recommendations (not installable):\n");
      for (const entry of recommendations) {
        output.write(`  - ${formatCatalogOnlyChoice(entry)}\n`);
      }
    }

    const skillAnswer = (
      await ask(lines, "Skill number (or q to cancel): ")
    ).trim();
    if (skillAnswer.toLowerCase() === "q") {
      return { cancelled: true, message: "Cancelled." };
    }

    const skillIndex = Number.parseInt(skillAnswer, 10);
    if (
      !Number.isInteger(skillIndex) ||
      skillIndex < 1 ||
      skillIndex > installable.length
    ) {
      throw new Error(
        `Invalid skill selection "${skillAnswer}". Choose a number from 1 to ${installable.length}.`,
      );
    }

    const selected = installable[skillIndex - 1];
    if (selected === undefined) {
      throw new Error(`Invalid skill selection "${skillAnswer}".`);
    }

    const agentAnswer = (await ask(lines, "Agent (codex): ")).trim() || "codex";
    const agent = parseSupportedAgent(agentAnswer);

    const scopeAnswer =
      (await ask(lines, "Scope (project): ")).trim() || "project";
    parseSupportedScope(scopeAnswer);

    const installed = await installLocalSkill({
      source: selected.path,
      projectDirectory: options.projectDirectory,
      agent,
    });

    return {
      cancelled: false,
      message: `Installed ${installed.name}@${installed.version} for ${installed.agent} (${installed.scope})`,
    };
  } finally {
    rl.close();
  }
}

async function ask(
  lines: AsyncIterator<string>,
  prompt: string,
): Promise<string> {
  output.write(prompt);
  const result = await lines.next();
  if (result.done) {
    return "";
  }

  return result.value;
}

function formatMaintainedChoice(entry: MaintainedCatalogEntry): string {
  return `${entry.name}@${entry.version} [maintained] (${entry.compatibility.join(",")}) — ${entry.description}`;
}

function formatCatalogOnlyChoice(entry: CatalogOnlyEntry): string {
  return `${entry.name} [catalog-only] upstream=${entry.upstream} (${entry.compatibility.join(",")}) — ${entry.description}`;
}
