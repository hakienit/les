# UI Preview Gate `v1.0.1` Plan

**Status:** Implemented locally; release gates passed
**Date:** 2026-09-21
**Spec:** `docs/specs/2026-09-21-ui-preview-gate-design.md`

## Objective

Ship one frontend skill and a deterministic selection contract without adding
parallel specialist skills or changing provider activation behavior.

## Ordered changes

1. Add `skills/ui-preview-gate/SKILL.md` with model invocation, frontend
   profile, Figma/wireframe trigger, preview/feedback/selection procedure,
   design-system reuse guard, gallery metadata, and terminal evidence.
2. Add `les-ui-preview-gate` to `inventory.yaml` and add its `frontend-preview`
   touchpoint to `routes.yaml`. Add route role/phase/composition metadata only
   where needed to express primary versus specialist selection.
3. Update `skills/README.md` with the one-primary/one-specialist selection
   contract and the frontend decision table.
4. Add positive, near-miss, stop, and overlap fixtures for the new route. Extend
   routing tests to assert composition and to keep the six existing frontend
   routes from competing with the preview gate.
5. Regenerate adapter manifests from inventory.
6. Bump `package.json` to `1.0.1` and add a concise changelog entry.
7. Run focused tests, full tests, inventory verification, release verification,
   and inspect the final diff/package boundary.

## Owned paths

- Skill: `skills/ui-preview-gate/SKILL.md`
- Routing/catalog: `routes.yaml`, `inventory.yaml`, `skills/README.md`
- Evidence: `test/fixtures/route-cases.json`,
  `test/fixtures/skill-cases.json`, `test/fixtures/host-scenarios.json`,
  `test/operationalization.test.mjs`
- Release: `adapters/*/manifest.json`, `package.json`, `CHANGELOG.md`

## Verification

- Static: frontmatter/registry consistency and generated manifest equality.
- Focused: new positive, near-miss, unauthorized-stop, and overlapping frontend
  route fixtures.
- Integrated: `npm test`, `npm run verify-inventory`, and
  `npm run verify-release`.
- Unavailable: live browser/host smoke remains explicitly unavailable unless
  evidence is already present; it is not converted into release readiness.

## Rollback

Remove the new skill and its registry/fixture/release entries, regenerate
manifests, and restore package metadata. Existing 39-skill behavior remains the
rollback baseline.

## Stop condition

Stop before implementation if the selection contract cannot express one primary
route plus at most one specialist, or if the new skill would need a new runtime
service rather than LES instruction content.
