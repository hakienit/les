# Workflow: Refactoring

**Trigger:** structural change intended to preserve behavior. **Inputs:** current contract, structural objective, callers, and rollback boundary.
**Procedure:** characterize observable behavior; choose one ownership boundary; move one coherent unit at a time; run the same focused proof after each move; inspect diff and dependency surface. **Done when:** structure changes, preservation proof passes, and no accidental behavior or package change remains.
**Risk and approval:** reclassify if behavior, public interface, compatibility, or data changes. **Output artifact:** structural diff, characterization proof, and residual risk.
**Terminal statuses:** use `../workflow-contracts.md`. **Verification evidence:** characterization, focused checks, integration checks, and diff review.
**Recovery:** stop and route to feature delivery or migration if behavior must change.
