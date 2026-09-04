# Run artifacts and persistent ledger protocol

This is the canonical policy for where audit output lives. Structured artifacts
must validate against the versions in `shared/protocols/schemas.md`.

## Application-owned layout

```text
<application-root>/audits/
  YYYY-MM-DD-<type>/
  YYYY-MM-DD-<type>-02/
  latest.md
  findings-ledger.jsonl
  project-profile/
```

`application-root` is the nearest directory that owns the audited runtime/build
configuration. Reusable audit code never stores product-specific run evidence.

Each run directory is immutable after completion. A repeated audit of the same
type on one date receives the next two-digit suffix. Reports may link prior runs,
but must not overwrite their evidence.

The Phase 3 orchestrator uses `YYYY-MM-DD-aud/` for its plan, shared run
manifest, capture manifest, shared evidence index, prior-open snapshot, and
execution summary. Specialist artifacts remain in their own type directories
and reference that one run manifest.

When Phase 4 synthesis completes, the AUD run also contains `synthesis.json`,
`synthesis-report.md`, `remediation-plan.json`, and `remediation-plan.md`.
Markdown is rendered from the structured artifacts. Compatible regeneration
writes a new `YYYY-MM-DD-synthesis/` directory with collision suffixes and never
rewrites the source run.

A Phase 5 verify run adds `verification-plan.json`,
`verification-results.json`, `regression-results.json`,
`verification-summary.json`, `verification-evidence.jsonl`, and Markdown
verification/regression reports derived from those records. Baseline and
candidate revisions remain explicit and prior completed runs stay immutable.

A structured run contains `run-manifest.json`, `evidence.jsonl`,
`findings.jsonl`, and the human report, plus the applicable project context, task
model, specialist contracts, captures, and test output. Standalone specialists
may omit inapplicable upstream artifacts but must record skipped inputs and
degraded status in `input-status.json` and the run manifest when it owns that
manifest. A specialist must not silently mutate a shared manifest owned by the
pipeline.

Phase 2 specialist-specific artifacts are:

- Content: `content-contract.json`, `evidence.jsonl`, `findings.jsonl`,
  `input-status.json`.
- Place: native atom/prominence/overlay artifacts plus `evidence.jsonl`,
  `findings.jsonl`, `input-status.json`.
- Flow: `journey-model.json`, `flow-contract.json`, `evidence.jsonl`,
  `findings.jsonl`, `input-status.json`.
- Visual and functional: `evidence.jsonl`, `findings.jsonl`,
  `input-status.json` plus their native evidence.

Every artifact and record identifies one compatible `run_id`. Evidence IDs in a
finding must resolve to that specialist's evidence records for the same run.

## `latest.md`

Copy `shared/templates/latest.md` into the target application's `audits/`
directory. It is a human-readable index, not the findings source of truth. Update
only the completed specialist row and carry-forward summary; preserve links to
other specialists' latest runs.

## Persistent ledger

`audits/findings-ledger.jsonl` is the machine-readable current snapshot. It has
one line per stable finding ID. A later run must merge rather than replace it:

- Add genuinely new findings with status `open`.
- Update an existing record only when evidence identifies the same finding.
- Preserve prior evidence references and status history.
- Carry forward findings that were not rechecked; absence from a new report does
  not close them.
- Close a finding only through an explicit `verified` or `waived` transition.
- A failed verification uses the legal `failed` or `reopened` transition for
  the finding's current state; blocked, inconclusive, and not-run checks do not
  resolve it.
- Write the merged ledger atomically so an interrupted run cannot truncate it.
- Add synthesis cluster, relationship, and remediation references without
  replacing specialist facts, severity, confidence, or native metrics.
- Append verification attempts by stable ID and promote newly introduced
  regressions to independent findings.

Use the merge behavior in `shared/protocols/ledger.md` and the Phase 1 ledger
tool. Existing Markdown reports remain legacy evidence and are indexed from
`latest.md` without being rewritten.
