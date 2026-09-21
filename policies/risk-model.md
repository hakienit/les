# Risk Model

| Level | Typical effect | Gate |
| --- | --- | --- |
| R0 | Read-only inspection | Proceed. |
| R1 | Reversible local edit | Proceed within stated scope. |
| R2 | Broad or compatibility-sensitive edit | Plan, targeted proof, rollback path. |
| R3 | External mutation, release, credentials, destructive action | Explicit human approval immediately before action. |

Raise risk for uncertain targets, weak rollback, security boundaries, user data,
or wide blast radius. The highest applicable level governs. Lack of approval for
R3 means `PENDING_USER_ACTION`, not permission by implication.
