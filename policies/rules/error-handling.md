# Error Handling

**Activate:** operations that can fail or cross a boundary.

Validate early, preserve the original cause, and add only actionable context.
Use explicit result states where recovery differs. Clean up partial work without
destroying prior state. A fallback must remain correct and visible; silent
degradation is not recovery.
