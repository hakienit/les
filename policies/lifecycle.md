# Task Lifecycle

Load each phase just in time. Do not claim a later state while an earlier exit is unmet.

## 1. Intake
**Activate:** task received. **Input:** request. **Output:** stated outcome and constraints. **Done when:** scope is restated. **Stop:** `BLOCKED` when outcome is unintelligible.

## 2. Instruction loading
**Activate:** intake complete. **Input:** runtime and LES entrypoints. **Output:** applicable instruction set. **Done when:** precedence is resolved. **Stop:** `BLOCKED` on contradiction.

## 3. Project context reconstruction
**Activate:** instructions loaded. **Input:** project entrypoint and repository state. **Output:** relevant conventions and current work state. **Done when:** affected area is located. **Stop:** `BLOCKED` when required context is unavailable.

## 4. Task-state recovery
**Activate:** prior work exists. **Input:** handoff, diff, and checks. **Output:** trusted current state. **Done when:** stale claims are revalidated. **Stop:** `BLOCKED` on unresolved ownership.

## 5. Affected-flow inspection
**Activate:** target located. **Input:** callers, dependencies, and boundaries. **Output:** responsible seam. **Done when:** related paths are inspected. **Stop:** `BLOCKED` when the flow cannot be determined.

## 6. Ambiguity resolution
**Activate:** a material choice is unclear. **Input:** alternatives and constraints. **Output:** accepted interpretation. **Done when:** acceptance has one meaning. **Stop:** `PENDING_USER_ACTION` when only a human can choose.

## 7. Risk classification
**Activate:** scope understood. **Input:** blast radius and reversibility. **Output:** highest R0–R3 level. **Done when:** required gate is named. **Stop:** `PENDING_USER_ACTION` before unapproved R3 action.

## 8. Acceptance definition
**Activate:** risk known. **Input:** requested outcome. **Output:** observable acceptance conditions. **Done when:** each condition has evidence. **Stop:** `BLOCKED` when proof cannot be defined.

## 9. Execution planning
**Activate:** acceptance defined. **Input:** seam, risk, and proof. **Output:** bounded sequence and rollback path. **Done when:** next action is safe. **Stop:** `PENDING_USER_ACTION` when the plan changes authorized scope.

## 10. Approval gate
**Activate:** R3 or explicit approval requirement. **Input:** immediate action and impact. **Output:** approval record. **Done when:** authority exists. **Stop:** `PENDING_USER_ACTION` without it.

## 11. Red proof or characterization
**Activate:** behavior or structure changes. **Input:** acceptance condition or current behavior. **Output:** failing check or preservation record. **Done when:** a regression would be detected. **Stop:** `SKIPPED` only with stated reason and alternative evidence.

## 12. Implementation
**Activate:** prior exit passes. **Input:** bounded plan. **Output:** smallest coherent change. **Done when:** requested behavior is present. **Stop:** `FAILED` on an unrecoverable execution error.

## 13. Focused verification
**Activate:** implementation complete. **Input:** targeted evidence. **Output:** focused result. **Done when:** changed contract is checked. **Stop:** `FAILED` on a failed required check.

## 14. Integrated verification
**Activate:** boundary or R2 change. **Input:** affected subsystem. **Output:** integration result. **Done when:** required tier passes. **Stop:** `SKIPPED` only when unavailable evidence is named.

## 15. Diff and policy review
**Activate:** verification complete. **Input:** final diff and active policy. **Output:** scope and policy assessment. **Done when:** findings are resolved or reported. **Stop:** `BLOCKED` on a policy conflict.

## 16. Knowledge or handoff promotion
**Activate:** durable finding or transfer. **Input:** verified record. **Output:** minimal project-owned record. **Done when:** durable knowledge is placed or explicitly not promoted. **Stop:** `SKIPPED` when nothing is durable.

## 17. Final state reporting
**Activate:** work ends. **Input:** outcome, evidence, and residual risk. **Output:** terminal status. **Done when:** status and next safe action are truthful. **Stop:** never conceal unmet conditions.
