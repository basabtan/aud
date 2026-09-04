---
name: aud
description: Primary entry point for broad or ambiguous product/interface audits and coordinated multi-specialist AUD work. Use when the user asks for an audit, product review, UX review, redesign assessment, verification plan, or multi-area evaluation without naming exactly one specialist. Build a deterministic report-only plan across content, place, flow, visual, and functional audits. Preserve direct specialist commands for explicit narrow requests.
---

# AUD orchestrator

Use this command for broad or ambiguous requests. Its job is intake, planning,
dependency coordination, shared evidence, and persistent run bookkeeping. It
does not perform Phase 4 synthesis, cluster root causes, assign remediation priority,
apply application changes, or perform full Phase 5 verification.

## Modes

- `diagnose` — assess the current product. Strictly report-only.
- `redesign` — build the content-first specialist plan and design constraints.
  Phase 3 stops before synthesis, remediation prioritization, or implementation.
- `verify` — load eligible ledger records and plan producing-specialist plus
  functional rechecks. Full replay, status closure, and regression logic remain
  Phase 5.
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

## Deterministic selection and dependencies

Use the selection table in `references/selection.md`. Every canonical specialist
must have a selected, skipped, or deferred decision with a written reason.

Content runs before selected place/flow work unless a schema-valid, accepted,
current content contract already covers the requested revision and stage. Place and flow
share the same next execution wave and are parallel-ready once that
contract exists. A narrow specialist request never silently expands into a full
pipeline. Missing dependencies either defer execution or require explicit
`allow_degraded`, with consequences recorded in the plan and specialist status.

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

AUD orchestration is report-only in Phase 3. All output writes must remain under
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

The request supplies `mode`, `current_revision`, scope, risk profile, capture
packet, and optional specialist observation-packet paths. Use the emitted plan
as the source of truth for execution order.

## References

- `references/selection.md` — deterministic selection and dependency rules.
- `references/evidence.md` — baseline, capture, reuse, and degradation rules.
- `scripts/aud.mjs` — executable orchestrator.
