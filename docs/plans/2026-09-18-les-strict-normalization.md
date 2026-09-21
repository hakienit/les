# LES Strict Normalization Implementation Plan

**Spec:** `docs/specs/2026-09-18-les-strict-normalization-design.md`  
**Risk:** High — replaces LES authority, discovery, package, and installation contracts.  
**Authorization:** Architecture and implementation approved by the maintainer on 2026-09-18.
**Status:** Complete locally; no publish, install, provider mutation, or commit performed.

## Scope

Replace the incomplete, unpublished layout with one provider-neutral package
containing canonical policies, discoverable skills, optional profiles, project
templates, adapter metadata, a validated inventory, and the existing safe CLI
operations.

## Exclusions

- No publish, global install, real provider mutation, commit, push, or network
  integration.
- No compatibility layer for the unpublished legacy layout.
- No external research, source reference, or attributed third-party content.

## Execution order

1. **Create red contract checks**
   - Extend `test/cli.test.mjs` for inventory coverage, canonical paths,
     bootstrap discovery, adapter metadata, package allowlist, and forbidden
     reference detection.
   - Verify the new checks fail against the current layout.

2. **Add canonical inventory and validator**
   - Add `inventory.yaml`.
   - Add `bin/verify-inventory.mjs` using Node standard library only.
   - Register kernel, rules, workflows, skills, profile, templates, adapters,
     validators, and CLI paths.

3. **Build independently authored policies**
   - Add the kernel under `policies/`.
   - Add fourteen registered universal rules.
   - Add ten registered operational workflows.
   - Keep authority, activation, stop conditions, and evidence explicit.

4. **Build the frontend profile**
   - Add seven registered frontend rules.
   - Add one frontend routing skill without project-specific library choices.

5. **Replace passive skills**
   - Add `les-bootstrap` plus registered engineering and governance skills.
   - Make each skill thin and point to canonical policy/workflow paths.
   - Remove the legacy nested catalog.

6. **Add adapter discovery metadata**
   - Preserve thin human-readable adapter entrypoints.
   - Add a machine-readable LES adapter manifest for each provider.
   - Validate every declared skill and bootstrap path.

7. **Normalize project templates and CLI payload**
   - Replace `project/` with `templates/project/`.
   - Update CLI payload, doctor, diff/update/rollback paths, and package files.
   - Preserve collision and backup behavior.

8. **Remove legacy and external-reference artifacts**
   - Remove old Core, old P-phase evidence, legacy source-comparison material,
     and the temporary normalization input.
   - Keep only current LES-owned product docs required for users.

9. **Run full proof**
   - `npm test`
   - `npm run verify-inventory`
   - `npm run verify-release`
   - syntax checks for every executable
   - package dry-run and clean-reference scan
   - record a new normalization handoff without committing or publishing

## Stop condition

Stop when all registered paths, discovery routes, CLI fixtures, and package
boundaries pass locally. Report any unavailable provider smoke as pending; it
does not permit a false-ready result.
