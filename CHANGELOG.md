# Changelog

## 1.5.0 - 2026-10-19

- `les doctor` reports the Claude Code guard: `READY` when `les guard on` is active, `FALLBACK` (exit code unchanged) when it is off, since nothing then injects the bootstrap or enforces the status footer.
- `les init` recommends `les guard on` for Claude Code. The guard stays opt-in.

## 1.4.0 - 2026-10-19

- Add `les guard on codex` and `les guard on gemini`: the risky-call check for Codex and Gemini CLI shell commands, without the bootstrap read gate.
- Inject the bootstrap at session start: it now fits the 10,000-character hook cap (17,004 to 9,709 characters), and `verify-inventory` fails if it stops fitting. The read list and gate remain as the fallback.
- `lifecycle.md` and `workflows/task-lifecycle.md` leave the always-loaded set; review-findings and team-integration text moved into `workflows/review.md` and `workflows/handoff-recovery.md`.
- Add a Stop hook that sends back, once, a reply that used tools but lacks the LES status footer.
- Fail closed: `les guard on` sets `onFailure: "block"` on the PreToolUse hook (Claude Code 2.1.295 or later), so a missing or crashing guard blocks the call. Run `les guard off` in a normal terminal to remove it. Session start warns when the bootstrap `loads` line is unreadable.
- Fix: the guard compared unresolved paths and silently did nothing when installed behind a symlink.
- `verify-inventory` now checks that the bootstrap `loads`, the inventory kernel, and `policies/README.md` list the same policies.
## 1.3.2 - 2026-10-17

- Trim `README.md` to a minimal landing page: install, why, commands, and update.

## 1.3.1 - 2026-10-17

- Fix Windows: `les connect` and `les doctor` now detect provider CLIs installed as npm `.cmd` shims, such as `codex` and `gemini`.
- Fix Windows: `les guard off` removes the guard hooks, and `les guard on` no longer adds them twice.
- Fix Windows: the guard allows deletes inside the project and matches bootstrap reads regardless of drive-letter case.
- Fix Windows: install manifests and `les diff` use `/` paths, so legacy updates no longer report every file as missing.
- Force LF line endings with `.gitattributes`, and make `verify-inventory`, `verify-release`, and the tests pass on Windows and npm 12. CI now also runs on `windows-latest`.

## 1.3.0 - 2026-10-16

- `les guard on` now also enforces the bootstrap in Claude Code. A `SessionStart` hook (`guard.mjs session-start`) resets a per-session read log after startup, resume, `/clear`, and compaction. The `PreToolUse` guard then blocks `Edit`, `Write`, `MultiEdit`, `NotebookEdit`, and `Bash` until the adapter, `les-bootstrap`, and every file it `loads` were read with the Read tool. `les guard off` removes both hooks.

## 1.2.1 - 2026-10-16

- `les guard on` now adds `.claude/settings.local.json` to the repository's `.git/info/exclude`, so the personal hook file does not show up in `git status`. It is skipped outside a git repository.
- Rewrite `README.md` as a landing page with a banner, an npm downloads badge, a flow diagram, a command reference, and the safety nets, with installer and legacy details collapsed.
- Let `verify-inventory` accept only the npm downloads badge and npm package page URLs for `@hakienit/les` in public files.

## 1.2.0 - 2026-10-16

- Add `les lint FILE...` to flag placeholders, unmeasurable or unverifiable acceptance criteria, and files with no acceptance section.
- Add `les guard on|off`, an opt-in Claude Code `PreToolUse` hook written to `.claude/settings.local.json`. It blocks secret reads, deletes outside the project, and force pushes to protected branches, and preserves other hooks and settings.

## 1.1.8 - 2026-10-16

- Simplify `les connect`: create `LES-AGENT.md` when missing, accept provider names or `--all`, and use one preselected prompt instead of two. Hide legacy `active` and repo-scope commands from help; they still work.
- Extend `les doctor` with `store-integrity` (managed files against manifest hashes) and `bootstrap-pointer` (`LES-AGENT.md` paths that no longer resolve in the store).
- Persist the user-local `les` PATH in `.profile` and the login shell's rc file, refreshing other known profiles only when they exist; print one install message with a reload command.
- Show the skill-path upgrade notice only when upgrading from a version before 1.1.2.

## 1.1.7 - 2026-10-14

- Require feature delivery, bug fixing, and refactoring completion to meet the delivery ownership contract, so known delivery defects block `COMPLETE` in the skill and workflow path too.
- Clarify terminal status selection: contradictions and unresolved ownership are `BLOCKED` even when an owner must act; `PENDING_USER_ACTION` is for approvals and choices the agent cannot make.
- Ship `bin/les.cmd` as a registered public path, and skip the source-only readiness check when verifying an installed store.

## 1.1.6 - 2026-10-02

- Make agents own verification, diff review, correction, and fresh proof before delivery, without requiring users to request another diff review.
- Keep delivery incomplete when known delivery defects or required evidence remain unresolved, while preserving read-only review authority.
- Add delivery completion scenarios and pin evaluation entrypoints to the selected LES store; retain checks and next safe actions in behavior reports.

## 1.1.5 - 2026-09-29

- Add a Claude Code (Haiku 4.5) host smoke to `tools/behavior-eval.mjs` with a read-only tool set, an allowlisted host environment, and installed-store version reporting.
- Drop the stale `packageVersion` field from `inventory.yaml`.

## 1.1.4 - 2026-09-25

- Persist the user-local `les` command in `ZDOTDIR` and PowerShell profiles,
  alongside the existing POSIX and Windows PATH setup.
- Define task-scoped session closeability in the LES workflow contract.

## 1.1.3 - 2026-09-22

- Repair stale LES PATH snippets when reinstalling the user-local CLI.

## 1.1.2 - 2026-09-22

- Prefix skill directories with `les-` to keep LES paths distinct from other agent skill catalogs.
- Notify users after updating an existing install that repositories must refresh their `LES-AGENT.md` skill pointer.

## 1.1.1 - 2026-09-22

- Persist the user-local `les` command in common shell profiles and Windows User PATH during installation.
- Add a Windows `les.cmd` launcher for terminals that do not execute extensionless shell scripts.

## 1.1.0 - 2026-09-21

- Add interactive `les connect` multi-provider discovery with `Select all` and default-on selection.

## 1.0.2 - 2026-09-21

- Fix `les doctor` missing newly published npm updates while a current-version cache entry is still fresh.

## 1.0.1 - 2026-09-21

- Add `les-ui-preview-gate` for Figma/wireframe preview selection before frontend implementation.
- Add bounded primary/specialist frontend route selection evidence and gallery status guidance.

## 1.0.0 - 2026-09-21

- Install LES once in user-local `~/.les-agents`; repositories keep only `LES-AGENT.md` and provider pointers.
- Add `les init`, user-local routing state, and collision-safe native CLI shims.
- Add cached daily update notices through `les doctor`.
- Keep repo-local `.les-agents/` Markdown-only and gitignored; run the CLI from
  the pinned package instead of copying LES source code into the repository.
- Add repo-local `.les-agents` installation with `on`/`off` routing controls.
- Keep provider pointers collision-safe and independent from global agent directories.

## 0.1.0

- Establish the strict LES policy kernel, registered rules and workflows.
- Add discoverable operational skills, frontend profile, adapter manifests, and project templates.
- Expand the operational catalog to 27 distinct lifecycle, engineering, assurance, repository, governance, and frontend entrypoints.
- Add inventory and local release verification gates.
