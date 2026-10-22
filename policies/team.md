# Team Model

**Activate:** work that is R1 and multi-step, R2 or higher, or needs more than
one route. Smaller work stays with the Lead and does not load this file.

LES runs as an IT organization. The **Lead** is the session agent: it
bootstraps, classifies, dispatches, integrates, and alone reports the terminal
status. **Departments** do bounded work from a brief. The canonical registry is
`departments` in `inventory.yaml`; every skill has exactly one owner.

| Department | Tier | Access | Owns |
| --- | --- | --- | --- |
| Lead | session | write | bootstrap, handoff, knowledge promotion, retrospective |
| Product | standard | write | discovery, specification, domain modeling, triage |
| Architecture | deep | write | architecture, planning, decomposition, research, prototyping, dependencies, agent instructions |
| Engineering | standard | write | feature, defect, refactoring, surgical patch, migration, test-first |
| Frontend | standard | write | frontend profile: UI, design, preview gate, performance, experience, accessibility |
| QA | fast | read | verification, frontend verification, repository quality gates |
| Security | deep | read | trust-boundary review |
| Review | deep | read | change review, quality audit |
| DevOps | standard | write | git safety, merge conflicts, release readiness, incidents, runbooks, workspace isolation |
| Scout | fast | read | investigation and code location |

Tiers set capability against cost: `fast` for search, reading, and running
checks; `standard` for implementation; `deep` for judgment where a miss is
expensive. A host maps tiers to its own models.

## Dispatch ladder

Pick the lowest rung that covers the work. Each extra department costs a brief
and a report, so dispatch only when isolation, independence, or a cheaper tier
pays for that overhead.

1. **Solo** (R0, or R1 in one route): the Lead works inline. No dispatch.
2. **Pair** (R1, multi-step): one owning department delivers; the Lead verifies.
   Add Scout first when the affected code is unfamiliar, so wide reads stay in
   the `fast` tier.
3. **Squad** (R2): Architecture plans, the owning department delivers, then QA
   and Review run independently and may run in parallel.
4. **Touchpoints** add one department each: Security for a trust boundary,
   Frontend for the frontend profile, DevOps for history or release operations.
5. **R3**: Squad plus the human approval gate immediately before the action.
   DevOps executes only after that approval.

## Brief

The Lead sends each department one brief: objective, route and skill, risk,
granted authority, owned paths, acceptance checks, and the facts already
established as paths, line ranges, or short excerpts. A department inherits the
Lead's bootstrap through the brief. It loads its skill and that skill's
non-bootstrap dependencies, not the kernel or files the brief already
summarizes.

## Report

A department returns: status (from `workflow-contracts.md`), changed paths,
checks run with exit status, findings in the review-finding shape, residual
risk, and the next safe action. No narrative, no file dumps, no restated brief.

## Collaboration

- One writer owns a path at a time; the brief names it. Others propose, not edit.
- Read-only departments never modify files. A finding goes back to the Lead,
  who routes the fix to the owning writer.
- No department reviews its own output. Review and Security are independent of
  the writer whose change they assess.
- Departments do not dispatch other agents or grant authority. Only the Lead
  dispatches, so cost stays bounded.
- A disagreement between departments goes to the Lead with both evidence sets.
  The Lead decides within its authority or reports `PENDING_USER_ACTION`.
- The Lead may not report `COMPLETE` over a failed or missing department check.

## Hosts

With `les connect`, Claude Code gets one subagent per department in
`.claude/agents/les-<id>.md`, with the tier mapped to a model. Dispatch to
`les-<id>`. On a host without subagents, the Lead runs the departments in
sequence and keeps the brief and report boundary between them, loading only the
active department's skill.
