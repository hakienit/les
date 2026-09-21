# Architecture

**Activate:** changes to boundaries, interfaces, data flow, or ownership.

Trace callers and consumers before moving a seam. Prefer one clear owner per
concept and a deep module: substantial behavior behind a small, stable interface
that is testable at the boundary. Keep dependencies pointing toward policy or
domain authority. Compare the smallest viable seams, record a project decision
when alternatives have durable tradeoffs, and verify compatibility at every
changed boundary.
