import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repositoryRoot, "dist", "cli.js");
const fixtureCatalog = join(repositoryRoot, "test", "fixtures", "catalog.json");
const summarizeFixture = join(
  repositoryRoot,
  "test",
  "fixtures",
  "skills",
  "summarize",
);

test("lists maintained skills and catalog-only recommendations distinctly", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "list", "--catalog", fixtureCatalog],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /example\s+1\.0\.0\s+maintained\s+codex\s+A minimal canonical skill fixture\./,
  );
  assert.match(
    result.stdout,
    /summarize\s+1\.0\.0\s+maintained\s+codex\s+Summarize the current conversation or selection concisely\./,
  );
  assert.match(
    result.stdout,
    /find-skills\s+https:\/\/github\.com\/vercel-labs\/skills\/tree\/main\/skills\/find-skills\s+catalog-only\s+codex,claude-code\s+Discover and install agent skills from public registries\./,
  );
  assert.doesNotMatch(result.stdout, /find-skills\s+1\.0\.0\s+maintained/);
});

test("installs a second maintained skill through the interactive add flow", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", "--catalog", fixtureCatalog],
    {
      cwd: project,
      encoding: "utf8",
      input: "2\ncodex\nproject\n",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /summarize@1\.0\.0 \[maintained\]/);
  assert.match(result.stdout, /find-skills \[catalog-only\].*upstream=/);
  assert.match(result.stdout, /Installed summarize@1\.0\.0 for codex \(project\)/);

  const installedSkill = await readFile(
    join(project, ".agents", "skills", "summarize", "SKILL.md"),
    "utf8",
  );
  assert.match(installedSkill, /name: summarize/);

  const lock = JSON.parse(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
  );
  assert.deepEqual(lock.installations, [
    {
      name: "summarize",
      source: { type: "local", path: summarizeFixture },
      version: "1.0.0",
      agent: "codex",
      scope: "project",
      files: [".agents/skills/summarize/SKILL.md"],
    },
  ]);
});

test("cancels interactive add without installing", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", "--catalog", fixtureCatalog],
    {
      cwd: project,
      encoding: "utf8",
      input: "q\n",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Cancelled\./);
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});

test("rejects selecting a catalog-only entry during interactive add", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", "--catalog", fixtureCatalog],
    {
      cwd: project,
      encoding: "utf8",
      input: "3\n",
    },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /Catalog-only recommendations \(not installable\):/,
  );
  assert.match(
    result.stdout,
    /find-skills \[catalog-only\] upstream=https:\/\/github\.com\/vercel-labs\/skills\/tree\/main\/skills\/find-skills/,
  );
  assert.doesNotMatch(result.stdout, /3\) find-skills/);
  assert.match(
    result.stderr,
    /Invalid skill selection "3"\. Choose a number from 1 to 2\./,
  );
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});

test("rejects an unsupported agent choice during interactive add", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", "--catalog", fixtureCatalog],
    {
      cwd: project,
      encoding: "utf8",
      input: "2\ncursor\n",
    },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Unsupported agent "cursor"\. Supported agents: codex\./,
  );
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});
