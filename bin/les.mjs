#!/usr/bin/env node
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageMetadata = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const manifestFilename = "les-manifest.md";
const agentFilename = "LES-AGENT.md";
const legacyManagedFiles = new Set(["les-manifest.json", "les-manifest.yaml", "activate.sh"]);
const packageFiles = [...new Set([...(packageMetadata.files || []), "package.json"])].filter((path) => path !== "package-lock.json");

function userRoot() {
  return process.env.LES_HOME || join(homedir(), ".les-agents");
}

function isAgentPayloadFile(path) {
  return path.endsWith(".md") && (
    path.startsWith("policies/") ||
    (path.startsWith("skills/") && path.endsWith("/SKILL.md")) ||
    (path.startsWith("profiles/") && (path.includes("/rules/") || path.includes("/references/"))) ||
    (path.startsWith("adapters/") && path !== "adapters/README.md")
  );
}

function usage() {
  console.log(`LES user-local CLI

Usage:
  les                         install or update ~/.les-agents
  les init                    create LES-AGENT.md in the current repo
  les active <provider>       enable a provider pointer in this repo
  les on [provider]           enable one or all configured providers
  les off [provider]          disable one or all providers
  les doctor                  show install, routing, and update status
  les add --scope repo        legacy: copy Markdown payload into a repo
  les update --scope repo     legacy: update a repo-local payload
  les diff --scope repo       legacy: show repo-local payload differences
  les rollback --backup PATH  legacy: restore a prior repo update backup

Providers: codex, claude-code, gemini-cli, antigravity
Options: --root PATH, --scope repo|user|global, --dry-run

Install from npm:
  npx -y @hakienit/les
  export PATH="$HOME/.les-agents/bin:$PATH"`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { scope: "repo", root: ".les-agents", dryRun: false, backup: undefined };
  let provider;
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (["adapter", "active", "on", "off"].includes(command) && !provider && !value.startsWith("-")) {
      provider = value;
      continue;
    }
    if (value === "--scope") {
      options.scope = rest[++index];
    } else if (value.startsWith("--scope=")) {
      options.scope = value.slice("--scope=".length);
    } else if (value === "--root") {
      options.root = rest[++index];
    } else if (value.startsWith("--root=")) {
      options.root = value.slice("--root=".length);
    } else if (value === "--dry-run") {
      options.dryRun = true;
    } else if (value === "--backup") {
      options.backup = rest[++index];
    } else if (value === "--version") {
      console.log(packageMetadata.version);
      process.exit(0);
    } else if (value === "--help" || value === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error("Unknown option: " + value);
    }
  }
  if (!["install", "add", "init", "update", "rollback", "doctor", "diff", "adapter", "active", "on", "off"].includes(command)) {
    usage();
    throw new Error("Choose install, init, active, on, off, doctor, or a legacy add/update command.");
  }
  if (!["repo", "user", "global"].includes(options.scope)) throw new Error("--scope must be repo, user, or global.");
  if (["init", "active", "on", "off"].includes(command) && options.scope !== "repo") {
    throw new Error(command + " is repo-local; omit --scope or use --scope repo.");
  }
  if (["adapter", "active"].includes(command) && !provider) {
    throw new Error(command + " requires codex, claude-code, gemini-cli, or antigravity.");
  }
  return { command, options, provider };
}

function targetFor(scope, root = ".les-agents") {
  if (scope === "user") return userRoot();
  if (scope === "global") return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "les");
  if (!root || root.startsWith("/") || root.split(/[\\/]/).includes("..")) {
    throw new Error("--root must be a relative repo path without ..");
  }
  return resolve(process.cwd(), root);
}

function providerEntryFor(provider, scope) {
  const root = scope === "repo" ? process.cwd() : undefined;
  const home = process.env.HOME || homedir();
  const entries = {
    codex: ["AGENTS.md", join(process.env.CODEX_HOME || join(home, ".codex"), "AGENTS.md")],
    "claude-code": ["CLAUDE.md", join(home, ".claude", "CLAUDE.md")],
    "gemini-cli": ["GEMINI.md", join(home, ".gemini", "GEMINI.md")],
    antigravity: [join(".agents", "agents", "les", "agent.md"), join(home, ".gemini", "config", "agents", "les", "agent.md")]
  };
  if (!entries[provider]) throw new Error("Unknown provider: " + provider);
  return scope === "repo" ? join(root, entries[provider][0]) : entries[provider][1];
}

function adapterFilename(provider) {
  return provider === "codex" ? "AGENTS.md" : provider === "claude-code" ? "CLAUDE.md" : provider === "gemini-cli" ? "GEMINI.md" : "agent.md";
}

function adapterSourceFor(root, provider) {
  return join(root, "adapters", provider, adapterFilename(provider));
}

function adapterPointer(provider, source) {
  if (provider === "antigravity") {
    return "---\nname: les\ndescription: Route work through the user-local Living Engineering System.\n---\n\n@" + source + "\n";
  }
  return "# LES\n\n@" + source + "\n";
}

function localAgentPath() {
  return join(process.cwd(), agentFilename);
}

function localPointerSource(entry) {
  const path = relative(dirname(entry), localAgentPath()).split(sep).join("/");
  return path.startsWith(".") ? path : "./" + path;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function filesBelow(root, prefix = "") {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...await filesBelow(join(root, entry.name), relativePath));
    else files.push(relativePath);
  }
  return files;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function sourceFiles(root = packageRoot) {
  const files = new Map();
  for (const directory of ["policies", "skills", "profiles", "adapters"]) {
    const sourcePath = join(root, directory);
    if (!await exists(sourcePath)) continue;
    for (const relativePath of await filesBelow(sourcePath)) {
      const path = join(directory, relativePath).split(sep).join("/");
      if (isAgentPayloadFile(path)) files.set(path, join(sourcePath, relativePath));
    }
  }
  return files;
}

async function copyPayload(stage, root = packageRoot) {
  for (const [destination, sourcePath] of await sourceFiles(root)) {
    const target = join(stage, destination);
    await mkdir(dirname(target), { recursive: true });
    await cp(sourcePath, target);
  }
}

async function copyDistribution(stage, root = packageRoot) {
  for (const path of packageFiles) {
    const source = join(root, path);
    if (await exists(source)) await cp(source, join(stage, path), { recursive: true });
  }
  const launcher = join(stage, "bin", "les");
  await mkdir(dirname(launcher), { recursive: true });
  await writeFile(launcher, "#!/bin/sh\nexec node \"$(dirname \"$0\")/les.mjs\" \"$@\"\n", { mode: 0o755 });
}

function manifestSource(manifest) {
  return "# LES manifest\n\n```json\n" + JSON.stringify(manifest, null, 2) + "\n```\n";
}

function parseManifest(source) {
  const json = source.match(/```json\n([\s\S]*?)\n```/u)?.[1] || source;
  return JSON.parse(json);
}

async function writeManifest(target, manifest) {
  await writeFile(join(target, manifestFilename), manifestSource(manifest));
}

async function createManifest(stage, scope, adapters = [], configuredAdapters = adapters, metadata = packageMetadata) {
  const managed = [];
  for (const relativePath of await filesBelow(stage)) {
    managed.push({ path: relativePath, sha256: await sha256(join(stage, relativePath)) });
  }
  const manifest = {
    manifestVersion: 1,
    packageName: metadata.name,
    packageVersion: metadata.version,
    scope,
    installedAt: new Date().toISOString(),
    managed,
    adapters,
    configuredAdapters: [...configuredAdapters]
  };
  await writeManifest(stage, manifest);
  return manifest;
}

async function readManifest(target) {
  const currentPath = join(target, manifestFilename);
  const legacyPath = join(target, "les-manifest.json");
  const manifestPath = await exists(currentPath) ? currentPath : legacyPath;
  if (!await exists(manifestPath)) throw new Error("No LES manifest at " + target + ". Run the LES installer first.");
  const manifest = parseManifest(await readFile(manifestPath, "utf8"));
  if (manifest.packageName !== packageMetadata.name || !Array.isArray(manifest.managed)) {
    throw new Error("The existing manifest is not a compatible LES installation.");
  }
  return manifest;
}

async function unmanagedFiles(target, manifest) {
  const known = new Set(manifest.managed.map((entry) => entry.path));
  known.add(manifestFilename);
  for (const path of legacyManagedFiles) known.add(path);
  return (await filesBelow(target)).filter((path) => !known.has(path));
}

async function changesFor(target) {
  const manifest = await readManifest(target);
  const source = await sourceFiles();
  const installed = new Set((await filesBelow(target)).filter((path) => path !== manifestFilename && !legacyManagedFiles.has(path)));
  const changes = [];
  for (const [relativePath, sourcePath] of source) {
    const installedPath = join(target, relativePath);
    if (!installed.has(relativePath)) changes.push("missing " + relativePath);
    else if (await sha256(sourcePath) !== await sha256(installedPath)) changes.push("changed " + relativePath);
    installed.delete(relativePath);
  }
  for (const relativePath of installed) changes.push("removed " + relativePath);
  for (const relativePath of await unmanagedFiles(target, manifest)) changes.push("unmanaged " + relativePath);
  return changes.sort();
}

async function buildStage(target, scope, adapters, configuredAdapters, sourceRoot = packageRoot, metadata = packageMetadata) {
  await mkdir(dirname(target), { recursive: true });
  const stage = await mkdtemp(join(dirname(target), "." + basename(target) + ".staging-"));
  await copyPayload(stage, sourceRoot);
  await createManifest(stage, scope, adapters, configuredAdapters, metadata);
  return stage;
}

async function installRepo(target, scope, replace, adapters = [], configuredAdapters = adapters) {
  const stage = await buildStage(target, scope, adapters, configuredAdapters);
  let backup;
  let backupStage;
  let displaced;
  try {
    if (replace) {
      backup = join(dirname(target), "." + basename(target) + ".backup-" + Date.now());
      const previousManifest = await readManifest(target);
      backupStage = await buildStage(backup, scope, previousManifest.adapters || [], previousManifest.configuredAdapters || previousManifest.adapters || [], target, {
        name: previousManifest.packageName,
        version: previousManifest.packageVersion
      });
      await rename(backupStage, backup);
      backupStage = undefined;
      displaced = join(dirname(target), "." + basename(target) + ".displaced-" + Date.now());
      await rename(target, displaced);
    }
    await rename(stage, target);
    if (displaced) await rm(displaced, { recursive: true, force: true });
    return backup;
  } catch (error) {
    if (displaced && !await exists(target) && await exists(displaced)) await rename(displaced, target);
    throw error;
  } finally {
    if (await exists(stage)) await rm(stage, { recursive: true, force: true });
    if (backupStage && await exists(backupStage)) await rm(backupStage, { recursive: true, force: true });
  }
}

async function installUser(target, replace) {
  await mkdir(dirname(target), { recursive: true });
  if (await exists(target) && !replace) throw new Error("Collision at " + target + ". Run the installer again to update LES.");
  if (await exists(target) && (await filesBelow(target)).length) await readManifest(target);
  const stage = await mkdtemp(join(dirname(target), "." + basename(target) + ".staging-"));
  await copyDistribution(stage);
  await createManifest(stage, "user");
  let displaced;
  try {
    if (await exists(target)) {
      displaced = join(dirname(target), "." + basename(target) + ".displaced-" + Date.now());
      await rename(target, displaced);
    }
    await rename(stage, target);
    if (displaced) await rm(displaced, { recursive: true, force: true });
  } catch (error) {
    if (displaced && !await exists(target) && await exists(displaced)) await rename(displaced, target);
    throw error;
  } finally {
    if (await exists(stage)) await rm(stage, { recursive: true, force: true });
  }
}

function printPlan(action, target, changes = []) {
  console.log(action.toUpperCase() + " " + target);
  for (const change of changes) console.log("  " + change);
}

function repoIgnoreEntry(target) {
  const path = relative(process.cwd(), target).split(sep).join("/").replace(/\/+$/u, "");
  return path ? path + "/" : undefined;
}

async function needsRepoIgnore(target) {
  const entry = repoIgnoreEntry(target);
  if (!entry) return false;
  const path = join(process.cwd(), ".gitignore");
  const current = await exists(path) ? await readFile(path, "utf8") : "";
  return !current.split(/\r?\n/u).some((line) => [entry, entry.slice(0, -1)].includes(line.trim()));
}

async function ensureRepoIgnore(target) {
  const entry = repoIgnoreEntry(target);
  if (!entry || !await needsRepoIgnore(target)) return false;
  const path = join(process.cwd(), ".gitignore");
  const current = await exists(path) ? await readFile(path, "utf8") : "";
  const prefix = current && !current.endsWith("\n") ? current + "\n" : current;
  await writeFile(path, prefix + entry + "\n");
  return true;
}

async function add(target, options) {
  if (options.scope === "user") {
    printPlan("install", target, ["copy the LES CLI and source into the user-local store"]);
    if (!options.dryRun) {
      await installUser(target, true);
      console.log("Installed " + packageMetadata.name + "@" + packageMetadata.version + " in " + target + ".");
    }
    return;
  }
  if (await exists(target)) throw new Error("Collision at " + target + ". Use les update only for an existing LES installation.");
  const changes = ["write Markdown-only LES files pinned to " + packageMetadata.version];
  if (options.scope === "repo" && await needsRepoIgnore(target)) changes.push("add " + repoIgnoreEntry(target) + " to .gitignore");
  printPlan("add", target, changes);
  if (options.dryRun) return;
  if (options.scope === "repo") await ensureRepoIgnore(target);
  await installRepo(target, options.scope, false);
  console.log("Installed " + packageMetadata.name + "@" + packageMetadata.version + ".");
}

function initialState() {
  return { configuredProviders: [], activeProviders: [] };
}

function agentDocument(state) {
  const providers = [
    "codex: ~/.les-agents/adapters/codex/AGENTS.md",
    "claude-code: ~/.les-agents/adapters/claude-code/CLAUDE.md",
    "gemini-cli: ~/.les-agents/adapters/gemini-cli/GEMINI.md",
    "antigravity: ~/.les-agents/adapters/antigravity/agent.md"
  ];
  return "# LES\n\n" +
    "This repository uses the user-local LES installation at `~/.les-agents`.\n" +
    "Use that installation as the only LES source for this repository.\n\n" +
    "Read the adapter matching the current AI CLI:\n" +
    providers.map((provider) => "- " + provider).join("\n") + "\n\n" +
    "Then read `~/.les-agents/skills/bootstrap/SKILL.md` before starting work.\n\n" +
    "<!-- LES-MANAGED\n" + JSON.stringify(state, null, 2) + "\n-->\n";
}

function parseAgentState(source) {
  const body = source.match(/<!-- LES-MANAGED\n([\s\S]*?)\n-->/u)?.[1];
  if (!body) throw new Error("Collision at " + localAgentPath() + ". Existing LES-AGENT.md is not LES-managed.");
  const state = JSON.parse(body);
  if (!Array.isArray(state.configuredProviders) || !Array.isArray(state.activeProviders)) throw new Error("LES-AGENT.md has invalid LES state.");
  return state;
}

async function readAgentState() {
  const path = localAgentPath();
  if (!await exists(path)) throw new Error("No " + agentFilename + " in this repo. Run les init first.");
  return parseAgentState(await readFile(path, "utf8"));
}

async function writeAgentState(state) {
  await writeFile(localAgentPath(), agentDocument(state));
}

async function requireUserStore() {
  const root = userRoot();
  await readManifest(root);
  return root;
}

async function init(options) {
  await requireUserStore();
  const path = localAgentPath();
  const state = await exists(path) ? parseAgentState(await readFile(path, "utf8")) : initialState();
  printPlan("init", path, ["point the repository to ~/.les-agents", "store provider routing in LES-AGENT.md"]);
  if (options.dryRun) return;
  if (!await exists(path)) await writeAgentState(state);
  console.log("Initialized LES for this repository.");
  console.log("Next: les active <provider>");
}

async function update(target, options) {
  if (options.scope === "user") {
    await requireUserStore();
    printPlan("update", target, ["refresh the user-local LES CLI and source"]);
    if (!options.dryRun) {
      await installUser(target, true);
      console.log("Updated LES to " + packageMetadata.version + ".");
    }
    return;
  }
  const manifest = await readManifest(target);
  const unmanaged = await unmanagedFiles(target, manifest);
  if (unmanaged.length) throw new Error("Collision: unmanaged files exist in the LES root: " + unmanaged.join(", "));
  const changes = await changesFor(target);
  const ignoreNeeded = options.scope === "repo" && await needsRepoIgnore(target);
  if (!changes.length && manifest.packageVersion === packageMetadata.version && !ignoreNeeded) {
    console.log("Already pinned to " + packageMetadata.version + ".");
    return;
  }
  const plan = changes.length ? changes : ["refresh manifest to " + packageMetadata.version];
  if (ignoreNeeded) plan.push("add " + repoIgnoreEntry(target) + " to .gitignore");
  printPlan("update", target, plan);
  if (options.dryRun) return;
  if (ignoreNeeded) await ensureRepoIgnore(target);
  // ponytail: no cross-process lock; add one only if concurrent installs become supported.
  const backup = await installRepo(target, options.scope, true, manifest.adapters || [], manifest.configuredAdapters || manifest.adapters || []);
  console.log("Updated to " + packageMetadata.version + ". Backup: " + backup);
}

async function rollback(target, options) {
  if (!options.backup) throw new Error("Rollback requires --backup <path> from a prior update.");
  const backup = resolve(options.backup);
  const targetParent = resolve(dirname(target));
  if (dirname(backup) !== targetParent || !basename(backup).startsWith("." + basename(target) + ".backup-")) {
    throw new Error("Backup must be a sibling created by les update.");
  }
  await readManifest(target);
  await readManifest(backup);
  printPlan("rollback", target, ["restore " + backup]);
  if (options.dryRun) return;
  const displaced = join(targetParent, "." + basename(target) + ".rollback-" + Date.now());
  await rename(target, displaced);
  try {
    await rename(backup, target);
  } catch (error) {
    await rename(displaced, target);
    throw error;
  }
  console.log("Rolled back. Displaced installation: " + displaced);
}

async function setAdapter(provider, options, enabled) {
  const root = await requireUserStore();
  const state = await readAgentState();
  const source = adapterSourceFor(root, provider);
  if (!await exists(source)) throw new Error("Adapter source is missing: " + source);
  const entry = providerEntryFor(provider, "repo");
  const pointer = adapterPointer(provider, localPointerSource(entry));
  const current = await exists(entry) ? await readFile(entry, "utf8") : undefined;
  if (enabled) {
    if (current !== undefined && current !== pointer) throw new Error("Collision at " + entry + ". Add this pointer manually:\n" + pointer);
    printPlan("on " + provider, entry, ["route work through " + agentFilename + " to " + source]);
    if (options.dryRun) return;
    if (current === undefined) {
      await mkdir(dirname(entry), { recursive: true });
      await writeFile(entry, pointer);
    }
    state.configuredProviders = [...new Set([...state.configuredProviders, provider])].sort();
    state.activeProviders = [...new Set([...state.activeProviders, provider])].sort();
  } else {
    if (current !== undefined && current !== pointer) throw new Error("Cannot turn off " + provider + ": " + entry + " is not a LES-managed pointer.");
    printPlan("off " + provider, entry, ["stop routing through " + agentFilename]);
    if (options.dryRun) return;
    if (current !== undefined) await rm(entry);
    state.activeProviders = state.activeProviders.filter((name) => name !== provider);
  }
  await writeAgentState(state);
  console.log((enabled ? "Enabled " : "Disabled ") + provider + " routing.");
}

async function setAllAdapters(options, enabled) {
  const state = await readAgentState();
  const providers = enabled ? state.configuredProviders : state.activeProviders;
  if (!providers.length) throw new Error("No configured provider. Use les active <provider> first.");
  for (const provider of providers) await setAdapter(provider, options, enabled);
}

async function diff(target) {
  const changes = await changesFor(target);
  if (!changes.length) {
    console.log("No managed differences.");
    return 0;
  }
  for (const change of changes) console.log(change);
  return 1;
}

async function nearestExisting(path) {
  let current = path;
  while (!await exists(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function doctorLine(status, name, detail) {
  console.log("[" + status + "] " + name + ": " + detail);
  return status;
}

function versionParts(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)/u);
  return match ? match.slice(1).map(Number) : undefined;
}

function isNewer(candidate, installed) {
  const next = versionParts(candidate);
  const current = versionParts(installed);
  if (!next || !current) return false;
  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== current[index]) return next[index] > current[index];
  }
  return false;
}

function updateCachePath() {
  return join(process.env.LES_CACHE_HOME || process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "les", "update-check.json");
}

async function latestVersion() {
  if (process.env.LES_UPDATE_CHECK === "0") return undefined;
  if (process.env.LES_LATEST_VERSION) return process.env.LES_LATEST_VERSION;
  const cache = updateCachePath();
  if (await exists(cache)) {
    try {
      const cached = JSON.parse(await readFile(cache, "utf8"));
      if (Date.now() - cached.checkedAt < 86_400_000) return cached.latestVersion;
    } catch { /* refresh a broken cache */ }
  }
  const response = await fetch("https://registry.npmjs.org/@hakienit/les/latest", {
    signal: AbortSignal.timeout(3000),
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const latest = (await response.json()).version;
  if (!versionParts(latest)) throw new Error("remote package version is invalid");
  await mkdir(dirname(cache), { recursive: true });
  await writeFile(cache, JSON.stringify({ checkedAt: Date.now(), latestVersion: latest }) + "\n");
  return latest;
}

async function doctor() {
  const root = userRoot();
  const statuses = [];
  let manifest;
  try {
    manifest = await readManifest(root);
    statuses.push(doctorLine("READY", "installation", "LES " + manifest.packageVersion + " at " + root));
  } catch {
    statuses.push(doctorLine("PENDING_USER_ACTION", "installation", "run npx -y @hakienit/les"));
  }
  statuses.push(doctorLine(await exists(join(root, "policies", "README.md")) ? "READY" : "BLOCKED", "les-policies", "canonical policy kernel"));
  statuses.push(doctorLine(await exists(join(root, "inventory.yaml")) ? "READY" : "BLOCKED", "inventory", "public contract inventory"));
  statuses.push(doctorLine(Number(process.versions.node.split(".")[0]) >= 20 ? "READY" : "BLOCKED", "node", process.version + " (requires >=20)"));
  try {
    await access(await nearestExisting(dirname(root)), constants.W_OK);
    statuses.push(doctorLine("READY", "filesystem", "user store parent is writable"));
  } catch {
    statuses.push(doctorLine("PENDING_USER_ACTION", "filesystem", "grant write permission for " + dirname(root)));
  }
  const agent = localAgentPath();
  if (await exists(agent)) {
    try {
      const state = await readAgentState();
      statuses.push(doctorLine("READY", "repository", "LES-AGENT.md; active: " + (state.activeProviders.join(", ") || "none")));
    } catch {
      statuses.push(doctorLine("BLOCKED", "repository", "LES-AGENT.md is not LES-managed"));
    }
  } else {
    statuses.push(doctorLine("PENDING_USER_ACTION", "repository", "run les init"));
  }
  statuses.push(doctorLine(spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0 ? "READY" : "FALLBACK", "git", "recommended project tool"));
  if (process.env.LES_PROVIDER) {
    const provider = process.env.LES_PROVIDER;
    const command = { codex: "codex", "claude-code": "claude", "gemini-cli": "gemini", antigravity: "antigravity" }[provider];
    if (!command || !await exists(adapterSourceFor(root, provider))) {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " has no compatible LES adapter"));
    } else if (spawnSync(command, ["--version"], { stdio: "ignore" }).status !== 0) {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " CLI is unavailable; host smoke evidence is pending"));
    } else {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " requires instruction-loading and permission smoke-test evidence"));
    }
  }
  if (manifest) {
    try {
      const latest = await latestVersion();
      if (latest && isNewer(latest, manifest.packageVersion)) {
        statuses.push(doctorLine("UPDATE_AVAILABLE", "les", manifest.packageVersion + " -> " + latest + "; run npx -y @hakienit/les"));
      } else if (latest) {
        statuses.push(doctorLine("READY", "update-check", "LES is current (" + manifest.packageVersion + ")"));
      }
    } catch {
      statuses.push(doctorLine("SKIPPED", "update-check", "remote version unavailable; retry later"));
    }
  }
  if (statuses.includes("BLOCKED")) return 2;
  if (statuses.includes("PENDING_USER_ACTION")) return 1;
  return 0;
}

try {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--version") {
    console.log(packageMetadata.version);
    process.exit(0);
  }
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    usage();
    process.exit(0);
  }
  const { command, options, provider } = parseArgs(argv.length ? argv : ["install", "--scope", "user"]);
  const target = targetFor(options.scope, options.root);
  if (command === "install") {
    if (options.scope === "repo") throw new Error("install is user-local; omit --scope or use --scope user.");
    printPlan("install", target, ["copy the LES CLI and source into the user-local store"]);
    if (!options.dryRun) {
      await installUser(target, true);
      console.log("Installed " + packageMetadata.name + "@" + packageMetadata.version + " in " + target + ".");
      console.log("Add to PATH once: export PATH=\"$HOME/.les-agents/bin:$PATH\"");
    }
  } else if (command === "add") {
    await add(target, options);
  } else if (command === "init") {
    await init(options);
  } else if (command === "update") {
    await update(target, options);
  } else if (command === "rollback") {
    await rollback(target, options);
  } else if (command === "diff") {
    process.exitCode = await diff(target);
  } else if (command === "adapter" || command === "active" || (command === "on" && provider) || (command === "off" && provider)) {
    await setAdapter(provider, options, command !== "off");
  } else if (command === "on" || command === "off") {
    await setAllAdapters(options, command === "on");
  } else {
    process.exitCode = await doctor();
  }
} catch (error) {
  console.error("[BLOCKED] " + error.message);
  process.exitCode = 2;
}
