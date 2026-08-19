import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("package manifest is a pi package", async () => {
  const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "@mournerliao/pi-cursor-provider");
  assert.ok(pkg.keywords.includes("pi-package"));
  assert.ok(pkg.pi.extensions.includes("./extensions/cursor-provider.ts"));
});
