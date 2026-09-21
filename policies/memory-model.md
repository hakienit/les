# Memory Model

- Task state is temporary: plan, current findings, checks, blockers, and handoff.
- Project knowledge is durable: verified terminology, decisions, commands, and pitfalls.
- LES policy is package-owned and changes only through LES review.
- Personal preferences and credentials stay outside LES and project knowledge.

Promote a finding only when it is reusable, evidence-backed, and has a clear
project owner. Record decisions as project ADRs; never turn one project's choice
into universal LES policy.

Every handoff or durable record separates:

- verified facts and exact evidence;
- inferences and their confidence;
- proposals awaiting authority; and
- stale, unavailable, or conflicting checks.

Task state expires when its repository identity, dirty paths, or evidence changes.
Durable knowledge carries an owner and an update trigger.
