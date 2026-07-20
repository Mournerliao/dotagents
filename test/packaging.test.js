import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("npm pack installs and completes the Codex project installation path", async () => {
  const distCli = join(repositoryRoot, "dist", "cli.js");
  await access(distCli);

  const packDir = await mkdtemp(join(tmpdir(), "agent-skills-pack-"));
  const installDir = await mkdtemp(join(tmpdir(), "agent-skills-install-"));
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  try {
    const pack = spawnSync(
      "npm",
      ["pack", "--ignore-scripts", "--pack-destination", packDir],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      },
    );
    assert.equal(pack.status, 0, pack.stderr || pack.stdout);

    const tarballName = pack.stdout.trim().split(/\r?\n/).at(-1);
    assert.ok(tarballName, "npm pack should print a tarball name");
    assert.match(tarballName, /^mournerliao-agent-skills-0\.1\.0\.tgz$/);

    const tarballPath = join(packDir, tarballName);
    const listing = spawnSync("tar", ["-tzf", tarballPath], {
      encoding: "utf8",
    });
    assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, /package\/dist\/cli\.js/);
    assert.match(listing.stdout, /package\/catalog\/catalog\.json/);
    assert.match(listing.stdout, /package\/skills\/summarize\/skill\.json/);
    assert.match(listing.stdout, /package\/skills\/example\/skill\.json/);
    assert.match(
      listing.stdout,
      /package\/skills\/find-skills-lite\/skill\.json/,
    );
    assert.match(listing.stdout, /package\/README\.md/);
    assert.match(listing.stdout, /package\/CHANGELOG\.md/);

    const install = spawnSync("npm", ["install", "--ignore-scripts", tarballPath], {
      cwd: installDir,
      encoding: "utf8",
    });
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const packageRoot = join(
      installDir,
      "node_modules",
      "@mournerliao",
      "agent-skills",
    );
    const packagedCli = join(packageRoot, "dist", "cli.js");

    const validate = spawnSync(
      process.execPath,
      [packagedCli, "validate", "--catalog"],
      {
        cwd: project,
        encoding: "utf8",
      },
    );
    assert.equal(validate.status, 0, validate.stderr);
    assert.match(validate.stdout, /Valid catalog: \d+ entries/);

    const listCatalog = spawnSync(
      process.execPath,
      [packagedCli, "list", "--catalog"],
      {
        cwd: project,
        encoding: "utf8",
      },
    );
    assert.equal(listCatalog.status, 0, listCatalog.stderr);
    assert.match(listCatalog.stdout, /summarize\s+1\.0\.0\s+maintained/);

    // Documented Codex project path: interactive add against the bundled catalog
    // (maintained order: 1=example, 2=summarize, 3=find-skills-lite).
    const add = spawnSync(process.execPath, [packagedCli, "add"], {
      cwd: project,
      encoding: "utf8",
      input: "2\ncodex\nproject\n",
    });
    assert.equal(add.status, 0, add.stderr);
    assert.match(
      add.stdout,
      /Installed summarize@1\.0\.0 for codex \(project\)/,
    );

    const installedSkill = await readFile(
      join(project, ".agents", "skills", "summarize", "SKILL.md"),
      "utf8",
    );
    assert.match(installedSkill, /name: summarize/);

    const lock = JSON.parse(
      await readFile(join(project, "agent-skills.lock.json"), "utf8"),
    );
    assert.equal(lock.installations.length, 1);
    assert.equal(lock.installations[0].name, "summarize");
    assert.equal(lock.installations[0].version, "1.0.0");
    assert.equal(lock.installations[0].agent, "codex");
    assert.equal(lock.installations[0].scope, "project");
    assert.deepEqual(lock.installations[0].files, [
      ".agents/skills/summarize/SKILL.md",
    ]);
    assert.equal(lock.installations[0].source.type, "local");
    assert.match(
      lock.installations[0].source.path,
      /skills[\\/]+summarize$/,
    );
  } finally {
    await Promise.all([
      rm(packDir, { recursive: true, force: true }),
      rm(installDir, { recursive: true, force: true }),
      rm(project, { recursive: true, force: true }),
    ]);
  }
});
