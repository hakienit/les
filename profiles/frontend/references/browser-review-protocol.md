# Browser Experience Review Protocol

Use this reference when a reachable app boundary must be reviewed in a real
browser. It extends LES evidence rules; it does not authorize production writes.

## Preconditions

1. Use an explicitly supplied or already verified URL; never guess a local port.
2. Confirm the target is development or staging with safe seed data.
3. Start read-only. List every mutating action and obtain approval immediately
   before that action; destructive actions remain out of scope.

If the URL, safe environment, or browser is unavailable, report `unavailable`
with the missing condition and stop the browser lane.

## Review matrix

For the affected journey, record the starting state, action, observed result,
and evidence at each applicable viewport: 375px, 768px, and 1440px. Exercise
loading, empty, success, error, retry, disabled, permission, focus, keyboard,
and reduced-motion paths when the product exposes them.

Also record console errors, failed network requests, visible timing problems,
focus movement, URL/storage changes, and layout shifts that affect completion.

## Output

Return a browser session record with environment, viewport/state matrix,
journey steps, console/network result, screenshots or accessibility snapshots,
mutations approved, skipped lanes, findings, and terminal status. Keep browser
evidence separate from source review and automated test evidence.
