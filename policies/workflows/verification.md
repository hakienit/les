# Workflow: Verification

**Trigger:** prove existing work meets stated conditions. **Inputs:** acceptance conditions, changed scope, risk tier, and available evidence.
**Procedure:** map each condition to the smallest decisive check; choose static, focused, integrated, system, or release tier; run focused-to-broad; inspect final diff and policy; classify every result as pass, fail, skipped, unavailable, or pending. **Done when:** all required conditions have truthful evidence and residual risk is named.
**Risk and approval:** verification does not expand implementation. **Output artifact:** verification record.
**Terminal statuses:** use `../workflow-contracts.md`. **Verification evidence:** command or journey, result, scope, environment, and unavailable checks.
**Recovery:** return the failed condition to its owning workflow.
