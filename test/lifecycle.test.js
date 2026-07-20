import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repositoryRoot, "dist", "cli.js");
const fixturePath = join(repositoryRoot, "test", "fixtures", "skills", "example");
const fixtureV2Path = join(
  repositoryRoot,
  "test",
  "fixtures",
  "skills",
  "example-v2",
);

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    ...options,
  });
}

async function writeSkill(directory, skill) {
  const { contents = {}, ...metadata } = skill;
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "skill.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  for (const [relativePath, fileContents] of Object.entries(contents)) {
    const absolute = join(directory, relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, fileContents);
  }
}

test("lists installed skill identity, source, version, agent, scope, and update status", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const listed = runCli(["list"], { cwd: project });
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(
    listed.stdout,
    `example\tlocal:${fixturePath}\t1.0.0\tcodex\tproject\tup-to-date\n`,
  );
});

test("reports update-available when the recorded source has a newer version", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "mutable-source");
  await writeSkill(source, {
    name: "example",
    version: "1.0.0",
    description: "Mutable local source for update detection.",
    license: "MIT",
    compatibility: ["codex"],
    files: ["SKILL.md"],
    provenance: { kind: "original" },
    contents: {
      "SKILL.md": "# Example 1.0.0\n",
    },
  });

  const install = runCli(["add", source, "--agent", "codex"], { cwd: project });
  assert.equal(install.status, 0, install.stderr);

  await writeSkill(source, {
    name: "example",
    version: "2.0.0",
    description: "Mutable local source for update detection.",
    license: "MIT",
    compatibility: ["codex"],
    files: ["SKILL.md"],
    provenance: { kind: "original" },
    contents: {
      "SKILL.md": "# Example 2.0.0\n",
    },
  });

  const listed = runCli(["list"], { cwd: project });
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(
    listed.stdout,
    `example\tlocal:${source}\t1.0.0\tcodex\tproject\tupdate-available:2.0.0\n`,
  );

  const installedSkill = await readFile(
    join(project, ".agents", "skills", "example", "SKILL.md"),
    "utf8",
  );
  assert.equal(installedSkill, "# Example 1.0.0\n");

  const updated = runCli(["update", "example"], { cwd: project });
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /Updated example@1\.0\.0 -> 2\.0\.0/);
  assert.equal(
    await readFile(
      join(project, ".agents", "skills", "example", "SKILL.md"),
      "utf8",
    ),
    "# Example 2.0.0\n",
  );
});

test("update is a no-op when the source version matches the installed version", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const before = await readFile(
    join(project, ".agents", "skills", "example", "SKILL.md"),
    "utf8",
  );
  const beforeLock = await readFile(
    join(project, "agent-skills.lock.json"),
    "utf8",
  );

  const updated = runCli(["update", "example", "--source", fixturePath], {
    cwd: project,
  });
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /Already up to date: example@1\.0\.0/);

  assert.equal(
    await readFile(
      join(project, ".agents", "skills", "example", "SKILL.md"),
      "utf8",
    ),
    before,
  );
  assert.equal(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
    beforeLock,
  );
});

test("update revises installed content and lock state from a newer local source", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const updated = runCli(["update", "example", "--source", fixtureV2Path], {
    cwd: project,
  });
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /Updated example@1\.0\.0 -> 2\.0\.0/);

  const installedSkill = await readFile(
    join(project, ".agents", "skills", "example", "SKILL.md"),
    "utf8",
  );
  assert.match(installedSkill, /Example v2/);
  const installedExtra = await readFile(
    join(project, ".agents", "skills", "example", "EXTRA.md"),
    "utf8",
  );
  assert.match(installedExtra, /Supporting notes/);

  const lock = JSON.parse(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
  );
  assert.deepEqual(lock.installations, [
    {
      name: "example",
      source: { type: "local", path: fixtureV2Path },
      version: "2.0.0",
      agent: "codex",
      scope: "project",
      files: [
        ".agents/skills/example/SKILL.md",
        ".agents/skills/example/EXTRA.md",
      ],
      digests: {
        ".agents/skills/example/SKILL.md":
          "29da871f0f59b198763c6035a1fe47a7fe83b9b344b25a43f0cc0c1fc7393568",
        ".agents/skills/example/EXTRA.md":
          "a9b0030957c56d0f8fccc82e9b927b9de58a444fc993ad7d679c27fcc037aae8",
      },
    },
  ]);
});

test("dry-run update previews changes without modifying the filesystem", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const beforeSkill = await readFile(
    join(project, ".agents", "skills", "example", "SKILL.md"),
    "utf8",
  );
  const beforeLock = await readFile(
    join(project, "agent-skills.lock.json"),
    "utf8",
  );

  const preview = runCli(
    ["update", "example", "--source", fixtureV2Path, "--dry-run"],
    { cwd: project },
  );
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Dry run: update example@1\.0\.0 -> 2\.0\.0/);
  assert.match(preview.stdout, /replace:\s+\.agents\/skills\/example\/SKILL\.md/);
  assert.match(preview.stdout, /write:\s+\.agents\/skills\/example\/EXTRA\.md/);
  assert.match(preview.stdout, /lock:\s+version 1\.0\.0 -> 2\.0\.0/);
  assert.doesNotMatch(preview.stdout, /Updated example@/);

  assert.equal(
    await readFile(
      join(project, ".agents", "skills", "example", "SKILL.md"),
      "utf8",
    ),
    beforeSkill,
  );
  assert.equal(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
    beforeLock,
  );
  await assert.rejects(
    readFile(join(project, ".agents", "skills", "example", "EXTRA.md")),
  );
});

test("remove deletes only installer-owned files and clears the lock entry", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const unrelated = join(project, ".agents", "skills", "manual", "NOTES.md");
  await mkdir(dirname(unrelated), { recursive: true });
  await writeFile(unrelated, "# keep me\n");

  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const removed = runCli(["remove", "example"], { cwd: project });
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(
    removed.stdout,
    /Removed example@1\.0\.0 for codex \(project\)/,
  );

  await assert.rejects(
    readFile(join(project, ".agents", "skills", "example", "SKILL.md")),
  );
  assert.equal(await readFile(unrelated, "utf8"), "# keep me\n");

  const lock = JSON.parse(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
  );
  assert.deepEqual(lock, { lockfileVersion: 1, installations: [] });
});

test("update fails when a managed file was modified unless --force is supplied", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const managed = join(project, ".agents", "skills", "example", "SKILL.md");
  await writeFile(managed, "# user edited\n");

  const blocked = runCli(["update", "example", "--source", fixtureV2Path], {
    cwd: project,
  });
  assert.equal(blocked.status, 1);
  assert.match(
    blocked.stderr,
    /Managed file was modified: .*[/\\]\.agents[/\\]skills[/\\]example[/\\]SKILL\.md\. Re-run with --force to override\./,
  );
  assert.equal(await readFile(managed, "utf8"), "# user edited\n");

  const forced = runCli(
    ["update", "example", "--source", fixtureV2Path, "--force"],
    { cwd: project },
  );
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /Updated example@1\.0\.0 -> 2\.0\.0/);
  assert.match(await readFile(managed, "utf8"), /Example v2/);
});

test("update fails on destination conflicts unless --force is supplied", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const conflict = join(project, ".agents", "skills", "example", "EXTRA.md");
  await writeFile(conflict, "# unmanaged\n");

  const blocked = runCli(["update", "example", "--source", fixtureV2Path], {
    cwd: project,
  });
  assert.equal(blocked.status, 1);
  assert.match(
    blocked.stderr,
    /Destination conflict for unmanaged file: .*[/\\]\.agents[/\\]skills[/\\]example[/\\]EXTRA\.md\. Re-run with --force to override\./,
  );
  assert.equal(await readFile(conflict, "utf8"), "# unmanaged\n");

  const forced = runCli(
    ["update", "example", "--source", fixtureV2Path, "--force"],
    { cwd: project },
  );
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(await readFile(conflict, "utf8"), /Supporting notes/);
});

test("partial update failure rolls back installed files and lock state", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const beforeSkill = await readFile(
    join(project, ".agents", "skills", "example", "SKILL.md"),
    "utf8",
  );
  const beforeLock = await readFile(
    join(project, "agent-skills.lock.json"),
    "utf8",
  );

  const source = join(project, "partial-fail-source");
  await writeSkill(source, {
    name: "example",
    version: "2.0.0",
    description: "Source that writes two new files for rollback coverage.",
    license: "MIT",
    compatibility: ["codex"],
    files: ["SKILL.md", "A.md", "B.md"],
    provenance: { kind: "original" },
    contents: {
      "SKILL.md": "# Example rollback\n",
      "A.md": "first new file\n",
      "B.md": "second new file\n",
    },
  });

  await mkdir(join(project, ".agents", "skills", "example", "B.md"), {
    recursive: true,
  });

  const failed = runCli(
    ["update", "example", "--source", source, "--force"],
    { cwd: project },
  );
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Error:/);

  assert.equal(
    await readFile(
      join(project, ".agents", "skills", "example", "SKILL.md"),
      "utf8",
    ),
    beforeSkill,
  );
  await assert.rejects(
    readFile(join(project, ".agents", "skills", "example", "A.md")),
  );
  assert.equal(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
    beforeLock,
  );
});

test("update removes owned files that disappear between versions", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const install = runCli(["add", fixtureV2Path, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const preview = runCli(
    ["update", "example", "--source", fixturePath, "--dry-run"],
    { cwd: project },
  );
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Dry run: update example@2\.0\.0 -> 1\.0\.0/);
  assert.match(preview.stdout, /remove:\s+\.agents\/skills\/example\/EXTRA\.md/);
  assert.match(preview.stdout, /lock:\s+version 2\.0\.0 -> 1\.0\.0/);

  const updated = runCli(["update", "example", "--source", fixturePath], {
    cwd: project,
  });
  assert.equal(updated.status, 0, updated.stderr);
  await assert.rejects(
    readFile(join(project, ".agents", "skills", "example", "EXTRA.md")),
  );

  const lock = JSON.parse(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
  );
  assert.deepEqual(lock.installations[0]?.files, [
    ".agents/skills/example/SKILL.md",
  ]);
});

test("remove fails when a managed file was modified unless --force is supplied", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const install = runCli(["add", fixturePath, "--agent", "codex"], {
    cwd: project,
  });
  assert.equal(install.status, 0, install.stderr);

  const managed = join(project, ".agents", "skills", "example", "SKILL.md");
  await writeFile(managed, "# user edited\n");

  const blocked = runCli(["remove", "example"], { cwd: project });
  assert.equal(blocked.status, 1);
  assert.match(
    blocked.stderr,
    /Managed file was modified: .*[/\\]\.agents[/\\]skills[/\\]example[/\\]SKILL\.md\. Re-run with --force to override\./,
  );
  assert.equal(await readFile(managed, "utf8"), "# user edited\n");

  const forced = runCli(["remove", "example", "--force"], { cwd: project });
  assert.equal(forced.status, 0, forced.stderr);
  await assert.rejects(readFile(managed));
});
