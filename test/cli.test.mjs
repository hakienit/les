import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, realpathSync, rmSync } from "node:fs";
import { access, appendFile, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "bin", "les.mjs");
const releaseVerifier = join(root, "bin", "verify-release.mjs");
const inventoryVerifier = join(root, "bin", "verify-inventory.mjs");
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

function run(args, cwd, env = {}, input) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, LES_UPDATE_CHECK: "0", ...env },
    input
  });
}

async function filesBelow(root, prefix = "") {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...await filesBelow(join(root, entry.name), path));
    else files.push(path);
  }
  return files;
}

async function readManifest(path) {
  const source = await readFile(path, "utf8");
  return JSON.parse(source.match(/```json\n([\s\S]*?)\n```/u)?.[1] || source);
}

test("user install, repo init, routing, and cached update notice work without repo source", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-user-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-home-"));
  const shellHome = await mkdtemp(join(tmpdir(), "les-cli-shell-home-"));
  const zshHome = await mkdtemp(join(tmpdir(), "les-cli-zsh-home-"));
  const powerShellBin = await mkdtemp(join(tmpdir(), "les-cli-powershell-bin-"));
  const powerShellProfile = join(shellHome, "Microsoft.PowerShell_profile.ps1");
  const cache = await mkdtemp(join(tmpdir(), "les-cli-cache-"));
  try {
    if (process.platform !== "win32") {
      await writeFile(join(powerShellBin, "pwsh"), "#!/bin/sh\nprintf '%s\\n' \"$POWERSHELL_PROFILE\"\n");
      await chmod(join(powerShellBin, "pwsh"), 0o755);
    }
    const env = {
      LES_HOME: home,
      HOME: shellHome,
      SHELL: "/bin/zsh",
      ZDOTDIR: zshHome,
      POWERSHELL_PROFILE: powerShellProfile,
      ...(process.platform !== "win32" ? { PATH: powerShellBin + ":/usr/bin:/bin" } : {}),
      LES_CACHE_HOME: cache,
      CODEX_HOME: join(project, "outside-codex"),
      ...(process.platform === "win32" ? { LES_DISABLE_PATH_SETUP: "1" } : {})
    };
    const installed = run([], project, env);
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal((await readManifest(join(home, "les-manifest.md"))).scope, "user");
    assert.equal((await readManifest(join(home, "les-manifest.md"))).packageVersion, packageMetadata.version);
    assert.ok(await access(join(home, "bin", "les.mjs")).then(() => true).catch(() => false));
    assert.ok(await access(join(home, "bin", "les.cmd")).then(() => true).catch(() => false));
    if (process.platform !== "win32") {
      const profile = await readFile(join(zshHome, ".zshrc"), "utf8");
      assert.match(profile, /LES user-local CLI/);
      assert.match(profile, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      const shell = spawnSync("sh", ["-c", ". \"$HOME/.profile\" && command -v les"], {
        cwd: project,
        encoding: "utf8",
        env: { ...process.env, ...env, PATH: "/usr/bin:/bin" }
      });
      assert.equal(shell.status, 0, shell.stderr);
      assert.equal(shell.stdout.trim(), join(home, "bin", "les"));
      const zsh = spawnSync("zsh", ["-lic", "command -v les"], {
        cwd: project,
        encoding: "utf8",
        env: { ...process.env, ...env, PATH: "/usr/bin:/bin" }
      });
      if (!zsh.error || zsh.error.code !== "ENOENT") {
        assert.equal(zsh.status, 0, zsh.stderr);
        assert.equal(zsh.stdout.trim(), join(home, "bin", "les"));
      }
      const powerShellProfileSource = await readFile(powerShellProfile, "utf8");
      assert.match(powerShellProfileSource, /\$env:Path/);
      assert.match(powerShellProfileSource, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.equal(await access(join(project, ".les-agents")).then(() => true).catch(() => false), false);

    const refreshed = run([], project, env);
    assert.equal(refreshed.status, 0, refreshed.stderr);
    assert.doesNotMatch(refreshed.stdout, /NOTICE/);
    assert.equal((refreshed.stdout.match(/Added LES to PATH/g) || []).length, 0);
    assert.equal(await access(join(shellHome, ".bashrc")).then(() => true).catch(() => false), false);
    assert.equal(await access(join(shellHome, ".config", "fish", "config.fish")).then(() => true).catch(() => false), false);
    await writeFile(join(home, "les-manifest.md"), (await readFile(join(home, "les-manifest.md"), "utf8")).replace(`"packageVersion": "${packageMetadata.version}"`, '"packageVersion": "1.0.0"'));
    await mkdir(join(home, "skills", "bootstrap"), { recursive: true });
    await writeFile(join(home, "skills", "bootstrap", "SKILL.md"), "legacy\n");
    const updated = run([], project, env);
    assert.equal(updated.status, 0, updated.stderr);
    assert.match(updated.stdout, /NOTICE: LES skill paths now use `skills\/les-\*`/);
    assert.ok(await access(join(home, "skills", "les-bootstrap", "SKILL.md")).then(() => true).catch(() => false));
    assert.equal(await access(join(home, "skills", "bootstrap")).then(() => true).catch(() => false), false);
    if (process.platform !== "win32") {
      assert.equal((await readFile(join(zshHome, ".zshrc"), "utf8")).match(/LES user-local CLI/g).length, 1);
    }

    assert.equal(run(["init"], project, env).status, 0);
    assert.match(await readFile(join(project, "LES-AGENT.md"), "utf8"), /~\/\.les-agents/);
    assert.match(run(["doctor"], project, env).stdout, /\[FALLBACK\] guard: off.*les connect/);
    const connected = run(["connect"], project, env);
    assert.equal(connected.status, 0, connected.stderr);
    assert.equal(await readFile(join(project, "AGENTS.md"), "utf8"), "# LES\n\n@./LES-AGENT.md\n");
    assert.equal(await access(join(project, "outside-codex", "AGENTS.md")).then(() => true).catch(() => false), false);
    assert.equal(run(["connect"], project, env).status, 0);
    assert.equal(run(["init"], project, env).status, 0);
    assert.match(run(["doctor"], project, env).stdout, /\[READY\] guard/);
    assert.equal(run(["doctor"], project, { ...env, LES_UPDATE_CHECK: "1", LES_LATEST_VERSION: "9.9.9" }).status, 0);
    assert.match(run(["doctor"], project, { ...env, LES_UPDATE_CHECK: "1", LES_LATEST_VERSION: "9.9.9" }).stdout, /UPDATE_AVAILABLE.*les/);
    const healthy = run(["doctor"], project, env).stdout;
    assert.match(healthy, /\[READY\] store-integrity/);
    assert.match(healthy, /\[READY\] bootstrap-pointer/);
    const agentSource = await readFile(join(project, "LES-AGENT.md"), "utf8");
    await writeFile(join(project, "LES-AGENT.md"), agentSource.replace("skills/les-bootstrap", "skills/bootstrap"));
    const stalePointer = run(["doctor"], project, env);
    assert.equal(stalePointer.status, 1);
    assert.match(stalePointer.stdout, /\[PENDING_USER_ACTION\] bootstrap-pointer.*skills\/bootstrap\/SKILL\.md/);
    await writeFile(join(project, "LES-AGENT.md"), agentSource);
    const policy = join(home, "policies", "principles.md");
    const original = await readFile(policy, "utf8");
    await writeFile(policy, original + "drift\n");
    assert.match(run(["doctor"], project, env).stdout, /\[PENDING_USER_ACTION\] store-integrity: 1 .*changed policies\/principles\.md/);
    await writeFile(policy, original);
    await writeFile(join(home, "les-manifest.md"), (await readFile(join(home, "les-manifest.md"), "utf8")).replace(`"packageVersion": "${packageMetadata.version}"`, '"packageVersion": "1.0.0"'));
    await mkdir(join(cache, "les"), { recursive: true });
    await writeFile(join(cache, "les", "update-check.json"), JSON.stringify({ checkedAt: Date.now(), latestVersion: "1.0.0" }) + "\n");
    const registryMock = "data:text/javascript," + encodeURIComponent("globalThis.fetch = async () => new Response(JSON.stringify({ version: '1.0.1' }), { status: 200, headers: { 'content-type': 'application/json' } });");
    const staleCacheCheck = spawnSync(process.execPath, ["--import", registryMock, cli, "doctor"], {
      cwd: project,
      encoding: "utf8",
      env: { ...env, LES_UPDATE_CHECK: "1" }
    });
    assert.match(staleCacheCheck.stdout, /UPDATE_AVAILABLE.*1\.0\.0 -> 1\.0\.1/);
    assert.ok((await filesBelow(project)).every((path) => path.endsWith(".md") || path.endsWith(".json")));
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(shellHome, { recursive: true, force: true });
    await rm(zshHome, { recursive: true, force: true });
    await rm(powerShellBin, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
  }
});

test("user install repairs a stale LES PATH snippet", async () => {
  if (process.platform === "win32") return;
  const project = await mkdtemp(join(tmpdir(), "les-cli-path-project-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-path-home-"));
  const shellHome = await mkdtemp(join(tmpdir(), "les-cli-path-shell-home-"));
  const staleBin = join(tmpdir(), "les-cli-stale-bin");
  try {
    const env = { LES_HOME: home, HOME: shellHome, LES_UPDATE_CHECK: "0" };
    assert.equal(run([], project, env).status, 0);
    await writeFile(join(shellHome, ".zshrc"), `# LES user-local CLI\nexport PATH='${staleBin}:$PATH'\n`);

    assert.equal(run([], project, env).status, 0);

    const profile = await readFile(join(shellHome, ".zshrc"), "utf8");
    assert.match(profile, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(profile, new RegExp(staleBin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(shellHome, { recursive: true, force: true });
  }
});

test("connect skips a project-owned provider entrypoint and connects the rest", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-adapter-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-adapter-home-"));
  try {
    const env = { LES_HOME: home, LES_DISABLE_PATH_SETUP: "1" };
    assert.equal(run([], project, env).status, 0);
    assert.equal(run(["init"], project, env).status, 0);
    await writeFile(join(project, "GEMINI.md"), "project owned\n");
    const result = run(["connect"], project, env);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Skipped gemini-cli/);
    assert.equal(await readFile(join(project, "GEMINI.md"), "utf8"), "project owned\n");
    assert.equal(await readFile(join(project, "AGENTS.md"), "utf8"), "# LES\n\n@./LES-AGENT.md\n");
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("connect links every provider and turns the guard on without being asked", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-connect-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-connect-home-"));
  try {
    const env = { LES_HOME: home, LES_DISABLE_PATH_SETUP: "1" };
    assert.equal(run([], project, env).status, 0);
    execFileSync("git", ["init", "-q"], { cwd: project });
    const stateOf = async () => JSON.parse((await readFile(join(project, "LES-AGENT.md"), "utf8"))
      .match(/<!-- LES-MANAGED\n([\s\S]*?)\n-->/u)[1]);
    const pointer = "# LES\n\n@./LES-AGENT.md\n";

    assert.equal(run(["connect", "--dry-run"], project, env).status, 0);
    assert.equal(await access(join(project, "LES-AGENT.md")).then(() => true).catch(() => false), false);
    assert.equal(await access(join(project, ".claude")).then(() => true).catch(() => false), false);
    assert.notEqual(run(["connect", "nope"], project, env).status, 0);

    const result = run(["connect"], project, env);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual((await stateOf()).activeProviders, ["antigravity", "claude-code", "codex", "gemini-cli"]);
    for (const file of ["AGENTS.md", "CLAUDE.md", "GEMINI.md"]) assert.equal(await readFile(join(project, file), "utf8"), pointer);
    assert.match(await readFile(join(project, ".agents", "agents", "les", "agent.md"), "utf8"), /@\.\.\/\.\.\/\.\.\/LES-AGENT\.md/);
    assert.equal(run(["connect"], project, env).status, 0);

    const script = join(home, "adapters", "claude-code", "guard.mjs");
    const claude = JSON.parse(await readFile(join(project, ".claude", "settings.local.json"), "utf8"));
    assert.equal(claude.hooks.PreToolUse.length, 1);
    assert.equal(claude.hooks.PreToolUse[0].hooks[0].command, `node "${script}"`);
    assert.equal(claude.hooks.PreToolUse[0].hooks[0].onFailure, "block");
    assert.equal(claude.hooks.Stop.length, 1);
    assert.equal(claude.hooks.Stop[0].hooks[0].command, `node "${script}" stop`);
    assert.equal(claude.hooks.SessionStart.length, 1);
    assert.equal(claude.hooks.SessionStart[0].hooks[0].command, `node "${script}" session-start`);
    const codex = JSON.parse(await readFile(join(project, ".codex", "hooks.json"), "utf8"));
    assert.deepEqual(codex.hooks.PreToolUse, [{ matcher: "Bash", hooks: [{ type: "command", command: `node "${script}" --no-gate` }] }]);
    assert.equal(codex.hooks.SessionStart[0].hooks[0].command, `node "${script}" --no-gate session-start`);
    const gemini = JSON.parse(await readFile(join(project, ".gemini", "settings.json"), "utf8"));
    assert.deepEqual(gemini.hooks.BeforeTool, [{ matcher: "run_shell_command|read_file", hooks: [{ type: "command", command: `node "${script}" --host gemini` }] }]);
    assert.equal(gemini.hooks.SessionStart[0].hooks[0].command, `node "${script}" --host gemini session-start`);

    const exclude = (await readFile(join(project, ".git", "info", "exclude"), "utf8")).split("\n");
    for (const entry of [".claude/settings.local.json", ".codex/hooks.json", ".gemini/settings.json"]) assert.equal(exclude.filter((line) => line === entry).length, 1, entry);
    const status = execFileSync("git", ["status", "--short"], { cwd: project, encoding: "utf8" });
    for (const hidden of [".claude", ".codex", ".gemini"]) assert.equal(status.includes(hidden), false, hidden);
    assert.match(run(["doctor"], project, env).stdout, /\[READY\] guard/);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("connect merges into existing settings without touching other hooks or settings", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-merge-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-merge-home-"));
  try {
    const env = { LES_HOME: home, LES_DISABLE_PATH_SETUP: "1" };
    assert.equal(run([], project, env).status, 0);
    const settings = join(project, ".claude", "settings.local.json");
    await mkdir(join(project, ".claude"), { recursive: true });
    const other = { matcher: "Edit", hooks: [{ type: "command", command: "true" }] };
    await writeFile(settings, JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { PreToolUse: [other] } }));
    await mkdir(join(project, ".gemini"), { recursive: true });
    await writeFile(join(project, ".gemini", "settings.json"), JSON.stringify({ theme: "dark" }));

    assert.equal(run(["connect"], project, env).status, 0);
    assert.equal(run(["connect"], project, env).status, 0);
    const merged = JSON.parse(await readFile(settings, "utf8"));
    assert.equal(merged.hooks.PreToolUse.length, 2);
    assert.deepEqual(merged.hooks.PreToolUse[0], other);
    assert.deepEqual(merged.permissions, { allow: ["Bash(ls)"] });
    assert.equal(JSON.parse(await readFile(join(project, ".gemini", "settings.json"), "utf8")).theme, "dark");

    await writeFile(settings, "{ nope");
    assert.notEqual(run(["connect"], project, env).status, 0);
    assert.equal(await readFile(settings, "utf8"), "{ nope");
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("update runs the latest published package through npx", async () => {
  if (process.platform === "win32") return;
  const bin = await mkdtemp(join(tmpdir(), "les-cli-npx-"));
  try {
    await writeFile(join(bin, "npx"), '#!/bin/sh\necho "$@" > "$NPX_LOG"\n[ -z "$NPX_FAIL" ]\n');
    await chmod(join(bin, "npx"), 0o755);
    const env = { PATH: bin + ":" + process.env.PATH, NPX_LOG: join(bin, "log") };
    assert.equal(run(["update", "--dry-run"], root, env).status, 0);
    assert.equal(await access(env.NPX_LOG).then(() => true).catch(() => false), false);
    assert.equal(run(["update"], root, env).status, 0);
    assert.equal((await readFile(env.NPX_LOG, "utf8")).trim(), "-y " + packageMetadata.name + "@latest");
    const failed = run(["update"], root, { ...env, NPX_FAIL: "1" });
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /npx .* failed/);
  } finally {
    await rm(bin, { recursive: true, force: true });
  }
});

test("version and status are available as commands", () => {
  assert.equal(run(["version"], root).stdout.trim(), packageMetadata.version);
  assert.equal(run(["--version"], root).stdout.trim(), packageMetadata.version);
  assert.match(run(["status"], root, { LES_HOME: join(tmpdir(), "les-cli-no-such-home") }).stdout, /\[PENDING_USER_ACTION\] installation/);
  for (const removed of ["on", "off", "add", "diff", "rollback"]) assert.notEqual(run([removed], root).status, 0, removed);
});

test("user install never writes provider home directories", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-isolation-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-isolation-home-"));
  const providerHome = await mkdtemp(join(tmpdir(), "les-cli-provider-home-"));
  try {
    const env = { LES_HOME: home, CODEX_HOME: join(providerHome, ".codex"), LES_DISABLE_PATH_SETUP: "1" };
    assert.equal(run([], project, env).status, 0);
    assert.equal(run(["init"], project, env).status, 0);
    assert.equal(run(["connect"], project, env).status, 0);
    assert.equal(await access(join(providerHome, ".codex", "AGENTS.md")).then(() => true).catch(() => false), false);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(providerHome, { recursive: true, force: true });
  }
});

test("package tarball is limited to public LES paths", () => {
  const packed = JSON.parse(execFileSync("npm pack --dry-run --json --ignore-scripts", {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, NPM_CONFIG_CACHE: join(tmpdir(), "les-npm-cache") }
  }));
  const allowed = ["bin/", "policies/", "skills/", "profiles/", "adapters/", "templates/", "tools/", "inventory.yaml", "routes.yaml", "README.md", "CHANGELOG.md", "LICENSE", "package.json"];
  for (const file of Object.values(packed)[0].files.map((entry) => entry.path)) {
    assert.ok(allowed.some((prefix) => file === prefix || file.startsWith(prefix)), "unexpected tarball file: " + file);
  }
});

test("CLI has no install hook and only checks the network from doctor", async () => {
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const source = await readFile(cli, "utf8");
  assert.equal(packageJson.scripts.postinstall, undefined);
  assert.match(source, /fetch\(/);
  assert.doesNotMatch(source, /npm install/);
});

test("release verification is local and passes the package boundary", () => {
  const result = spawnSync(process.execPath, [releaseVerifier], { cwd: root, encoding: "utf8", env: { ...process.env, NPM_CONFIG_CACHE: join(tmpdir(), "les-npm-cache") } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release verification passed/);
});

test("inventory validates the complete public LES contract", () => {
  const result = spawnSync(process.execPath, [inventoryVerifier], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Inventory verification passed/);
});

test("every adapter declares the canonical bootstrap and skill root", async () => {
  for (const provider of ["codex", "claude-code", "gemini-cli", "antigravity"]) {
    const manifest = JSON.parse(await readFile(join(root, "adapters", provider, "adapter.json"), "utf8"));
    assert.equal(manifest.skillRoot, "skills");
    assert.equal(manifest.bootstrap, "skills/les-bootstrap/SKILL.md");
  }
});

test("skill catalog exposes the approved operational entrypoints", async () => {
  const inventory = JSON.parse(await readFile(join(root, "inventory.yaml"), "utf8"));
  const expected = inventory.skills.map((skill) => skill.name).sort();
  const names = [];
  const loaded = new Set();
  for (const skill of inventory.skills) {
    const source = await readFile(join(root, skill.path), "utf8");
    names.push(source.match(/^name:\s*(.+)$/mu)?.[1]);
    for (const dependency of JSON.parse(source.match(/^loads:\s*(\[.*\])$/mu)?.[1] || "[]")) {
      loaded.add(resolve(join(root, skill.path, ".."), dependency).slice(root.length + 1).split(sep).join("/"));
    }
  }
  assert.deepEqual(names.sort(), expected);
  for (const workflow of inventory.workflows) assert.ok(loaded.has(workflow), "orphan workflow: " + workflow);
});

test("lint flags placeholders and acceptance criteria without an observable check", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-lint-"));
  try {
    await writeFile(join(project, "bad.md"), "# Spec\n\nTBD owner.\n\n## Acceptance criteria\n\n- The page loads fast.\n- It works for users.\n- `les lint` exits 1 on a finding.\n\n```\nTODO in code is ignored\n```\n");
    await writeFile(join(project, "good.md"), "# Spec\n\n## Done when\n\n1. `les doctor` returns exit code 0.\n");
    await writeFile(join(project, "none.md"), "# Notes\n\nNothing here.\n");

    const bad = run(["lint", "bad.md"], project);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /bad\.md:3: \[placeholder\]/);
    assert.match(bad.stdout, /bad\.md:7: \[vague\] "fast"/);
    assert.match(bad.stdout, /bad\.md:8: \[unverifiable\]/);
    assert.doesNotMatch(bad.stdout, /bad\.md:9/);
    assert.doesNotMatch(bad.stdout, /bad\.md:12/);
    assert.equal(run(["lint", "good.md"], project).status, 0);
    assert.match(run(["lint", "none.md"], project).stdout, /\[missing\]/);
    assert.notEqual(run(["lint"], project).status, 0);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

const guardScript = join(root, "adapters", "claude-code", "guard.mjs");
function guardRun(call, project, script = guardScript) {
  return spawnSync(process.execPath, [script], { encoding: "utf8", input: JSON.stringify(call), env: { ...process.env, HOME: "/home/tester", CLAUDE_PROJECT_DIR: project } });
}
const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

test("guard blocks secret reads, deletes outside the project, and protected force pushes", () => {
  const project = "/work/app";
  for (const call of [
    bash("cat .env"), bash("grep KEY ~/.ssh/id_ed25519"), bash("FOO=1 head -n1 .env.local"),
    { tool_name: "Read", tool_input: { file_path: "/work/app/.env" } },
    bash("rm -rf /"), bash("rm -rf ~"), bash("rm -rf ../other"), bash("cd x && rm -rf $TARGET"), bash("find / -name x -delete"),
    bash("git push --force origin main"), bash("git push -f"), bash("git push origin +master")
  ]) assert.equal(guardRun(call, project).status, 2, JSON.stringify(call));
  for (const call of [
    bash("cat .env.example"), bash("echo .env >> .gitignore"), bash("rm -rf node_modules dist/*"), bash("rm ./tmp/a.txt"),
    bash("git push origin feature/x"), bash("git push --force-with-lease origin feature/x"), bash("ls -la"),
    { tool_name: "Read", tool_input: { file_path: "/work/app/src/index.ts" } }
  ]) assert.equal(guardRun(call, project).status, 0, JSON.stringify(call));
  assert.equal(spawnSync(process.execPath, [guardScript], { input: "not json" }).status, 0);
});

test("session-start injects the bootstrap under the hook cap and counts it as read", async () => {
  const session_id = "les-inject-" + process.pid;
  const out = spawnSync(process.execPath, [guardScript, "session-start"], { encoding: "utf8", input: JSON.stringify({ session_id }) }).stdout;
  assert.ok(out.length < 10000, String(out.length));
  assert.ok(out.includes("Human authority") && out.includes("Terminal statuses") && out.includes("# LES Bootstrap"));
  assert.ok(!out.includes("loads: ["), "front matter must not be injected");
  assert.equal(guardRun({ session_id, tool_name: "Edit", tool_input: { file_path: "/work/app/a.ts" } }, "/work/app").status, 0);
  spawnSync(process.execPath, [guardScript, "session-start"], { input: JSON.stringify({ session_id }) });
  rmSync(join(tmpdir(), "les-bootstrap-" + session_id), { force: true });
});

test("guard blocks Edit, Write, and Bash until every bootstrap file is read when the bootstrap exceeds the hook cap", async () => {
  const project = "/work/app";
  const session_id = "les-gate-" + process.pid;
  // A copy of the bootstrap whose policies no longer fit the cap, so session-start falls back to the read list.
  const store = realpathSync(await mkdtemp(join(tmpdir(), "les-cli-bloat-")));
  for (const dir of [["adapters", "claude-code"], ["skills", "les-bootstrap"], ["policies"]]) cpSync(join(root, ...dir), join(store, ...dir), { recursive: true });
  await appendFile(join(store, "policies", "principles.md"), "\n" + "padding ".repeat(1300));
  const script = join(store, "adapters", "claude-code", "guard.mjs");
  const call = (extra) => guardRun({ session_id, ...extra }, project, script).status;
  const edit = { tool_name: "Edit", tool_input: { file_path: "/work/app/a.ts" } };
  const readOf = (file_path) => ({ tool_name: "Read", tool_input: { file_path } });
  const reset = () => spawnSync(process.execPath, [script, "session-start"], { input: JSON.stringify({ session_id }) });
  const skill = join(store, "skills", "les-bootstrap", "SKILL.md");
  const loads = JSON.parse(/^loads: (\[.*\])$/mu.exec(await readFile(skill, "utf8"))[1]);
  const required = [join(store, "adapters", "claude-code", "CLAUDE.md"), skill, ...loads.map((path) => resolve(store, "skills", "les-bootstrap", path))];
  const readAll = () => required.forEach((file) => assert.equal(call(readOf(file)), 0));
  assert.ok(spawnSync(process.execPath, [script, "session-start"], { encoding: "utf8" }).stdout.includes("read every file in this list"), "fallback expected");
  reset();
  assert.equal(call(edit), 2);
  assert.equal(call(bash("ls")), 2);
  assert.equal(call({ tool_name: "Write", tool_input: { file_path: "/work/app/b.ts" } }), 2);
  assert.equal(call(readOf("/work/app/src/index.ts")), 0);
  assert.equal(call(edit), 2);
  for (const file of required.slice(0, -1)) assert.equal(call(readOf(file)), 0);
  const blocked = guardRun({ session_id, ...edit }, project, script);
  assert.equal(blocked.status, 2);
  assert.ok(blocked.stderr.includes(required.at(-1)), blocked.stderr);
  assert.equal(call(readOf(required.at(-1))), 0);
  assert.equal(call(edit), 0);
  assert.equal(call(bash("ls")), 0);
  reset();
  assert.equal(call(edit), 2);
  readAll();
  assert.equal(call(edit), 0);
  assert.equal(guardRun(edit, project, script).status, 0);
  reset();
  await rm(store, { recursive: true, force: true });
});

test("session-start warns instead of staying silent when the bootstrap loads line is unreadable", async () => {
  const store = realpathSync(await mkdtemp(join(tmpdir(), "les-cli-broken-")));
  for (const dir of [["adapters", "claude-code"], ["skills", "les-bootstrap"], ["policies"]]) cpSync(join(root, ...dir), join(store, ...dir), { recursive: true });
  const skill = join(store, "skills", "les-bootstrap", "SKILL.md");
  await writeFile(skill, (await readFile(skill, "utf8")).replace(/^loads: .*$/mu, "loads: broken"));
  const out = spawnSync(process.execPath, [join(store, "adapters", "claude-code", "guard.mjs"), "session-start"], { encoding: "utf8" });
  assert.equal(out.status, 0);
  assert.ok(out.stdout.includes("LES guard warning"), out.stdout);
  await rm(store, { recursive: true, force: true });
});

test("guard stop sends a task reply back once when the LES status footer is missing or inconsistent", () => {
  const session_id = "les-stop-" + process.pid;
  const stop = (extra) => spawnSync(process.execPath, [guardScript, "stop"], { encoding: "utf8", input: JSON.stringify({ session_id, ...extra }) });
  const work = () => guardRun({ session_id, ...bash("ls") }, "/work/app");
  const done = "Done.\n\nLES status: COMPLETE\nSession: CLOSEABLE\nNext safe action: none";
  assert.equal(stop({ last_assistant_message: "hello" }).status, 0, "chat turns are left alone");
  work();
  const missing = stop({ last_assistant_message: "Done." });
  assert.equal(missing.status, 2);
  assert.ok(missing.stderr.includes("LES status footer"), missing.stderr);
  assert.equal(stop({ last_assistant_message: "Done." }).status, 0, "marker is cleared after each Stop");
  work();
  assert.equal(stop({ last_assistant_message: "Done.", stop_hook_active: true }).status, 0, "never loops");
  work();
  assert.equal(stop({ last_assistant_message: done }).status, 0);
  work();
  assert.equal(stop({ last_assistant_message: done.replace("CLOSEABLE", "KEEP_OPEN") }).status, 2, "COMPLETE must be CLOSEABLE");
  work();
  assert.equal(stop({ last_assistant_message: "x\nLES status: BLOCKED\nSession: KEEP_OPEN\nNext safe action: ask" }).status, 0);
});

test("guard --host gemini maps Gemini tool names to the same verdicts and emits SessionStart context as JSON", () => {
  const gemini = (tool_name, tool_input) => spawnSync(process.execPath, [guardScript, "--host", "gemini"], { encoding: "utf8", input: JSON.stringify({ session_id: "gemini-" + process.pid, cwd: "/work/app", tool_name, tool_input }), env: { ...process.env, HOME: "/home/tester", CLAUDE_PROJECT_DIR: "/work/app" } }).status;
  for (const command of ["cat .env", "rm -rf ../other", "git push --force origin main"]) assert.equal(gemini("run_shell_command", { command }), 2, command);
  assert.equal(gemini("read_file", { file_path: "/work/app/.env" }), 2);
  for (const command of ["ls -la", "git push origin feature/x"]) assert.equal(gemini("run_shell_command", { command }), 0, command);
  assert.equal(gemini("read_file", { file_path: "/work/app/src/index.ts" }), 0);
  assert.equal(gemini("write_file", { file_path: "/work/app/a.ts", content: "" }), 0);
  const out = JSON.parse(spawnSync(process.execPath, [guardScript, "session-start", "--host", "gemini"], { encoding: "utf8" }).stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.ok(out.hookSpecificOutput.additionalContext.includes("Human authority"));
});

test("guard --no-gate (Codex) blocks risky Bash like Claude Code but never gates on bootstrap reads", () => {
  const codex = (call) => spawnSync(process.execPath, [guardScript, "--no-gate"], { encoding: "utf8", input: JSON.stringify({ session_id: "codex-" + process.pid, cwd: "/work/app", ...call }), env: { ...process.env, HOME: "/home/tester", CLAUDE_PROJECT_DIR: "/work/app" } }).status;
  for (const command of ["cat .env", "rm -rf ../other", "git push --force origin main"]) assert.equal(codex(bash(command)), 2, command);
  for (const command of ["ls -la", "git push origin feature/x"]) assert.equal(codex(bash(command)), 0, command);
  assert.equal(codex({ tool_name: "apply_patch", tool_input: { command: "*** Begin Patch" } }), 0);
  const out = spawnSync(process.execPath, [guardScript, "session-start", "--no-gate"], { encoding: "utf8" }).stdout;
  assert.ok(out.includes("status footer") && !out.includes("are blocked until"));
});

test("connect writes one subagent per department without touching user agents", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-team-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-team-home-"));
  try {
    const env = { LES_HOME: home, LES_DISABLE_PATH_SETUP: "1" };
    assert.equal(run([], project, env).status, 0);
    execFileSync("git", ["init", "-q"], { cwd: project });
    const agents = join(project, ".claude", "agents");
    await mkdir(agents, { recursive: true });
    await writeFile(join(agents, "les-review.md"), "mine");
    await writeFile(join(agents, "other.md"), "other");
    const departments = JSON.parse(await readFile(join(root, "inventory.yaml"), "utf8")).departments.filter((department) => department.id !== "lead");

    assert.equal(run(["connect", "--dry-run"], project, env).status, 0);
    assert.deepEqual((await readdir(agents)).sort(), ["les-review.md", "other.md"]);
    assert.equal(run(["connect"], project, env).status, 0);
    assert.equal(run(["connect"], project, env).status, 0);
    assert.equal(await readFile(join(agents, "les-review.md"), "utf8"), "mine");
    assert.equal((await readdir(agents)).length, departments.length + 1);
    const engineering = await readFile(join(agents, "les-engineering.md"), "utf8");
    assert.match(engineering, /^---\nname: les-engineering\n/u);
    assert.match(engineering, /\nmodel: sonnet\n/u);
    assert.doesNotMatch(engineering, /\ntools:/u);
    assert.ok(engineering.includes(join(home, "skills", "les-feature-delivery", "SKILL.md")));
    const scout = await readFile(join(agents, "les-scout.md"), "utf8");
    assert.match(scout, /\nmodel: haiku\ntools: Read, Grep, Glob, Bash\n---\n/u);
    assert.match(scout, /read-only/u);
    assert.match(await readFile(join(agents, "les-security.md"), "utf8"), /\nmodel: opus\n/u);
    const exclude = (await readFile(join(project, ".git", "info", "exclude"), "utf8")).split("\n");
    assert.equal(exclude.filter((line) => line === ".claude/agents/les-*.md").length, 1);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("team on and off manage one subagent per department without touching user agents", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-team-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-team-home-"));
  try {
    const env = { LES_HOME: home, LES_DISABLE_PATH_SETUP: "1" };
    assert.equal(run([], project, env).status, 0);
    execFileSync("git", ["init", "-q"], { cwd: project });
    const agents = join(project, ".claude", "agents");
    await mkdir(agents, { recursive: true });
    await writeFile(join(agents, "les-review.md"), "mine");
    await writeFile(join(agents, "other.md"), "other");
    const departments = JSON.parse(await readFile(join(root, "inventory.yaml"), "utf8")).departments.filter((department) => department.id !== "lead");

    assert.equal(run(["team", "on", "--dry-run"], project, env).status, 0);
    assert.deepEqual((await readdir(agents)).sort(), ["les-review.md", "other.md"]);
    assert.equal(run(["team", "on"], project, env).status, 0);
    assert.equal(run(["team", "on"], project, env).status, 0);
    assert.equal(await readFile(join(agents, "les-review.md"), "utf8"), "mine");
    assert.equal((await readdir(agents)).length, departments.length + 1);
    const engineering = await readFile(join(agents, "les-engineering.md"), "utf8");
    assert.match(engineering, /^---\nname: les-engineering\n/u);
    assert.match(engineering, /\nmodel: sonnet\n/u);
    assert.doesNotMatch(engineering, /\ntools:/u);
    assert.ok(engineering.includes(join(home, "skills", "les-feature-delivery", "SKILL.md")));
    const scout = await readFile(join(agents, "les-scout.md"), "utf8");
    assert.match(scout, /\nmodel: haiku\ntools: Read, Grep, Glob, Bash\n---\n/u);
    assert.match(scout, /read-only/u);
    assert.match(await readFile(join(agents, "les-security.md"), "utf8"), /\nmodel: opus\n/u);
    const exclude = (await readFile(join(project, ".git", "info", "exclude"), "utf8")).split("\n");
    assert.equal(exclude.filter((line) => line === ".claude/agents/les-*.md").length, 1);

    assert.equal(run(["team", "off"], project, env).status, 0);
    assert.deepEqual((await readdir(agents)).sort(), ["les-review.md", "other.md"]);
    assert.notEqual(run(["team"], project, env).status, 0);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("guard on and off merge into settings.local.json without touching other hooks", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-guard-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-guard-home-"));
  try {
    const env = { LES_HOME: home, LES_DISABLE_PATH_SETUP: "1" };
    assert.equal(run([], project, env).status, 0);
    execFileSync("git", ["init", "-q"], { cwd: project });
    const settings = join(project, ".claude", "settings.local.json");
    await mkdir(join(project, ".claude"), { recursive: true });
    const other = { matcher: "Edit", hooks: [{ type: "command", command: "true" }] };
    await writeFile(settings, JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { PreToolUse: [other] } }));

    assert.equal(run(["guard", "on", "--dry-run"], project, env).status, 0);
    assert.deepEqual(JSON.parse(await readFile(settings, "utf8")).hooks.PreToolUse, [other]);
    assert.equal(run(["guard", "on"], project, env).status, 0);
    assert.equal(run(["guard", "on"], project, env).status, 0);
    const on = JSON.parse(await readFile(settings, "utf8"));
    assert.equal(on.hooks.PreToolUse.length, 2);
    assert.deepEqual(on.permissions, { allow: ["Bash(ls)"] });
    const exclude = (await readFile(join(project, ".git", "info", "exclude"), "utf8")).split("\n");
    assert.equal(exclude.filter((line) => line === ".claude/settings.local.json").length, 1);
    assert.equal(execFileSync("git", ["status", "--short"], { cwd: project, encoding: "utf8" }).includes(".claude"), false);
    assert.equal(on.hooks.PreToolUse[1].hooks[0].command, `node "${join(home, "adapters", "claude-code", "guard.mjs")}"`);
    assert.equal(on.hooks.PreToolUse[1].hooks[0].onFailure, "block");
    assert.equal(on.hooks.Stop[0].hooks[0].onFailure, undefined, "Stop hooks ignore onFailure");
    assert.equal(on.hooks.Stop.length, 1);
    assert.equal(on.hooks.Stop[0].hooks[0].command, `node "${join(home, "adapters", "claude-code", "guard.mjs")}" stop`);
    assert.equal(on.hooks.SessionStart.length, 1);
    assert.equal(on.hooks.SessionStart[0].hooks[0].command, `node "${join(home, "adapters", "claude-code", "guard.mjs")}" session-start`);
    assert.equal(run(["init"], project, env).status, 0);
    assert.match(run(["doctor"], project, env).stdout, /\[READY\] guard/);

    assert.equal(run(["guard", "off"], project, env).status, 0);
    const offDoctor = run(["doctor"], project, env);
    assert.match(offDoctor.stdout, /\[FALLBACK\] guard: off.*les connect/);
    assert.equal(offDoctor.status, 0, "guard off is a warning, not a failure");
    const off = JSON.parse(await readFile(settings, "utf8"));
    assert.deepEqual(off.hooks.PreToolUse, [other]);
    assert.equal(off.hooks.SessionStart, undefined);
    assert.equal(off.hooks.Stop, undefined);

    const codexHooks = join(project, ".codex", "hooks.json");
    const script = join(home, "adapters", "claude-code", "guard.mjs");
    assert.equal(run(["guard", "on", "codex"], project, env).status, 0);
    const codexOn = JSON.parse(await readFile(codexHooks, "utf8"));
    assert.deepEqual(codexOn.hooks.PreToolUse, [{ matcher: "Bash", hooks: [{ type: "command", command: `node "${script}" --no-gate` }] }]);
    assert.equal(codexOn.hooks.SessionStart[0].hooks[0].command, `node "${script}" --no-gate session-start`);
    assert.equal(execFileSync("git", ["status", "--short"], { cwd: project, encoding: "utf8" }).includes(".codex"), false);
    assert.equal(run(["guard", "off", "codex"], project, env).status, 0);
    assert.deepEqual(JSON.parse(await readFile(codexHooks, "utf8")), {});
    const geminiSettings = join(project, ".gemini", "settings.json");
    await mkdir(join(project, ".gemini"), { recursive: true });
    await writeFile(geminiSettings, JSON.stringify({ theme: "dark" }));
    assert.equal(run(["guard", "on", "gemini"], project, env).status, 0);
    const geminiOn = JSON.parse(await readFile(geminiSettings, "utf8"));
    assert.equal(geminiOn.theme, "dark");
    assert.deepEqual(geminiOn.hooks.BeforeTool, [{ matcher: "run_shell_command|read_file", hooks: [{ type: "command", command: `node "${script}" --host gemini` }] }]);
    assert.equal(geminiOn.hooks.SessionStart[0].hooks[0].command, `node "${script}" --host gemini session-start`);
    assert.equal(run(["guard", "off", "gemini"], project, env).status, 0);
    assert.deepEqual(JSON.parse(await readFile(geminiSettings, "utf8")), { theme: "dark" });
    assert.notEqual(run(["guard", "on", "antigravity"], project, env).status, 0);
    assert.notEqual(run(["guard"], project, env).status, 0);
    await writeFile(settings, "{ nope");
    assert.notEqual(run(["guard", "on"], project, env).status, 0);
    assert.equal(await readFile(settings, "utf8"), "{ nope");
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
