# Workflow: Investigation

**Trigger:** cause, scope, or behavior is uncertain. **Inputs:** observed symptom, affected flow, available evidence, and read-only access.
**Procedure:** reproduce or characterize; rank 3–5 falsifiable hypotheses; run the cheapest discriminating read-only check one variable at a time; record supporting and conflicting evidence; update ranking and confidence. **Done when:** evidence supports a next safe action or the missing access/seam is explicit.
**Risk and approval:** diagnosis does not authorize mutation. **Output artifact:** hypothesis report with reproduction, probes, confidence, and next action.
**Terminal statuses:** use `../workflow-contracts.md`. **Verification evidence:** observed facts, commands, outputs, conflicting facts, and unavailable evidence.
**Recovery:** hand off uncertainty or route a confirmed defect to bug fixing; never turn a hypothesis into a fix silently.
