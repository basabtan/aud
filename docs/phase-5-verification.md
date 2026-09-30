# Phase 5 remediation verification

Verify mode proves whether accepted remediation solved the original finding. It
does not treat a code change or an `implemented` label as proof, and it never
modifies the audited application. It consumes a Phase 4 remediation plan,
selected remediation IDs, the persistent finding ledger, original evidence and
capture baseline, implementation status, and a distinct candidate revision.

## Readiness and execution

Every remediation/finding pair becomes a stable verification case. The planner
checks accepted status, completed implementation, completed dependencies,
different known baseline and candidate revisions, compatible original evidence,
available fixtures, and a comparable environment. Missing acceptance criteria
or methods are blocked; they are never inferred. Cases are `ready`, `blocked`,
`deferred`, or explicitly `degraded`.

Declared methods map to automated-test, browser-interaction, visual-comparison,
content-inspection, accessibility-check, performance-measurement, manual expert,
or evidence-only adapters. An unavailable adapter produces `not_run`, not a
fabricated result. Manual work remains pending until a reviewer supplies a
result and candidate-revision evidence. Potentially state-changing checks must
use an isolated environment, disposable fixtures, or documented non-destructive
mode.

## Outcomes, baselines, and lifecycle

Case outcomes are `passed`, `partially_passed`, `failed`, `blocked`,
`inconclusive`, and `not_run`. Each records the original condition, expected
condition, current observation, acceptance results, evidence, executor,
revision, time, and environment. Baseline comparisons are `fixed`,
`improved_but_incomplete`, `unchanged`, `worsened`,
`no_longer_reproducible`, or `unable_to_compare`. No-longer-reproducible is
inconclusive unless comparable evidence proves every criterion.

Only a proved pass is eligible for `verified`, and only through the shared legal
transition table. Dependencies must also pass, candidate evidence must match the
candidate revision, contradictions must not block closure, and targeted
regressions must pass. Partial and failed cases use legal `partial`, `failed`, or
`reopened` states; blocked, inconclusive, and unexecuted cases do not resolve a
finding. Each finding in a multi-finding remediation is decided separately.

## Targeted regression and persistence

Re-audits are limited to affected specialists: content can select content/place/
flow; flow selects flow/functional; visual selects visual and accessibility
checks; functional selects functional and affected flows. A full regression run
must be explicit. Regression records distinguish original checks, targeted
regressions, unrelated pre-existing issues, and newly introduced regressions.
New regressions are promoted to standalone schema-valid findings.

The ledger update is atomic. Original severity, confidence, native metrics,
synthesis metadata, remediation references, and status history are preserved.
Verification history is append-only and deduplicated by stable verification ID.
Structured JSON is authoritative; both Markdown reports are derived from it.

Phase 6 receives these stable attempts and outcomes for framework calibration.
Phase 5 does not add scoring calibration, analytics, or cross-run tuning.
