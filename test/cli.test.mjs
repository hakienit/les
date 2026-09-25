import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
    assert.match(refreshed.stdout, /NOTICE: LES skill paths now use `skills\/les-\*`/);
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
    assert.equal(run(["active", "codex"], project, env).status, 0);
    assert.equal(await readFile(join(project, "AGENTS.md"), "utf8"), "# LES\n\n@./LES-AGENT.md\n");
    assert.equal(await access(join(project, "outside-codex", "AGENTS.md")).then(() => true).catch(() => false), false);
    assert.equal(run(["off"], project, env).status, 0);
    assert.equal(await access(join(project, "AGENTS.md")).then(() => true).catch(() => false), false);
    assert.equal(run(["on"], project, env).status, 0);
    assert.equal(run(["init"], project, env).status, 0);
    assert.equal(run(["doctor"], project, { ...env, LES_UPDATE_CHECK: "1", LES_LATEST_VERSION: "9.9.9" }).status, 0);
    assert.match(run(["doctor"], project, { ...env, LES_UPDATE_CHECK: "1", LES_LATEST_VERSION: "9.9.9" }).stdout, /UPDATE_AVAILABLE.*les/);
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
    assert.ok((await filesBelow(project)).every((path) => path.endsWith(".md")));
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

test("active preserves a project-owned provider entrypoint", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-adapter-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-adapter-home-"));
  try {
    const env = { LES_HOME: home };
    assert.equal(run([], project, env).status, 0);
    assert.equal(run(["init"], project, env).status, 0);
    await writeFile(join(project, "GEMINI.md"), "project owned\n");
    const result = run(["active", "gemini-cli"], project, env);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Collision/);
    assert.equal(await readFile(join(project, "GEMINI.md"), "utf8"), "project owned\n");
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("connect discovers available CLIs and selects connected/default-on providers", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-connect-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-connect-home-"));
  const cliBin = await mkdtemp(join(tmpdir(), "les-cli-connect-bin-"));
  try {
    for (const provider of ["codex", "gemini"]) {
      const command = join(cliBin, provider);
      await writeFile(command, "#!/bin/sh\nexit 0\n");
      await chmod(command, 0o755);
    }
    const env = { LES_HOME: home, PATH: cliBin };
    assert.equal(run([], project, env).status, 0);
    assert.equal(run(["init"], project, env).status, 0);

    const result = run(["connect"], project, env, " \r \x1b[B \r");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Select all/);
    const state = JSON.parse((await readFile(join(project, "LES-AGENT.md"), "utf8"))
      .match(/<!-- LES-MANAGED\n([\s\S]*?)\n-->/u)[1]);
    assert.deepEqual(state.configuredProviders, ["codex", "gemini-cli"]);
    assert.deepEqual(state.activeProviders, ["codex"]);
    assert.equal(await readFile(join(project, "AGENTS.md"), "utf8"), "# LES\n\n@./LES-AGENT.md\n");
    assert.equal(await access(join(project, "GEMINI.md")).then(() => true).catch(() => false), false);
    assert.equal(run(["on", "gemini-cli"], project, env).status, 0);
    assert.equal(await readFile(join(project, "GEMINI.md"), "utf8"), "# LES\n\n@./LES-AGENT.md\n");
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(cliBin, { recursive: true, force: true });
  }
});

test("legacy add, diff, and update preserve a Markdown-only repo installation", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-legacy-"));
  try {
    assert.equal(run(["add", "--scope", "repo"], project).status, 0);
    const installRoot = join(project, ".les-agents");
    const manifest = await readManifest(join(installRoot, "les-manifest.md"));
    assert.equal(manifest.scope, "repo");
    assert.match(await readFile(join(project, ".gitignore"), "utf8"), /^\.les-agents\/?$/mu);
    assert.ok((await filesBelow(installRoot)).every((path) => path.endsWith(".md")));
    assert.equal(run(["add", "--scope", "repo"], project).status, 2);
    await writeFile(join(installRoot, "policies", "principles.md"), "changed\n");
    assert.equal(run(["diff", "--scope", "repo"], project).status, 1);
    assert.equal(run(["update", "--scope", "repo"], project).status, 0);
    assert.match(await readFile(join(installRoot, "policies", "principles.md"), "utf8"), /# Principles/);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("legacy update migrates a full repo payload to Markdown-only", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-migration-"));
  const installRoot = join(project, ".les-agents");
  try {
    await mkdir(join(installRoot, "policies"), { recursive: true });
    await mkdir(join(installRoot, "bin"), { recursive: true });
    await mkdir(join(installRoot, "tools"), { recursive: true });
    await writeFile(join(installRoot, "policies", "principles.md"), "legacy\n");
    await writeFile(join(installRoot, "bin", "les.mjs"), "legacy source\n");
    await writeFile(join(installRoot, "tools", "old.mjs"), "legacy source\n");
    await writeFile(join(installRoot, "les-manifest.json"), JSON.stringify({
      manifestVersion: 1,
      packageName: "@hakienit/les",
      packageVersion: "0.1.0",
      scope: "repo",
      managed: [
        { path: "policies/principles.md", sha256: "legacy" },
        { path: "bin/les.mjs", sha256: "legacy" },
        { path: "tools/old.mjs", sha256: "legacy" }
      ],
      adapters: [],
      configuredAdapters: []
    }) + "\n");
    assert.equal(run(["update", "--scope", "repo"], project).status, 0);
    assert.ok((await filesBelow(installRoot)).every((path) => path.endsWith(".md")));
    assert.equal(await access(join(installRoot, "bin")).then(() => true).catch(() => false), false);
    assert.equal(await access(join(installRoot, "tools")).then(() => true).catch(() => false), false);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("user install never writes provider home directories", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-isolation-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-isolation-home-"));
  const providerHome = await mkdtemp(join(tmpdir(), "les-cli-provider-home-"));
  try {
    const env = { LES_HOME: home, CODEX_HOME: join(providerHome, ".codex") };
    assert.equal(run([], project, env).status, 0);
    assert.equal(run(["init"], project, env).status, 0);
    assert.equal(run(["active", "codex"], project, env).status, 0);
    assert.equal(await access(join(providerHome, ".codex", "AGENTS.md")).then(() => true).catch(() => false), false);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(providerHome, { recursive: true, force: true });
  }
});

test("package tarball is limited to public LES paths", () => {
  const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NPM_CONFIG_CACHE: join(tmpdir(), "les-npm-cache") }
  }));
  const allowed = ["bin/", "policies/", "skills/", "profiles/", "adapters/", "templates/", "tools/", "inventory.yaml", "routes.yaml", "README.md", "CHANGELOG.md", "LICENSE", "package.json"];
  for (const file of packed[0].files.map((entry) => entry.path)) {
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
      loaded.add(resolve(join(root, skill.path, ".."), dependency).slice(root.length + 1));
    }
  }
  assert.deepEqual(names.sort(), expected);
  for (const workflow of inventory.workflows) assert.ok(loaded.has(workflow), "orphan workflow: " + workflow);
});
