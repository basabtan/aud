# Phase 7 architecture and maintainability capability

Phase 7 adds one selective specialist: `architecture-maintainability-audit`.
The coverage decision and rejected candidates are recorded in
`phase-7-coverage-review.md`.

The specialist consumes the shared run manifest and project context, with task
and capture context optional. Its structured emitter requires each finding to:

- use an `architecture.*` category;
- preserve at least one architecture-native measure;
- cite repository, test, or measurement evidence;
- include consequence severity, independent confidence, acceptance criteria,
  and verification methods;
- omit synthesis priority and application mutations.

AUD selects it for explicit architecture, maintainability, coupling, or
dependency scope, for an explicit specialist request, for high/critical
architecture or technical-debt risk, and for `all` scope. Generic product/UX
requests retain the five interface specialists so code-architecture review is
not silently expanded.

Architecture findings use the existing finding/evidence schemas and therefore
need no parallel contract. Synthesis preserves the source fact, remediation may
order its structural constraint with other work, verification selects the same
specialist for architecture-affected items, and the ledger carries unresolved
IDs forward normally.

The calibration corpus includes one true dependency-cycle case and one
prohibited style-preference false positive. These measure selection,
consequence severity, confidence, evidence sufficiency, native metric
preservation, and deterministic output.

This capability does not implement refactors, change dependencies, rewrite
tests, make security/privacy claims, or alter audited applications.
