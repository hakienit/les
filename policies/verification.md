# Verification

Use the lowest tier that proves the change, and escalate with risk. Fresh proof
beats confidence: a previous result is reusable only when repository identity,
changed paths, inputs, and environment still match:

1. Static: syntax, formatting, schema, and link checks.
2. Focused: smallest runnable check covering changed behavior.
3. Integrated: affected subsystem and contract checks.
4. System: build or end-to-end journey across boundaries.
5. Release: clean package, security, compatibility, and rollback evidence.

R0 needs inspection evidence; R1 needs tiers 1–2; R2 needs tiers 1–3 and the
relevant higher tier; R3 needs explicit approval plus tier 5 when releasing.
Report skipped or unavailable checks by name and never convert them into passes.
