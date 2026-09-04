# Phase 4 cross-audit synthesis

Phase 4 consumes a compatible Phase 3 audit plan/run manifest, project and task
context, specialist findings/evidence, optional content/flow contracts, shared
capture manifest, and the unresolved ledger. It emits `synthesis.json`,
`synthesis-report.md`, `remediation-plan.json`, and `remediation-plan.md`.
It generates `aud-remediation-plan-v2`; the validator and functional specialist
continue accepting Phase 1's v1 plan as a legacy input during migration.

## Deterministic diagnosis

Deduplication requires an explicit duplicate relationship or equivalent
normalized semantics plus a shared location, task, affected area, evidence, or
root-cause signal. It never deletes source findings. Ambiguous candidates remain
separate and may be linked with `related_to`.

Typed relationships are `duplicate_of`, `reinforces`, `contradicts`,
`symptom_of`, `caused_by`, `blocks`, `depends_on`, `supersedes`, and
`related_to`. Each relationship records both endpoints, rationale, attributable
evidence, and confidence.

Contradictions retain exact claims, conflict type, evidence, resolution state,
and missing-evidence requests. No majority vote or fixed specialist precedence
silently chooses a winner. Root-cause clusters distinguish observed symptoms
from inferred causes and mark confidence below 0.7 provisional.

## Priority and remediation

Only synthesis assigns remediation priority. Its explainable factors preserve
severity as consequence and treat confidence separately. High-severity,
low-confidence risks keep their severity and become investigation work.

Each remediation item declares an action type (`investigate`, `decide`,
`implement`, `verify`, `defer`, or `accept_risk`), source findings/clusters,
affected areas, outcome, acceptance criteria, verification method, priority,
dependencies, blockers, risk, effort, confidence, owner capability, and status.
Topological waves put prerequisites first, mark independent work parallel-ready,
and surface dependency cycles as human-decision gates.

## Ledger and authority

The persistent finding ledger receives additive synthesis, relationship, and
remediation references with stable history. Specialist facts, severity,
confidence, and `native_metrics` are unchanged; absent findings remain open.
Writes are atomic and product artifacts remain under the audited application's
`audits/` directory.

Phase 4 is analysis/planning only. It never modifies the application, executes a
remediation, marks a finding verified, or fabricates evidence. Phase 5 receives
accepted remediation IDs, source findings, acceptance criteria, verification
methods, dependency state, and the original evidence baseline for execution and
lifecycle closure.
