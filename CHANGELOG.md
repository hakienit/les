# Changelog

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
