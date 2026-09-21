#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(await readFile(resolve(root, "inventory.yaml"), "utf8"));
const providers = ["codex", "claude-code", "gemini-cli", "antigravity"];
let codexSmokePassed = false;
try {
  const evidence = JSON.parse(await readFile(resolve(root, "test/evidence/codex-host-smoke-medium.json"), "utf8"));
  codexSmokePassed = evidence.provider === "codex" && evidence.model === "gpt-5.6-luna" && evidence.reasoningEffort === "medium" && evidence.summary?.passed === 5 && evidence.summary?.total === 5 && evidence.cases?.every((scenario) => scenario.pass);
} catch {}
const promotedSkills = inventory.skills.filter((skill) => skill.maturity === "stable").map((skill) => skill.name);
const manifest = (provider) => JSON.stringify({
  manifestVersion: 1,
  provider,
  skillRoot: "skills",
  bootstrap: "skills/bootstrap/SKILL.md",
  promotedSkills,
  modelInvokedSkills: inventory.skills.filter((skill) => skill.invocation === "model" && skill.maturity === "stable").map((skill) => skill.name),
  userInvokedSkills: inventory.skills.filter((skill) => skill.invocation === "user" && skill.maturity === "stable").map((skill) => skill.name),
  unsupportedCapabilities: provider === "codex" && codexSmokePassed ? ["provider activation"] : ["provider activation", "real host smoke"],
  readiness: provider === "codex" && codexSmokePassed ? "READY" : "PENDING_HOST_SMOKE",
  smokeModel: provider === "codex" && codexSmokePassed ? "gpt-5.6-luna/medium" : undefined,
  smokeTests: provider === "codex" && codexSmokePassed ? { bootstrap: "passed", model: "passed", user: "passed", profile: "passed", permission: "passed" } : { bootstrap: "not_run", model: "not_run", user: "not_run", profile: "not_run", permission: "not_run" }
}, null, 2) + "\n";

let failed = false;
for (const provider of providers) {
  const path = resolve(root, "adapters", provider, "manifest.json");
  const expected = manifest(provider);
  if (process.argv.includes("--write")) await writeFile(path, expected);
  else if (JSON.stringify(JSON.parse(await readFile(path, "utf8"))) !== JSON.stringify(JSON.parse(expected))) {
    console.error(`[BLOCKED] generated adapter manifest differs: ${provider}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log(process.argv.includes("--write") ? "Adapter manifests generated." : "Adapter manifests match inventory.");
