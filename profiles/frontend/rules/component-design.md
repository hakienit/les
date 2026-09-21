# Component Design

Keep components responsible for one user-facing concept. Prefer semantic native
elements, explicit inputs, and composition over mode-heavy components. Put shared
state above the lowest common consumer and keep domain decisions outside rendering.
Use project design tokens for color, spacing, typography, radius, and motion; do
not introduce raw component-level colors or arbitrary magic values. Use a coherent
icon family with labels for controls, and keep visual decisions separate from
transport or domain state.
