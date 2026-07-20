#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatCatalogListing, readCatalog } from "./catalog.js";
import { runInteractiveAdd } from "./interactive-add.js";
import { installLocalSkill } from "./installer.js";
import { readCanonicalSkill } from "./canonical-skill.js";
import {
  parseSupportedAgent,
  parseSupportedScope,
} from "./supported-options.js";

const args = process.argv.slice(2);
const command = args[0];

try {
  if (command === "validate") {
    await runValidate(args.slice(1));
  } else if (command === "list") {
    await runList(args.slice(1));
  } else if (command === "add") {
    await runAdd(args.slice(1));
  } else {
    throw new Error(
      "Usage: agent-skills <add|list|validate> [options]",
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

async function runValidate(args: string[]): Promise<void> {
  rejectUnknownOptions(args, new Set());
  const source = args[0];
  if (source === undefined) {
    throw new Error("Usage: agent-skills validate <local-source>");
  }

  const skill = await readCanonicalSkill(source);
  process.stdout.write(`Valid canonical skill: ${skill.name}@${skill.version}\n`);
}

async function runList(args: string[]): Promise<void> {
  rejectUnknownOptions(args, new Set(["--catalog"]));
  const catalogPath = readOption(args, "--catalog") ?? defaultCatalogPath();
  const catalog = await readCatalog(catalogPath);
  process.stdout.write(formatCatalogListing(catalog));
}

async function runAdd(args: string[]): Promise<void> {
  rejectUnknownOptions(args, new Set(["--agent", "--scope", "--catalog"]));

  const source = firstPositional(args);
  const agent = readOption(args, "--agent");
  const scope = readOption(args, "--scope") ?? "project";
  const catalogPath = readOption(args, "--catalog") ?? defaultCatalogPath();

  if (source === undefined) {
    const catalog = await readCatalog(catalogPath);
    const result = await runInteractiveAdd({
      catalog,
      projectDirectory: process.cwd(),
    });
    process.stdout.write(`${result.message}\n`);
    return;
  }

  if (agent === undefined) {
    throw new Error(
      "Usage: agent-skills add <local-source> --agent <claude-code|codex> [--scope <global|project>]",
    );
  }

  const supportedAgent = parseSupportedAgent(agent);
  const supportedScope = parseSupportedScope(scope);

  const installed = await installLocalSkill({
    source,
    projectDirectory: process.cwd(),
    agent: supportedAgent,
    scope: supportedScope,
  });

  process.stdout.write(
    `Installed ${installed.name}@${installed.version} for ${installed.agent} (${installed.scope})\n`,
  );
}

function rejectUnknownOptions(args: string[], allowed: Set<string>): void {
  const unknownOption = args.find(
    (argument) => argument.startsWith("--") && !allowed.has(argument),
  );

  if (unknownOption !== undefined) {
    throw new Error(`Unknown option "${unknownOption}".`);
  }
}

function readOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function firstPositional(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument.startsWith("--")) {
      index += 1;
      continue;
    }

    return argument;
  }

  return undefined;
}

function defaultCatalogPath(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "catalog",
    "catalog.json",
  );
}
