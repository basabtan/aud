# Verification protocol

In `verify` mode, require an accepted `aud-remediation-plan-v2`, explicit
implementation status, selected remediation IDs (or all accepted items), an
original capture/evidence baseline, a distinct candidate revision, and the
persistent ledger. Build one case per finding; never merge their acceptance
decisions.

Block cases with missing criteria or methods. Do not turn missing adapters,
manual-review silence, unexecuted checks, or no-longer-reproducible observations
into passes. Candidate evidence must identify the candidate revision.

Select only affected specialist re-audits and state why every specialist is
selected or skipped. Treat new targeted regressions as new findings, not notes.
Apply only legal lifecycle transitions and append verification attempts without
overwriting prior attempts.

Write `verification-plan.json`, `verification-results.json`,
`regression-results.json`, `verification-summary.json`,
`verification-report.md`, and `regression-report.md`. Structured artifacts are
the source of truth. Inspection/exercise is allowed; application file edits and
persistent product-data mutation are not.
