import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repositoryRoot, "dist", "cli.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    ...options,
  });
}

test("list shows the sync set catalog by default", () => {
  const result = runCli(["list", "--catalog", join(repositoryRoot, "catalog.json")]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Catalog \(\d+ entries\)$/m);
  assert.match(result.stdout, /^commit$/m);
  assert.match(result.stdout, /^  Type: skill \| Status: maintained \| Version: 1\.0\.2$/m);
  assert.match(result.stdout, /^agent-skills$/m);
  assert.match(result.stdout, /^  Type: skill \| Status: maintained \| Version: 1\.1\.1$/m);
  assert.doesNotMatch(result.stdout, /find-skills-lite/);
  assert.match(result.stdout, /^mattpocock-skills$/m);
  assert.match(result.stdout, /^  Type: skill \| Status: delegated$/m);
  assert.match(result.stdout, /^  Source: https:\/\/github\.com\/mattpocock\/skills$/m);
  assert.match(result.stdout, /^find-skills$/m);
  assert.match(result.stdout, /^  Type: skill \| Status: link-only$/m);
  assert.doesNotMatch(result.stdout, /\t/);
  assert.ok(
    result.stdout.split("\n").every((line) => line.length <= 100),
    result.stdout,
  );
});

test("list --json returns machine-readable catalog", () => {
  const result = runCli([
    "list",
    "--catalog",
    join(repositoryRoot, "catalog.json"),
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.catalog.entries));
  assert.ok(
    payload.catalog.entries.some((entry) => entry.name === "commit"),
  );
});

test("installs a maintained skill without writing a lockfile", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-install-"));
  try {
    const result = runCli(
      [
        "install",
        "commit",
        "--agent",
        "codex",
        "--scope",
        "project",
        "--catalog",
        join(repositoryRoot, "catalog.json"),
      ],
      { cwd: project },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Installed commit@1\.0\.2 for codex \(project\)/);

    const installed = await readFile(
      join(project, ".agents", "skills", "commit", "SKILL.md"),
      "utf8",
    );
    assert.match(installed, /name: commit/);

    await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("dry-run delegated install prints the upstream recipe without executing", () => {
  const result = runCli([
    "install",
    "mattpocock-skills",
    "--dry-run",
    "--catalog",
    join(repositoryRoot, "catalog.json"),
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Permission review for delegated install: mattpocock-skills/);
  assert.match(result.stdout, /skills@latest/);
  assert.match(result.stdout, /mattpocock\/skills/);
  assert.match(result.stdout, /Dry run: delegated install mattpocock-skills/);
  assert.match(result.stdout, /-a claude-code/);
  assert.match(result.stdout, /-a codex/);
  assert.doesNotMatch(result.stdout, /-a cursor/);
});

test("dry-run impeccable recipe does not add a Cursor provider copy", () => {
  const result = runCli([
    "install",
    "impeccable",
    "--dry-run",
    "--catalog",
    join(repositoryRoot, "catalog.json"),
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--providers=claude,codex/);
  assert.doesNotMatch(result.stdout, /--providers=\S*cursor/);
});

test("delegated recipes do not copy into Cursor's skill directory", async () => {
  const catalog = JSON.parse(
    await readFile(join(repositoryRoot, "catalog.json"), "utf8"),
  );

  for (const entry of catalog.entries) {
    if (entry.kind !== "delegated") {
      continue;
    }

    for (const argv of [
      entry.recipe.install,
      entry.recipe.update,
      entry.recipe.remove,
    ]) {
      if (argv === undefined) {
        continue;
      }

      const command = argv.join(" ");
      assert.doesNotMatch(
        command,
        /(^|\s)-a cursor(\s|$)/,
        `${entry.name} must not pass -a cursor`,
      );
      assert.doesNotMatch(
        command,
        /--providers=\S*cursor/,
        `${entry.name} must not include a Cursor provider`,
      );
      assert.doesNotMatch(
        command,
        /\.cursor\/skills/,
        `${entry.name} must not write ~/.cursor/skills`,
      );
    }
  }
});

test("delegated install without --accept-permissions fails", () => {
  const result = runCli([
    "install",
    "impeccable",
    "--catalog",
    join(repositoryRoot, "catalog.json"),
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Delegated recipes require --accept-permissions/);
});

test("update and remove maintained skills by convention path", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-lifecycle-"));
  try {
    const install = runCli(
      [
        "install",
        "commit",
        "--agent",
        "codex",
        "--scope",
        "project",
        "--catalog",
        join(repositoryRoot, "catalog.json"),
      ],
      { cwd: project },
    );
    assert.equal(install.status, 0, install.stderr);

    const updated = runCli(
      [
        "update",
        "commit",
        "--agent",
        "codex",
        "--scope",
        "project",
        "--catalog",
        join(repositoryRoot, "catalog.json"),
      ],
      { cwd: project },
    );
    assert.equal(updated.status, 0, updated.stderr);
    assert.match(updated.stdout, /Updated commit@1\.0\.2/);

    const removed = runCli(
      [
        "remove",
        "commit",
        "--agent",
        "codex",
        "--scope",
        "project",
        "--catalog",
        join(repositoryRoot, "catalog.json"),
      ],
      { cwd: project },
    );
    assert.equal(removed.status, 0, removed.stderr);
    assert.match(removed.stdout, /Removed commit@1\.0\.2/);
    await assert.rejects(
      readFile(join(project, ".agents", "skills", "commit", "SKILL.md")),
    );
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("record upserts a delegated entry into the catalog", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-skills-record-"));
  try {
    const catalogPath = join(dir, "catalog.json");
    await writeFile(
      catalogPath,
      `${JSON.stringify(
        {
          entries: [
            {
              kind: "link-only",
              capabilityKind: "skill",
              name: "placeholder",
              upstream: "https://example.com/placeholder",
              author: "Test",
              license: "MIT",
              compatibility: ["codex"],
              recommendation: "test",
              description: "placeholder",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const entry = {
      kind: "delegated",
      capabilityKind: "skill",
      name: "demo-tool",
      upstream: "https://example.com/demo",
      author: "Demo",
      license: "MIT",
      compatibility: ["codex"],
      description: "Demo delegated tool",
      recipe: {
        install: ["echo", "install-demo"],
        update: ["echo", "update-demo"],
      },
    };

    const result = runCli([
      "record",
      "--catalog",
      catalogPath,
      "--entry-json",
      JSON.stringify(entry),
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.name, "demo-tool");

    const saved = JSON.parse(await readFile(catalogPath, "utf8"));
    assert.equal(saved.entries.length, 2);
    assert.equal(saved.entries[1].name, "demo-tool");
    assert.deepEqual(saved.entries[1].recipe.install, ["echo", "install-demo"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("link-only entries cannot be installed", () => {
  const result = runCli([
    "install",
    "find-skills",
    "--agent",
    "codex",
    "--catalog",
    join(repositoryRoot, "catalog.json"),
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /link-only/);
});

test("rejects unknown options", () => {
  const result = runCli(["list", "--nope"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option "--nope"/);
});
