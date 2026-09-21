import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "bin", "les.mjs");
const releaseVerifier = join(root, "bin", "verify-release.mjs");
const inventoryVerifier = join(root, "bin", "verify-inventory.mjs");

function run(args, cwd, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });
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

test("add, diff, and update preserve a managed repo installation", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-"));
  try {
    const preview = run(["add", "--scope", "repo", "--dry-run"], project);
    assert.equal(preview.status, 0, preview.stderr);
    const pending = run(["doctor", "--scope", "repo"], project);
    assert.equal(pending.status, 1);
    assert.match(pending.stdout, /PENDING_USER_ACTION.*installation/);

    const added = run(["add", "--scope", "repo"], project);
    assert.equal(added.status, 0, added.stderr);
    assert.equal(run(["add", "--scope", "repo"], project).status, 2);

    const installRoot = join(project, ".les-agents");
    const manifest = await readManifest(join(installRoot, "les-manifest.md"));
    assert.equal(manifest.packageName, "@hakienit/les");
    assert.equal(manifest.packageVersion, "1.0.0");
    assert.match(await readFile(join(project, ".gitignore"), "utf8"), /^\.les-agents\/?$/mu);
    assert.ok((await filesBelow(installRoot)).every((path) => path.endsWith(".md")));
    assert.equal(await access(join(installRoot, "bin")).then(() => true).catch(() => false), false);
    await rm(join(project, ".gitignore"));
    assert.equal(run(["update", "--scope", "repo"], project).status, 0);
    assert.match(await readFile(join(project, ".gitignore"), "utf8"), /^\.les-agents\/?$/mu);

    assert.equal(run(["adapter", "codex", "--scope", "repo", "--dry-run"], project).status, 0);
    assert.equal(run(["adapter", "codex", "--scope", "repo"], project).status, 0);
    assert.match(await readFile(join(project, "AGENTS.md"), "utf8"), /\.les-agents is the LES source of truth/);
    assert.match(await readFile(join(project, "AGENTS.md"), "utf8"), /adapters[/\\]codex[/\\]AGENTS\.md/);
    assert.deepEqual((await readManifest(join(installRoot, "les-manifest.md"))).adapters, ["codex"]);
    assert.equal(run(["adapter", "codex", "--scope", "repo"], project).status, 0);

    assert.equal(run(["diff", "--scope", "repo"], project).status, 0);
    assert.equal(run(["doctor", "--scope", "repo"], project).status, 0);
    const providerDoctor = run(["doctor", "--scope", "repo"], project, { LES_PROVIDER: "codex" });
    assert.equal(providerDoctor.status, 1);
    assert.match(providerDoctor.stdout, /PENDING_USER_ACTION.*provider-adapter/);
    await writeFile(join(installRoot, "policies", "principles.md"), "changed\n");
    const changed = run(["diff", "--scope", "repo"], project);
    assert.equal(changed.status, 1);
    assert.match(changed.stdout, /changed policies[/\\]principles\.md/);

    await writeFile(join(installRoot, "project-owned.txt"), "preserve\n");
    assert.equal(run(["update", "--scope", "repo"], project).status, 2);
    await rm(join(installRoot, "project-owned.txt"));

    const updated = run(["update", "--scope", "repo"], project);
    assert.equal(updated.status, 0, updated.stderr);
    assert.match(await readFile(join(installRoot, "policies", "principles.md"), "utf8"), /# Principles/);

    const backup = updated.stdout.match(/Backup: (.+)\n/)?.[1];
    assert.ok(backup);
    const rolledBack = run(["rollback", "--scope", "repo", "--backup", backup], project);
    assert.equal(rolledBack.status, 0, rolledBack.stderr);
    assert.equal(await readFile(join(installRoot, "policies", "principles.md"), "utf8"), "changed\n");
    assert.deepEqual((await readManifest(join(installRoot, "les-manifest.md"))).adapters, ["codex"]);
    assert.ok((await filesBelow(installRoot)).every((path) => path.endsWith(".md")));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("default install is repo-local and routing can be toggled per provider or all at once", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-routing-"));
  const globalHome = await mkdtemp(join(tmpdir(), "les-cli-routing-home-"));
  try {
    const env = { CODEX_HOME: join(globalHome, ".codex") };
    assert.equal(run([], project, env).status, 0);
    const localRun = (args) => run(args, project, env);
    assert.equal(localRun(["active", "codex"]).status, 0);
    assert.match(await readFile(join(project, "AGENTS.md"), "utf8"), /\.les-agents\/adapters\/codex\/AGENTS\.md/);
    assert.equal(await access(join(globalHome, ".codex", "AGENTS.md")).then(() => true).catch(() => false), false);

    assert.equal(localRun(["off"]).status, 0);
    assert.equal(await access(join(project, "AGENTS.md")).then(() => true).catch(() => false), false);
    await writeFile(join(project, ".les-agents", "policies", "principles.md"), "changed\n");
    assert.equal(localRun(["update"]).status, 0);
    assert.equal(localRun(["on"]).status, 0);
    assert.equal(await access(join(project, "AGENTS.md")).then(() => true).catch(() => false), true);

    await writeFile(join(project, "AGENTS.md"), "project owned\n");
    assert.equal(localRun(["off", "codex"]).status, 2);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(globalHome, { recursive: true, force: true });
  }
});

test("global scope uses XDG_CONFIG_HOME instead of a provider directory", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-project-"));
  const config = await mkdtemp(join(tmpdir(), "les-cli-config-"));
  const home = await mkdtemp(join(tmpdir(), "les-cli-home-"));
  try {
    const added = run(["add", "--scope", "global"], project, { XDG_CONFIG_HOME: config });
    assert.equal(added.status, 0, added.stderr);
    assert.equal((await readManifest(join(config, "les", "les-manifest.md"))).scope, "global");
    const adapter = run(["adapter", "codex", "--scope", "global"], project, { XDG_CONFIG_HOME: config, CODEX_HOME: join(home, ".codex") });
    assert.equal(adapter.status, 0, adapter.stderr);
    assert.match(await readFile(join(home, ".codex", "AGENTS.md"), "utf8"), /les[/\\]adapters[/\\]codex/);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(config, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("adapter refuses a pre-existing provider entrypoint", async () => {
  const project = await mkdtemp(join(tmpdir(), "les-cli-adapter-"));
  try {
    await writeFile(join(project, "GEMINI.md"), "project owned\n");
    assert.equal(run(["add", "--scope", "repo"], project).status, 0);
    const result = run(["adapter", "gemini-cli", "--scope", "repo"], project);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Collision/);
    assert.equal(await readFile(join(project, "GEMINI.md"), "utf8"), "project owned\n");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("update migrates a legacy installation to Markdown-only payload", async () => {
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

    const updated = run(["update", "--scope", "repo"], project);
    assert.equal(updated.status, 0, updated.stderr);
    assert.ok((await filesBelow(installRoot)).every((path) => path.endsWith(".md")));
    assert.equal(await access(join(installRoot, "les-manifest.json")).then(() => true).catch(() => false), false);
    assert.equal(await access(join(installRoot, "bin")).then(() => true).catch(() => false), false);
    assert.equal(await access(join(installRoot, "tools")).then(() => true).catch(() => false), false);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("package tarball is limited to public LES paths", () => {
  const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }));
  const allowed = ["bin/", "policies/", "skills/", "profiles/", "adapters/", "templates/", "tools/", "inventory.yaml", "routes.yaml", "README.md", "CHANGELOG.md", "LICENSE", "package.json"];
  for (const file of packed[0].files.map((entry) => entry.path)) {
    assert.ok(allowed.some((prefix) => file === prefix || file.startsWith(prefix)), "unexpected tarball file: " + file);
  }
});

test("CLI has no install hook or network fetch", async () => {
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const source = await readFile(cli, "utf8");
  assert.equal(packageJson.scripts.postinstall, undefined);
  assert.doesNotMatch(source, /fetch\(|https?:\/\/|npm install/);
});

test("release verification is local and passes the package boundary", () => {
  const result = spawnSync(process.execPath, [releaseVerifier], { cwd: root, encoding: "utf8" });
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
    assert.equal(manifest.bootstrap, "skills/bootstrap/SKILL.md");
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
