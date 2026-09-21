# Frontend Design Quality Bar

Use this reference when a UI is being designed, reshaped, or judged visually.
It combines visual intent with the interaction and accessibility contract; it
does not turn personal taste into a universal requirement.

## Direction and review surface

Before implementation, state the design direction in one sentence and name the
surface the user will review:

- Use an in-stack page or route for treatment, motion, and final review.
- Use a standalone HTML specimen only for greybox or direction exploration.
- Record the affected journey, focal action, information hierarchy, and state
  matrix before choosing visual treatments.

## Quality bar

- Give the page one intentional focal point and a hierarchy that supports the
  journey; avoid interchangeable framework-default composition.
- Choose typography, color, spacing, icon, elevation, and motion as a coherent
  system using project tokens and a semantic color model.
- Treat loading, empty, success, error, disabled, permission, retry, focus,
  reduced-motion, and non-hover paths as part of the design when applicable.
- Make mobile and narrow layouts intentional rather than compressed desktop.
- Customize common controls only when the product goal benefits; preserve native
  semantics and platform behavior where they are already the best fit.

## Evidence gate

For visual acceptance, capture the rendered review surface at the supported
viewports and label the result as visual evidence. Pair it with separate
keyboard, accessibility-tree, automated, performance, and browser-journey
evidence. A polished screenshot cannot substitute for any of those categories.

## Scope guard

Do not add a motion library, generated asset, design dependency, or custom
interaction merely to satisfy this bar. Add it only when the product direction,
acceptance condition, or measured experience requires it.
