# Frontend Performance

Measure before optimizing. Protect the critical user journey by limiting shipped
code, unnecessary renders, blocking work, and oversized media. Prefer AVIF/WebP or
the project's measured equivalent, lazy-load below-the-fold media, reserve layout
space, and protect a CLS target below 0.1 when the platform exposes the metric.
Record the measurement that justifies complexity and preserve a useful experience
when optional data or media is slow. When the project uses React or Next.js, read
`../references/react-performance.md`; do not apply framework-specific advice to a
different stack.
