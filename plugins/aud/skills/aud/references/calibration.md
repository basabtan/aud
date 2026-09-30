# Calibration protocol

Calibration is framework maintenance, separate from product audit runs. Use the
versioned synthetic suite and never copy product screenshots, traces, personal
data, credentials, or product-specific findings into the corpus.

Run `scripts/calibrate.mjs --tier fast --baseline
calibration/baselines/accepted.json --check` for the normal gate. Use `--tier
full` for release-oriented validation, or `--cases` with comma-separated stable
case IDs while developing a framework correction. A selected subset can
legitimately report metrics as not applicable or insufficient; never fabricate
observations to make those metrics measurable.

The structured outputs are `calibration-results.json`,
`reliability-summary.json`, and `quality-gate-result.json`. Markdown reports are
views of those records. Preserve evaluator version and source revision, suite
and case versions, input revision, expected-outcome IDs, and exact unstable
field paths.

Treat severity as consequence and confidence as evidentiary certainty. Do not
reduce severity mathematically because confidence is low. Preserve specialist
identity and compare shared severity ranges across specialists. Runtime
timestamps may be ignored for deterministic comparison; finding IDs, evidence
references, decisions, and all other output fields may not.

Hard-gate failures block the calibration check. Warnings remain visible without
being represented as hard failures. Baseline replacement requires a review
rationale, and any expectation or threshold change requires explicit policy
approval. Corrections may improve the framework or corpus, but may not weaken a
test merely to pass it.

Calibration remains report-only and must not mutate an audited application or
claim that an unavailable browser, adapter, fixture, or execution succeeded.
