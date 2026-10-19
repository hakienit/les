# Workflow Contracts

## Skill execution

Every task begins with `les-bootstrap`. A selected skill loads its declared
policy and workflow dependencies, applies the route risk floor, and returns the
route evidence class. A skill may narrow scope; it cannot grant authority.

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
   user request to review.
3. Fix findings within the authorized scope, rerun checks affected by each fix,
   and review the resulting diff. Finish when required checks pass on the final
   state and no known defect introduced by the change or preventing acceptance
   remains.
4. Hand off the outcome, current evidence, and residual uncertainty. Human diff
   review is required only when requested or mandated by project governance.

When a finding needs a scope decision, access, or authority, report the exact
blocker and next safe action with a non-`COMPLETE` status. Unresolved delivery
defects or unavailable required proof also prevent `COMPLETE`; naming them as
residual risk does not satisfy the gate. Passing checks support the stated
coverage, never a guarantee of zero mistakes.

A read-only review or audit reports findings and coverage without modifying
files. It can be `COMPLETE` while the reviewed change needs fixes; correction
requires implementation authority.

Review findings are defined in `workflows/review.md`; parallel-work rules are in `workflows/handoff-recovery.md`.

## Terminal statuses

Use only `COMPLETE`, `BLOCKED`, `PENDING_USER_ACTION`, `FAILED`, or `SKIPPED`.
Any non-`COMPLETE` status names the unmet condition and next safe action.

Choose by the condition, not by who must act:
- `BLOCKED`: a contradiction between same-authority instructions, unresolved
  ownership, unavailable required context or evidence (browser, host, or
  runtime), or an undeterminable flow. Use it even when an owner must resolve it.
- `SKIPPED`: a verification tier that does not apply, with the alternative
  evidence named. Required evidence that is unavailable is never `SKIPPED`.
- `PENDING_USER_ACTION`: an approval gate, or a choice among valid options that
  the agent cannot make.
- `COMPLETE`: the workflow's Done-when is met. An investigation is `COMPLETE`
  when it names the missing access or evidence as the next safe action.

Evidence records never convert unavailable or waived checks into passes. A host
smoke waiver remains `PENDING_HOST_SMOKE` and is reported separately from local
package readiness.
