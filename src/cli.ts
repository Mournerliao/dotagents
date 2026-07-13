#!/usr/bin/env node

import { installLocalSkill } from "./installer.js";
import { readCanonicalSkill } from "./canonical-skill.js";

const args = process.argv.slice(2);
const command = args[0];
const source = args[1];
const agentFlag = args.indexOf("--agent");
const agent = agentFlag === -1 ? undefined : args[agentFlag + 1];
const scopeFlag = args.indexOf("--scope");
const scope = scopeFlag === -1 ? "project" : args[scopeFlag + 1];

try {
  const allowedOptions =
    command === "add" ? new Set(["--agent", "--scope"]) : new Set<string>();
  const unknownOption = args
    .slice(2)
    .find((argument) => argument.startsWith("--") && !allowedOptions.has(argument));

  if (unknownOption !== undefined) {
    throw new Error(`Unknown option "${unknownOption}".`);
  }

  if (command === "validate") {
    if (source === undefined) {
      throw new Error("Usage: agent-skills validate <local-source>");
    }

    const skill = await readCanonicalSkill(source);
    process.stdout.write(`Valid canonical skill: ${skill.name}@${skill.version}\n`);
  } else {
    if (command !== "add" || source === undefined || agent === undefined) {
      throw new Error("Usage: agent-skills add <local-source> --agent codex");
    }

    if (agent !== "codex") {
      throw new Error(`Unsupported agent "${agent}". Supported agents: codex.`);
    }

    if (scope !== "project") {
      throw new Error(`Unsupported scope "${scope}". Supported scopes: project.`);
    }

    const installed = await installLocalSkill({
      source,
      projectDirectory: process.cwd(),
      agent,
    });

    process.stdout.write(
      `Installed ${installed.name}@${installed.version} for ${installed.agent} (${installed.scope})\n`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
