# Phase 4 synthesis policy

## Inputs and outputs

Consume the audit plan, run manifest, project context, optional current task and
specialist contracts, specialist findings/evidence, shared capture manifest, and
persistent unresolved ledger. Reject incompatible revisions. Missing evidence
is a limitation, never an invitation to invent a replacement.

Produce `synthesis.json`, `synthesis-report.md`, `remediation-plan.json`, and
`remediation-plan.md`. Markdown is rendered from the structured records.

## Deduplication and relationships

Merge only explicit duplicate references or equivalent normalized semantics
plus a shared scope/evidence/root-cause signal. Preserve all source findings and
designate a representative. Suggestive but ambiguous matches remain separate
and may receive `related_to`.

Relationship types are `duplicate_of`, `reinforces`, `contradicts`,
`symptom_of`, `caused_by`, `blocks`, `depends_on`, `supersedes`, and
`related_to`. Every record has rationale, evidence references, and confidence.

## Contradictions and root causes

Never resolve by majority vote or a universal specialist precedence. Keep exact
claims, conflict type, evidence, and unresolved evidence needs visible. A
resolution must name the selected contextual claim and provide rationale.

Root causes are synthesis inferences, not observations. They retain every
symptom, supporting/conflicting evidence, scope, specialist coverage,
confidence, and assumptions. Confidence below 0.7 is provisional.

## Priority and remediation lifecycle

Priority considers consequence severity, affected scope, task criticality,
urgency, confidence, recurrence, blocking relationships, dependencies,
implementation risk, and effort. Confidence does not lower severity. Use both
human levels (`critical` through `deferred`) and P0–P4 bands with rationale.

Remediation actions are `investigate`, `decide`, `implement`, `verify`, `defer`,
or `accept_risk`. Phase 4 emits proposed/decision/deferred planning states only.
It does not execute work, verify findings, or close them. Dependencies determine
waves; independent same-wave work is parallel-ready and cycles require a human
decision.

## Phase 5 handoff

Phase 5 receives accepted remediation IDs, source findings, acceptance criteria,
verification methods, baseline evidence, and dependency state. Phase 5—not
Phase 4—captures fresh verification evidence and applies lifecycle transitions.
