import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("npm pack includes catalog skills and ADR, and list works from the package", async () => {
  await access(join(repositoryRoot, "dist", "cli.js"));

  const packDir = await mkdtemp(join(tmpdir(), "agent-skills-pack-"));
  const installDir = await mkdtemp(join(tmpdir(), "agent-skills-install-"));
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  try {
    const pack = spawnSync(
      "npm",
      ["pack", "--ignore-scripts", "--pack-destination", packDir],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(pack.status, 0, pack.stderr || pack.stdout);

    const tarballName = pack.stdout.trim().split(/\r?\n/).at(-1);
    assert.match(tarballName ?? "", /^mournerliao-agent-skills-0\.2\.0\.tgz$/);

    const listing = spawnSync("tar", ["-tzf", join(packDir, tarballName)], {
      encoding: "utf8",
    });
    assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, /package\/skills\/commit\/skill\.json/);
    assert.match(listing.stdout, /package\/docs\/adr\/0001-personal-capability-library\.md/);

    const install = spawnSync(
      "npm",
      ["install", "--ignore-scripts", join(packDir, tarballName)],
      { cwd: installDir, encoding: "utf8" },
    );
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const packagedCli = join(
      installDir,
      "node_modules",
      "@mournerliao",
      "agent-skills",
      "dist",
      "cli.js",
    );
    const list = spawnSync(process.execPath, [packagedCli, "list", "--json"], {
      cwd: project,
      encoding: "utf8",
    });
    assert.equal(list.status, 0, list.stderr);
    const payload = JSON.parse(list.stdout);
    assert.ok(
      payload.catalog.entries.some((entry) => entry.name === "commit"),
    );

    const installExample = spawnSync(
      process.execPath,
      [
        packagedCli,
        "install",
        "example",
        "--agent",
        "codex",
        "--scope",
        "project",
      ],
      { cwd: project, encoding: "utf8" },
    );
    assert.equal(installExample.status, 0, installExample.stderr);
    const skill = await readFile(
      join(project, ".agents", "skills", "example", "SKILL.md"),
      "utf8",
    );
    assert.match(skill, /name: example/);
  } finally {
    await Promise.all([
      rm(packDir, { recursive: true, force: true }),
      rm(installDir, { recursive: true, force: true }),
      rm(project, { recursive: true, force: true }),
    ]);
  }
});
