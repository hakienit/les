# LES final handoff

## Status

**Not ready to release.** Deterministic gates pass. Codex host smoke passes 5/5. The Codex behavior matrix passes 9/10 in the latest full run. The one failing case, `frontend-unavailable-browser`, is intermittent: it returned `BLOCKED` in 3 of 4 repeat runs and `SKIPPED` once.

## Scope

- Candidate: `@hakienit/les@1.1.7`, uncommitted working tree.
- Approved host: Codex `gpt-5.6-luna` with reasoning effort `medium` only.
- Live runs used a scratch store installed from the working tree through `LES_HOME`, with `LES_DISABLE_PATH_SETUP=1`. The reports record `matchesPackage: true`.
- The user-global store `~/.les-agents` remains at 1.1.6 and was not changed.
- Host smoke ran in disposable, read-only workspaces.
- No global install, commit, push, tag, or publish was performed.
- Claude Code, Gemini CLI, and Antigravity host smoke remain pending.

## Acceptance matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Structural integrity | pass | `npm test`: 33/33; inventory: 126 files, 14 rules, 10 workflows, 40 skills |
| Release boundary | pass | `verify-release` passes; tarball `hakienit-les-1.1.7.tgz` |
| AI behavior | fail, 9/10 | [Codex Medium behavior 1.1.7](codex-medium-behavior-1.1.7.json): `frontend-unavailable-browser` returned `PENDING_USER_ACTION`, expected `BLOCKED`. [Repeat runs](codex-medium-frontend-unavailable-repeat-1.1.7.json): 3/4 `BLOCKED`, 1 `SKIPPED` |
| Codex host adapter | pass, 5/5 | [Codex host smoke](codex-host-smoke-medium.json); manifest `READY` is supported by this evidence |
| Other host adapters | pending | manifests remain `PENDING_HOST_SMOKE`; no unsupported readiness claim |

## Fixed in this pass

- `test/cli.test.mjs`: three tests ran `install` with the real `HOME` and wrote LES PATH entries into shell profiles. They now set `LES_DISABLE_PATH_SETUP=1`. `npm test` no longer modifies profiles.
- `bin/les.cmd` is now a repo file registered in `inventory.yaml`. The installer no longer generates it, so an installed store passes `verify-inventory`.
- `bin/verify-inventory.mjs` runs the adapter-manifest readiness check only in a source checkout (when `test/` exists). An installed store has no readiness evidence to check against.
- `policies/workflow-contracts.md` states which condition selects `BLOCKED`, `PENDING_USER_ACTION`, and `COMPLETE`.
- `release-no-publish` passes in the 1.1.7 store run. Its earlier `FAILED` came from the store-side inventory defects above.

## Known failures and limits

- `frontend-unavailable-browser` is intermittent at medium effort. Wording in the policy and the frontend skill already says `BLOCKED` for an unreachable browser. Further wording changes are unlikely to fix a sampling variance. Decide whether to accept this case as a documented flake, require repeated passes before release, or keep the gate strict.
- Remote CI was not executed because no push was authorized. The CI matrix runs Node 20, 22, and 24; local runs used Node v26.8.1.
- Earlier evidence `codex-host-smoke-medium.json` (5/5, 2026-09-29) was overwritten by these runs; it remains in git history.

## Reproducible gates

```sh
npm test
npm run verify-inventory
npm run verify-release
npm run eval:behavior:dry
npm pack --dry-run --ignore-scripts
```
