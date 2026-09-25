import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const readJson = (path) => readFile(resolve(root, path), "utf8").then(JSON.parse);

test("operational catalog has deterministic routes and bootstrap inheritance", async () => {
  const [inventory, routes] = await Promise.all([readJson("inventory.yaml"), readJson("routes.yaml")]);
  assert.ok(inventory.skills.length >= 27);
  assert.equal(new Set(inventory.skills.map((skill) => skill.name)).size, inventory.skills.length);
  assert.equal(new Set(routes.routes.map((route) => route.id)).size, routes.routes.length);
  for (const id of ["trust-boundary", "dependency", "git-history", "interfaces", "data-transitions", "frontend-ui", "frontend-design", "accessibility", "frontend-experience", "frontend-performance", "frontend-verification"]) assert.equal(routes.routes.find((route) => route.id === id)?.kind, "touchpoint");
  for (const route of routes.routes) {
    assert.ok(inventory.skills.some((skill) => skill.name === route.skill));
    assert.ok(inventory.skills.some((skill) => skill.name === route.fallback));
    assert.ok(route.examples.length && route.nearMisses.length && route.evidence);
  }
  for (const skill of inventory.skills) {
    assert.ok(["stable", "experimental"].includes(skill.maturity));
    assert.match(skill.path, /^skills\/[^/]+\/SKILL\.md$/u);
    if (skill.name !== "les-bootstrap") assert.equal(skill.bootstrap, "skills/les-bootstrap/SKILL.md");
  }
});

test("lifecycle, workflow, adapter, and profile contracts expose truthful stops", async () => {
  const [lifecycle, contracts, profile] = await Promise.all([
    readFile(resolve(root, "policies/lifecycle.md"), "utf8"),
    readFile(resolve(root, "policies/workflow-contracts.md"), "utf8"),
    readJson("profiles/frontend/activation.json")
  ]);
  assert.equal((lifecycle.match(/^## \d+\./gmu) || []).length, 17);
  assert.match(lifecycle, /PENDING_USER_ACTION/);
  assert.match(contracts, /COMPLETE.*BLOCKED.*PENDING_USER_ACTION.*FAILED.*SKIPPED/su);
  assert.ok(profile.positiveTriggers.length && profile.negativeTriggers.length);
});

test("task output exposes truthful session closeability", async () => {
  const [contracts, bootstrap] = await Promise.all([
    readFile(resolve(root, "policies/workflow-contracts.md"), "utf8"),
    readFile(resolve(root, "skills/les-bootstrap/SKILL.md"), "utf8")
  ]);
  assert.match(contracts, /only `COMPLETE` is `CLOSEABLE`/u);
  assert.match(contracts, /every\s+other status is `KEEP_OPEN`/u);
  assert.match(contracts, /Omit the footer for ordinary conversation/u);
  assert.match(bootstrap, /closeability footer defined in/u);
  assert.match(bootstrap, /\.\.\/\.\.\/policies\/workflow-contracts\.md/u);
});

test("frontend profile covers the full evidence track", async () => {
  const [inventory, routes, profile, ...rules] = await Promise.all([
    readJson("inventory.yaml"),
    readJson("routes.yaml"),
    readJson("profiles/frontend/activation.json"),
    readFile(resolve(root, "profiles/frontend/rules/accessibility.md"), "utf8"),
    readFile(resolve(root, "profiles/frontend/rules/interaction-responsive.md"), "utf8"),
    readFile(resolve(root, "profiles/frontend/rules/performance.md"), "utf8"),
    readFile(resolve(root, "profiles/frontend/rules/browser-evidence.md"), "utf8"),
    readFile(resolve(root, "profiles/frontend/rules/visual-system.md"), "utf8"),
    readFile(resolve(root, "profiles/frontend/references/design-quality-bar.md"), "utf8"),
    readFile(resolve(root, "profiles/frontend/references/browser-review-protocol.md"), "utf8"),
    readFile(resolve(root, "profiles/frontend/references/react-performance.md"), "utf8")
  ]);
  const routeIds = new Set(routes.routes.map((route) => route.id));
  for (const touchpoint of profile.requiredTouchpoints) assert.ok(routeIds.has(touchpoint), "missing frontend touchpoint: " + touchpoint);
  assert.ok(inventory.skills.filter((skill) => skill.profile === "frontend").length >= 6);
  for (const term of ["4.5:1", "44x44", "CLS", "reduced-motion", "screenshot", "semantic color", "review surface", "375px", "mutation", "waterfalls"]) assert.ok(rules.some((source) => source.includes(term)), "missing frontend contract term: " + term);
});

test("AI behavior contract separates authority, evidence, and unavailable proof", async () => {
  const sources = await Promise.all([
    readFile(resolve(root, "policies/principles.md"), "utf8"),
    readFile(resolve(root, "policies/rules/ai-authority.md"), "utf8"),
    readFile(resolve(root, "policies/rules/context-loading.md"), "utf8"),
    readFile(resolve(root, "policies/workflow-contracts.md"), "utf8"),
    readFile(resolve(root, "policies/rules/definition-of-done.md"), "utf8"),
    readFile(resolve(root, "policies/rules/git-safety.md"), "utf8"),
    readFile(resolve(root, "policies/verification.md"), "utf8")
  ]);
  for (const term of ["Human authority", "Truthful reporting", "Progressive disclosure", "PENDING_USER_ACTION", "PENDING_HOST_SMOKE", "unavailable", "explicitly grants", "commits require user intent", "current repository state", "Fresh proof"]) assert.ok(sources.some((source) => source.includes(term)), "missing AI behavior contract term: " + term);
});

test("adapters promote only stable skills and distinguish pending host smoke", async () => {
  const inventory = await readJson("inventory.yaml");
  for (const provider of ["codex", "claude-code", "gemini-cli", "antigravity"]) {
    const manifest = await readJson(`adapters/${provider}/manifest.json`);
    assert.equal(manifest.readiness, provider === "codex" ? "READY" : "PENDING_HOST_SMOKE");
    assert.ok(manifest.promotedSkills.includes("les-bootstrap"));
    for (const name of manifest.promotedSkills) assert.equal(inventory.skills.find((skill) => skill.name === name)?.maturity, "stable");
    if (provider === "codex") assert.deepEqual(manifest.smokeTests, { bootstrap: "passed", model: "passed", user: "passed", profile: "passed", permission: "passed" });
  }
});

test("route fixtures keep specialized skills away from near misses", async () => {
  const [routes, fixtures] = await Promise.all([readJson("routes.yaml"), readJson("test/fixtures/route-cases.json")]);
  assert.equal(new Set(fixtures.map((fixture) => fixture.route)).size, routes.routes.length);
  assert.deepEqual(fixtures.map((fixture) => fixture.route).sort(), routes.routes.map((route) => route.id).sort());
  for (const fixture of fixtures) {
    const route = routes.routes.find((candidate) => candidate.id === fixture.route);
    assert.equal(route?.skill, fixture.expected);
    assert.ok(route.examples.includes(fixture.prompt));
    assert.ok(route.nearMisses.includes(fixture.nearMiss));
  }
});

test("frontend selection fixtures keep one primary preview or specialist choice", async () => {
  const [routes, fixtures] = await Promise.all([
    readJson("routes.yaml"),
    readJson("test/fixtures/frontend-selection-cases.json")
  ]);
  for (const fixture of fixtures) {
    const route = routes.routes.find((candidate) => candidate.examples.includes(fixture.prompt));
    assert.ok(route, "missing route example: " + fixture.prompt);
    assert.deepEqual(fixture.selected, [route.skill]);
    assert.ok(fixture.selected.length >= 1 && fixture.selected.length <= 2);
  }
  const preview = routes.routes.find((route) => route.id === "frontend-preview");
  assert.equal(preview?.role, "primary");
  assert.equal(preview?.phase, "design-gate");
  assert.deepEqual(preview?.composeWith, ["frontend-verification"]);
});

test("unrun provider-neutral host scenarios cannot support a readiness claim", async () => {
  const scenarios = await readJson("test/fixtures/host-scenarios.json");
  assert.ok(scenarios.length >= 8);
  for (const scenario of scenarios) {
    assert.equal(scenario.status, "not_run");
    assert.ok(scenario.invariants.length >= 2);
  }
});

test("every skill has structured positive, near-miss, stop, and output evidence", async () => {
  const [inventory, routes, fixtures] = await Promise.all([
    readJson("inventory.yaml"),
    readJson("routes.yaml"),
    readJson("test/fixtures/skill-cases.json")
  ]);
  assert.deepEqual(fixtures.map((fixture) => fixture.skill).sort(), inventory.skills.map((skill) => skill.name).sort());
  for (const fixture of fixtures) {
    const skill = inventory.skills.find((candidate) => candidate.name === fixture.skill);
    const route = routes.routes.find((candidate) => candidate.id === fixture.route);
    assert.equal(skill?.route, fixture.route);
    assert.equal(route?.skill, fixture.skill);
    assert.ok(route.examples.length && route.nearMisses.length);
    assert.ok(fixture.unauthorized);
    assert.ok(["COMPLETE", "BLOCKED", "PENDING_USER_ACTION", "FAILED", "SKIPPED"].includes(fixture.status));
    assert.equal(route.evidence, fixture.evidence);
  }
});

test("lifecycle fixture preserves phase order and truthful stops", async () => {
  const [lifecycle, fixture] = await Promise.all([
    readFile(resolve(root, "policies/lifecycle.md"), "utf8"),
    readJson("test/fixtures/lifecycle-cases.json")
  ]);
  assert.deepEqual([...lifecycle.matchAll(/^## \d+\. (.+)$/gmu)].map((match) => match[1]), fixture.phases);
  assert.match(lifecycle, new RegExp(fixture.approvalStop));
  assert.match(lifecycle, new RegExp(fixture.unavailableCheckStatus));
});
