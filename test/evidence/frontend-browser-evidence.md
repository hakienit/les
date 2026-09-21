# Frontend browser evidence

Captured with `agent-browser`, session `les-fe-d7cddcdf1437`, against the disposable fixture at `http://127.0.0.1:4173`.

| Check | Observed evidence | Result |
| --- | --- | --- |
| Desktop boundary | Document `200`; `GET /fixture-data.json` fetch `200`; no browser errors | PASS |
| Responsive mobile | Viewport `375x900`; `scrollWidth=375`; no horizontal overflow | PASS |
| Responsive tablet | Viewport `768x900`; grid columns `436px 280px` | PASS |
| Reduced motion | `prefers-reduced-motion: reduce` matched; loading animation computed to `1e-05s` and one iteration | PASS |
| Touch target | Button computed `min-height: 44px` | PASS |
| State recovery | Load sample, Show empty, and Show error controls changed the state attribute | PASS |
| Invalid form | Error message rendered and focus returned to `#email` | PASS |
| Valid form | Success message rendered with `data-kind=success` | PASS |

Screenshots captured during the run:

- `desktop.png`
- `tablet.png`
- `mobile.png`
- `error-state.png`
