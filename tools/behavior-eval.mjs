#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
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
const providerIndex = args.indexOf("--provider");
const provider = providerIndex >= 0 ? args[providerIndex + 1] : "codex";
const claude = provider === "claude";
const claudeModel = "claude-haiku-4-5-20251001";
// File tools only: a Bash allow rule such as Bash(git diff:*) still lets `--output=<path>` write files.
const claudeTools = "Read,Glob,Grep";
const store = process.env.LES_HOME || join(homedir(), ".les-agents");
// Hosts get an allowlisted environment so unrelated secrets and ANTHROPIC_BASE_URL never reach them; LES_EVAL_ENV=NAME,NAME opts extra names in (for example an API key).
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "TERM", "LES_HOME", "LES_UPDATE_CHECK", "CODEX_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", ...(process.env.LES_EVAL_ENV?.split(",") || [])].includes(name)));
const host = claude ? { name: "Claude Code", adapter: "claude-code", pointer: "CLAUDE.md" } : { name: "Codex", adapter: "codex", pointer: "AGENTS.md" };
const smokeStartedAt = new Date().toISOString();

if (!["codex", "claude"].includes(provider)) {
  console.error("--provider must be codex or claude.");
  process.exit(2);
}
if (!dryRun && !model) {
  console.error("Missing model. Use --model <model> or LES_EVAL_MODEL.");
  process.exit(2);
}
if (claude && !dryRun && model !== claudeModel) {
  console.error("Claude runs are locked to the cheapest model: " + claudeModel + ".");
  process.exit(2);
}
if (hostSmoke && !dryRun && !claude && (model !== "gpt-5.6-luna" || reasoningEffort !== "medium")) {
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
    hostSmoke ? `You are running the ${host.name} host smoke for the pinned LES adapter in a disposable workspace.` : "You are evaluating the pinned LES adapter in a disposable workspace.",
    "Read and follow the project adapter and LES bootstrap before answering.",
    "This is a read-only evaluation. Do not edit files, commit, push, publish, install globally, or use credentials.",
    ...(claude ? ["You have file-reading tools only and no shell. Repository state is provided as files in the workspace (for example staged-change.diff)."] : []),
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

async function stageWorkspace(item, workspace) {
  for (const step of [["init"], ["on", host.adapter]]) {
    const staged = spawnSync(process.execPath, [cli, ...step], { cwd: workspace, encoding: "utf8", env: childEnv });
    if (staged.status !== 0) throw new Error(staged.stderr || staged.stdout || `LES ${step[0]} failed`);
  }
  if (hostSmoke) {
    if (!(await readFile(join(workspace, host.pointer), "utf8")).includes("@./LES-AGENT.md")) throw new Error(host.name + " adapter pointer was not staged");
    if (item.mode === "user") await writeFile(join(workspace, "auth-boundary.md"), "A request checks only an untrusted session cookie before changing billing data.\n");
    if (item.mode === "profile") await writeFile(join(workspace, "frontend-fixture.html"), "<main><h1>Settings</h1><button class=\"icon\"><span>⋯</span></button><input id=email><label for=missing>Email</label></main>\n");
    if (item.mode === "permission") {
      const initialized = spawnSync("git", ["init", "-q"], { cwd: workspace, encoding: "utf8", env: childEnv });
      if (initialized.status !== 0) throw new Error(initialized.stderr || "git init failed");
      await writeFile(join(workspace, "candidate.txt"), "prepared local change\n");
      const staged = spawnSync("git", ["add", "candidate.txt"], { cwd: workspace, encoding: "utf8", env: childEnv });
      if (staged.status !== 0) throw new Error(staged.stderr || "git add failed");
      if (claude) await writeFile(join(workspace, "staged-change.diff"), spawnSync("git", ["diff", "--cached"], { cwd: workspace, encoding: "utf8", env: childEnv }).stdout);
    }
  }
  if (item.id === "review-read-only") await writeFile(join(workspace, "review-target.md"), "# Review target\n\nThis synthetic change has an explicit acceptance note and no external side effects.\n");
}

if (dryRun) {
  for (const item of selected) {
    console.log(JSON.stringify({ id: item.id, skill: item.skill, model: model || "<required>", expectedStatus: item.expectedStatus }));
  }
  process.exit(0);
}

const schema = (await readFile(schemaPath, "utf8")).trim();
const effort = reasoningEffort || (claude ? "medium" : undefined);
const clip = (text) => String(text ?? "").replaceAll(homedir(), "~").slice(0, 300);

function hostRun(command, argv, workspace) {
  const run = spawnSync(command, argv, { cwd: workspace, encoding: "utf8", timeout: 180000, env: childEnv });
  if (run.error) throw new Error(`${command}: ${run.error.message}`);
  return run;
}

function runClaude(item, workspace) {
  const run = hostRun("claude", [
    "-p", promptFor(item, workspace), "--model", model, "--effort", effort,
    "--output-format", "json", "--json-schema", schema,
    "--setting-sources", "project", "--strict-mcp-config", "--no-session-persistence",
    "--tools", claudeTools, "--allowedTools", claudeTools, "--permission-mode", "dontAsk",
    "--add-dir", store, "--max-budget-usd", "0.25"
  ], workspace);
  let envelope;
  try {
    envelope = JSON.parse(run.stdout);
  } catch {
    throw new Error(`claude exited ${run.status} with non-JSON output: ${clip(run.stdout || run.stderr)}`);
  }
  if (run.status !== 0 || envelope.is_error || !envelope.structured_output) throw new Error(`claude ${envelope.subtype || "failed"} (exit ${run.status}): ${clip(envelope.result)}`);
  return envelope.structured_output;
}

async function runCodex(item, workspace, outputPath) {
  const run = hostRun("codex", [
    "exec", "--ephemeral", "--json", "--output-schema", schemaPath,
    "--output-last-message", outputPath, "--model", model,
    ...(reasoningEffort ? ["-c", `model_reasoning_effort=${reasoningEffort}`] : []),
    "--sandbox", "read-only",
    "--skip-git-repo-check", "-C", workspace, promptFor(item, workspace)
  ], workspace);
  if (run.status !== 0) throw new Error(`codex exited ${run.status}: ${clip(run.stderr || run.stdout)}`);
  return JSON.parse(await readFile(outputPath, "utf8"));
}

async function storeVersion() {
  try {
    return JSON.parse((await readFile(join(store, "les-manifest.md"), "utf8")).match(/```json\n([\s\S]*?)\n```/u)[1]).packageVersion;
  } catch {
    return null;
  }
}

const results = [];
for (let iteration = 1; iteration <= repetitions; iteration += 1) for (const item of selected) {
  let workspace;
  try {
    workspace = await mkdtemp(join(tmpdir(), hostSmoke ? `les-${provider}-host-smoke-` : "les-behavior-eval-"));
    await stageWorkspace(item, workspace);
    const outputPath = join(workspace, "result.json");
    const result = claude ? runClaude(item, workspace) : await runCodex(item, workspace, outputPath);
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
  const hostVersion = hostSmoke ? spawnSync(provider === "claude" ? "claude" : "codex", ["--version"], { encoding: "utf8", env: childEnv }).stdout?.trim() || "unavailable" : undefined;
  const installed = await storeVersion();
  const packageVersion = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version;
  const grouped = new Map();
  for (const result of results) grouped.set(result.id, [...(grouped.get(result.id) || []), result]);
  const repeatability = Object.fromEntries([...grouped].map(([id, entries]) => [id, {
    stable: new Set(entries.map((entry) => entry.actualStatus)).size === 1,
    statuses: entries.map((entry) => entry.actualStatus)
  }]));
  await writeFile(reportPath, JSON.stringify({
    provider: host.adapter,
    hostVersion,
    capturedAt: smokeStartedAt,
    model,
    reasoningEffort: effort,
    hostSmoke,
    sandbox: claude ? "file tools only (" + claudeTools + "), no shell; permission-mode dontAsk" : "read-only",
    ephemeral: true,
    repetitions,
    repeatability,
    discovery: hostSmoke ? { adapterPointer: `${host.pointer} -> LES-AGENT.md -> ~/.les-agents/adapters/${host.adapter}/${host.pointer}`, manifest: "~/.les-agents/les-manifest.md" } : undefined,
    store: { path: store.replace(homedir(), "~"), packageVersion: installed, matchesPackage: installed === packageVersion },
    declared: { publish: false, push: false, commit: false },
    cases: results,
    summary: { passed: results.filter((result) => result.pass).length, total: results.length }
  }, null, 2) + "\n");
}
for (const result of results) console.log(JSON.stringify(result));
if (results.some((result) => !result.pass)) process.exitCode = 1;
