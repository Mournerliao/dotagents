import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repositoryRoot, "dist", "cli.js");
const scriptedFixture = join(
  repositoryRoot,
  "test",
  "fixtures",
  "skills",
  "scripted-example",
);

test("validates a script-bearing skill with bundled resources and capabilities", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "validate", scriptedFixture],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /Valid canonical skill: scripted-example@1\.0\.0/,
  );
});

test("rejects a resource path that is missing from the skill package", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "missing-resource");
  await mkdir(join(source, "scripts"), { recursive: true });
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "missing-resource",
      version: "1.0.0",
      description: "Declares a missing script resource.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md", "scripts/missing.sh"],
      resources: { scripts: ["scripts/missing.sh"] },
      runtime: "bash",
      commands: ["bash scripts/missing.sh"],
      dependencies: ["bash"],
      network: [],
      secrets: [],
      permissions: ["execute"],
      writeLocations: [],
      provenance: { kind: "original" }
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Missing resource\n");

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Required skill content is missing: scripts\/missing\.sh\./,
  );
});

test("rejects a resource that is not listed in files", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "undeclared-file");
  await mkdir(join(source, "scripts"), { recursive: true });
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "undeclared-file",
      version: "1.0.0",
      description: "Resource not listed in files.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md"],
      resources: { scripts: ["scripts/hello.sh"] },
      runtime: "bash",
      commands: ["bash scripts/hello.sh"],
      dependencies: ["bash"],
      network: [],
      secrets: [],
      permissions: ["execute"],
      writeLocations: [],
      provenance: { kind: "original" }
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Undeclared file\n");
  await writeFile(join(source, "scripts", "hello.sh"), "#!/bin/bash\necho hi\n");

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: resource "scripts\/hello\.sh" must also be listed in "files"\./,
  );
});

test("rejects a broken local reference in SKILL.md", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "broken-ref");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "broken-ref",
      version: "1.0.0",
      description: "Broken markdown reference.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md"],
      provenance: { kind: "original" }
    }),
  );
  await writeFile(
    join(source, "SKILL.md"),
    "# Broken\n\nSee [missing](references/gone.md).\n",
  );

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Broken skill reference: "references\/gone\.md"\./,
  );
});

test("rejects scripts that omit required execute permission", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "undeclared-capability");
  await mkdir(join(source, "scripts"), { recursive: true });
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "undeclared-capability",
      version: "1.0.0",
      description: "Scripts without execute permission.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md", "scripts/hello.sh"],
      resources: { scripts: ["scripts/hello.sh"] },
      runtime: "bash",
      commands: ["bash scripts/hello.sh"],
      dependencies: ["bash"],
      network: [],
      secrets: [],
      permissions: [],
      writeLocations: [],
      provenance: { kind: "original" }
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Undeclared capability\n");
  await writeFile(join(source, "scripts", "hello.sh"), "#!/bin/bash\necho hi\n");

  const result = spawnSync(process.execPath, [cliPath, "validate", source], {
    cwd: project,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid canonical metadata: undeclared required capability "execute"\./,
  );
});

test("non-interactive install of a script-bearing skill fails without explicit acceptance", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", scriptedFixture, "--agent", "codex"],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Permission review for scripted-example@1\.0\.0/);
  assert.match(result.stdout, /commands: bash scripts\/hello\.sh/);
  assert.match(result.stdout, /network: https:\/\/example\.com/);
  assert.match(result.stdout, /secrets: SCRIPTED_EXAMPLE_TOKEN/);
  assert.match(result.stdout, /writeLocations: \.scratch\/scripted-example\//);
  assert.match(
    result.stderr,
    /Sensitive capabilities require --accept-permissions\./,
  );
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});

test("non-interactive install accepts sensitive capabilities with --accept-permissions", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      "add",
      scriptedFixture,
      "--agent",
      "codex",
      "--accept-permissions",
    ],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Permission review for scripted-example@1\.0\.0/);
  assert.match(
    result.stdout,
    /Installed scripted-example@1\.0\.0 for codex \(project\)/,
  );

  const installedScript = await readFile(
    join(project, ".agents", "skills", "scripted-example", "scripts", "hello.sh"),
    "utf8",
  );
  assert.match(installedScript, /hello from scripted-example/);

  const installedReference = await readFile(
    join(
      project,
      ".agents",
      "skills",
      "scripted-example",
      "references",
      "notes.md",
    ),
    "utf8",
  );
  assert.match(installedReference, /Reference material/);

  const lock = JSON.parse(
    await readFile(join(project, "agent-skills.lock.json"), "utf8"),
  );
  assert.equal(lock.installations.length, 1);
  assert.equal(lock.installations[0]?.name, "scripted-example");
  assert.deepEqual(lock.installations[0]?.files.sort(), [
    ".agents/skills/scripted-example/SKILL.md",
    ".agents/skills/scripted-example/assets/logo.txt",
    ".agents/skills/scripted-example/references/notes.md",
    ".agents/skills/scripted-example/scripts/hello.sh",
    ".agents/skills/scripted-example/templates/report.md",
  ]);
  assert.equal(
    Object.keys(lock.installations[0]?.digests ?? {}).length,
    lock.installations[0]?.files.length,
  );
});

test("interactive install presents permission review and installs after approval", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const catalogPath = join(project, "catalog.json");
  await writeFile(
    catalogPath,
    JSON.stringify({
      version: 1,
      entries: [
        {
          kind: "maintained",
          name: "scripted-example",
          version: "1.0.0",
          description: "Script-bearing fixture.",
          path: scriptedFixture,
          compatibility: ["codex"],
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", "--catalog", catalogPath],
    {
      cwd: project,
      encoding: "utf8",
      input: "1\ncodex\nproject\ny\n",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Permission review for scripted-example@1\.0\.0/);
  assert.match(result.stdout, /Accept sensitive capabilities\? \[y\/N]:/);
  assert.match(
    result.stdout,
    /Installed scripted-example@1\.0\.0 for codex \(project\)/,
  );
  await access(
    join(project, ".agents", "skills", "scripted-example", "scripts", "hello.sh"),
  );
});

test("interactive install denies sensitive capabilities without filesystem changes", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const catalogPath = join(project, "catalog.json");
  await writeFile(
    catalogPath,
    JSON.stringify({
      version: 1,
      entries: [
        {
          kind: "maintained",
          name: "scripted-example",
          version: "1.0.0",
          description: "Script-bearing fixture.",
          path: scriptedFixture,
          compatibility: ["codex"],
        },
      ],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", "--catalog", catalogPath],
    {
      cwd: project,
      encoding: "utf8",
      input: "1\ncodex\nproject\nn\n",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Permission review for scripted-example@1\.0\.0/);
  assert.match(result.stdout, /Installation cancelled\./);
  await assert.rejects(
    access(
      join(
        project,
        ".agents",
        "skills",
        "scripted-example",
        "SKILL.md",
      ),
    ),
  );
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});

test("dry-run previews resource copies and declared external effects without installing", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  const result = spawnSync(
    process.execPath,
    [cliPath, "add", scriptedFixture, "--agent", "codex", "--dry-run"],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Permission review for scripted-example@1\.0\.0/);
  assert.match(result.stdout, /Dry run: install scripted-example@1\.0\.0/);
  assert.match(
    result.stdout,
    /copy: \.agents\/skills\/scripted-example\/scripts\/hello\.sh/,
  );
  assert.match(
    result.stdout,
    /copy: \.agents\/skills\/scripted-example\/references\/notes\.md/,
  );
  assert.match(result.stdout, /effect: command bash scripts\/hello\.sh/);
  assert.match(result.stdout, /effect: network https:\/\/example\.com/);
  assert.match(result.stdout, /effect: secret SCRIPTED_EXAMPLE_TOKEN/);
  assert.match(
    result.stdout,
    /effect: writeLocation \.scratch\/scripted-example\//,
  );
  assert.doesNotMatch(result.stdout, /Installed scripted-example/);
  await assert.rejects(
    access(
      join(
        project,
        ".agents",
        "skills",
        "scripted-example",
        "SKILL.md",
      ),
    ),
  );
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});

test("install rejects a skill whose declared dependency is missing", async () => {
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));
  const source = join(project, "missing-dep");
  await mkdir(source);
  await writeFile(
    join(source, "skill.json"),
    JSON.stringify({
      name: "missing-dep",
      version: "1.0.0",
      description: "Depends on a missing binary.",
      license: "MIT",
      compatibility: ["codex"],
      files: ["SKILL.md"],
      runtime: "bash",
      commands: ["definitely-not-installed-binary-xyz"],
      dependencies: ["definitely-not-installed-binary-xyz"],
      network: [],
      secrets: [],
      permissions: ["execute"],
      writeLocations: [],
      provenance: { kind: "original" }
    }),
  );
  await writeFile(join(source, "SKILL.md"), "# Missing dependency\n");

  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      "add",
      source,
      "--agent",
      "codex",
      "--accept-permissions",
    ],
    { cwd: project, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Missing required dependency: definitely-not-installed-binary-xyz\./,
  );
  await assert.rejects(readFile(join(project, "agent-skills.lock.json")));
});
