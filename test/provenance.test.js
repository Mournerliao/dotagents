import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repositoryRoot, "dist", "cli.js");

async function writeSkill(source, metadata) {
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "skill.json"), JSON.stringify(metadata));
  await writeFile(join(source, "SKILL.md"), "# Fixture\n");
}

function baseMetadata(overrides = {}) {
  return {
    name: "provenance-fixture",
    version: "1.0.0",
    description: "A provenance validation fixture.",
    license: "MIT",
    compatibility: ["codex"],
    files: ["SKILL.md"],
    ...overrides,
  };
}

test("rejects a skill missing provenance", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "missing-provenance");
  await writeSkill(source, baseMetadata({ name: "missing-provenance" }));

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: "provenance" is required\./,
  );
});

test("accepts an original skill with provenance.kind original", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "original-skill");
  await writeSkill(
    source,
    baseMetadata({
      name: "original-skill",
      provenance: { kind: "original" },
    }),
  );

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid canonical skill: original-skill@1\.0\.0/);
});

test("rejects an original skill that also declares upstream provenance", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "ambiguous-original");
  await writeSkill(
    source,
    baseMetadata({
      name: "ambiguous-original",
      provenance: {
        kind: "original",
        upstream: "https://example.com/upstream",
      },
    }),
  );

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: original provenance must not declare upstream fields\./,
  );
});

test("rejects a maintained-fork missing required provenance fields", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "incomplete-fork");
  await writeSkill(
    source,
    baseMetadata({
      name: "incomplete-fork",
      provenance: {
        kind: "maintained-fork",
        upstream: "https://example.com/upstream",
      },
    }),
  );

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: maintained-fork provenance requires "upstream", "baseline", "reason", "changes", and "attribution"\./,
  );
});

test("accepts a complete maintained-fork provenance record", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "complete-fork");
  await writeSkill(
    source,
    baseMetadata({
      name: "complete-fork",
      provenance: {
        kind: "maintained-fork",
        upstream: "https://example.com/skills/complete-fork",
        baseline: "1.2.3",
        reason: "Trim for local install contract.",
        changes: ["Removed registry network calls.", "Kept discovery instructions."],
        attribution: "Based on Example Author's complete-fork (MIT).",
      },
    }),
  );

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid canonical skill: complete-fork@1\.0\.0/);
});

test("rejects a maintained-fork with a malformed upstream URL", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "bad-upstream-fork");
  await writeSkill(
    source,
    baseMetadata({
      name: "bad-upstream-fork",
      provenance: {
        kind: "maintained-fork",
        upstream: "not-a-url",
        baseline: "abc123",
        reason: "Local maintenance.",
        changes: ["Adapted instructions."],
        attribution: "Upstream Author (MIT).",
      },
    }),
  );

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: "provenance\.upstream" must be an https URL\./,
  );
});

test("validates a catalog with complete catalog-only provenance fields", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const skillDir = join(project, "skills", "local-original");
  await writeSkill(
    skillDir,
    baseMetadata({
      name: "local-original",
      provenance: { kind: "original" },
    }),
  );

  const catalogPath = join(project, "catalog.json");
  await writeFile(
    catalogPath,
    JSON.stringify({
      entries: [
        {
          kind: "maintained",
          name: "local-original",
          version: "1.0.0",
          compatibility: ["codex"],
          description: "A local original skill.",
          path: "skills/local-original",
        },
        {
          kind: "catalog-only",
          name: "external-skill",
          upstream: "https://example.com/skills/external-skill",
          author: "Example Author",
          license: "MIT",
          compatibility: ["codex", "claude-code"],
          compatibilityNotes: "Codex and Claude Code layouts only.",
          recommendation: "Useful discovery helper; keep as upstream link.",
          description: "An external recommendation.",
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [cliPath, "validate", "--catalog", catalogPath],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid catalog:/);
});

test("rejects a catalog-only entry missing author license or recommendation", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const catalogPath = join(project, "catalog.json");
  await writeFile(
    catalogPath,
    JSON.stringify({
      entries: [
        {
          kind: "catalog-only",
          name: "incomplete-catalog",
          upstream: "https://example.com/skills/incomplete",
          compatibility: ["codex"],
          description: "Missing provenance fields.",
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [cliPath, "validate", "--catalog", catalogPath],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid link-only catalog entry: "author" and "license" are required\./,
  );
});

test("rejects a catalog-only entry with a malformed upstream URL", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const catalogPath = join(project, "catalog.json");
  await writeFile(
    catalogPath,
    JSON.stringify({
      entries: [
        {
          kind: "catalog-only",
          name: "bad-upstream",
          upstream: "ftp://example.com/skill",
          author: "Example Author",
          license: "unknown",
          compatibility: ["codex"],
          recommendation: "Do not use until upstream is https.",
          description: "Broken upstream shape.",
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [cliPath, "validate", "--catalog", catalogPath],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid link-only catalog entry: "upstream" must be an https URL\./,
  );
});

test("rejects a maintained catalog entry whose path does not resolve", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const catalogPath = join(project, "catalog.json");
  await writeFile(
    catalogPath,
    JSON.stringify({
      entries: [
        {
          kind: "maintained",
          name: "missing-path",
          version: "1.0.0",
          compatibility: ["codex"],
          description: "Points at a missing skill directory.",
          path: "skills/does-not-exist",
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [cliPath, "validate", "--catalog", catalogPath],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid maintained catalog entry: path "skills\/does-not-exist" does not resolve to a skill directory\./,
  );
});

test("rejects a maintained catalog entry whose skill lacks provenance", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const skillDir = join(project, "skills", "no-provenance");
  await writeSkill(
    skillDir,
    baseMetadata({ name: "no-provenance" }),
  );

  const catalogPath = join(project, "catalog.json");
  await writeFile(
    catalogPath,
    JSON.stringify({
      entries: [
        {
          kind: "maintained",
          name: "no-provenance",
          version: "1.0.0",
          compatibility: ["codex"],
          description: "Maintained skill missing provenance.",
          path: "skills/no-provenance",
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [cliPath, "validate", "--catalog", catalogPath],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: "provenance" is required\./,
  );
});
