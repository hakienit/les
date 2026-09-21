---
name: les-bug-fixing
description: Fix incorrect or regressed behavior after reproducing and locating its shared cause.
invocation: model
maturity: stable
route: defect
profile: core
bootstrap: skills/bootstrap/SKILL.md
loads: ["../bootstrap/SKILL.md","../../policies/workflows/bug-fixing.md","../../policies/rules/testing.md","../../policies/rules/error-handling.md","../../policies/rules/change-scope.md"]
---

# Bug Fixing

## Invoke

Inherit `../bootstrap/SKILL.md` and the bug-fixing workflow.

## Inputs

Reported symptom, reproduction, and affected flow.

## Procedure

1. Reproduce and trace all callers to the responsible owner. Done when: cause is evidenced.
2. Add the smallest regression proof. Done when: old behavior fails.
3. Correct the owner and verify adjacent paths. Done when: proof passes.

## Output

Cause, correction, regression evidence, and terminal status.

## Guardrails

Do not patch only the named symptom or substitute an unproven edit.

## Verification

Report reproduction, regression, integration, and any unavailable evidence.

Bootstrap LES, then load `../../policies/workflows/bug-fixing.md` plus
`testing.md`, `error-handling.md`, and `change-scope.md` from
`../../policies/rules/`. Output a root-cause fix with a focused regression
check. Stop and report evidence when reproduction or causality remains unproven.
