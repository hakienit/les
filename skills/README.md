# LES Skill Catalog

`inventory.yaml` is the canonical machine registry and `routes.yaml` is the
canonical selection registry. Every operational skill lives directly under this
root. Stable skills are promoted by host manifests; experimental skills remain
discoverable only through explicit local metadata.

Invoke `les-bootstrap` for any task. User-invoked skills are
`les-quality-audit`, `les-security-review`, `les-release-readiness`,
`les-accessibility-review`, `les-frontend-experience-review`,
`les-agent-instruction-authoring`, and `les-operator-runbook`; all other
non-bootstrap skills may be model-routed or explicitly invoked.

## Selection contract

Load one primary route for the requested outcome and at most one specialist
route for a concrete boundary. `touchpoint` routes add constraints; they do not
replace the primary task route. `test-first` is an overlay for delivery work,
and verification routes run after implementation. User-invoked review skills
run only when requested.

For frontend work:

- use `les-ui-preview-gate` for implementation from a Figma link, screenshot, or
  wireframe; it blocks implementation until a preview option is selected;
- use `les-frontend` for ordinary UI implementation without a design reference;
- use `les-frontend-design` for a design contract without implementation;
- use `les-accessibility-review` for explicit accessibility review;
- use `les-frontend-experience-review` for explicit UX/journey review;
- use `les-frontend-performance` only for measured frontend cost; and
- use `les-frontend-verification` for post-implementation UI proof.

Frontend work is a first-class LES track. The frontend router selects design,
experience, accessibility, performance, responsive interaction, and verification
evidence without choosing a framework or component library. Frontend references
are progressively disclosed for visual quality, browser experience, and
React/Next performance; they do not override universal LES authority or project
decisions.
