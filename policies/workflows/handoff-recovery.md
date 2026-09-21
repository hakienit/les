# Workflow: Handoff and Recovery

**Trigger:** work pauses, changes owner, or resumes incomplete. **Inputs:** objective, repository identity, work state, decisions, changed paths, dirty state, checks, blockers, and next action.
**Procedure:** record verified facts and authority; capture current tree and evidence identity; on recovery re-check ownership and rerun stale proof; reconcile conflicts before continuing. **Done when:** the next exact safe action is reproducible from the record.
**Risk and approval:** never infer authority from a handoff. **Output artifact:** handoff record.
**Terminal statuses:** use `../workflow-contracts.md`. **Verification evidence:** repository identity, changed-path manifest, commands, exit status, and stale-proof result.
**Recovery:** escalate ownership conflicts as `BLOCKED`.
