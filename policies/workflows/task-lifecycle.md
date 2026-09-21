# Workflow: Task Lifecycle

**Trigger:** any accepted task. **Inputs:** request, runtime, project context, repository state, kernel, and active work state.
**Procedure:** load precedence and bootstrap; resolve route and fallback; reconstruct context and ownership; define acceptance and risk; choose the narrowest workflow; execute only after prior exits pass; verify, review, promote/handoff, and report final state. **Done when:** the selected route has truthful terminal evidence and the next safe action is explicit.
**Risk and approval:** classify under `../risk-model.md`; stop before unapproved R3 action or unresolved authority.
**Output artifact:** task state, context trace, evidence record, residual risk, and terminal status. **Terminal statuses:** use `../workflow-contracts.md`.
**Verification evidence:** acceptance-to-check mapping, commands or journeys, skipped/unavailable checks, and final diff/policy review. **Recovery:** use handoff recovery when state is stale or ownership collides.
