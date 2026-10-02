# Workflow Contracts

## Skill execution

Every task begins with `les-bootstrap`. A selected skill loads its declared
policy and workflow dependencies, applies the route risk floor, and returns the
route evidence class. A skill may narrow scope; it cannot grant authority.

The execution record starts with objective, scope, repository identity, selected
route, risk, active profile, and acceptance. It ends with evidence, residual risk,
terminal status, and the next safe action.

Task-scoped responses end with a compact closeability footer:

```text
LES status: COMPLETE
Session: CLOSEABLE
Next safe action: none
```

Derive `Session` from the terminal status: only `COMPLETE` is `CLOSEABLE`; every
other status is `KEEP_OPEN` and names the unmet condition and next safe action.
Omit the footer for ordinary conversation that did not activate a LES task route.

Completion claims require current evidence. A skill may report that a check was
not run, unavailable, skipped, or stale; it may not promote that result to pass.

## Delivery ownership

**Activate:** implementation, bug fixing, refactoring, or another authorized
mutation task. The agent owns the delivered change's quality through completion.

1. Inspect the affected flow and define acceptance checks before editing.
2. Verify the change and review the final diff against acceptance, callers,
   boundaries, active policy, and unintended changes without waiting for a
   separate user request to review.
3. Fix findings within the authorized scope, rerun checks affected by each fix,
   and review the resulting diff. Finish when required checks pass on the final
   state and no known defect introduced by the change or preventing acceptance
   remains.
4. Hand off the outcome, current evidence, and residual uncertainty. Human diff
   review is required only when explicitly requested or mandated by active
   project governance; it is not a substitute for the agent's verification.

When a finding needs a scope decision, access, or additional authority, report
the exact blocker and next safe action with a non-`COMPLETE` status. Unresolved
delivery defects or unavailable required proof also prevent `COMPLETE`; naming
them as residual risk does not satisfy the completion gate. Passing checks and
no findings support the stated coverage, never a guarantee of zero mistakes.

For a read-only review or audit, report findings and coverage without modifying
files. That review task can be `COMPLETE` while the reviewed change needs fixes;
delivery correction requires implementation authority.

## Review findings

Each finding contains severity, location, observed evidence, impact, and a
safe next action. Absence of findings is a result, not proof that unrun checks
passed.

Review identity includes comparison point or working-tree manifest, dirty state,
freshness, coverage, and skipped reviewers. Agent-config files are executable
behavior and are reviewed as code, not dismissed as documentation.

## Team integration

One writer owns a file at a time. Parallel work uses disjoint paths or an
agreed integration order. On collision, preserve both intentions, re-establish
the current baseline, and recover through the handoff workflow.

Dispatch is cost-aware but coverage-first: inline execution is valid for small
work, while independent reviewers may run in parallel only when their ownership,
inputs, and result aggregation are explicit.

## Terminal statuses

Use only `COMPLETE`, `BLOCKED`, `PENDING_USER_ACTION`, `FAILED`, or `SKIPPED`.
Any non-`COMPLETE` status names the unmet condition and next safe action.

Evidence records never convert unavailable or waived checks into passes. A host
smoke waiver remains `PENDING_HOST_SMOKE` and is reported separately from local
package readiness.
