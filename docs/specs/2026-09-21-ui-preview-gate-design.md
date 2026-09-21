# UI Preview Gate and Skill Selection Design

**Status:** Implemented locally
**Date:** 2026-09-21
**Target:** LES `v1.0.1`

## Objective

Add a public LES frontend skill that previews UI options from a Figma link or
wireframe before implementation, while making skill selection composable and
bounded. The selected design must reuse the adopting repository's existing
design system, UI kit, components, tokens, and conventions.

## Scope

This change adds `les-ui-preview-gate` and a small selection contract for the
existing 39-skill catalog. It does not add separate state, API-boundary,
responsive-proof, or visual-regression skills.

The gallery is project-owned output. A preview run records every option and its
source/feedback metadata under `docs/ui-sandbox/`; the preview gate may open the
rendered artifact when a safe browser is available.

## Selection contract

- `les-bootstrap` always loads first and is not counted as a task skill.
- Select exactly one primary (`P`) route for the requested outcome.
- Add at most one specialist (`O`/`R`) when a concrete boundary requires it.
- User-invoked review skills run only when the user asks for that review.
- `test-first` supplements a delivery route; it does not replace it.
- Frontend implementation without a Figma/wireframe uses `les-frontend`.
- Frontend implementation with a Figma/wireframe uses `les-ui-preview-gate` as
  the primary route. It owns the preview/feedback gate and hands off to normal
  implementation only after the user selects an option.
- `les-frontend-verification` is a post-implementation proof route, not a
  competing implementation route.

Route metadata documents `role`, `phase`, and composition/near-miss behavior;
fixtures cover overlapping frontend prompts rather than only isolated examples.

## Preview gate behavior

1. Read the reference and inspect the project's design system, UI kit, existing
   component seams, tokens, and conventions.
2. Produce three to four preview options using existing UI primitives and state
   the reuse map for each option.
3. Record each option as `Draft` in the project gallery and open the safe preview.
4. Wait for selection, a focused question, or feedback. Feedback creates a new
   draft round and preserves previous options.
5. Mark the chosen option `Selected`; only then may implementation begin.
6. Mark the applied option `Implemented` after implementation evidence exists.
   Older options remain available as `Superseded` when replaced by a later round.

If no safe preview can be opened, the skill reports `unavailable` and stops
before implementation. If a required component is missing, it asks the user for
direction instead of creating a new component.

## Boundaries and evidence

The skill does not publish, commit, push, choose a framework, invent a design
system, or silently create replacement components. Its output names the source,
option IDs, reuse map, feedback/selection state, preview evidence, and terminal
status. Visual evidence remains distinct from keyboard, accessibility,
responsive, browser, and implementation evidence.

## Acceptance conditions

1. The new skill has valid LES frontmatter, bootstrap inheritance, a positive
   trigger, near-miss, unauthorized stop, output contract, and frontend profile.
2. Inventory, route registry, catalog, adapter manifests, package files, and
   fixtures agree on the new skill.
3. Frontend route fixtures prove primary/specialist selection for Figma,
   generic UI, UX review, accessibility review, performance, and verification.
4. Existing skill behavior and release/package gates remain passing.
5. No implementation occurs before an explicit `Selected` option.
