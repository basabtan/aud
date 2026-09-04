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

A structured run contains `run-manifest.json`, `evidence.jsonl`,
`findings.jsonl`, and the human report, plus the applicable project context, task
model, specialist contracts, captures, and test output. Standalone specialists
may omit inapplicable upstream artifacts but must record skipped inputs and
degraded status in the run manifest.

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
- A failed verification records the result and changes the finding to `reopened`.
- Write the merged ledger atomically so an interrupted run cannot truncate it.

Use the merge behavior in `shared/protocols/ledger.md` and the Phase 1 ledger
tool. Existing Markdown reports remain legacy evidence and are indexed from
`latest.md` without being rewritten.
