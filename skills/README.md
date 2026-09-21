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

Frontend work is a first-class LES track. The frontend router selects design,
experience, accessibility, performance, responsive interaction, and verification
evidence without choosing a framework or component library. Frontend references
are progressively disclosed for visual quality, browser experience, and
React/Next performance; they do not override universal LES authority or project
decisions.
