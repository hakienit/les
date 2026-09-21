# React and Next.js Performance Reference

Load this reference only when the project uses React or Next.js. Keep the
framework-neutral performance rules active for every other frontend stack.

Prioritize by likely user impact:

1. Remove request waterfalls by starting independent work together and awaiting
   only when the result is needed.
2. Reduce shipped JavaScript: avoid broad barrel imports, defer third-party code,
   and dynamically load genuinely heavy or conditional surfaces.
3. Preserve server/client boundaries: keep secrets and server-only work server-side,
   minimize serialized props, and validate server actions like public endpoints.
4. Prevent avoidable renders: derive values during render, use functional updates,
   keep effect dependencies precise, and use memoization only for a measured win.
5. Protect rendering: reserve media space, use progressive loading, place
   Suspense/loading boundaries near the data, and virtualize only when a measured
   list cost warrants it.

Establish a baseline before changing performance-sensitive code. Record the
journey, device or viewport, network condition, metric, and target. A rule of
thumb is not a measurement, and a static review cannot prove runtime speed.
