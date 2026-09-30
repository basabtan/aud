# Phase 3 orchestration and shared evidence

`aud` is the primary command for broad or ambiguous audits. Direct content,
place, flow, visual, functional, and legacy `audit` commands remain available
for explicit isolated requests.

## Planning

The orchestrator validates the project revision before creating a run, reads the
task model and prior ledger, inspects optional content/capture contracts, and
writes schema-valid `audit-plan.json`. All five specialists receive an explicit
selected, skipped, or deferred decision with rationale and degraded
consequences.

Content precedes dependent place/flow work. Once a current content contract
exists, place and flow occupy the same parallel-ready execution wave. Specialist
mode never silently expands to the whole pipeline.

## Evidence

`capture-manifest.json` fingerprints repository revision, routes, named states,
fixtures, viewports, and environment metadata. It indexes screenshots, traces,
browser/page/network errors, repository observations, measurements, and tests.
Evidence is reused only when the complete baseline and artifact fingerprint
match. Revision or baseline mismatch prevents reuse.

Every selected specialist receives the same capture manifest path and records
its baseline signature in `input-status.json`.

## Persistence and safety

Runs are created under `<application-root>/audits/` with collision suffixes;
completed directories are never rewritten. Prior unresolved findings are copied
into the orchestration run and retained by the atomic ledger merge.
`audits/latest.md` is also replaced atomically while preserving prior specialist
links.

All four modes remain report/planning-only. Diagnose rejects requested
application mutations. Phase 4 now consumes these outputs for synthesis,
root-cause clustering, visible contradiction handling, and remediation
priority. At the Phase 3 checkpoint, verify mode only built the eligible
verification plan; Phase 5 now executes that plan through evidence-backed
replay, regression checks, and legal status closure.
