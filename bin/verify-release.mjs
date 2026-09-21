#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowed = ["bin/", "policies/", "skills/", "profiles/", "adapters/", "templates/", "tools/", "inventory.yaml", "routes.yaml", "README.md", "CHANGELOG.md", "LICENSE", "package.json"];
const expectedFiles = ["bin", "policies", "skills", "profiles", "adapters", "templates", "tools", "inventory.yaml", "routes.yaml", "README.md", "CHANGELOG.md", "LICENSE"];
const expectedScripts = { test: "node --test", "eval:behavior": "node tools/behavior-eval.mjs", "eval:behavior:dry": "node tools/behavior-eval.mjs --dry-run", "smoke:codex:medium": "node tools/behavior-eval.mjs --host-smoke --model gpt-5.6-luna --reasoning-effort medium --report test/evidence/codex-host-smoke-medium.json", "verify-inventory": "node bin/verify-inventory.mjs", "verify-release": "node bin/verify-release.mjs" };
let failed = false;
const fail = (message) => { console.error("[BLOCKED] " + message); failed = true; };
const same = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && expected.every((value) => actual.includes(value));

const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (!same(metadata.files, expectedFiles)) fail("package files differ from the public allowlist");
if (JSON.stringify(metadata.scripts) !== JSON.stringify(expectedScripts)) fail("package scripts differ from the local verification contract");
for (const field of ["dependencies", "optionalDependencies", "bundleDependencies", "bundledDependencies"]) {
  if (metadata[field] && Object.keys(metadata[field]).length) fail("package declares " + field);
}
const inventory = spawnSync(process.execPath, [resolve(root, "bin/verify-inventory.mjs")], { cwd: root, encoding: "utf8" });
if (inventory.status !== 0) fail("inventory verification failed\n" + inventory.stderr.trim());
const packed = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" });
if (packed.status !== 0) fail("package dry-run failed: " + packed.stderr.trim());
else {
  try {
    for (const { path } of JSON.parse(packed.stdout)[0].files) {
      if (!allowed.some((prefix) => path === prefix || path.startsWith(prefix))) fail("unexpected tarball file: " + path);
    }
  } catch { fail("package dry-run returned invalid metadata"); }
}
if (failed) process.exitCode = 1;
else console.log("Release verification passed: inventory, dependency boundary, scripts, and tarball are clean.");
