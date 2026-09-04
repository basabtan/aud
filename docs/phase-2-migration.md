# Phase 2 specialist migration

Phase 2 changes the machine-readable handoff while preserving each specialist's
standalone question and Markdown report.

## Command transition

`functional-audit` is now the canonical portable functional command. The old
`audit` command remains as a temporary compatibility alias that delegates to it.
New integrations should install and invoke `functional-audit` directly.

## Shared emitter interface

Each canonical specialist bundles `scripts/emit-structured.mjs`:

```text
node <specialist>/scripts/emit-structured.mjs \
  --manifest run-manifest.json \
  --project-context project-context.json \
  --task-model task-model.json \
  --input specialist-observations.json \
  --out audits/YYYY-MM-DD-<type>/
```

Place and flow accept `--content-contract`. Functional accepts
`--flow-contract` and `--remediation-plan`. Optional missing upstream artifacts
are recorded as degraded inputs; required context failures and incompatible
versions fail explicitly.

Place must run `filter-applicable.mjs` before demand/FIT scoring when a content
contract exists. Removed and merged content is excluded; unknown content IDs are
rejected. Native verdict mapping is specified in
`shared/protocols/specialist-mappings.md`.

The specialist observation packet is an internal adapter input, not a shared
contract. It preserves native measurements and supplies the evidence,
consequence, confidence, recommendation, acceptance, and verification material
needed to produce shared records.

## Output changes

Every specialist now emits `evidence.jsonl`, `findings.jsonl`, and
`input-status.json`. Content additionally emits `content-contract.json`; flow
emits `flow-contract.json`. Existing reports, capture tools, scoring rubrics, and
standalone specialist behavior remain supported.

The content-to-place, content-to-flow, and flow-to-functional handoffs are
exercised by `tests/specialist-integration.mjs`.
