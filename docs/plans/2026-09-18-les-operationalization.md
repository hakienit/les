# LES Operationalization Plan

**Parent:** HBA-10  
**Status:** Superseded by `docs/plans/2026-09-18-les-fe-first-completion.md`  
**Risk:** High — changes runtime discovery, skill behavior, lifecycle, and release claims.  
**Implementation authority:** Historical plan; use the FE-first plan for current work.

## Outcome

Turn the normalized LES package into a public-ready engineering methodology that
is both structurally valid and behaviorally enforceable. Preserve LES as the only
policy authority while deepening workflows and skills, adding explicit routing and
invocation classes, exposing the catalog through verified host-native discovery,
and testing behavior rather than file presence alone.

## Constraints

- Author all LES content independently.
- Keep external research, donor names, source links, revisions, comparison notes,
  and attribution records outside the repository and package.
- Keep project-specific decisions, credentials, work state, and private knowledge
  outside the public payload.
- Do not publish, install, activate a provider, mutate global configuration, commit,
  push, or contact an external service during implementation.
- Keep `policies/` authoritative. Skills orchestrate policy and workflows without
  restating their rules.
- Keep the existing 27-skill baseline unless a behavior review proves a capability
  must be merged or split.
- Use Node standard library for validators and generators.

## Target model

~~~text
policy authority
  -> workflow contracts
    -> task/touchpoint routing
      -> skill orchestration
        -> host-native discovery
          -> static and behavior evidence
~~~

`inventory.yaml` remains the canonical registry. Human catalogs, route manifests,
host manifests, and package checks must agree with it.

## Phase 0 — Freeze the current baseline

### Changes

- Record the current 92-file, 27-skill, 14-rule, 10-workflow baseline.
- Add failing contract tests before changing routing, skill bodies, workflows, or
  adapters.
- Update the design specification to replace the assumption that skills are only
  thin routers with the approved orchestration contract below.

### Red checks

- Every non-bootstrap skill must resolve bootstrap through metadata.
- Every skill must have required operational sections.
- Every procedure step must have a completion criterion.
- Every workflow must be reachable through at least one route and one skill.
- Every public skill must be reachable through each adapter that claims support.
- No provider may be reported ready without native discovery evidence.

### Gate

The old package must still pass its existing nine tests before the first contract
test is made red. No production content changes in this phase.

## Phase 1 — Canonical routing and invocation contract

### Files

- Add `skills/README.md` as the human capability catalog.
- Add `routes.yaml` as a JSON-compatible YAML route registry.
- Extend `inventory.yaml` with maturity, invocation, route, profile, and bootstrap
  fields.
- Extend `bin/verify-inventory.mjs` and `test/cli.test.mjs`.

### Route model

Each route declares:

- task or touchpoint trigger;
- selected skill;
- required profile, if any;
- risk floor;
- positive examples;
- near-miss examples;
- fallback route; and
- terminal evidence class.

Task routes cover discovery, planning, specification, decomposition, feature work,
defects, investigation, refactoring, migration, incident response, review,
verification, repository operations, release readiness, handoff, and knowledge.
Touchpoint routes cover trust boundaries, dependencies, Git history, interfaces,
data transitions, frontend UI, accessibility, and performance.

### Invocation decision

- `bootstrap`: `les-bootstrap` only.
- `user`: `les-quality-audit`, `les-security-review`,
  `les-release-readiness`, and `les-accessibility-review`.
- `model`: the remaining 22 skills.

Explicit invocation remains valid for model-invoked skills. High risk does not by
itself force user-only invocation; risk policy still requires approval immediately
before an R3 action.

### Maturity decision

- All 27 current skills remain `stable` only after their behavior contract and
  required tests pass.
- A new or incomplete skill must be `experimental` and excluded from promoted
  host manifests.
- No empty experimental directory is created.

### Gate

- Catalog, routes, and inventory contain the same 27 unique skill identities.
- Every task route resolves one primary skill and a deterministic fallback.
- Every touchpoint route adds constraints without replacing the primary task skill.
- Near-miss fixtures prove specialized skills do not attract unrelated tasks.

## Phase 2 — Lifecycle and workflow depth

### Lifecycle

Expand `policies/lifecycle.md` into four JIT phases with 17 explicit steps:

1. intake;
2. instruction loading;
3. project context reconstruction;
4. task-state recovery;
5. affected-flow inspection;
6. ambiguity resolution;
7. risk classification;
8. acceptance definition;
9. execution planning;
10. approval gate;
11. red proof or characterization;
12. implementation;
13. focused verification;
14. integrated verification;
15. diff and policy review;
16. knowledge or handoff promotion; and
17. final state reporting.

Each step declares activation, required input, output, `done when`, and stop state.
Later phases load only after the prior phase exit passes.

### Shared workflow contracts

Add LES-owned workflow contracts for:

- skill execution and bootstrap inheritance;
- review identity and finding shape; and
- team ownership, concurrent writers, and integration recovery.

Expand the existing ten workflows to a common schema:

- trigger;
- inputs;
- procedure with completion criteria;
- risk and approval behavior;
- output artifact;
- terminal statuses;
- verification evidence; and
- recovery or handoff behavior.

### Terminal statuses

Use only `COMPLETE`, `BLOCKED`, `PENDING_USER_ACTION`, `FAILED`, and `SKIPPED`.
Every non-complete state must name the unmet condition and next safe action.

### Gate

- All 17 lifecycle steps have checkable exits.
- No workflow redefines a universal rule.
- Each workflow has at least one skill and route consumer.
- Lifecycle tests cover phase ordering, approval stops, recovery, and truthful
  reporting of unavailable checks.

## Phase 3 — Deepen the 27 skill contracts

### Required skill body

Every `SKILL.md` must contain:

1. `Invoke` — bootstrap inheritance and policy/workflow loads;
2. `Inputs` — minimum state required to begin;
3. `Procedure` — ordered orchestration steps;
4. `Output` — exact artifact or decision shape;
5. `Guardrails` — authority, mutation, and scope boundaries;
6. `Verification` — required evidence and terminal status.

Every procedure step ends with a `Done when` condition. Skill bodies may add
task-specific orchestration but must link to, rather than duplicate, policy.

### Delivery waves

#### Wave A — system-critical behavior

- bootstrap;
- discovery;
- planning;
- test-first;
- investigation;
- review;
- verification;
- release readiness.

These establish the behavior contract used to review later waves.

#### Wave B — engineering execution

- specification;
- task decomposition;
- feature delivery;
- bug fixing;
- surgical patch;
- refactoring;
- architecture design;
- migration;
- incident hotfix;
- dependency change.

#### Wave C — repository, assurance, and governance

- security review;
- quality audit;
- Git safety;
- merge conflict;
- handoff;
- knowledge promotion.

#### Wave D — frontend profile

- frontend router;
- accessibility review;
- frontend verification.

### Bootstrap inheritance

Every non-bootstrap skill declares `skills/bootstrap/SKILL.md` in resolved
metadata. The validator rejects prose-only bootstrap references.

### Gate per wave

- Static contract validation passes for every changed skill.
- Trigger-positive and trigger-near-miss fixtures pass.
- Stop-condition fixture proves the skill refuses one unauthorized path.
- Output fixture proves evidence and terminal status shape.
- Maintainer may reject one wave without invalidating approved earlier waves.

## Phase 4 — Host-native discovery

### Adapter model

Keep portable skills host-neutral. Each adapter owns:

- native manifest or supported discovery metadata;
- promoted stable skill list;
- bootstrap/session entrypoint;
- profile skill roots;
- invocation translation;
- unsupported capability list; and
- smoke-test state.

Provider schemas are verified outside the repository. Only independently authored
LES manifests and runtime files enter the package; source research does not.

### Generation and validation

- Generate repetitive promoted-skill lists from `inventory.yaml` with one
  dependency-free script.
- Keep generated manifests checked in only when the host requires static files.
- Fail verification when generated output differs from checked-in output.
- Validate that experimental skills are not promoted.
- Validate that user-invoked skills are not exposed as implicit when the host
  supports invocation policy.

### Readiness states

- `STRUCTURAL_READY`: manifest schema and paths pass locally.
- `PENDING_HOST_SMOKE`: host is unavailable or activation is unauthorized.
- `READY`: real host discovery, bootstrap, invocation, and permission smoke passes.

The release gate must treat `PENDING_HOST_SMOKE` as pending, never as ready.

### Gate

Each supported adapter proves that one bootstrap, one model-invoked skill, one
user-invoked skill, and one optional profile skill are discoverable. Real provider
activation remains a separately authorized action.

## Phase 5 — Behavior evaluation

### Deterministic layer

Add repository-only fixtures for:

- trigger match and near-miss;
- bootstrap inheritance;
- lifecycle phase order;
- approval and mutation stop;
- completion criteria;
- output and finding schemas;
- route/profile composition; and
- adapter promotion and maturity filtering.

Tests must evaluate behavior contracts and structured output, not exact prose.

### Host evaluation layer

Define clean-room scenarios for the highest-risk skills:

- bootstrap;
- planning;
- test-first;
- investigation;
- security review;
- verification;
- release readiness; and
- handoff recovery.

Store only LES-authored prompts, expected invariants, redacted results, and status.
Provider execution remains `PENDING_USER_ACTION` until explicitly authorized.

### Gate

- Deterministic fixtures pass locally.
- A scenario marked `not_run` cannot support a readiness claim.
- A host failure blocks only that adapter unless it reveals a provider-neutral
  contract defect.

## Phase 6 — Frontend profile completion

### Changes

- Add a profile activation manifest with positive and negative triggers.
- Map component, state, UI completeness, API integration, accessibility,
  performance, and frontend verification touchpoints to the three profile skills.
- Keep framework, design tool, component library, and project architecture choices
  in project-owned decisions.
- Add profile conflict and precedence fixtures.

### Gate

- Backend-only tasks do not activate the frontend profile.
- A frontend task loads only relevant profile rules.
- Accessibility remains active for every user-interface change.
- The profile adds constraints without weakening universal rules.

## Phase 7 — Package and release proof

### Required commands

- `npm test`
- `npm run verify-inventory`
- `npm run verify-release`
- syntax checks for all executables
- package dry-run with scripts disabled
- clean-reference scan
- generated-manifest drift check

### Acceptance

1. Inventory, routes, catalogs, workflows, skills, and adapter manifests agree.
2. All 27 stable skills satisfy the operational body contract.
3. All skills inherit bootstrap and resolve their policy/workflow dependencies.
4. All 17 lifecycle steps and every workflow have consumers and exit evidence.
5. User/model invocation is preserved by supporting hosts.
6. Unsupported or untested host behavior remains pending.
7. Package payload contains no external research or project-owned state.
8. CLI collision, diff, update, rollback, doctor, and adapter behavior remain green.
9. No install hook, runtime fetch, dependency, publish, provider activation, commit,
   or push is introduced.

## Review gates

Maintainer approval is required at these boundaries:

1. route schema and invocation classification;
2. lifecycle and shared workflow contracts;
3. Wave A skill behavior as the template for all 27;
4. adapter manifest strategy before host-specific files are added;
5. behavior fixture schema before scenarios are authored; and
6. final release-readiness evidence.

Approval of this plan authorizes planning only. Implementation starts only after
the maintainer explicitly approves the plan.

## Rollback

Each phase remains a coherent diff and must leave the previous acceptance suite
runnable. Before publication, rollback means reverting only the current phase's
files and inventory entries. No compatibility layer is retained for an unapproved
phase, and no completed earlier phase is rewritten to preserve speculative work.

## Stop condition

Stop when Phase 7 passes locally and every unrun host smoke is reported as pending.
Do not proceed to publication, installation, provider activation, commit, push, or
release without separate explicit authorization.
