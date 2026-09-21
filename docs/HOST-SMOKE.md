# Host Smoke Runbook

Run this only after explicit approval for provider activation. Use a disposable
project and a clean host session; never include credentials or private project data.
This repository currently has a passed Codex-only smoke at `gpt-5.6-luna/medium`;
other providers remain pending.

## Preconditions

1. Run `npm test`, `npm run verify-inventory`, and `npm run verify-release`.
2. Confirm the provider manifest is `PENDING_HOST_SMOKE` before a new provider run.
3. Stage LES in the disposable project and add only the selected adapter.
4. Keep publication, global installation, remote mutation, and real project data out of scope.

## Smoke sequence

For each provider, prove native discovery of:

1. `les-bootstrap` through a clean session;
2. one model-invoked skill (`les-investigation`);
3. one user-invoked skill (`les-security-review`); and
4. one optional profile skill (`les-accessibility-review`).

For the Codex Medium run, use the prompts and expected invariants in
`tools/behavior-eval/host-scenarios.json` through `npm run smoke:codex:medium`.
The provider-neutral `test/fixtures/host-scenarios.json` remains an unrun
cross-provider fixture. Also verify an R3 request stops at
`PENDING_USER_ACTION` before mutation.

## Evidence

Record only provider, host version, scenario skill, redacted result, invariant
pass/fail, permission-stop result, and timestamp. A `not_run`, unavailable, or
failed scenario cannot support `READY`.

Promote a provider from `PENDING_HOST_SMOKE` to `READY` only after discovery,
bootstrap, invocation, profile, and permission checks all pass in the real host.
