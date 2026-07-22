import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function runNpm(args, options) {
  if (process.env.npm_execpath !== undefined) {
    return spawnSync(process.execPath, [process.env.npm_execpath, ...args], options);
  }
  return spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    ...options,
    shell: process.platform === "win32",
  });
}

test("npm pack includes catalog skills and ADR, and list works from the package", async () => {
  await access(join(repositoryRoot, "dist", "cli.js"));
  const packageMetadata = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  );

  const packDir = await mkdtemp(join(tmpdir(), "agent-skills-pack-"));
  const installDir = await mkdtemp(join(tmpdir(), "agent-skills-install-"));
  const project = await mkdtemp(join(tmpdir(), "agent-skills-project-"));

  try {
    const npmEnv = {
      ...process.env,
      npm_config_cache: join(packDir, "npm-cache"),
    };
    const pack = runNpm(
      ["pack", "--ignore-scripts", "--pack-destination", packDir],
      { cwd: repositoryRoot, encoding: "utf8", env: npmEnv },
    );
    assert.equal(pack.status, 0, pack.stderr || pack.stdout);

    const tarballName = pack.stdout.trim().split(/\r?\n/).at(-1);
    assert.equal(
      tarballName,
      `mournerliao-agent-skills-${packageMetadata.version}.tgz`,
    );

    const listing = spawnSync("tar", ["-tzf", join(packDir, tarballName)], {
      encoding: "utf8",
    });
    assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, /package\/skills\/commit\/skill\.json/);
    assert.match(listing.stdout, /package\/docs\/adr\/0001-personal-capability-library\.md/);

    const install = runNpm(
      [
        "install",
        "--ignore-scripts",
        "--prefix",
        installDir,
        join(packDir, tarballName),
      ],
      { cwd: installDir, encoding: "utf8", env: npmEnv },
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
    try {
      await access(packagedCli);
    } catch {
      assert.fail(
        `Packaged CLI was not installed.\nstdout:\n${install.stdout}\nstderr:\n${install.stderr}`,
      );
    }
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
