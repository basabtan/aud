---
name: aud
description: Primary entry point for broad or ambiguous product/interface audits and coordinated multi-specialist AUD work. Use when the user asks for an audit, product review, UX review, redesign assessment, remediation verification, regression audit, or multi-area evaluation without naming exactly one specialist. Build deterministic report-only plans and evidence-backed verification across content, place, flow, visual, functional, and selectively routed architecture/maintainability audits. Preserve direct specialist commands for explicit narrow requests.
---

# AUD orchestrator

Use this command for broad or ambiguous requests. Its job is intake, planning,
dependency coordination, shared evidence, cross-audit synthesis, remediation
planning, evidence-backed remediation verification, targeted regression checks,
selective architecture/maintainability review, and persistent run bookkeeping. It does not execute remediation or apply
application changes.

## Modes

- `diagnose` — assess the current product and synthesize a multi-specialist
  diagnosis by default. Strictly report-only.
- `redesign` — build the content-first specialist plan and design constraints.
  Phase 4 produces an ordered remediation plan but stops before implementation.
- `verify` — consume accepted remediation and a distinct candidate revision,
  build finding-specific cases, coordinate declared adapters, run targeted
  rechecks, and apply only evidence-backed legal lifecycle transitions.
- `specialist` — coordinate one explicitly named specialist without expanding
  into the full pipeline. The existing direct specialist commands remain valid.

## Intake

Read and validate `project-context.json`, `task-model.json` when available, the
persistent ledger, requested routes/states/personas, current repository revision,
declared risk profile, and any prior content/capture contracts. Never infer that
an absent contract exists. Reject project revision mismatch before creating a
run. Record missing, stale, incompatible, and deliberately degraded inputs.

Create one immutable `<application-root>/audits/YYYY-MM-DD-aud/` directory,
adding `-02`, `-03`, and so on when needed. Write:

- `audit-plan.json`
- `run-manifest.json`
- `capture-manifest.json`
- shared `evidence.jsonl`
- `prior-open-findings.jsonl`
- `execution.json`
- `synthesis.json` and `synthesis-report.md` when synthesis inputs are sufficient
- `remediation-plan.json` and `remediation-plan.md` when synthesis completes
- `verification-plan.json`, `verification-results.json`,
  `regression-results.json`, and `verification-summary.json` in verify mode
- `verification-report.md` and `regression-report.md` derived from those JSON artifacts

## Deterministic selection and dependencies

Use the selection table in `references/selection.md`. Every canonical specialist
must have a selected, skipped, or deferred decision with a written reason.

Content runs before selected place/flow work unless a schema-valid, accepted,
current content contract already covers the requested revision and stage. Place and flow
share the same next execution wave and are parallel-ready once that
contract exists. A narrow specialist request never silently expands into a full
pipeline. Missing dependencies either defer execution or require explicit
`allow_degraded`, with consequences recorded in the plan and specialist status.

## Synthesis and remediation planning

Enable synthesis by default for multi-specialist diagnose/redesign runs. Keep
specialist-only runs independent. Require at least two compatible specialist
outputs; otherwise mark synthesis skipped with an explicit reason.

Preserve every specialist finding. Group only deterministic duplicate matches,
record ambiguous candidates as possible relationships, and keep provenance and
evidence attribution. Contradictions remain visible until an explicit resolution
records its evidence and rationale. Treat root causes as inferences and mark
low-confidence causes provisional. Follow `references/synthesis.md`.

Only synthesis assigns priority. Severity remains the specialist's consequence
judgment and confidence remains separate. High-severity/low-confidence risks
become investigation work without reducing severity. Order remediation through
dependencies and leverage; report cycles and human-decision gates rather than
inventing an order.

## Shared evidence

Build one capture manifest for the revision, routes, named states, fixtures,
viewports, and environment. It may index screenshots, traces, repository
observations, browser/page/network errors, tests, and measurements. Stable
evidence IDs derive from the baseline signature and artifact identity.

Reuse prior artifacts only when schema, revision, full baseline signature, key,
and fingerprint match. Record reused IDs and remaining capture needs. Pass this
same capture manifest to every selected specialist; specialists create distinct
evidence only when their method requires it.

## Persistence and safety

Carry every unresolved ledger record into the new run. Merge new specialist
findings into `audits/findings-ledger.jsonl` and update `audits/latest.md`
atomically. Never rewrite prior completed run directories.

Never store product-specific audit results in the repository that distributes this skill.

## Calibration and reliability

Phase 6 adds a separate framework-maintenance command. It runs only the
redistributable synthetic calibration corpus, compares results with a reviewed
versioned baseline, and writes `calibration-results.json`,
`reliability-summary.json`, `quality-gate-result.json`,
`calibration-report.md`, and `drift-report.md`. It does not alter product audit
selection, synthesize product findings, or mutate an application.

Use the fast tier for routine checks and the full tier for complete reliability
measurement. Selected cases are supported for diagnosis. Preserve explicit
not-applicable and insufficient-sample states. Follow
`references/calibration.md`; never accept a baseline without review rationale
or silently weaken an expected outcome or quality gate.

AUD product orchestration remains report-only through Phase 7. It may inspect and exercise an
isolated or non-destructive test target, but cannot edit application files. All output writes must remain under
the audited application's `audits/` directory. Any requested application
mutation in `diagnose` is an error; other modes also require separate future
authorization and execution outside this orchestrator.

## Running the deterministic core

```text
node scripts/aud.mjs \
  --request request.json \
  --project-context project-context.json \
  --task-model task-model.json \
  [--content-contract prior-content-contract.json] \
  [--capture-manifest prior-capture-manifest.json] \
  [--ledger audits/findings-ledger.jsonl]
```

Regenerate Phase 4 artifacts from one compatible completed run:

```text
node scripts/aud.mjs \
  --regenerate-synthesis audits/YYYY-MM-DD-aud \
  --project-context project-context.json \
  [--task-model task-model.json] \
  [--ledger audits/findings-ledger.jsonl]
```

The request supplies `mode`, `current_revision`, scope, risk profile, capture
packet, and optional specialist observation-packet paths. Use the emitted plan
as the source of truth for execution order.

Verify requests additionally supply `remediation_plan`,
`selected_remediation_ids`, `implementation_status`,
`baseline_capture_manifest`, `original_evidence`, and optional adapter results.
Follow `references/verification.md`; missing acceptance criteria, methods,
compatible evidence, fixtures, or adapters stay blocked, degraded, or not run.

## References

- `references/selection.md` — deterministic selection and dependency rules.
- `references/evidence.md` — baseline, capture, reuse, and degradation rules.
- `references/synthesis.md` — deduplication, relationships, contradictions,
  priority, lifecycle, and Phase 5 handoff.
- `references/verification.md` — readiness, adapters, comparisons, regressions,
  manual review, mutation boundaries, and Phase 6 handoff.
- `references/calibration.md` — corpus, metrics, gates, drift, baseline review,
  and authority boundaries.
- `scripts/aud.mjs` — executable orchestrator.
- `scripts/calibrate.mjs` — executable Phase 6 calibration entry point.
- `references/selection.md` also defines Phase 7's selective
  architecture/maintainability routing and why other candidate modules remain
  deferred or rejected.
