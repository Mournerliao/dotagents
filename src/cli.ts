#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  catalogToJson,
  formatCatalogListing,
  readCatalog,
} from "./catalog.js";
import { readCanonicalSkill } from "./canonical-skill.js";
import { getPermissionReview, runLifecycle } from "./lifecycle.js";
import { emitResult } from "./output.js";
import { recordCatalogEntry } from "./record.js";
import {
  parseSupportedAgent,
  parseSupportedScope,
} from "./supported-options.js";

const args = process.argv.slice(2);
const command = args[0];
const json = args.includes("--json");

try {
  if (command === "validate") {
    await runValidate(args.slice(1), json);
  } else if (command === "list") {
    await runList(args.slice(1), json);
  } else if (command === "install" || command === "add") {
    await runLifecycleCommand(args.slice(1), "install", json);
  } else if (command === "update") {
    await runLifecycleCommand(args.slice(1), "update", json);
  } else if (command === "remove") {
    await runLifecycleCommand(args.slice(1), "remove", json);
  } else if (command === "record") {
    await runRecord(args.slice(1), json);
  } else {
    throw new Error(
      "Usage: agent-skills <list|install|update|remove|record|validate|add> [options]",
    );
  }
} catch (error) {
  const permissionReview = getPermissionReview(error);
  if (permissionReview !== undefined && !json) {
    process.stdout.write(permissionReview);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        error: message,
        ...(permissionReview === undefined ? {} : { permissionReview }),
      })}\n`,
    );
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
  process.exitCode = 1;
}

async function runValidate(argv: string[], asJson: boolean): Promise<void> {
  rejectUnknownOptions(argv, new Set(["--catalog", "--json"]));

  if (argv.includes("--catalog") || firstPositional(argv) === undefined) {
    const catalogPath = readOption(argv, "--catalog") ?? defaultCatalogPath();
    const catalog = await readCatalog(catalogPath);
    for (const entry of catalog.entries) {
      if (entry.kind === "maintained") {
        await readCanonicalSkill(entry.path);
      }
    }
    emitResult({
      json: asJson,
      text: `Valid catalog: ${catalog.entries.length} entries`,
      payload: {
        ok: true,
        entryCount: catalog.entries.length,
        catalog: catalogToJson(catalog),
      },
    });
    return;
  }

  const source = firstPositional(argv);
  if (source === undefined) {
    throw new Error(
      "Usage: agent-skills validate <local-source> | validate --catalog [path]",
    );
  }

  const skill = await readCanonicalSkill(source);
  emitResult({
    json: asJson,
    text: `Valid canonical skill: ${skill.name}@${skill.version}`,
    payload: { ok: true, name: skill.name, version: skill.version },
  });
}

async function runList(argv: string[], asJson: boolean): Promise<void> {
  rejectUnknownOptions(argv, new Set(["--catalog", "--json"]));
  const catalogPath = readOption(argv, "--catalog") ?? defaultCatalogPath();
  const catalog = await readCatalog(catalogPath);
  emitResult({
    json: asJson,
    text: formatCatalogListing(catalog),
    payload: { ok: true, catalog: catalogToJson(catalog) },
  });
}

async function runLifecycleCommand(
  argv: string[],
  action: "install" | "update" | "remove",
  asJson: boolean,
): Promise<void> {
  rejectUnknownOptions(
    argv,
    new Set([
      "--agent",
      "--scope",
      "--catalog",
      "--dry-run",
      "--accept-permissions",
      "--force",
      "--json",
    ]),
  );

  const name = firstPositional(argv);
  if (name === undefined) {
    throw new Error(
      `Usage: agent-skills ${action} <name> [--agent <claude-code|codex>] [--scope <global|project>] [--catalog <path>] [--dry-run] [--accept-permissions] [--force] [--json]`,
    );
  }

  const catalogPath = readOption(argv, "--catalog") ?? defaultCatalogPath();
  const catalog = await readCatalog(catalogPath);
  const agentOption = readOption(argv, "--agent");
  const scopeOption = readOption(argv, "--scope");

  const result = await runLifecycle({
    catalog,
    name,
    action,
    projectDirectory: process.cwd(),
    ...(agentOption === undefined
      ? {}
      : { agent: parseSupportedAgent(agentOption) }),
    ...(scopeOption === undefined
      ? {}
      : { scope: parseSupportedScope(scopeOption) }),
    dryRun: argv.includes("--dry-run"),
    acceptPermissions: argv.includes("--accept-permissions"),
    force: argv.includes("--force"),
  });

  if (result.permissionReview !== undefined && !asJson && result.dryRun) {
    process.stdout.write(result.permissionReview);
  }

  emitResult({
    json: asJson,
    text: result.message,
    payload: {
      ok: true,
      action: result.action,
      dryRun: result.dryRun,
      name: result.entry.name,
      kind: result.entry.kind,
      message: result.message,
      ...(result.permissionReview === undefined
        ? {}
        : { permissionReview: result.permissionReview }),
      ...(result.delegated === undefined
        ? {}
        : {
            command: result.delegated.argv,
            stdout: result.delegated.stdout,
            stderr: result.delegated.stderr,
          }),
      ...(result.maintained === undefined
        ? {}
        : {
            version: result.maintained.skill.version,
            files: result.maintained.plannedFiles.map((file) => file.ownedPath),
          }),
    },
  });
}

async function runRecord(argv: string[], asJson: boolean): Promise<void> {
  rejectUnknownOptions(argv, new Set(["--catalog", "--entry-json", "--json"]));

  const entryJson = readOption(argv, "--entry-json");
  if (entryJson === undefined) {
    throw new Error(
      "Usage: agent-skills record --entry-json '<catalog-entry-object>' [--catalog <path>] [--json]",
    );
  }

  const catalogPath = readOption(argv, "--catalog") ?? defaultCatalogPath();
  const catalog = await readCatalog(catalogPath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(entryJson);
  } catch {
    throw new Error("Invalid --entry-json: must be valid JSON.");
  }

  const written = await recordCatalogEntry(catalog, parsed);
  emitResult({
    json: asJson,
    text: `Recorded ${written.kind} entry "${written.name}" in catalog`,
    payload: {
      ok: true,
      kind: written.kind,
      name: written.name,
      capabilityKind: written.capabilityKind,
    },
  });
}

function rejectUnknownOptions(argv: string[], allowed: Set<string>): void {
  const unknownOption = argv.find(
    (argument) => argument.startsWith("--") && !allowed.has(argument),
  );
  if (unknownOption !== undefined) {
    throw new Error(`Unknown option "${unknownOption}".`);
  }
}

function readOption(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function firstPositional(argv: string[]): string | undefined {
  const flagsWithValues = new Set([
    "--agent",
    "--scope",
    "--catalog",
    "--entry-json",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
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
