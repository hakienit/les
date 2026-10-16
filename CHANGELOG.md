# Changelog

## 1.2.1 - 2026-10-16

- `les guard on` now adds `.claude/settings.local.json` to the repository's `.git/info/exclude`, so the personal hook file does not show up in `git status`. It is skipped outside a git repository.
- Rewrite `README.md` as a landing page: why LES, quick start, how it works, commands, and safety nets, with installer and legacy details collapsed.

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
