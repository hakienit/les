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

function usage() {
  console.log(`LES user-local CLI

Usage:
  les                  install ~/.les-agents from this package
  les update           fetch @hakienit/les@latest from npm and install it
  les init             create LES-AGENT.md only
  les connect          set up this repo: LES-AGENT.md, every provider, guard and team on
  les guard on|off [codex|gemini]  block secret reads, deletes outside the repo, and force pushes (default: Claude Code)
  les team on|off      add or remove one Claude Code subagent per LES department
  les lint FILE...     flag placeholders and unverifiable acceptance criteria
  les doctor           show install, routing, and update status (alias: les status)
  les version          print the LES version

Options: --dry-run, --version

Install from npm:
  npx -y @hakienit/les@latest

The installer persists the LES command in the user PATH. Open a new terminal
after the first install.`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { dryRun: false };
  const args = [];
  for (const value of rest) {
    if (["guard", "team", "lint"].includes(command) && !value.startsWith("-")) args.push(value);
    else if (value === "--dry-run") options.dryRun = true;
    else if (value === "--version") {
      console.log(packageMetadata.version);
      process.exit(0);
    } else if (value === "--help" || value === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error("Unknown option: " + value);
    }
  }
  if (!["install", "update", "init", "connect", "guard", "team", "lint", "doctor", "status", "version"].includes(command)) {
    usage();
    throw new Error("Choose update, init, connect, guard, team, lint, doctor, or version.");
  }
  if (command === "lint" && !args.length) throw new Error("lint requires at least one Markdown file.");
  if (command === "guard" && !(["on", "off"].includes(args[0]) && (args.length === 1 || args.length === 2 && ["codex", "gemini"].includes(args[1])))) throw new Error("guard requires on or off, optionally followed by codex or gemini.");
  if (command === "team" && !(args.length === 1 && ["on", "off"].includes(args[0]))) throw new Error("team requires on or off.");
  if (!["guard", "team", "lint"].includes(command) && args.length) throw new Error("Unknown option: " + args[0]);
  return { command, options, args };
}

function providerEntryFor(provider) {
  const entries = {
    codex: "AGENTS.md",
    "claude-code": "CLAUDE.md",
    "gemini-cli": "GEMINI.md",
    antigravity: join(".agents", "agents", "les", "agent.md")
  };
  return join(process.cwd(), entries[provider]);
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
    // Manifest and source keys always use "/" so they match on Windows.
    const relativePath = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) files.push(...await filesBelow(join(root, entry.name), relativePath));
    else files.push(relativePath);
  }
  return files;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
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

async function createManifest(stage, scope) {
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
    adapters: [],
    configuredAdapters: []
  };
  await writeManifest(stage, manifest);
  return manifest;
}

async function readManifest(target) {
  const currentPath = join(target, manifestFilename);
  const legacyPath = join(target, "les-manifest.json");
  const manifestPath = await exists(currentPath) ? currentPath : legacyPath;
  if (!await exists(manifestPath)) throw new Error("No LES manifest at " + target + ". Run npx -y @hakienit/les@latest first.");
  const manifest = parseManifest(await readFile(manifestPath, "utf8"));
  if (manifest.packageName !== packageMetadata.name || !Array.isArray(manifest.managed)) {
    throw new Error("The existing manifest is not a compatible LES installation.");
  }
  return manifest;
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
  if (!await exists(path)) throw new Error("No " + agentFilename + " in this repo. Run les connect first.");
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

// Windows npm CLIs are .cmd shims, which spawnSync only finds through a shell; commands are fixed names, never user input.
function commandWorks(command) {
  const result = process.platform === "win32"
    ? spawnSync(command + " --version", { stdio: "ignore", shell: true })
    : spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

const guardHostFor = { codex: "codex", "claude-code": "claude", "gemini-cli": "gemini" };

async function connect(options) {
  const root = await requireUserStore();
  const state = await exists(localAgentPath()) ? await readAgentState() : initialState();
  const plans = [];
  for (const { name: provider } of supportedProviders) {
    const source = adapterSourceFor(root, provider);
    if (!await exists(source)) throw new Error("Adapter source is missing: " + source);
    const entry = providerEntryFor(provider);
    const pointer = adapterPointer(provider, localPointerSource(entry));
    const current = await exists(entry) ? await readFile(entry, "utf8") : undefined;
    if (current !== undefined && current !== pointer) {
      console.error("[WARN] Skipped " + provider + ": " + entry + " is not a LES pointer. Add this pointer manually:\n" + pointer);
      continue;
    }
    plans.push({ provider, entry, pointer, current });
  }
  const connected = plans.map(({ provider }) => provider);
  if (!connected.length) throw new Error("Every provider entrypoint is project-owned; nothing to connect.");
  printPlan("connect", localAgentPath(), connected);
  if (!options.dryRun) {
    for (const { entry, pointer, current } of plans) {
      if (current === undefined) {
        await mkdir(dirname(entry), { recursive: true });
        await writeFile(entry, pointer);
      }
    }
    state.configuredProviders = [...new Set([...state.configuredProviders, ...connected])].sort();
    state.activeProviders = [...new Set([...state.activeProviders, ...connected])].sort();
    await writeAgentState(state);
  }
  for (const provider of connected) if (guardHostFor[provider]) await guard(root, true, options, guardHostFor[provider]);
  if (connected.includes("claude-code")) await team(root, true, options);
  if (!options.dryRun) console.log("Connected " + connected.join(", ") + ".");
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

// Codex and Gemini CLI have no matching Edit/Write tool names or Read gate to observe, so they get the risky-call check only (--no-gate).
const guardHosts = {
  claude: { label: "Claude Code", file: ".claude/settings.local.json", before: "PreToolUse", matcher: "Bash|Read|Edit|Write|MultiEdit|NotebookEdit", start: "startup|resume|clear|compact", flags: "", stop: true, failClosed: true },
  codex: { label: "Codex", file: ".codex/hooks.json", before: "PreToolUse", matcher: "Bash", start: "startup|resume|clear|compact", flags: " --no-gate", note: "Codex skips new hooks until trusted: run /hooks in Codex and trust them." },
  gemini: { label: "Gemini CLI", file: ".gemini/settings.json", before: "BeforeTool", matcher: "run_shell_command|read_file", start: "*", flags: " --host gemini" }
};

// Keep personal settings out of `git status` without touching tracked files; skipped outside a git repo.
async function excludeLocally(entry) {
  const found = spawnSync("git", ["rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" });
  if (found.status !== 0) return;
  const path = resolve(found.stdout.trim());
  const current = await exists(path) ? await readFile(path, "utf8") : "";
  if (current.split(/\r?\n/u).includes(entry)) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, current + (current && !current.endsWith("\n") ? "\n" : "") + entry + "\n");
}

async function guard(root, enabled, options, host = "claude") {
  const script = join(root, "adapters", "claude-code", "guard.mjs");
  if (enabled && !await exists(script)) throw new Error("Guard script is missing: " + script);
  const { label, file: guardSettings, before, matcher, start, flags, note, stop, failClosed } = guardHosts[host];
  const path = join(process.cwd(), guardSettings);
  let settings = {};
  if (await exists(path)) {
    try { settings = JSON.parse(await readFile(path, "utf8")); } catch { throw new Error(guardSettings + " is not valid JSON; fix it, then rerun the command."); }
  }
  const isGuard = (entry) => entry?.hooks?.some((hook) => /adapters[\\/]claude-code[\\/]guard\.mjs"/u.test(String(hook.command)));
  const command = "node \"" + script + "\"" + flags;
  const entries = {
    // onFailure "block" (Claude Code 2.1.295+): a crashed or missing guard blocks the call instead of silently allowing it. `les guard off` removes it.
    [before]: { matcher, hooks: [{ type: "command", command, ...failClosed && { onFailure: "block" } }] },
    SessionStart: { matcher: start, hooks: [{ type: "command", command: command + " session-start" }] },
    ...stop && { Stop: { hooks: [{ type: "command", command: command + " stop" }] } }
  };
  printPlan("guard " + (enabled ? "on" : "off"), path, [enabled ? "block risky calls" + (host === "claude" ? ", block Edit, Write, and Bash until the LES bootstrap files are read each session, and send back task replies that lack the LES status footer" : "") + ", with " + script : "remove the LES guard hooks"]);
  if (options.dryRun) return;
  settings.hooks = { ...settings.hooks };
  for (const [event, entry] of Object.entries(entries)) {
    const rest = (settings.hooks[event] || []).filter((existing) => !isGuard(existing));
    settings.hooks[event] = enabled ? [...rest, entry] : rest;
    if (!settings.hooks[event].length) delete settings.hooks[event];
  }
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n");
  if (enabled) await excludeLocally(guardSettings);
  console.log("Guard " + (enabled ? "enabled" : "disabled") + " for " + label + " in " + guardSettings + ".");
  if (enabled && note) console.log(note);
}

const teamAgents = ".claude/agents";
const teamMarker = "<!-- les-team: generated by `les connect` or `les team on`; `les team off` removes it. -->";
const teamModels = { fast: "haiku", standard: "sonnet", deep: "opus" };

function teamAgent(root, department) {
  const readOnly = department.access === "read";
  const skills = department.skills.map((name) => "   - `" + join(root, "skills", name, "SKILL.md") + "`").join("\n");
  return `---
name: les-${department.id}
description: LES ${department.name} department (${department.tier} tier). ${department.description} Use only when the LES Lead dispatches a brief to ${department.name}.
model: ${teamModels[department.tier]}
${readOnly ? "tools: Read, Grep, Glob, Bash\n" : ""}---
${teamMarker}

# LES ${department.name}

You are the ${department.name} department of a LES team. Work only from the Lead's brief.

1. Read \`${join(root, "policies", "team.md")}\`.
2. Read the one skill the brief names from your catalog, plus its non-bootstrap \`loads\`:
${skills}
3. Stay inside the brief's owned paths and granted authority.${readOnly ? " You are read-only: never modify files." : ""}
4. Return only the report defined in \`team.md\`. Do not dispatch other agents.
`;
}

async function team(root, enabled, options) {
  const inventory = JSON.parse(await readFile(join(root, "inventory.yaml"), "utf8"));
  const departments = (inventory.departments || []).filter((department) => department.id !== "lead");
  if (enabled && !departments.length) throw new Error("The installed LES has no departments; run les update.");
  const directory = join(process.cwd(), teamAgents);
  const changes = [];
  const actions = [];
  for (const department of departments) {
    const path = join(directory, "les-" + department.id + ".md");
    const relativePath = teamAgents + "/les-" + department.id + ".md";
    const present = await exists(path);
    // Never overwrite or delete an agent file the user wrote under the same name.
    if (present && !(await readFile(path, "utf8")).includes(teamMarker)) {
      changes.push("keep " + relativePath + " (not LES-managed)");
      continue;
    }
    if (enabled) {
      changes.push("write " + relativePath + " (" + department.tier + " tier, " + department.access + " access)");
      actions.push(() => writeFile(path, teamAgent(root, department)));
    } else if (present) {
      changes.push("remove " + relativePath);
      actions.push(() => rm(path));
    }
  }
  printPlan("team " + (enabled ? "on" : "off"), directory, changes.length ? changes : ["nothing to change"]);
  if (options.dryRun) return;
  if (enabled) await mkdir(directory, { recursive: true });
  for (const action of actions) await action();
  // Agent files hold absolute paths into this machine's user store, so keep them out of git.
  if (enabled) await excludeLocally(teamAgents + "/les-*.md");
  console.log("Team " + (enabled ? "enabled" : "disabled") + " for Claude Code in " + teamAgents + ".");
}

async function doctor() {
  const root = userRoot();
  const statuses = [];
  let manifest;
  try {
    manifest = await readManifest(root);
    statuses.push(doctorLine("READY", "installation", "LES " + manifest.packageVersion + " at " + root));
  } catch {
    statuses.push(doctorLine("PENDING_USER_ACTION", "installation", "run npx -y @hakienit/les@latest"));
  }
  if (manifest) {
    const drift = await storeDrift(root, manifest);
    statuses.push(drift.length
      ? doctorLine("PENDING_USER_ACTION", "store-integrity", drift.length + " managed file(s) differ: " + drift.slice(0, 3).join(", ") + "; run les update")
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
      // Without the guard no hook injects the bootstrap or enforces the status footer; the agent alone must follow LES-AGENT.md.
      // Raw JSON escapes Windows separators as "\\", so allow repeated separators.
      const guardOn = /adapters[\\/]+claude-code[\\/]+guard\.mjs\\?"/u.test(await readFile(join(process.cwd(), guardHosts.claude.file), "utf8").catch(() => ""));
      statuses.push(guardOn
        ? doctorLine("READY", "guard", "Claude Code hooks inject the bootstrap and enforce the status footer")
        : doctorLine("FALLBACK", "guard", "off: nothing injects the bootstrap or enforces the status footer in Claude Code; run les guard on"));
    } catch {
      statuses.push(doctorLine("BLOCKED", "repository", "LES-AGENT.md is not LES-managed"));
    }
  } else {
    statuses.push(doctorLine("PENDING_USER_ACTION", "repository", "run les connect"));
  }
  statuses.push(doctorLine(spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0 ? "READY" : "FALLBACK", "git", "recommended project tool"));
  if (process.env.LES_PROVIDER) {
    const provider = process.env.LES_PROVIDER;
    const command = supportedProviders.find((entry) => entry.name === provider)?.command;
    if (!command || !await exists(adapterSourceFor(root, provider))) {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " has no compatible LES adapter"));
    } else if (!commandWorks(command)) {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " CLI is unavailable; host smoke evidence is pending"));
    } else {
      statuses.push(doctorLine("PENDING_USER_ACTION", "provider-adapter", provider + " requires instruction-loading and permission smoke-test evidence"));
    }
  }
  if (manifest) {
    try {
      const latest = await latestVersion(manifest.packageVersion);
      if (latest && isNewer(latest, manifest.packageVersion)) {
        statuses.push(doctorLine("UPDATE_AVAILABLE", "les", manifest.packageVersion + " -> " + latest + "; run les update"));
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
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "version")) {
    console.log(packageMetadata.version);
    process.exit(0);
  }
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    usage();
    process.exit(0);
  }
  const { command, options, args } = parseArgs(argv.length ? argv : ["install"]);
  const target = userRoot();
  if (command === "update") {
    // Run the latest published package: this copy only knows its own version.
    const npx = ["-y", packageMetadata.name + "@latest"];
    printPlan("update", target, ["run npx " + npx.join(" ")]);
    if (!options.dryRun) {
      const result = process.platform === "win32"
        ? spawnSync("npx " + npx.join(" "), { stdio: "inherit", shell: true })
        : spawnSync("npx", npx, { stdio: "inherit" });
      if (result.status !== 0) throw new Error("npx " + npx.join(" ") + " failed" + (result.error ? ": " + result.error.message : " with exit code " + result.status) + ".");
    }
  } else if (command === "install") {
    printPlan("install", target, ["copy the LES CLI and source into the user-local store"]);
    if (!options.dryRun) {
      await installUser(target, true);
      console.log("Installed " + packageMetadata.name + "@" + packageMetadata.version + " in " + target + ".");
      console.log("Next: run les connect in a repository.");
    }
  } else if (command === "init") {
    await init(options);
  } else if (command === "connect") {
    await connect(options);
  } else if (command === "guard") {
    await guard(await requireUserStore(), args[0] === "on", options, args[1] || "claude");
  } else if (command === "team") {
    await team(await requireUserStore(), args[0] === "on", options);
  } else if (command === "lint") {
    process.exitCode = await lint(args);
  } else {
    process.exitCode = await doctor();
  }
} catch (error) {
  console.error("[BLOCKED] " + error.message);
  process.exitCode = 2;
}
