#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatCatalogListing,
  readCatalog,
} from "./catalog.js";
import { runInteractiveAdd } from "./interactive-add.js";
import {
  formatInstalledListing,
  getPermissionReview,
  installLocalSkill,
  listInstalledSkills,
  removeLocalSkill,
  updateLocalSkill,
} from "./installer.js";
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
  } else if (command === "update") {
    await runUpdate(args.slice(1));
  } else if (command === "remove") {
    await runRemove(args.slice(1));
  } else {
    throw new Error(
      "Usage: agent-skills <add|list|update|remove|validate> [options]",
    );
  }
} catch (error) {
  const permissionReview = getPermissionReview(error);
  if (permissionReview !== undefined) {
    process.stdout.write(permissionReview);
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

async function runValidate(args: string[]): Promise<void> {
  rejectUnknownOptions(args, new Set(["--catalog"]));

  if (args.includes("--catalog")) {
    const catalogPath = readOption(args, "--catalog") ?? defaultCatalogPath();
    const catalog = await readCatalog(catalogPath);
    for (const entry of catalog.entries) {
      if (entry.kind === "maintained") {
        await readCanonicalSkill(entry.path);
      }
    }
    process.stdout.write(
      `Valid catalog: ${catalog.entries.length} entries\n`,
    );
    return;
  }

  const source = firstPositional(args);
  if (source === undefined) {
    throw new Error(
      "Usage: agent-skills validate <local-source> | validate --catalog [path]",
    );
  }

  const skill = await readCanonicalSkill(source);
  process.stdout.write(`Valid canonical skill: ${skill.name}@${skill.version}\n`);
}

async function runList(args: string[]): Promise<void> {
  rejectUnknownOptions(args, new Set(["--catalog"]));
  if (args.includes("--catalog")) {
    const catalogPath = readOption(args, "--catalog") ?? defaultCatalogPath();
    const catalog = await readCatalog(catalogPath);
    process.stdout.write(formatCatalogListing(catalog));
    return;
  }

  const listings = await listInstalledSkills(process.cwd());
  process.stdout.write(formatInstalledListing(listings));
}

async function runAdd(args: string[]): Promise<void> {
  rejectUnknownOptions(
    args,
    new Set([
      "--agent",
      "--scope",
      "--catalog",
      "--dry-run",
      "--accept-permissions",
    ]),
  );

  const source = firstPositional(args);
  const agent = readOption(args, "--agent");
  const scope = readOption(args, "--scope") ?? "project";
  const catalogPath = readOption(args, "--catalog") ?? defaultCatalogPath();
  const dryRun = args.includes("--dry-run");
  const acceptPermissions = args.includes("--accept-permissions");

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
      "Usage: agent-skills add <local-source> --agent <claude-code|codex> [--scope <global|project>] [--dry-run] [--accept-permissions]",
    );
  }

  const supportedAgent = parseSupportedAgent(agent);
  const supportedScope = parseSupportedScope(scope);

  const result = await installLocalSkill({
    source,
    projectDirectory: process.cwd(),
    agent: supportedAgent,
    scope: supportedScope,
    dryRun,
    acceptPermissions,
  });

  if (result.permissionReview !== undefined) {
    process.stdout.write(result.permissionReview);
  }

  if (result.preview !== undefined) {
    process.stdout.write(result.preview);
    return;
  }

  const installed = result.installation;
  if (installed === undefined) {
    throw new Error("Installation did not produce a lock record.");
  }

  process.stdout.write(
    `Installed ${installed.name}@${installed.version} for ${installed.agent} (${installed.scope})\n`,
  );
}

async function runUpdate(args: string[]): Promise<void> {
  rejectUnknownOptions(
    args,
    new Set(["--source", "--agent", "--scope", "--dry-run", "--force"]),
  );

  const name = firstPositional(args);
  if (name === undefined) {
    throw new Error(
      "Usage: agent-skills update <name> [--source <local-source>] [--agent <claude-code|codex>] [--scope <global|project>] [--dry-run] [--force]",
    );
  }

  const source = readOption(args, "--source");
  const agent = readOption(args, "--agent");
  const scope = readOption(args, "--scope");
  const message = await updateLocalSkill({
    name,
    projectDirectory: process.cwd(),
    ...(source === undefined ? {} : { source }),
    ...(agent === undefined ? {} : { agent: parseSupportedAgent(agent) }),
    ...(scope === undefined ? {} : { scope: parseSupportedScope(scope) }),
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
  });
  process.stdout.write(`${message}\n`);
}

async function runRemove(args: string[]): Promise<void> {
  rejectUnknownOptions(
    args,
    new Set(["--agent", "--scope", "--dry-run", "--force"]),
  );

  const name = firstPositional(args);
  if (name === undefined) {
    throw new Error(
      "Usage: agent-skills remove <name> [--agent <claude-code|codex>] [--scope <global|project>] [--dry-run] [--force]",
    );
  }

  const agent = readOption(args, "--agent");
  const scope = readOption(args, "--scope");
  const message = await removeLocalSkill({
    name,
    projectDirectory: process.cwd(),
    ...(agent === undefined ? {} : { agent: parseSupportedAgent(agent) }),
    ...(scope === undefined ? {} : { scope: parseSupportedScope(scope) }),
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
  });
  process.stdout.write(`${message}\n`);
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
  const flagsWithValues = new Set([
    "--agent",
    "--scope",
    "--catalog",
    "--source",
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument.startsWith("--")) {
      if (flagsWithValues.has(argument)) {
        index += 1;
      }
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
