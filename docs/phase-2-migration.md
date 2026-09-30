# Phase 2 specialist migration

## Framework 0.2.0 compatibility notes

Framework 0.2.0 is the first release baseline containing all Phase 0–7 work.
The primary `aud` plugin now uses the public framework version `0.2.0`; earlier
`6.0.0` and `7.0.0` values were internal phase markers, not published release
lines. Specialist plugins retain their independent versions.

Existing structured artifacts remain readable. Audit and verification plan
schemas accept legacy five-specialist decisions and current six-specialist
decisions. Consumers must identify decisions by specialist name rather than
array position or an assumed length of five. The sixth specialist,
`architecture-maintainability-audit`, is selected only for explicit matching
scope, `all` scope, or qualifying declared risk; generic product/UX requests
continue to select the five interface specialists.

The canonical functional command remains `functional-audit`. The old `audit`
command is still available as a temporary compatibility alias in 0.2.0, but new
automation should migrate now. No application audit output paths or persistent
ledger formats changed in this release.

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
