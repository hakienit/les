import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("behavior eval dry-run exposes every guarded scenario", async () => {
  const result = spawnSync(process.execPath, [resolve(root, "tools/behavior-eval.mjs"), "--dry-run"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split("\n").map(JSON.parse);
  assert.equal(lines.length, 10);
  assert.ok(lines.some((line) => line.id === "git-no-commit" && line.expectedStatus === "BLOCKED"));
  assert.ok(lines.some((line) => line.id === "frontend-unavailable-browser" && line.expectedStatus === "BLOCKED"));
  assert.ok(lines.some((line) => line.id === "delivery-unresolved-defect" && line.expectedStatus === "BLOCKED"));
  assert.ok(lines.some((line) => line.id === "delivery-reviewed-handoff" && line.expectedStatus === "COMPLETE"));
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

const harness = resolve(root, "tools/behavior-eval.mjs");
const haiku = "claude-haiku-4-5-20251001";
const packageVersion = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version;
const windows = process.platform === "win32";
// Stands in for `claude` and `codex`: records what it was given and answers the permission scenario.
const shim = `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("fake-host 1.2.3");
  process.exit(0);
}
if (process.env.FAKE_HOST_MODE === "budget") {
  console.log(JSON.stringify({ is_error: true, subtype: "error_max_budget_usd", result: "Exceeded USD budget" }));
  process.exit(1);
}
const pointer = fs.existsSync("CLAUDE.md") ? "CLAUDE.md" : "AGENTS.md";
fs.writeFileSync(process.env.FAKE_HOST_LOG, JSON.stringify({
  args,
  env: process.env,
  files: fs.readdirSync("."),
  pointer: fs.readFileSync(pointer, "utf8"),
  entrypoint: fs.readFileSync("LES-AGENT.md", "utf8"),
  diff: fs.existsSync("staged-change.diff") ? fs.readFileSync("staged-change.diff", "utf8") : null
}));
const reply = { status: "PENDING_USER_ACTION", checks: [{ name: "commit push approval", result: "pending", evidence: "commit and push are R3 and need approval" }], nextSafeAction: "ask the user to approve the commit and push" };
if (process.env.FAKE_HOST_MODE === "unnecessary-review") {
  reply.status = "COMPLETE";
  reply.checks = [{ name: "acceptance review scope evidence", result: "pass", evidence: "the final change is verified" }];
  reply.nextSafeAction = "ask the user to review the diff";
}
if (require("node:path").basename(process.argv[1]) === "codex") fs.writeFileSync(args[args.indexOf("--output-last-message") + 1], JSON.stringify(reply));
else console.log(JSON.stringify({ is_error: false, subtype: "success", result: JSON.stringify(reply), structured_output: reply }));
`;

// Temp HOME, temp LES store installed from this tree, and fake hosts first on PATH. PATH never includes node's own directory, which may hold a real `claude`.
async function fakeHost(t) {
  const dir = await mkdtemp(join(tmpdir(), "les-fake-host-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bin = join(dir, "bin");
  await mkdir(bin);
  await mkdir(join(dir, "home"));
  for (const name of ["claude", "codex"]) {
    await writeFile(join(bin, name), shim);
    await chmod(join(bin, name), 0o755);
  }
  const log = join(dir, "call.json");
  const env = {
    ...process.env, HOME: join(dir, "home"), ZDOTDIR: join(dir, "home"), USER: "les-test", LOGNAME: "les-test",
    LES_HOME: join(dir, "store"), LES_UPDATE_CHECK: "0", LES_DISABLE_PATH_SETUP: "1", PATH: bin + ":/usr/bin:/bin",
    FAKE_HOST_LOG: log, LES_EVAL_ENV: "FAKE_HOST_LOG,FAKE_HOST_MODE",
    ANTHROPIC_API_KEY: "canary-key", ANTHROPIC_BASE_URL: "http://canary.invalid"
  };
  const installed = spawnSync(process.execPath, [resolve(root, "bin/les.mjs")], { cwd: dir, encoding: "utf8", env });
  assert.equal(installed.status, 0, installed.stderr);
  return { dir, env, log, report: join(dir, "report.json") };
}

function smoke(env, provider, ...flags) {
  return spawnSync(process.execPath, [harness, "--host-smoke", "--provider", provider, "--model", provider === "claude" ? haiku : "gpt-5.6-luna", "--reasoning-effort", "medium", ...flags], { cwd: root, encoding: "utf8", env });
}

test("a verified delivery cannot pass by delegating diff review to the user", { skip: windows }, async (t) => {
  const { env, report } = await fakeHost(t);
  const result = spawnSync(process.execPath, [harness, "--model", "gpt-5.6-luna", "--case", "delivery-reviewed-handoff", "--report", report], {
    cwd: root, encoding: "utf8", env: { ...env, FAKE_HOST_MODE: "unnecessary-review" }
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const saved = JSON.parse(await readFile(report, "utf8"));
  assert.equal(saved.cases[0].pass, false);
  assert.ok(saved.cases[0].errors.some((error) => error.includes("nextSafeAction")));
});

for (const provider of ["claude", "codex"]) {
  test(`${provider} host smoke stages the pointer, filters the environment, and reports the store`, { skip: windows }, async (t) => {
    const { env, log, report } = await fakeHost(t);
    const result = smoke(env, provider, "--case", "host-permission-stop", "--report", report);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const call = JSON.parse(await readFile(log, "utf8"));
    assert.ok(call.files.includes(provider === "claude" ? "CLAUDE.md" : "AGENTS.md"));
    assert.ok(call.files.includes("LES-AGENT.md"));
    assert.match(call.pointer, /@\.\/LES-AGENT\.md/u);
    assert.ok(call.entrypoint.includes(env.LES_HOME));
    assert.ok(!call.entrypoint.includes("~/.les-agents"));
    assert.deepEqual(Object.keys(call.env).filter((name) => /^(ANTHROPIC|OPENAI|CLAUDE)/u.test(name)), []);
    assert.equal(call.env.LES_HOME, env.LES_HOME);
    assert.equal(call.env.FAKE_HOST_LOG, log);
    if (provider === "claude") {
      for (const flag of ["--tools", "--allowedTools"]) assert.equal(call.args[call.args.indexOf(flag) + 1], "Read,Glob,Grep");
      assert.equal(call.args[call.args.indexOf("--model") + 1], haiku);
      assert.match(call.diff, /candidate\.txt/u);
    } else {
      assert.equal(call.diff, null);
      assert.equal(call.args[call.args.indexOf("--sandbox") + 1], "read-only");
    }
    const saved = JSON.parse(await readFile(report, "utf8"));
    assert.equal(saved.provider, provider === "claude" ? "claude-code" : "codex");
    assert.equal(saved.hostVersion, "fake-host 1.2.3");
    assert.deepEqual(saved.summary, { passed: 1, total: 1 });
    assert.equal(saved.store.packageVersion, packageVersion);
    assert.equal(saved.store.matchesPackage, true);
  });
}

test("a missing host binary or a host error is reported per case and the report is still written", { skip: windows }, async (t) => {
  const { dir, env, report } = await fakeHost(t);
  await mkdir(join(dir, "empty"));
  const missing = smoke({ ...env, PATH: join(dir, "empty") }, "claude", "--case", "host-bootstrap", "--report", report);
  assert.equal(missing.status, 1);
  const missingReport = JSON.parse(await readFile(report, "utf8"));
  assert.equal(missingReport.hostVersion, "unavailable");
  assert.match(missingReport.cases[0].errors[0], /ENOENT/u);
  const budget = smoke({ ...env, FAKE_HOST_MODE: "budget" }, "claude", "--case", "host-bootstrap", "--report", report);
  assert.equal(budget.status, 1);
  assert.match(JSON.parse(await readFile(report, "utf8")).cases[0].errors[0], /error_max_budget_usd.*Exceeded USD budget/u);
});

test("Claude runs are locked to the cheapest model before any host call", () => {
  // No reachable host or store: if the lock regressed, the run would fail with exit 1 instead of calling a paid model.
  const run = (...flags) => spawnSync(process.execPath, [harness, "--provider", "claude", ...flags], { cwd: root, encoding: "utf8", env: { ...process.env, PATH: "/nonexistent", LES_HOME: "/nonexistent/les" } });
  const refused = run("--host-smoke", "--model", "claude-opus-5-5");
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /claude-haiku-4-5-20251001/);
  assert.equal(run("--host-smoke", "--dry-run").status, 0);
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
