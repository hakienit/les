import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("behavior eval dry-run exposes every guarded scenario", async () => {
  const result = spawnSync(process.execPath, [resolve(root, "tools/behavior-eval.mjs"), "--dry-run"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split("\n").map(JSON.parse);
  assert.equal(lines.length, 8);
  assert.ok(lines.some((line) => line.id === "git-no-commit" && line.expectedStatus === "BLOCKED"));
  assert.ok(lines.some((line) => line.id === "frontend-unavailable-browser" && line.expectedStatus === "BLOCKED"));
});

test("frontend fixture contains the required evidence surfaces", async () => {
  const source = await readFile(resolve(root, "test/fixtures/frontend-app/index.html"), "utf8");
  assert.match(source, /aria-live/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /min-height: 44px/);
  assert.match(source, /375px|760px/);
  assert.match(source, /data-state-button/);
  assert.match(source, /fetch\(['"]\/fixture-data\.json['"]\)/);
  const syntax = spawnSync(process.execPath, ["--check", resolve(root, "test/fixtures/frontend-app/server")], { cwd: root, encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
});

test("Codex host smoke is explicit, bounded, and Medium-only", async () => {
  const scenarios = JSON.parse(await readFile(resolve(root, "tools/behavior-eval/host-scenarios.json"), "utf8"));
  const source = await readFile(resolve(root, "tools/behavior-eval.mjs"), "utf8");
  assert.equal(scenarios.length, 5);
  assert.deepEqual(scenarios.map((scenario) => scenario.mode), ["bootstrap", "model", "user", "profile", "permission"]);
  assert.match(source, /gpt-5\.6-luna/);
  assert.match(source, /reasoningEffort !== "medium"/);
  assert.match(source, /--host-smoke/);
  assert.match(source, /--repeat/);
  assert.match(source, /--ephemeral/);
});
