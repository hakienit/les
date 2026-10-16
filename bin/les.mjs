#!/usr/bin/env node
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageMetadata = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const manifestFilename = "les-manifest.md";
const agentFilename = "LES-AGENT.md";
const legacyManagedFiles = new Set(["les-manifest.json", "les-manifest.yaml", "activate.sh"]);
const packageFiles = [...new Set([...(packageMetadata.files || []), "package.json"])].filter((path) => path !== "package-lock.json");
const supportedProviders = [
  { name: "codex", command: "codex" },
  { name: "claude-code", command: "claude" },
  { name: "gemini-cli", command: "gemini" },
  { name: "antigravity", command: "antigravity" }
];

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
  les connect [provider...]   set up this repo: create LES-AGENT.md, enable providers
                              (no names: pick from detected CLIs; --all: every detected CLI)
  les init                    create LES-AGENT.md only
  les on [provider]           enable one or all configured providers
  les guard on|off            block secret reads, deletes outside the repo, and force pushes (Claude Code)
  les lint FILE...            flag placeholders and unverifiable acceptance criteria
  les off [provider]          disable one or all providers
  les doctor                  show install, routing, and update status
  les add --scope repo        legacy: copy Markdown payload into a repo
  les update --scope repo     legacy: update a repo-local payload
  les diff --scope repo       legacy: show repo-local payload differences
  les rollback --backup PATH  legacy: restore a prior repo update backup

Providers: codex, claude-code, gemini-cli, antigravity
Options: --all, --dry-run (legacy repo commands also take --root, --scope)

Install from npm:
  npx -y @hakienit/les

The installer persists the LES command in the user PATH. Open a new terminal
after the first install.`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { scope: "repo", root: ".les-agents", dryRun: false, backup: undefined };
  let provider;
  const providers = [];
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (["connect", "lint", "guard"].includes(command) && !value.startsWith("-")) {
      providers.push(value);
      continue;
    }
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
    } else if (value === "--all") {
      options.all = true;
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
  if (!["install", "add", "init", "update", "rollback", "doctor", "diff", "adapter", "active", "connect", "lint", "guard", "on", "off"].includes(command)) {
    usage();
    throw new Error("Choose install, init, connect, lint, guard, active, on, off, doctor, or a legacy add/update command.");
  }
  if (!["repo", "user", "global"].includes(options.scope)) throw new Error("--scope must be repo, user, or global.");
  if (["init", "connect", "active", "on", "off"].includes(command) && options.scope !== "repo") {
    throw new Error(command + " is repo-local; omit --scope or use --scope repo.");
  }
  if (["adapter", "active"].includes(command) && !provider) {
    throw new Error(command + " requires codex, claude-code, gemini-cli, or antigravity.");
  }
  if (command === "lint" && !providers.length) throw new Error("lint requires at least one Markdown file.");
  if (command === "guard" && !(providers.length === 1 && ["on", "off"].includes(providers[0]))) throw new Error("guard requires on or off.");
  if (!["lint", "guard"].includes(command)) for (const name of providers) if (!supportedProviders.some((entry) => entry.name === name)) throw new Error("Unknown provider: " + name);
  return { command, options, provider, providers };
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

function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

function shellPathExpression(target) {
  const defaultRoot = resolve(join(homedir(), ".les-agents"));
  return resolve(target) === defaultRoot
    ? '"$HOME/.les-agents/bin"'
    : shellQuote(resolve(join(target, "bin")));
}

function posixPathSnippet(target) {
  const path = shellPathExpression(target);
  return "# LES user-local CLI\ncase \":$PATH:\" in *:" + path + ":*) ;; *) export PATH=" + path + ":$PATH;; esac";
}

function fishPathSnippet(target) {
  return "# LES user-local CLI\nfish_add_path " + shellPathExpression(target);
}

function powerShellQuote(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

function powerShellPathSnippet(target) {
  const path = powerShellQuote(resolve(join(target, "bin")));
  return "# LES user-local CLI\nif (-not (($env:Path -split [IO.Path]::PathSeparator) -contains " + path + ")) { $env:Path = " + path + " + [IO.Path]::PathSeparator + $env:Path }";
}

async function appendPathSnippet(path, snippet) {
  const current = await exists(path) ? await readFile(path, "utf8") : "";
  await mkdir(dirname(path), { recursive: true });
  const marker = "# LES user-local CLI";
  const markerIndex = current.indexOf(marker);
  if (markerIndex >= 0) {
    const lineEnd = current.indexOf("\n", markerIndex);
    const blockEnd = lineEnd < 0 ? current.length : current.indexOf("\n", lineEnd + 1);
    const replacement = current.slice(0, markerIndex) + snippet + current.slice(blockEnd < 0 ? current.length : blockEnd);
    if (replacement === current) return false;
    await writeFile(path, replacement);
    return true;
  }
  if (current.includes(".les-agents/bin")) return false;
  const prefix = current && !current.endsWith("\n") ? current + "\n" : current;
  await writeFile(path, prefix + snippet + "\n");
  return true;
}

async function configurePosixPath(target) {
  const home = homedir();
  const zshHome = process.env.ZDOTDIR ? resolve(process.env.ZDOTDIR) : home;
  const fish = join(home, ".config", "fish", "config.fish");
  const known = [join(home, ".profile"), join(home, ".bash_profile"), join(home, ".bashrc"), join(zshHome, ".zprofile"), join(zshHome, ".zshrc"), fish];
  const own = { zsh: [join(zshHome, ".zshrc")], bash: [join(home, ".bashrc"), join(home, ".bash_profile")], fish: [fish] }[basename(process.env.SHELL || "")] || [];
  // Write .profile and the login shell's rc; refresh other profiles only if they already exist.
  const profiles = [join(home, ".profile"), ...own];
  for (const path of known) if (!profiles.includes(path) && await exists(path)) profiles.push(path);
  const changed = [];
  for (const path of profiles) {
    try {
      if (await appendPathSnippet(path, path === fish ? fishPathSnippet(target) : posixPathSnippet(target))) changed.push(path);
    } catch (error) {
      console.error("[WARN] Could not persist LES PATH in " + path + ": " + error.message);
    }
  }
  return changed;
}

async function configurePowerShellPath(target) {
  const command = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const result = spawnSync(command, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$PROFILE"], {
    encoding: "utf8",
    env: process.env
  });
  if (result.status !== 0 || !result.stdout.trim()) return [];
  const profile = result.stdout.trim();
  return await appendPathSnippet(profile, powerShellPathSnippet(target)) ? [profile] : [];
}

async function configureWindowsPath(target) {
  const bin = resolve(join(target, "bin"));
  const script = "$entry = [System.IO.Path]::GetFullPath($env:LES_BIN_PATH)\n" +
    "$current = [Environment]::GetEnvironmentVariable('Path', 'User')\n" +
    "$parts = @()\n" +
    "if ($current) { $parts = @($current -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }\n" +
    "if ($parts | Where-Object { $_.TrimEnd('\\') -ieq $entry.TrimEnd('\\') }) { Write-Output 'exists'; exit 0 }\n" +
    "[Environment]::SetEnvironmentVariable('Path', (($parts + $entry) -join ';'), 'User')\n" +
    "Write-Output 'added'";
  const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, LES_BIN_PATH: bin }
  });
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr?.trim() || "PowerShell could not update the user PATH.");
  }
  return result.stdout.trim() === "added" ? ["the Windows user PATH"] : [];
}

async function configureCommandPath(target) {
  if (process.env.LES_DISABLE_PATH_SETUP === "1") return;
  try {
    const changed = [...process.platform === "win32" ? await configureWindowsPath(target) : await configurePosixPath(target), ...await configurePowerShellPath(target)];
    if (changed.length) {
      const reload = process.platform !== "win32" && changed.find((path) => path.endsWith("rc"));
      console.log("Added LES to PATH in " + changed.join(", ") + ". " + (reload ? "Run `source " + reload + "` or open" : "Open") + " a new terminal to use `les`.");
    }
  } catch (error) {
    const detail = process.platform === "win32"
      ? "Add " + resolve(join(target, "bin")) + " to the Windows user PATH manually."
      : "Add `export PATH=\"$HOME/.les-agents/bin:$PATH\"` to your shell profile manually.";
    console.error("[WARN] Could not persist LES PATH: " + error.message + " " + detail);
  }
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
  const existingInstall = await exists(target);
  if (existingInstall && !replace) throw new Error("Collision at " + target + ". Run the installer again to update LES.");
  const previous = existingInstall && (await filesBelow(target)).length ? await readManifest(target) : undefined;
  const stage = await mkdtemp(join(dirname(target), "." + basename(target) + ".staging-"));
  await copyDistribution(stage);
  await createManifest(stage, "user");
  let displaced;
  try {
    if (existingInstall) {
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
  await configureCommandPath(target);
  if (previous && (!versionParts(previous.packageVersion) || isNewer("1.1.2", previous.packageVersion))) {
    console.log("NOTICE: LES skill paths now use `skills/les-*`. Update existing repositories' LES-AGENT.md pointers to `~/.les-agents/skills/les-bootstrap/SKILL.md`.");
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
    "Then read `~/.les-agents/skills/les-bootstrap/SKILL.md` before starting work.\n\n" +
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
  console.log("Next: les connect");
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

function availableProviders() {
  return supportedProviders
    .filter(({ command }) => spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0)
    .map(({ name }) => name);
}

function renderProviderSelector(title, providers, cursor, selected) {
  if (process.stdout.isTTY) process.stdout.write("\x1b[2J\x1b[H");
  const allSelected = selected.size === providers.length;
  const rows = ["Select all", ...providers];
  process.stdout.write("\n" + title + "\n");
  process.stdout.write("  ↑/↓ move, Space select, Enter confirm\n");
  rows.forEach((label, index) => {
    const checked = index === 0 ? allSelected : selected.has(label);
    process.stdout.write((cursor === index ? "> " : "  ") + "[" + (checked ? "x" : " ") + "] " + label + "\n");
  });
}

let nonTTYInputPromise;
let nonTTYInput = "";
let nonTTYInputLoaded = false;

async function selectProviders(title, providers, initial = [], required = false) {
  const selected = new Set(initial);
  let cursor = 0;
  const stdin = process.stdin;
  const rowCount = providers.length + 1;
  const finish = () => {
    if (required && !selected.size) throw new Error("Select at least one provider.");
    return providers.filter((provider) => selected.has(provider));
  };
  const applyKey = (input, key = {}) => {
    if (key.ctrl && key.name === "c") throw new Error("Selection cancelled.");
    if (key.name === "up") cursor = (cursor + rowCount - 1) % rowCount;
    else if (key.name === "down") cursor = (cursor + 1) % rowCount;
    else if (key.name === "space" || input === " ") {
      if (cursor === 0) {
        if (selected.size === providers.length) selected.clear();
        else providers.forEach((provider) => selected.add(provider));
      } else {
        const provider = providers[cursor - 1];
        if (selected.has(provider)) selected.delete(provider);
        else selected.add(provider);
      }
    } else if (["return", "enter"].includes(key.name) || input === "\r" || input === "\n") {
      return finish();
    }
    renderProviderSelector(title, providers, cursor, selected);
  };

  renderProviderSelector(title, providers, cursor, selected);
  if (!stdin.isTTY) {
    if (!nonTTYInputPromise) {
      nonTTYInputPromise = new Promise((resolve) => {
        let input = "";
        stdin.setEncoding("utf8");
        stdin.on("data", (chunk) => { input += chunk; });
        stdin.on("end", () => resolve(input));
      });
    }
    if (!nonTTYInputLoaded) {
      nonTTYInput = await nonTTYInputPromise;
      nonTTYInputLoaded = true;
    }
    for (let index = 0; index < nonTTYInput.length; index += 1) {
      if (nonTTYInput.startsWith("\x1b[A", index) || nonTTYInput.startsWith("\x1b[B", index)) {
        const key = nonTTYInput[index + 2] === "A" ? "up" : "down";
        index += 2;
        const result = applyKey("", { name: key });
        if (result) {
          nonTTYInput = nonTTYInput.slice(index + 1);
          return result;
        }
      } else {
        const input = nonTTYInput[index];
        const result = applyKey(input, {});
        if (result) {
          if (input === "\r" && nonTTYInput[index + 1] === "\n") index += 1;
          nonTTYInput = nonTTYInput.slice(index + 1);
          return result;
        }
      }
    }
    throw new Error("Selection input ended before Enter.");
  }

  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    const onKeypress = (input, key = {}) => {
      try {
        const result = applyKey(input, key);
        if (result) {
          stdin.removeListener("keypress", onKeypress);
          stdin.setRawMode(false);
          stdin.pause();
          resolve(result);
        }
      } catch (error) {
        stdin.removeListener("keypress", onKeypress);
        stdin.setRawMode(false);
        stdin.pause();
        reject(error);
      }
    };
    stdin.on("keypress", onKeypress);
  });
}

async function connect(options, requested) {
  const root = await requireUserStore();
  const state = await exists(localAgentPath()) ? await readAgentState() : initialState();
  const detected = availableProviders();
  if (!requested.length && !detected.length) throw new Error("No supported provider CLI found on PATH. Supported: " + supportedProviders.map(({ name }) => name).join(", ") + ".");
  const selected = requested.length ? requested : options.all ? detected : await selectProviders("Select provider CLIs to connect", detected, detected, true);
  const plans = [];
  for (const provider of selected) {
    const source = adapterSourceFor(root, provider);
    if (!await exists(source)) throw new Error("Adapter source is missing: " + source);
    const entry = providerEntryFor(provider, "repo");
    const pointer = adapterPointer(provider, localPointerSource(entry));
    const current = await exists(entry) ? await readFile(entry, "utf8") : undefined;
    if (current !== undefined && current !== pointer) throw new Error("Collision at " + entry + ". Add this pointer manually:\n" + pointer);
    plans.push({ entry, pointer, current });
  }
  printPlan("connect", localAgentPath(), selected);
  if (options.dryRun) return;
  for (const { entry, pointer, current } of plans) {
    if (current === undefined) {
      await mkdir(dirname(entry), { recursive: true });
      await writeFile(entry, pointer);
    }
  }
  state.configuredProviders = [...new Set([...state.configuredProviders, ...selected])].sort();
  state.activeProviders = [...new Set([...state.activeProviders, ...selected])].sort();
  await writeAgentState(state);
  console.log("Connected " + selected.join(", ") + ".");
}

async function setAllAdapters(options, enabled) {
  const state = await readAgentState();
  const providers = enabled ? state.configuredProviders : state.activeProviders;
  if (!providers.length) throw new Error("No configured provider. Use les connect first.");
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

async function storeDrift(root, manifest) {
  const drift = [];
  for (const entry of manifest.managed) {
    const path = join(root, entry.path);
    if (!await exists(path)) drift.push("missing " + entry.path);
    else if (await sha256(path) !== entry.sha256) drift.push("changed " + entry.path);
  }
  return drift;
}

async function missingPointers(root, source) {
  const missing = [];
  for (const [, path] of source.matchAll(/~\/\.les-agents\/([^\s`]+)/gu)) {
    if (!await exists(join(root, path))) missing.push(path);
  }
  return missing;
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

async function latestVersion(installed) {
  if (process.env.LES_UPDATE_CHECK === "0") return undefined;
  if (process.env.LES_LATEST_VERSION) return process.env.LES_LATEST_VERSION;
  const cache = updateCachePath();
  if (await exists(cache)) {
    try {
      const cached = JSON.parse(await readFile(cache, "utf8"));
      if (Date.now() - cached.checkedAt < 86_400_000 && isNewer(cached.latestVersion, installed)) return cached.latestVersion;
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

const placeholderPattern = /\b(?:TBD|TBC|TODO|FIXME|XXX)\b|\?\?\?|\bto be (?:decided|determined)\b/iu;
const vaguePattern = /\b(?:fast|quick(?:ly)?|easy|easily|simple|user-friendly|intuitive|robust|seamless(?:ly)?|properly|appropriate(?:ly)?|reasonable|efficient(?:ly)?|good|nice|better|as needed|etc\.?|and so on)\b/iu;
const observablePattern = /\d|`|["“]|\b(?:returns?|shows?|prints?|exits?|fails?|rejects?|emits?|writes?|creates?|contains?|equals?|matches|status|error|passes|blocks?|displays?|renders?|logs?|lists?)\b/iu;

function lintSource(source) {
  const findings = [];
  let fenced = false;
  let inCriteria = false;
  let sawCriteria = false;
  source.split(/\r?\n/u).forEach((line, index) => {
    if (/^\s*(?:```|~~~)/u.test(line)) fenced = !fenced;
    if (fenced || /^\s*(?:```|~~~)/u.test(line)) return;
    const at = index + 1;
    const heading = line.match(/^#{1,6}\s+(.*)/u)?.[1];
    if (heading !== undefined) {
      inCriteria = /accept|criteria|done when|definition of done|success/iu.test(heading);
      sawCriteria ||= inCriteria;
    }
    if (placeholderPattern.test(line)) findings.push({ at, kind: "placeholder", text: line.trim() });
    if (!inCriteria || !/^\s*(?:[-*+]|\d+[.)])\s+/u.test(line)) return;
    const vague = line.match(vaguePattern)?.[0];
    if (vague) findings.push({ at, kind: "vague", text: "\"" + vague + "\" is not measurable: " + line.trim() });
    else if (!observablePattern.test(line)) findings.push({ at, kind: "unverifiable", text: "no observable check: " + line.trim() });
  });
  if (!sawCriteria) findings.push({ at: 1, kind: "missing", text: "no acceptance criteria section" });
  return findings;
}

async function lint(files) {
  let count = 0;
  for (const file of files) {
    for (const { at, kind, text } of lintSource(await readFile(file, "utf8"))) {
      console.log(file + ":" + at + ": [" + kind + "] " + text);
      count += 1;
    }
  }
  console.log(count ? count + " finding(s)." : "No findings.");
  return count ? 1 : 0;
}

const guardSettings = ".claude/settings.local.json";

async function guard(root, enabled, options) {
  const script = join(root, "adapters", "claude-code", "guard.mjs");
  if (enabled && !await exists(script)) throw new Error("Guard script is missing: " + script);
  const path = join(process.cwd(), guardSettings);
  let settings = {};
  if (await exists(path)) {
    try { settings = JSON.parse(await readFile(path, "utf8")); } catch { throw new Error(guardSettings + " is not valid JSON; fix it before running les guard."); }
  }
  const isGuard = (entry) => entry?.hooks?.some((hook) => String(hook.command).endsWith("adapters/claude-code/guard.mjs\""));
  const rest = (settings.hooks?.PreToolUse || []).filter((entry) => !isGuard(entry));
  const entry = { matcher: "Bash|Read", hooks: [{ type: "command", command: "node \"" + script + "\"" }] };
  printPlan("guard " + (enabled ? "on" : "off"), path, [enabled ? "block risky Bash and Read calls with " + script : "remove the LES guard hook"]);
  if (options.dryRun) return;
  settings.hooks = { ...settings.hooks, PreToolUse: enabled ? [...rest, entry] : rest };
  if (!settings.hooks.PreToolUse.length) delete settings.hooks.PreToolUse;
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n");
  console.log("Guard " + (enabled ? "enabled" : "disabled") + " for Claude Code in " + guardSettings + ".");
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
  if (manifest) {
    const drift = await storeDrift(root, manifest);
    statuses.push(drift.length
      ? doctorLine("PENDING_USER_ACTION", "store-integrity", drift.length + " managed file(s) differ: " + drift.slice(0, 3).join(", ") + "; run npx -y @hakienit/les")
      : doctorLine("READY", "store-integrity", manifest.managed.length + " managed files match the manifest"));
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
      const missing = await missingPointers(root, await readFile(agent, "utf8"));
      statuses.push(missing.length
        ? doctorLine("PENDING_USER_ACTION", "bootstrap-pointer", "LES-AGENT.md points to missing ~/.les-agents/" + missing.join(", ") + "; update the pointer")
        : doctorLine("READY", "bootstrap-pointer", "LES-AGENT.md pointers resolve in the user store"));
    } catch {
      statuses.push(doctorLine("BLOCKED", "repository", "LES-AGENT.md is not LES-managed"));
    }
  } else {
    statuses.push(doctorLine("PENDING_USER_ACTION", "repository", "run les init"));
  }
  statuses.push(doctorLine(spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0 ? "READY" : "FALLBACK", "git", "recommended project tool"));
  if (process.env.LES_PROVIDER) {
    const provider = process.env.LES_PROVIDER;
    const command = supportedProviders.find((entry) => entry.name === provider)?.command;
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
      const latest = await latestVersion(manifest.packageVersion);
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
  const { command, options, provider, providers } = parseArgs(argv.length ? argv : ["install", "--scope", "user"]);
  const target = targetFor(options.scope, options.root);
  if (command === "install") {
    if (options.scope === "repo") throw new Error("install is user-local; omit --scope or use --scope user.");
    printPlan("install", target, ["copy the LES CLI and source into the user-local store"]);
    if (!options.dryRun) {
      await installUser(target, true);
      console.log("Installed " + packageMetadata.name + "@" + packageMetadata.version + " in " + target + ".");
    }
  } else if (command === "add") {
    await add(target, options);
  } else if (command === "init") {
    await init(options);
  } else if (command === "connect") {
    await connect(options, providers);
  } else if (command === "guard") {
    await guard(await requireUserStore(), providers[0] === "on", options);
  } else if (command === "lint") {
    process.exitCode = await lint(providers);
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
