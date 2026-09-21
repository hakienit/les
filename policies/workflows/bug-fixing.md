# Workflow: Bug Fixing

**Trigger:** incorrect, failing, or regressed behavior. **Inputs:** symptom, reproduction, affected flow, user impact, and repository state.
**Procedure:** build a tight red-capable reproduction; inspect callers and boundaries to locate the shared cause; rank falsifiable hypotheses; add regression proof at the correct seam; fix the owner; rerun original and integrated checks. **Done when:** the proof and affected integration pass, cleanup is complete, and the root cause is stated.
**Risk and approval:** classify before mutation. **Output artifact:** cause, hypothesis record, correction, regression proof, and residual risk.
**Terminal statuses:** use `../workflow-contracts.md`. **Verification evidence:** reproduction, red/green result, original symptom, regression result, and cleanup.
**Recovery:** report `BLOCKED` when unreproducible or no valid seam exists; do not apply an unproven edit.
