# LES Policies

This directory is the canonical authority for LES behavior. Load the kernel for
every task, then only the rules and workflow activated by that task.

Kernel order: `principles.md`, `precedence.md`, `risk-model.md`,
`memory-model.md`, `verification.md`, and `workflow-contracts.md`.
`lifecycle.md` holds the 17 phase details; load a phase when its trigger matches.
Rules constrain decisions; workflows sequence work. Skills route to both and
never redefine them.
