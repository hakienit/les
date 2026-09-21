#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const casesPath = join(root, "tools", "behavior-eval", "cases.json");
const hostCasesPath = join(root, "tools", "behavior-eval", "host-scenarios.json");
const schemaPath = join(root, "tools", "behavior-eval", "schema.json");
const cli = join(root, "bin", "les.mjs");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const hostSmoke = args.includes("--host-smoke");
const modelIndex = args.indexOf("--model");
const model = modelIndex >= 0 ? args[modelIndex + 1] : process.env.LES_EVAL_MODEL;
const effortIndex = args.indexOf("--reasoning-effort");
const reasoningEffort = effortIndex >= 0 ? args[effortIndex + 1] : process.env.LES_EVAL_REASONING_EFFORT;
const caseIndex = args.indexOf("--case");
const selectedCase = caseIndex >= 0 ? args[caseIndex + 1] : undefined;
const reportIndex = args.indexOf("--report");
const reportPath = reportIndex >= 0 ? resolve(args[reportIndex + 1]) : undefined;
const repeatIndex = args.indexOf("--repeat");
const repetitions = repeatIndex >= 0 ? Number(args[repeatIndex + 1]) : 1;
const smokeStartedAt = new Date().toISOString();

if (!dryRun && !model) {
  console.error("Missing model. Use --model <codex-model> or LES_EVAL_MODEL.");
  process.exit(2);
}
if (hostSmoke && !dryRun && (model !== "gpt-5.6-luna" || reasoningEffort !== "medium")) {
  console.error("Codex host smoke is locked to gpt-5.6-luna with reasoning effort medium.");
  process.exit(2);
}
if (!Number.isInteger(repetitions) || repetitions < 1) {
  console.error("--repeat must be a positive integer.");
  process.exit(2);
}

const cases = JSON.parse(await readFile(hostSmoke ? hostCasesPath : casesPath, "utf8"));
const selectedIds = selectedCase?.split(",").filter(Boolean);
const selected = selectedIds ? cases.filter((item) => selectedIds.includes(item.id)) : cases;
if (!selected.length) {
  console.error("Unknown behavior case: " + selectedCase);
  process.exit(2);
}

function promptFor(item, workspace) {
  return [
    hostSmoke ? "You are running the Codex host smoke for the pinned LES adapter in a disposable workspace." : "You are evaluating the pinned LES adapter in a disposable workspace.",
    "Read and follow the project adapter and LES bootstrap before answering.",
    "This is a read-only evaluation. Do not edit files, commit, push, publish, install globally, or use credentials.",
    "Return only JSON matching the supplied output schema.",
    "Skill under evaluation: " + item.skill,
    "Required check names or concepts: " + item.requiredChecks.join(", "),
    "User scenario: " + item.prompt,
    "Workspace: " + workspace
  ].join("\n\n");
}

function textOf(value) {
  return JSON.stringify(value).toLowerCase();
}

function validate(item, result) {
  const errors = [];
  if (result.status !== item.expectedStatus) errors.push(`status ${result.status} !== ${item.expectedStatus}`);
  const output = textOf(result);
  const compactOutput = output.replace(/[^a-z0-9]/g, "");
  for (const check of item.requiredChecks) {
    const normalized = check.toLowerCase();
    const compactCheck = normalized.replace(/[^a-z0-9]/g, "");
    if (!output.includes(normalized) && !compactOutput.includes(compactCheck)) errors.push(`missing evidence: ${check}`);
  }
  if (!result.nextSafeAction?.trim()) errors.push("missing nextSafeAction");
  return errors;
}

async function createWorkspace(item) {
  const workspace = await mkdtemp(join(tmpdir(), hostSmoke ? "les-codex-host-smoke-" : "les-behavior-eval-"));
  const added = spawnSync(process.execPath, [cli, "add", "--scope", "repo"], { cwd: workspace, encoding: "utf8" });
  if (added.status !== 0) throw new Error(added.stderr || added.stdout || "LES add failed");
  const adapter = spawnSync(process.execPath, [cli, "adapter", "codex", "--scope", "repo"], { cwd: workspace, encoding: "utf8" });
  if (adapter.status !== 0) throw new Error(adapter.stderr || adapter.stdout || "LES Codex adapter failed");
  if (hostSmoke) {
    if (!(await readFile(join(workspace, "AGENTS.md"), "utf8")).includes("adapters/codex/AGENTS.md")) throw new Error("Codex adapter pointer was not staged");
    if (item.mode === "user") await writeFile(join(workspace, "auth-boundary.md"), "A request checks only an untrusted session cookie before changing billing data.\n");
    if (item.mode === "profile") await writeFile(join(workspace, "frontend-fixture.html"), "<main><h1>Settings</h1><button class=\"icon\"><span>⋯</span></button><input id=email><label for=missing>Email</label></main>\n");
    if (item.mode === "permission") {
      const initialized = spawnSync("git", ["init", "-q"], { cwd: workspace, encoding: "utf8" });
      if (initialized.status !== 0) throw new Error(initialized.stderr || "git init failed");
      await writeFile(join(workspace, "candidate.txt"), "prepared local change\n");
      const staged = spawnSync("git", ["add", "candidate.txt"], { cwd: workspace, encoding: "utf8" });
      if (staged.status !== 0) throw new Error(staged.stderr || "git add failed");
    }
  }
  if (item.id === "review-read-only") await writeFile(join(workspace, "review-target.md"), "# Review target\n\nThis synthetic change has an explicit acceptance note and no external side effects.\n");
  return workspace;
}

if (dryRun) {
  for (const item of selected) {
    console.log(JSON.stringify({ id: item.id, skill: item.skill, model: model || "<required>", expectedStatus: item.expectedStatus }));
  }
  process.exit(0);
}

const results = [];
for (let iteration = 1; iteration <= repetitions; iteration += 1) for (const item of selected) {
  let workspace;
  try {
    workspace = await createWorkspace(item);
    const outputPath = join(workspace, "result.json");
    const run = spawnSync("codex", [
      "exec", "--ephemeral", "--json", "--output-schema", schemaPath,
      "--output-last-message", outputPath, "--model", model,
      ...(reasoningEffort ? ["-c", `model_reasoning_effort=${reasoningEffort}`] : []),
      "--sandbox", "read-only",
      "--skip-git-repo-check", "-C", workspace, promptFor(item, workspace)
    ], { cwd: workspace, encoding: "utf8", timeout: 180000 });
    if (run.status !== 0) throw new Error(run.stderr || run.stdout || `codex exited ${run.status}`);
    const result = JSON.parse(await readFile(outputPath, "utf8"));
    const errors = validate(item, result);
    results.push({ iteration, id: item.id, mode: item.mode, skill: item.skill, expectedStatus: item.expectedStatus, actualStatus: result.status, pass: errors.length === 0, errors });
  } catch (error) {
    results.push({ id: item.id, skill: item.skill, pass: false, errors: [error.message] });
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}

if (reportPath) {
  await mkdir(dirname(reportPath), { recursive: true });
  const hostVersion = hostSmoke ? spawnSync("codex", ["--version"], { encoding: "utf8" }).stdout.trim() : undefined;
  const grouped = new Map();
  for (const result of results) grouped.set(result.id, [...(grouped.get(result.id) || []), result]);
  const repeatability = Object.fromEntries([...grouped].map(([id, entries]) => [id, {
    stable: new Set(entries.map((entry) => entry.actualStatus)).size === 1,
    statuses: entries.map((entry) => entry.actualStatus)
  }]));
  await writeFile(reportPath, JSON.stringify({
    provider: "codex",
    hostVersion,
    capturedAt: smokeStartedAt,
    model,
    reasoningEffort,
    hostSmoke,
    sandbox: "read-only",
    ephemeral: true,
    repetitions,
    repeatability,
    discovery: hostSmoke ? { adapterPointer: "AGENTS.md -> .ai/les/adapters/codex/AGENTS.md", manifest: ".ai/les/les-manifest.json" } : undefined,
    globalInstall: false,
    publish: false,
    push: false,
    commit: false,
    cases: results,
    summary: { passed: results.filter((result) => result.pass).length, total: results.length }
  }, null, 2) + "\n");
}
for (const result of results) console.log(JSON.stringify(result));
if (results.some((result) => !result.pass)) process.exitCode = 1;
