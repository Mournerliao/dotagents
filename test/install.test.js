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

test("installs one local canonical skill for Codex at project scope", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", fixturePath, "--agent", "codex"],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed example@1\.0\.0 for codex \(project\)/);

  const installedSkill = await readFile(
    join(project, ".agents", "skills", "example", "SKILL.md"),
    "utf8",
  );
  assert.match(installedSkill, /name: example/);

  const lock = JSON.parse(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
  );
  assert.deepEqual(lock, {
    lockfileVersion: 1,
    installations: [
      {
        name: "example",
        source: { type: "local", path: fixturePath },
        version: "1.0.0",
        agent: "codex",
        scope: "project",
        files: [".agents/skills/example/SKILL.md"],
      },
    ],
  });
});

test("rejects an unsupported agent with an actionable error", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", fixturePath, "--agent", "cursor"],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported agent "cursor"\. Supported agents: codex\./);
});

test("rejects a non-project scope in the first installation slice", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      "add",
      fixturePath,
      "--agent",
      "codex",
      "--scope",
      "global",
    ],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Unsupported scope "global"\. Supported scopes: project\./,
  );
});

test("rejects canonical metadata that omits a required field", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "invalid-skill");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "invalid-skill",
      version: "1.0.0",
      description: "Missing its license.",
      compatibility: ["codex"],
      files: ["SKILL.md"],
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Invalid\n");

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", source, "--agent", "codex"],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: "license" must be a non-empty string\./,
  );
});

test("rejects a canonical skill that is incompatible with Codex", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "claude-only");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "claude-only",
      version: "1.0.0",
      description: "Only supports Claude Code.",
      license: "MIT",
      compatibility: ["claude-code"],
      files: ["SKILL.md"],
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Claude only\n");

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", source, "--agent", "codex"],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Skill "claude-only" does not support agent "codex"\./,
  );
});

test("validates canonical metadata without installing the skill", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "validate", fixturePath],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid canonical skill: example@1\.0\.0/);
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});

test("rejects an unsafe canonical skill identity", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "unsafe-skill");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "../escape",
      version: "1.0.0",
      description: "Unsafe identity.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md"],
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Unsafe\n");

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: "name" must be a lowercase kebab-case identifier\./,
  );
});

test("rejects a canonical skill without a semantic version", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "invalid-version");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "invalid-version",
      version: "next",
      description: "Invalid version.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md"],
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Invalid version\n");

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: "version" must be a semantic version\./,
  );
});

test("rejects canonical metadata whose required content is missing", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "missing-content");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "missing-content",
      version: "1.0.0",
      description: "Missing its declared skill instructions.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md"],
    }),
  );

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Required skill content is missing: SKILL\.md\./);
});

test("rejects canonical metadata without declared compatibility", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "missing-compatibility");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "missing-compatibility",
      version: "1.0.0",
      description: "Missing compatibility.",
      license: "MIT",
      files: ["SKILL.md"],
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Missing compatibility\n");

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: "compatibility" must list at least one supported agent\./,
  );
});
