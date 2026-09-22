# LES Engineering Capability Synthesis Design

**Status:** Implemented locally; Codex Luna Medium host smoke passed; other providers remain pending  
**Parent:** HBA-10  
**Date:** 2026-09-18

## Objective

Expand LES beyond the current 27-skill baseline by independently synthesizing
useful engineering behavior into a portable, policy-governed capability catalog.
Flatten every operational skill into one physical `skills/` root so discovery,
identity, validation, and packaging no longer depend on category directories or
profile-specific skill roots.

LES remains standalone. External skills may inform requirements during analysis,
but LES does not depend on, name, link to, mirror, or copy them.

## Scope

This change covers engineering capabilities for frontend developers first. It
excludes writing, teaching, content production, personal productivity, and
technology-specific workflows that do not justify a provider-neutral LES contract.

### Frontend-first product boundary

Frontend is a primary LES capability track, not an optional afterthought. Every
UI change routes through the frontend contract and selects only the relevant
design, component, state, integration, accessibility, performance, responsive,
and verification checks.

The frontend contract is framework-neutral, but it is strict about observable
user outcomes:

- semantic structure, accessible names, keyboard operation, visible focus, and
  contrast evidence;
- touch targets of at least 44x44 CSS pixels, non-hover interaction paths, and
  loading or pending feedback;
- mobile-first responsive behavior without horizontal overflow or disabled zoom;
- explicit loading, empty, success, error, disabled, retry, and permission states;
- stable layout and measured performance, including image loading and cumulative
  layout shift controls;
- typography, color, spacing, icon, motion, and form feedback decisions that are
  coherent with the project design system;
- reduced-motion behavior and animation that communicates state rather than
  decoration; and
- browser evidence for critical journeys whenever a UI boundary changes.

These are LES requirements, not a dependency on a globally installed UI skill or
any framework-specific component library.

The current count of 27 skills is a baseline, not a target or ceiling. The final
catalog is determined by distinct triggers, outputs, authority boundaries, and
verification behavior.

Publication, global installation, commit, and push are outside this change.
Adapter contract smoke is in scope. The approved Codex Luna Medium host smoke
is recorded as passed; other host smoke remains pending.

### Approved execution scope

The user approved only Codex `gpt-5.6-luna` with reasoning effort `medium` for
host smoke. Its discovery, bootstrap, model, user, profile, and permission-stop
evidence is recorded in `test/evidence/codex-host-smoke-medium.json`. Other
providers remain `PENDING_HOST_SMOKE`.

## Clean-room synthesis

External analysis happens outside the repository. Only independently stated
capability requirements enter LES.

Each observed behavior receives one decision:

- `ADD`: it has a distinct engineering trigger, output, and stop boundary;
- `ENRICH`: an existing LES skill already owns the trigger and should gain the
  independently stated behavior; or
- `EXCLUDE`: it is non-engineering, provider-specific, framework-specific,
  duplicative, or not strong enough to justify permanent catalog load.

Names, source paths, revisions, comparison matrices, excerpts, and provenance
records remain outside the repository. No external wording or document structure
is copied into LES.

## Flat skill architecture

Every skill is a real directory directly beneath `skills/`:

~~~text
skills/
  README.md
  les-bootstrap/SKILL.md
  les-discovery/SKILL.md
  les-planning/SKILL.md
  les-technical-research/SKILL.md
  les-domain-modeling/SKILL.md
  ...
  les-frontend/SKILL.md
  les-frontend-design/SKILL.md
  les-accessibility-review/SKILL.md
  les-frontend-verification/SKILL.md
~~~

Category directories and skill symlinks are invalid. Folder names use the
canonical `les-*` identity. Profile membership is metadata, not physical
nesting.

`profiles/frontend/` keeps activation and rule files only. All frontend skills
live in the common skill root and declare `profile: frontend`.

## Registry and discovery

`inventory.yaml` remains canonical for skill identity, path, maturity, invocation,
route, profile, and bootstrap inheritance. `routes.yaml`, the human catalog,
generated adapter manifests, and package verification resolve from inventory.

Adapters expose one `skillRoot: skills`. They do not declare profile-specific
skill roots. Profile filtering uses inventory metadata and activation rules.

The validator rejects:

- a skill outside `skills/<capability>/SKILL.md`;
- nested category directories or symlinks;
- duplicate folder, route, or canonical identity;
- folder/frontmatter/inventory disagreement;
- missing bootstrap inheritance;
- a generated manifest that differs from inventory; and
- promotion of incomplete or experimental skills.

## Initial capability candidates

The first audit evaluates these additions without pre-approving them:

- `les-technical-research`;
- `les-domain-modeling`;
- `les-prototyping`;
- `les-work-triage`;
- `les-workspace-isolation`;
- `les-repository-quality-gates`;
- `les-agent-instruction-authoring`;
- `les-operator-runbook`;
- `les-retrospective`;
- `les-frontend-design`;
- `les-frontend-experience-review`; and
- `les-frontend-performance`.

A candidate becomes stable only after its distinct trigger, near-miss, unauthorized
stop, output evidence, workflow ownership, and route consumer are proven. A
candidate that fails this test is merged into an existing skill or excluded; no
empty experimental directory is created.

## Enrichment boundaries

Existing skills may gain stronger orchestration for discovery, planning, task
decomposition, feature delivery, defect diagnosis, test-first work, surgical
patches, refactoring, architecture design, migration, review, verification, Git
safety, handoff, frontend design, frontend implementation, accessibility,
responsive behavior, frontend performance, and browser-facing verification.

Enrichment changes behavior only when it creates a checkable decision, step,
completion criterion, stop condition, or evidence requirement. Explanatory prose,
restated policy, tool instructions, and speculative flexibility are rejected.

Universal authority stays in `policies/`. Shared execution meaning stays in
workflow contracts. Skills contain only trigger-specific orchestration. Conditional
reference is reached through explicit pointers so always-loaded descriptions remain
small.

## Migration sequence

### 1. Baseline freeze

Record the current registry and passing gates. Add structural tests that fail on
nested skills, symlinks, profile skill roots, and path/identity disagreement.

### 2. Behavior-preserving flattening

Move all 27 current skills into direct child directories under `skills/`. Update
inventory, relative loads, routes, catalog, adapters, generators, tests, package
registration, and documentation. No skill behavior changes in this stage.

The old directory structure is removed without aliases or compatibility symlinks.
Rollback restores the previous paths and generated manifests as one coherent diff.

### 3. Capability audit

Analyze the curated engineering corpus outside the repository. Produce temporary
`ADD`, `ENRICH`, and `EXCLUDE` decisions. Only independently authored requirements
cross into implementation work.

### 4. New capability waves

Add accepted skills in small waves:

1. reasoning and planning: research, domain modeling, prototyping, and triage;
2. repository execution: isolation and quality gates;
3. agent operations: instruction authoring and operator runbooks;
4. frontend-first delivery: frontend design, experience review, performance,
   accessibility, responsive behavior, and browser verification;
5. feedback and maintenance: retrospective.

Each wave may be rejected or rolled back without rewriting approved earlier waves.

### 5. Existing-skill enrichment

Apply accepted enrichment decisions to existing skills at their current owners.
Prefer deletion or replacement of weaker steps over appending parallel guidance.

### 6. Integrated proof

Regenerate manifests and run inventory, routing, behavior, package, release, and
frontend verification. Run adapter contract smoke. Report live host evidence as
pending when unavailable and stop before external activation.

## Behavior evidence

Every added or enriched skill requires structured fixtures for:

- positive trigger and near-miss;
- bootstrap and policy/workflow resolution;
- one unauthorized path and required terminal status;
- exact output evidence class;
- profile activation or exclusion where applicable; and
- deterministic fallback routing;
- for frontend skills, state coverage, viewport coverage, keyboard/focus coverage,
  accessibility evidence, responsive evidence, and browser evidence when required.

Tests assert contracts and structured output, not exact prose. Flattening receives
an independent preservation gate before synthesis begins, so a routing regression
cannot be hidden by later behavior changes.

## Failure and recovery

- Ambiguous capability ownership stops at `PENDING_USER_ACTION`.
- A candidate with no distinct trigger is `SKIPPED` and merged or excluded.
- Broken structural migration is rolled back before synthesis proceeds.
- A failed wave leaves earlier accepted waves and the flattened baseline intact.
- Unavailable non-approved host behavior remains `PENDING_HOST_SMOKE` and
  cannot support a readiness claim.

## Acceptance conditions

1. Every operational skill is a physical direct child of `skills/`.
2. No category directory, skill symlink, or profile skill root remains.
3. The catalog has no predetermined count and no duplicate trigger ownership.
4. Added capabilities are engineering-focused and independently authored.
5. Existing skills receive only behaviorally meaningful enrichment.
6. LES remains usable without any external or globally installed skill.
7. Inventory, routes, catalogs, adapters, fixtures, and package contents agree.
8. External research and comparison material are absent from the repository.
9. Adapter contract smoke passes for every supported host; approved Codex host
   smoke is passed and non-approved hosts remain pending.
10. Frontend routes have explicit coverage for design, states, accessibility,
    responsive behavior, interaction, performance, and browser verification.
11. Frontend acceptance never treats a visual inspection as keyboard or browser
    proof, and never treats unavailable evidence as a pass.
12. All local verification and release gates pass.
13. Codex `gpt-5.6-luna/medium` host smoke is recorded as passed; other live
    host smoke remains `PENDING_HOST_SMOKE` and is not converted into `READY`.
14. No external action occurs without the existing risk and approval gate.
