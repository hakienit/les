# LES FE-First Capability Completion Plan

**Parent:** `docs/specs/2026-09-18-les-global-pattern-synthesis-design.md`  
**Status:** Implemented locally; Codex Luna Medium host smoke passed; other providers remain pending  
**Risk:** High — changes skill paths, routing, frontend behavior, manifests, and package acceptance.  
**Host-smoke scope:** Codex `gpt-5.6-luna` with reasoning effort `medium` only.

## Outcome

Turn LES into a complete frontend-first engineering system while preserving its
policy authority, risk gates, standalone package boundary, and provider-neutral
adapters. The local matrix must be executable and pass at 5/5 for structural,
workflow, AI-behavior, frontend, and package criteria. Codex host smoke is
passed; non-Codex hosts remain `PENDING_HOST_SMOKE`.

## Non-goals

- No non-Codex provider activation or host smoke.
- No publish, global installation, push, external service, or credential action.
- No external repository names, links, copied wording, or comparison material in
  the LES package.
- No framework-specific frontend dependency or design-system lock-in.
- No compatibility aliases after flattening.

## Target shape

```text
policies/                 universal authority
  -> workflows/           shared execution contracts
    -> routes.yaml        task/touchpoint selection
      -> skills/          one direct root of operational skills
        -> profiles/      frontend activation and rules only
          -> adapters/    host-native discovery metadata
```

Target public capability set is the current 27 skills plus the approved
capability candidates that prove distinct ownership, including the FE track:

- frontend router;
- frontend design;
- frontend experience review;
- frontend performance;
- accessibility review;
- frontend verification;
- technical research;
- domain modeling;
- prototyping;
- work triage;
- workspace isolation;
- repository quality gates;
- agent instruction authoring;
- operator runbook; and
- retrospective.

Redundant candidates are merged into their owning skill rather than kept as
duplicate triggers.

## Phase 0 — Baseline and contract fixtures

### Work

- Freeze current inventory, routes, manifests, package contents, and test output.
- Add fixture schema for positive, near-miss, bootstrap, unauthorized, output,
  fallback, profile, and frontend-evidence cases.
- Preserve all existing local gates before structural edits.

### Gate

```text
npm test
npm run verify-inventory
npm run verify-release
```

All existing checks pass before flattening begins.

## Phase 1 — Safe flattening

### Work

- Move every operational skill to `skills/<capability>/SKILL.md`.
- Move the three current frontend skills out of `profiles/frontend/skills/`.
- Update relative loads, inventory, routes, catalog, adapters, generators, tests,
  and package registration.
- Reject nested categories, symlinks, profile skill roots, and identity drift.

### Preservation gate

The same route identities, bootstrap inheritance, invocation modes, and output
evidence classes resolve before and after the move. No behavior enrichment occurs
until this gate passes.

## Phase 2 — FE-first capability track

### Work

Make the frontend router a primary model-invoked route for UI changes. Add or
enrich:

- design direction and component composition;
- state completeness and API boundary behavior;
- accessibility semantics, keyboard, focus, naming, contrast, and status;
- responsive/mobile-first behavior and touch interaction;
- visual experience and interaction review;
- measured frontend performance and stable layout;
- critical browser journey verification.

Every FE skill must map to the frontend profile and expose state, viewport,
keyboard/focus, accessibility, responsive, interaction, performance, and browser
evidence as applicable.

### Gate

- Backend-only work does not activate FE profile.
- Every UI change activates accessibility constraints.
- UI verification distinguishes visual, keyboard, browser, and unavailable proof.
- Loading, empty, success, error, disabled, retry, and permission states are
  represented where relevant.

## Phase 3 — Core skill behavior enrichment

Enrich system-critical skills first:

1. bootstrap and discovery;
2. planning and specification;
3. investigation and bug fixing;
4. test-first and feature delivery;
5. review and verification;
6. release readiness and handoff.

Each procedure step gets a checkable completion criterion. Each skill returns a
stable output shape with evidence, status, residual risk, and next safe action.

## Phase 4 — Complete capability catalog

Add the remaining distinct capabilities in small waves:

1. technical research, domain modeling, prototyping, and triage;
2. workspace isolation and repository quality gates;
3. agent instruction authoring and operator runbook;
4. retrospective and durable knowledge feedback.

Each skill requires a route, near-miss, unauthorized stop, output fixture, and
verification evidence before `stable` promotion.

## Phase 5 — AI behavior and workflow contracts

Add or enrich LES-owned contracts for:

- authority and scope;
- fact/inference/proposal separation;
- context budget and progressive disclosure;
- inline versus subagent routing;
- role evidence contracts;
- handoff identity, dirty state, checks, blockers, and recovery;
- review coverage and finding freshness;
- frontend evidence classification.

Universal behavior stays in `policies/`; skills only orchestrate trigger-specific
work.

## Phase 6 — Deterministic verification

Extend validators and fixtures to prove:

- inventory/route/catalog/manifest agreement;
- no duplicate trigger ownership;
- all skills inherit bootstrap;
- all procedure steps have completion criteria;
- all routes have positive and near-miss coverage;
- unauthorized actions stop with the correct status;
- frontend profile precedence and negative triggers;
- FE evidence categories are not conflated;
- package contains no external provenance or project state.

Run:

```text
npm test
npm run verify-inventory
npm run verify-release
```

Run only the approved Codex Medium host smoke; leave other providers pending.

## Phase 7 — Final local proof

Required local result:

- `STRUCTURAL_READY`;
- package and release checks pass;
- all deterministic behavior fixtures pass;
- adapter contract smoke passes;
- frontend route coverage passes;
- Codex live host evidence is passed with model and reasoning effort recorded;
- non-Codex hosts remain `PENDING_HOST_SMOKE`.

## Rollback

Each phase remains a coherent diff. If a preservation or inventory gate fails,
stop and restore the prior phase before adding capabilities. Do not retain aliases
or partially promoted skills to hide a failed migration.

## Stop condition

Stop after deterministic local gates, package proof, and the approved Codex host
smoke pass. Do not activate other providers or publish.
