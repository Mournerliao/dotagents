import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile, mkdir, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repositoryRoot, "dist", "cli.js");
const scriptedFixture = join(
  repositoryRoot,
  "test",
  "fixtures",
  "skills",
  "scripted-example",
);

test("script-bearing maintained skill requires --accept-permissions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-skills-perm-"));
  try {
    const skillsDir = join(dir, "skills", "scripted-example");
    await cp(scriptedFixture, skillsDir, { recursive: true });
    await chmod(join(skillsDir, "scripts", "hello.sh"), 0o755);

    const catalogPath = join(dir, "catalog.json");
    await writeFile(
      catalogPath,
      `${JSON.stringify(
        {
          entries: [
            {
              kind: "maintained",
              capabilityKind: "skill",
              name: "scripted-example",
              version: "1.0.0",
              compatibility: ["codex"],
              description: "Scripted fixture",
              path: "skills/scripted-example",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const project = join(dir, "project");
    await mkdir(project);

    const blocked = spawnSync(
      process.execPath,
      [
        cli,
        "install",
        "scripted-example",
        "--agent",
        "codex",
        "--scope",
        "project",
        "--catalog",
        catalogPath,
      ],
      { cwd: project, encoding: "utf8" },
    );
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /Sensitive capabilities require --accept-permissions/);

    const allowed = spawnSync(
      process.execPath,
      [
        cli,
        "install",
        "scripted-example",
        "--agent",
        "codex",
        "--scope",
        "project",
        "--catalog",
        catalogPath,
        "--accept-permissions",
      ],
      { cwd: project, encoding: "utf8" },
    );
    assert.equal(allowed.status, 0, allowed.stderr);
    const script = await readFile(
      join(project, ".agents", "skills", "scripted-example", "scripts", "hello.sh"),
      "utf8",
    );
    assert.match(script, /hello from scripted-example/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
