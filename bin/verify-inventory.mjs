#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(await readFile(join(root, "inventory.yaml"), "utf8"));
const routes = JSON.parse(await readFile(join(root, inventory.routes), "utf8"));
const publicRoots = ["bin", "policies", "skills", "profiles", "adapters", "templates", "tools"];
const rootFiles = ["package.json", "README.md", "CHANGELOG.md", "LICENSE", "inventory.yaml", "routes.yaml"];
const providers = ["codex", "claude-code", "gemini-cli", "antigravity"];
const failures = [];
const fail = (message) => failures.push(message);

async function walk(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) result.push(...await walk(child));
    else result.push(relative(root, child));
  }
  return result;
}

function frontmatter(source) {
  const body = source.match(/^---\n([\s\S]*?)\n---/u)?.[1] || "";
  return Object.fromEntries(body.split("\n").map((line) => line.match(/^([\w-]+):\s*(.+)$/u)).filter(Boolean).map((match) => [match[1], match[2]]));
}

if (inventory.inventoryVersion !== 1) fail("unsupported inventory version");
const declared = inventory.files || [];
if (new Set(declared).size !== declared.length) fail("duplicate public file entry");
for (const path of declared) try { await access(join(root, path)); } catch { fail("missing registered path: " + path); }
const actual = [...rootFiles];
for (const path of publicRoots) actual.push(...await walk(join(root, path)));
for (const path of actual) if (!declared.includes(path)) fail("unregistered public path: " + path);
for (const path of declared) if (!actual.includes(path)) fail("registered path is outside the public payload: " + path);

if (inventory.rules?.length !== 14) fail("rule registry must contain 14 capabilities");
for (const rule of inventory.rules || []) for (const field of ["name", "owner", "status", "activation", "path"]) if (!rule[field]) fail("rule metadata missing " + field);
if (inventory.workflows?.length !== 10) fail("workflow registry must contain 10 workflows");
for (const workflow of inventory.workflows || []) {
  const source = await readFile(join(root, workflow), "utf8");
  for (const label of ["Trigger", "Inputs", "Procedure", "Done when", "Risk and approval", "Output artifact", "Terminal statuses", "Verification evidence", "Recovery"]) if (!source.includes(`**${label}:**`)) fail(`${workflow} missing workflow contract field: ${label}`);
}

const names = new Set();
const descriptions = new Set();
const loadedWorkflows = new Set();
const skillWorkflowLoads = new Map();
if (!Array.isArray(inventory.skills) || inventory.skills.length < 27) fail("skill registry is missing the approved baseline entrypoints");
for (const skill of inventory.skills || []) {
  for (const field of ["name", "path", "maturity", "invocation", "route", "profile"]) if (!skill[field]) fail("skill metadata missing " + field);
  if (names.has(skill.name)) fail("duplicate skill name: " + skill.name);
  names.add(skill.name);
  if (!/^skills\/[^/]+\/SKILL\.md$/u.test(skill.path)) fail("skill is not a direct child of skills/: " + skill.path);
  if (!["stable", "experimental"].includes(skill.maturity)) fail("invalid maturity: " + skill.name);
  if (!["bootstrap", "model", "user"].includes(skill.invocation)) fail("invalid invocation mapping: " + skill.name);
  const source = await readFile(join(root, skill.path), "utf8");
  const fields = frontmatter(source);
  for (const field of ["name", "description", "invocation", "maturity", "route", "profile", "loads"]) if (!fields[field]) fail(skill.path + " missing " + field);
  if (fields.name !== skill.name || fields.invocation !== skill.invocation || fields.maturity !== skill.maturity || fields.route !== skill.route || fields.profile !== skill.profile) fail(skill.path + " metadata differs from inventory");
  if (descriptions.has(fields.description)) fail("duplicate skill trigger: " + skill.path);
  descriptions.add(fields.description);
  if (skill.name !== "les-bootstrap" && (skill.bootstrap !== "skills/bootstrap/SKILL.md" || fields.bootstrap !== skill.bootstrap)) fail(skill.path + " lacks resolved bootstrap metadata");
  try {
    const dependencies = JSON.parse(fields.loads);
    const workflows = new Set();
    if (skill.name !== "les-bootstrap" && !dependencies.some((dependency) => dependency.endsWith("bootstrap/SKILL.md"))) fail(skill.path + " does not load bootstrap");
    for (const dependency of dependencies) {
      const target = resolve(dirname(join(root, skill.path)), dependency);
      await access(target);
      if (relative(root, target).startsWith("policies/workflows/")) {
        loadedWorkflows.add(relative(root, target));
        workflows.add(relative(root, target));
      }
    }
    skillWorkflowLoads.set(skill.name, workflows);
  } catch { fail(skill.path + " has invalid or broken loads metadata"); }
  for (const heading of ["Invoke", "Inputs", "Procedure", "Output", "Guardrails", "Verification"]) if (!source.includes(`## ${heading}`)) fail(skill.path + " missing skill section: " + heading);
  const procedure = source.match(/## Procedure\n([\s\S]*?)(?=\n## |$)/u)?.[1] || "";
  if (!procedure || procedure.split("\n").filter((line) => /^\d+\. /u.test(line)).some((line) => !line.includes("Done when:"))) fail(skill.path + " has procedure step without completion criterion");
}

const routeIds = new Set();
for (const route of routes.routes || []) {
  for (const field of ["id", "kind", "trigger", "skill", "riskFloor", "examples", "nearMisses", "fallback", "evidence"]) if (!route[field]) fail("route metadata missing " + field);
  if (routeIds.has(route.id)) fail("duplicate route: " + route.id);
  routeIds.add(route.id);
  if (!names.has(route.skill) || !names.has(route.fallback)) fail("route references unknown skill: " + route.id);
  if (!/^R[0-3]$/u.test(route.riskFloor) || !route.examples.length || !route.nearMisses.length) fail("invalid route contract: " + route.id);
}
for (const skill of inventory.skills) if (!routeIds.has(skill.route)) fail("skill route missing: " + skill.name);
for (const id of ["trust-boundary", "dependency", "git-history", "interfaces", "data-transitions", "frontend-ui", "frontend-design", "accessibility", "frontend-experience", "frontend-performance", "frontend-verification"]) if (!routeIds.has(id)) fail("missing touchpoint route: " + id);
const routeSkills = new Set((routes.routes || []).map((route) => route.skill));
for (const workflow of inventory.workflows) {
  if (!loadedWorkflows.has(workflow)) fail("orphan workflow: " + workflow);
  if (!inventory.skills.some((skill) => routeSkills.has(skill.name) && skillWorkflowLoads.get(skill.name)?.has(workflow))) fail("workflow has no route consumer: " + workflow);
}

const lifecycle = await readFile(join(root, "policies/lifecycle.md"), "utf8");
const lifecycleSteps = lifecycle.split(/^## \d+\. /mu).slice(1);
if (lifecycleSteps.length !== 17) fail("lifecycle must contain 17 phases");
for (const [index, step] of lifecycleSteps.entries()) for (const field of ["Activate", "Input", "Output", "Done when", "Stop"]) if (!step.includes(`**${field}:**`)) fail(`lifecycle step ${index + 1} missing ${field}`);
for (const status of ["COMPLETE", "BLOCKED", "PENDING_USER_ACTION", "FAILED", "SKIPPED"]) if (!(await readFile(join(root, "policies/workflow-contracts.md"), "utf8")).includes(status)) fail("missing terminal status: " + status);

for (const provider of providers) {
  const adapter = JSON.parse(await readFile(join(root, "adapters", provider, "adapter.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(root, "adapters", provider, "manifest.json"), "utf8"));
  if (adapter.provider !== provider || adapter.skillRoot !== "skills" || adapter.bootstrap !== "skills/bootstrap/SKILL.md") fail("invalid adapter contract: " + provider);
  if (Object.hasOwn(manifest, "profileSkillRoots")) fail("adapter manifest declares a profile-specific skill root: " + provider);
  if (manifest.provider !== provider || !["PENDING_HOST_SMOKE", "READY"].includes(manifest.readiness) || !manifest.promotedSkills.includes("les-bootstrap")) fail("invalid host manifest: " + provider);
  if (manifest.readiness === "READY" && (provider !== "codex" || manifest.smokeModel !== "gpt-5.6-luna/medium" || Object.values(manifest.smokeTests || {}).some((status) => status !== "passed"))) fail("ready host manifest lacks complete Codex smoke evidence: " + provider);
  for (const name of manifest.promotedSkills) if (inventory.skills.find((skill) => skill.name === name)?.maturity !== "stable") fail("experimental skill promoted by " + provider);
  for (const skill of inventory.skills.filter((skill) => skill.maturity === "stable")) if (!manifest.promotedSkills.includes(skill.name)) fail("stable skill not promoted by " + provider + ": " + skill.name);
  if (manifest.userInvokedSkills.some((name) => inventory.skills.find((skill) => skill.name === name)?.invocation !== "user")) fail("user invocation mismatch: " + provider);
  if (!manifest.modelInvokedSkills.some((name) => inventory.skills.find((skill) => skill.name === name)?.invocation === "model") || !manifest.userInvokedSkills.length || !manifest.promotedSkills.some((name) => inventory.skills.find((skill) => skill.name === name)?.profile === "frontend")) fail("host manifest lacks discovery smoke coverage: " + provider);
}
const generated = spawnSync(process.execPath, [join(root, "bin/generate-adapter-manifests.mjs")], { cwd: root, encoding: "utf8" });
if (generated.status !== 0) fail("generated manifest drift\n" + generated.stderr.trim());

const forbiddenFields = ["prove" + "nance", "source" + "Revision", "source" + "Repository"];
const forbidden = new RegExp("\\b(?:" + forbiddenFields.join("|") + ")\\b|https?:\\/\\/(?!github\\.com\\/hakienit\\/les)", "iu");
for (const path of declared) {
  if (path === "LICENSE") continue;
  const source = await readFile(join(root, path), "utf8");
  if (forbidden.test(source)) fail("forbidden public reference in " + path);
}

if (failures.length) {
  for (const message of failures) console.error("[BLOCKED] " + message);
  process.exitCode = 1;
} else console.log(`Inventory verification passed: ${declared.length} files, ${inventory.rules.length} rules, ${inventory.workflows.length} workflows, ${inventory.skills.length} skills.`);
