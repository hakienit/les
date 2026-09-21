#!/usr/bin/env node
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageMetadata = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const payload = [
  ["bin/les", "bin/les"],
  ["bin/les.mjs", "bin/les.mjs"],
  ["package.json", "package.json"],
  ["policies", "policies"],
  ["skills", "skills"],
  ["profiles", "profiles"],
  ["adapters", "adapters"],
  ["templates", "templates"],
  ["tools", "tools"],
  ["inventory.yaml", "inventory.yaml"],
  ["README.md", "README.md"],
  ["CHANGELOG.md", "CHANGELOG.md"],
  ["LICENSE", "LICENSE"]
];

function usage() {
  console.log(`LES repo-local CLI

Usage:
  les                         install the default repo payload
  les init                    initialize the local shell activation helper
  les active <provider>       register and enable a provider
  les on [provider]           enable one or all registered providers
  les off [provider]          disable one or all providers
  les doctor                  show installation and routing status
  les diff                    show managed payload differences
  les update                  refresh the payload from this CLI source
  les rollback --backup PATH  restore a prior update backup

Providers: codex, claude-code, gemini-cli, antigravity
Options: --root PATH, --scope repo|global, --dry-run

Install from GitHub:
  npx -y github:hakienit/les
  les init
  les active codex`);
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
  if (!["add", "init", "update", "rollback", "doctor", "diff", "adapter", "active", "on", "off"].includes(command)) {
    usage();
    throw new Error("Choose add, init, update, rollback, doctor, diff, active, on, off, or adapter.");
  }
  if (!["repo", "global"].includes(options.scope)) {
    throw new Error("--scope must be repo or global.");
  }
  if (["adapter", "active"].includes(command) && !provider) {
    throw new Error(command + " requires codex, claude-code, gemini-cli, or antigravity.");
  }
  if (["on", "off"].includes(command) && options.scope !== "repo") {
    throw new Error("on/off are repo-local; use --scope repo.");
  }
  return { command, options, provider };
}

function targetFor(scope, root = ".les-agents") {
  if (scope === "global") {
    return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "les");
  }
  if (!root || root.startsWith("/") || root.split(/[\\/]/).includes("..")) {
    throw new Error("--root must be a relative repo path without ..");
  }
  return resolve(process.cwd(), root);
}

function repoManifestPath(target) {
  return join(target, "les-manifest.yaml");
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
  if (!entries[provider]) {
    throw new Error("Unknown provider: " + provider);
  }
  return scope === "repo" ? join(root, entries[provider][0]) : entries[provider][1];
}

function adapterSourceFor(target, provider) {
  const filename = provider === "codex" ? "AGENTS.md" : provider === "claude-code" ? "CLAUDE.md" : provider === "gemini-cli" ? "GEMINI.md" : "agent.md";
  return join(target, "adapters", provider, filename);
}

function adapterSourcePath(target, provider) {
  return "./" + relative(process.cwd(), adapterSourceFor(target, provider)).split(sep).join("/");
}

function adapterPointer(provider, source) {
  if (provider === "codex") {
    return "# LES adapter\n\nRead and follow the pinned LES adapter at " + source + " before starting work.\n";
  }
  if (provider === "antigravity") {
    return "---\nname: les\ndescription: Route work through the pinned Living Engineering System.\n---\n\nRead and follow the pinned LES adapter at " + source + " before starting work.\n";
  }
  return "# LES adapter\n\n@" + source + "\n";
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
    if (entry.isDirectory()) {
      files.push(...await filesBelow(join(root, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function sourceFiles() {
  const files = new Map();
  for (const [source, destination] of payload) {
    const sourcePath = join(packageRoot, source);
    const sourceInfo = await stat(sourcePath);
    if (sourceInfo.isDirectory()) {
      for (const relativePath of await filesBelow(sourcePath)) {
        files.set(join(destination, relativePath), sourcePath + "/" + relativePath);
      }
    } else {
      files.set(destination, sourcePath);
    }
  }
  return files;
}

async function copyPayload(stage) {
  for (const [source, destination] of payload) {
    await cp(join(packageRoot, source), join(stage, destination), { recursive: true });
  }
}

async function createManifest(stage, scope, adapters = [], configuredAdapters = adapters) {
  const managed = [];
  for (const relativePath of await filesBelow(stage)) {
    managed.push({ path: relativePath, sha256: await sha256(join(stage, relativePath)) });
  }
  const manifest = {
    manifestVersion: 1,
    packageName: packageMetadata.name,
    packageVersion: packageMetadata.version,
    scope,
    installedAt: new Date().toISOString(),
    managed,
    adapters,
    configuredAdapters: [...configuredAdapters]
  };
  await writeFile(join(stage, "les-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

async function writeRepoManifest(target, manifest) {
  const path = repoManifestPath(target);
  await mkdir(target, { recursive: true });
  await writeFile(path, [
    "manifestVersion: 1",
    "lesVersion: " + JSON.stringify(manifest.packageVersion),
    "managedRoot: " + JSON.stringify(relative(process.cwd(), target).split(sep).join("/")),
    "profiles: []",
    "adapters: " + JSON.stringify(manifest.adapters || []),
    "configuredAdapters: " + JSON.stringify(manifest.configuredAdapters || manifest.adapters || []),
    ""
  ].join("\n"));
}

async function writeActivation(target) {
  await writeFile(join(target, "activate.sh"), "export PATH=\"$PWD/" + relative(process.cwd(), join(target, "bin")).split(sep).join("/") + ":$PATH\"\n");
}

async function readManifest(target) {
  const manifestPath = join(target, "les-manifest.json");
  if (!await exists(manifestPath)) {
    throw new Error("No LES manifest at " + target + ". Run les add first.");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.packageName !== packageMetadata.name || !Array.isArray(manifest.managed)) {
    throw new Error("The existing manifest is not a compatible LES installation.");
  }
  return manifest;
}

async function unmanagedFiles(target, manifest) {
  const known = new Set(manifest.managed.map((entry) => entry.path));
  known.add("les-manifest.json");
  known.add("les-manifest.yaml");
  known.add("activate.sh");
  return (await filesBelow(target)).filter((relativePath) => !known.has(relativePath));
}

async function changesFor(target) {
  const manifest = await readManifest(target);
  const source = await sourceFiles();
  const installed = new Set((await filesBelow(target)).filter((path) => !["les-manifest.json", "les-manifest.yaml", "activate.sh"].includes(path)));
  const changes = [];
  for (const [relativePath, sourcePath] of source) {
    const installedPath = join(target, relativePath);
    if (!installed.has(relativePath)) {
      changes.push("missing " + relativePath);
    } else if (await sha256(sourcePath) !== await sha256(installedPath)) {
      changes.push("changed " + relativePath);
    }
    installed.delete(relativePath);
  }
  for (const relativePath of installed) {
    changes.push("removed " + relativePath);
  }
  for (const relativePath of await unmanagedFiles(target, manifest)) {
    changes.push("unmanaged " + relativePath);
  }
  return changes.sort();
}

async function buildStage(target, scope, adapters, configuredAdapters) {
  await mkdir(dirname(target), { recursive: true });
  const stage = await mkdtemp(join(dirname(target), "." + basename(target) + ".staging-"));
  await copyPayload(stage);
  await createManifest(stage, scope, adapters, configuredAdapters);
  return stage;
}

function backupPath(target) {
  return join(dirname(target), "." + basename(target) + ".backup-" + Date.now());
}

async function install(target, scope, replace, adapters = [], configuredAdapters = adapters) {
  const stage = await buildStage(target, scope, adapters, configuredAdapters);
  let backup;
  try {
    if (replace) {
      backup = backupPath(target);
      await rename(target, backup);
    }
    await rename(stage, target);
    return backup;
  } catch (error) {
    if (backup && !await exists(target) && await exists(backup)) {
      await rename(backup, target);
    }
    throw error;
  } finally {
    if (await exists(stage)) {
      await rm(stage, { recursive: true, force: true });
    }
  }
}

function printPlan(action, target, changes = []) {
  console.log(action.toUpperCase() + " " + target);
  for (const change of changes) {
    console.log("  " + change);
  }
}

async function add(target, options) {
  if (await exists(target)) {
    throw new Error("Collision at " + target + ". Use les update only for an existing LES installation.");
  }
  if (options.scope === "repo" && await exists(repoManifestPath(target))) {
    throw new Error("Collision at " + repoManifestPath(target) + ". Resolve the existing LES metadata before adding a new installation.");
  }
  printPlan("add", target, ["write managed LES files pinned to " + packageMetadata.version]);
  if (options.dryRun) {
    return;
  }
  await install(target, options.scope, false);
  if (options.scope === "repo") {
    await writeRepoManifest(target, await readManifest(target));
  }
  console.log("Installed " + packageMetadata.name + "@" + packageMetadata.version + ".");
  if (options.scope === "repo") console.log("Next: export PATH=\"$PWD/" + relative(process.cwd(), join(target, "bin")).split(sep).join("/") + ":$PATH\" && les init");
}

async function init(target, options) {
  await readManifest(target);
  if (options.dryRun) {
    printPlan("init", join(target, "activate.sh"), ["write the repo-local PATH helper"]);
    return;
  }
  await writeActivation(target);
  console.log("Initialized repo-local LES.");
  console.log("Run: source " + relative(process.cwd(), join(target, "activate.sh")).split(sep).join("/") + " && les active <provider>");
}

async function update(target, options) {
  const manifest = await readManifest(target);
  const unmanaged = await unmanagedFiles(target, manifest);
  if (unmanaged.length) {
    throw new Error("Collision: unmanaged files exist in the LES root: " + unmanaged.join(", "));
  }
  const changes = await changesFor(target);
  if (!changes.length && manifest.packageVersion === packageMetadata.version) {
    if (options.scope === "repo" && !await exists(repoManifestPath(target))) {
      await writeRepoManifest(target, manifest);
      console.log("Restored " + repoManifestPath(target) + ".");
      return;
    }
    console.log("Already pinned to " + packageMetadata.version + ".");
    return;
  }
  printPlan("update", target, changes.length ? changes : ["refresh manifest to " + packageMetadata.version]);
  if (options.dryRun) {
    return;
  }
  // ponytail: no cross-process lock; add one only if concurrent installs become supported.
  const backup = await install(target, options.scope, true, manifest.adapters || [], manifest.configuredAdapters || manifest.adapters || []);
  if (options.scope === "repo") {
    await writeActivation(target);
    await writeRepoManifest(target, await readManifest(target));
  }
  console.log("Updated to " + packageMetadata.version + ". Backup: " + backup);
}

async function rollback(target, options) {
  if (!options.backup) {
    throw new Error("Rollback requires --backup <path> from a prior update.");
  }
  const backup = resolve(options.backup);
  const targetParent = resolve(dirname(target));
  if (dirname(backup) !== targetParent || !basename(backup).startsWith("." + basename(target) + ".backup-")) {
    throw new Error("Backup must be a sibling created by les update.");
  }
  await readManifest(target);
  await readManifest(backup);
  printPlan("rollback", target, ["restore " + backup]);
  if (options.dryRun) {
    return;
  }
  const displaced = join(targetParent, "." + basename(target) + ".rollback-" + Date.now());
  await rename(target, displaced);
  try {
    await rename(backup, target);
  } catch (error) {
    await rename(displaced, target);
    throw error;
  }
  if (options.scope === "repo") {
    await writeRepoManifest(target, await readManifest(target));
  }
  console.log("Rolled back. Displaced installation: " + displaced);
}

async function setAdapter(target, provider, options, enabled) {
  const manifest = await readManifest(target);
  const source = adapterSourceFor(target, provider);
  if (!await exists(source)) {
    throw new Error("Adapter source is missing: " + source);
  }
  const entry = providerEntryFor(provider, options.scope);
  const pointer = adapterPointer(provider, adapterSourcePath(target, provider));
  const current = await exists(entry) ? await readFile(entry, "utf8") : undefined;
  if (enabled) {
    if (current !== undefined && current !== pointer) {
      throw new Error("Collision at " + entry + ". Add this pointer manually:\n" + pointer);
    }
    printPlan("on " + provider, entry, ["route work through " + source]);
    if (options.dryRun) return;
    if (current === undefined) {
      await mkdir(dirname(entry), { recursive: true });
      await writeFile(entry, pointer);
    }
    manifest.adapters = [...new Set([...(manifest.adapters || []), provider])].sort();
    manifest.configuredAdapters = [...new Set([...(manifest.configuredAdapters || []), provider])].sort();
  } else {
    if (current !== undefined && current !== pointer) {
      throw new Error("Cannot turn off " + provider + ": " + entry + " is not a LES-managed pointer.");
    }
    printPlan("off " + provider, entry, ["stop routing through " + source]);
    if (options.dryRun) return;
    if (current !== undefined) await rm(entry);
    manifest.adapters = (manifest.adapters || []).filter((name) => name !== provider);
  }
  await writeFile(join(target, "les-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  if (options.scope === "repo") {
    await writeRepoManifest(target, manifest);
  }
  console.log((enabled ? "Enabled " : "Disabled ") + provider + " routing.");
}

async function setAllAdapters(target, options, enabled) {
  const manifest = await readManifest(target);
  const providers = enabled ? (manifest.configuredAdapters || manifest.adapters || []) : (manifest.adapters || []);
  if (!providers.length) {
    throw new Error("No configured provider. Use les on <provider> first.");
  }
  for (const provider of providers) await setAdapter(target, provider, options, enabled);
}

async function diff(target) {
  const changes = await changesFor(target);
  if (!changes.length) {
    console.log("No managed differences.");
    return 0;
  }
  for (const change of changes) {
    console.log(change);
  }
  return 1;
}

async function nearestExisting(path) {
  let current = path;
  while (!await exists(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
  return current;
}

function doctorLine(status, name, detail) {
  console.log("[" + status + "] " + name + ": " + detail);
  return status;
}

async function doctor(target) {
  const statuses = [];
  statuses.push(doctorLine(await exists(join(packageRoot, "policies", "README.md")) ? "READY" : "BLOCKED", "les-policies", "canonical policy kernel"));
  statuses.push(doctorLine(await exists(join(packageRoot, "inventory.yaml")) ? "READY" : "BLOCKED", "inventory", "public contract inventory"));
  statuses.push(doctorLine(Number(process.versions.node.split(".")[0]) >= 20 ? "READY" : "BLOCKED", "node", process.version + " (requires >=20)"));
  try {
    await access(await nearestExisting(dirname(target)), constants.W_OK);
    statuses.push(doctorLine("READY", "filesystem", "target parent is writable"));
  } catch {
    statuses.push(doctorLine("PENDING_USER_ACTION", "filesystem", "grant write permission for " + dirname(target)));
  }
  statuses.push(doctorLine(spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0 ? "READY" : "FALLBACK", "git", "recommended project tool"));
  statuses.push(doctorLine("SKIPPED", "browser-automation", "optional capability is not selected"));
  statuses.push(doctorLine("SKIPPED", "project-tracker-connector", "optional capability is not selected"));
  statuses.push(doctorLine(await exists(join(target, "les-manifest.json")) ? "READY" : "PENDING_USER_ACTION", "installation", "run les add when no manifest exists"));
  if (process.env.LES_PROVIDER) {
    const provider = process.env.LES_PROVIDER;
    const command = { codex: "codex", "claude-code": "claude", "gemini-cli": "gemini", antigravity: "antigravity" }[provider];
    if (!command || !await exists(adapterSourceFor(target, provider))) {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " has no compatible LES adapter"));
    } else if (spawnSync(command, ["--version"], { stdio: "ignore" }).status !== 0) {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " CLI is unavailable; host smoke evidence is pending"));
    } else {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " requires instruction-loading and permission smoke-test evidence"));
    }
  }
  if (statuses.includes("BLOCKED")) {
    return 2;
  }
  if (statuses.includes("PENDING_USER_ACTION")) {
    return 1;
  }
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
  const { command, options, provider } = parseArgs(argv.length ? argv : ["add"]);
  const target = targetFor(options.scope, options.root);
  if (command === "add") {
    await add(target, options);
  } else if (command === "update") {
    await update(target, options);
  } else if (command === "rollback") {
    await rollback(target, options);
  } else if (command === "diff") {
    process.exitCode = await diff(target);
  } else if (command === "init") {
    await init(target, options);
  } else if (command === "adapter" || command === "active" || (command === "on" && provider) || (command === "off" && provider)) {
    await setAdapter(target, provider, options, command !== "off");
  } else if (command === "on" || command === "off") {
    await setAllAdapters(target, options, command === "on");
  } else {
    process.exitCode = await doctor(target);
  }
} catch (error) {
  console.error("[BLOCKED] " + error.message);
  process.exitCode = 2;
}
