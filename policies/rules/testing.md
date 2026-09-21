# Testing

**Activate:** behavior changes, fixes, and refactors.

Test observable behavior at the narrowest stable boundary. A bug fix must have a
check that fails for the defect and passes for the fix when reproducible. Avoid
tests coupled only to implementation shape. Keep one focused regression check
before expanding coverage by risk.
