# Workflow: Review

**Trigger:** assess a change, plan, or release candidate. **Inputs:** comparison point, objective, acceptance source, repository identity, and dirty manifest.
**Procedure:** resolve review identity and freshness; route correctness, tests, security, frontend, and release coverage conservatively; inspect callers, boundaries, behavior, compatibility, tests, documentation, and agent-config changes; keep standards/compliance findings separate from acceptance/spec findings; deduplicate and rank findings. Each finding contains severity, location, observed evidence, impact, and a safe next action; absence of findings is a result, not proof that unrun checks passed. Review identity includes comparison point or working-tree manifest, dirty state, freshness, coverage, and skipped reviewers. Agent-config files are executable behavior and are reviewed as code, not dismissed as documentation. **Done when:** findings or no-finding result is evidence-backed and coverage is explicit.
**Risk and approval:** review is read-only unless a fix is requested. **Output artifact:** severity-ordered findings.
**Terminal statuses:** use `../workflow-contracts.md`. **Verification evidence:** exact locations, observed paths, commands, coverage, and freshness.
**Recovery:** report residual untested risk.
