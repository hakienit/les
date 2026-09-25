---
name: les-bootstrap
description: Bootstrap LES for any engineering task by loading authority, project context, risk, workflow, and verification requirements.
invocation: bootstrap
maturity: stable
route: bootstrap
profile: core
loads: ["../../policies/principles.md","../../policies/precedence.md","../../policies/lifecycle.md","../../policies/risk-model.md","../../policies/memory-model.md","../../policies/verification.md","../../policies/rules/context-loading.md","../../policies/workflows/task-lifecycle.md"]
---

# LES Bootstrap

## Invoke

Use first for every LES task; load only task-activated rules after this kernel.

## Inputs

Request, runtime constraints, project entrypoint, and current work state.

## Procedure

1. Resolve precedence and the task route. Done when: one route, near-miss interpretation, and fallback are selected.
2. Reconstruct relevant project context, active work state, and repository identity. Done when: scope, ownership, and stale evidence are named.
3. Classify risk, authority, active profile, and verification tier. Done when: approval and evidence gates are explicit.
4. Report the next safe action and context trace. Done when: terminal evidence, residual uncertainty, and status are defined.

## Output

Task state: outcome, scope, route, fallback, risk, active profile, evidence class,
approval requirement, context trace, residual uncertainty, and terminal status.

For task-scoped responses, use the closeability footer defined in
`../../policies/workflow-contracts.md`.

## Guardrails

Do not grant authority, duplicate policy, or load inactive profiles.

## Verification

Return `COMPLETE`, `BLOCKED`, `PENDING_USER_ACTION`, `FAILED`, or `SKIPPED` with evidence.

1. Read `../../policies/principles.md`, `precedence.md`, `lifecycle.md`,
   `risk-model.md`, `memory-model.md`, and `verification.md`.
2. Read the adopting project's entrypoint, active work state, and selected profiles.
3. Load `../../policies/rules/context-loading.md`, then the rules activated by the task.
4. Select one workflow from `../../policies/workflows/`; use
   `task-lifecycle.md` when no narrower workflow matches.
5. State outcome, scope, selected route and fallback, risk level, active profile,
   verification tier, context trace, and any approval gate.

Stop before dependent work when precedence is unresolved or required authority is absent.
