# Workflow: Feature Delivery

**Trigger:** new user-visible or system behavior. **Inputs:** acceptance, affected flow, constraints, project context, and route evidence.
**Procedure:** resolve outcome and exclusions; inspect callers and ownership; classify risk; establish red proof or characterization; implement one vertical slice; run focused and integrated verification; review the final diff. **Done when:** every acceptance condition has evidence and no unapproved scope remains.
**Risk and approval:** apply risk policy and require approval at R3. **Output artifact:** working slice, changed-path manifest, verification record, and residual-risk report.
**Terminal statuses:** use `../workflow-contracts.md`. **Verification evidence:** focused and integrated checks.
**Recovery:** preserve unrelated work, revert or isolate the failed slice, and hand off the exact failed proof and next safe action.
