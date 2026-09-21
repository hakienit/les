# LES Provider Adapters

Each adapter routes a host to the same canonical bootstrap and skill root.
`adapter.json` is the machine-readable discovery contract; the adjacent host
entrypoint is a thin pointer. Adapters never redefine policy.

The CLI creates provider entrypoints only when absent and never merges or
overwrites project-owned instructions.
