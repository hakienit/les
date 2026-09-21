# Browser Evidence

Use browser evidence when a change crosses a rendered UI boundary, changes a
critical journey, or depends on real viewport, focus, URL, storage, network, or
animation behavior. Use a verified development or staging target, capture the
journey at applicable 375px, 768px, and 1440px viewports, and record the
starting state, action, and observed result. Read
`../references/browser-review-protocol.md` for the full review matrix.

Label visual, keyboard, accessibility-tree, automated, performance, and
browser-journey checks separately. A screenshot proves appearance only; it does
not prove keyboard reachability, semantics, responsive behavior, or end-to-end
completion. An unavailable browser or unsafe environment remains unavailable.
