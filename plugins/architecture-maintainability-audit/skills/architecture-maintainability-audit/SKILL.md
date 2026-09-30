---
name: architecture-maintainability-audit
description: Audit repository architecture and maintainability when the user explicitly asks about dependency direction, coupling, module ownership, change amplification, architectural boundaries, or technical debt. Use repository and test evidence to identify structural risks and emit verifiable findings. Do not evaluate interface content, placement, flow, visual quality, runtime correctness, or security posture; broad audit requests belong to AUD.
---

# Architecture and maintainability audit

Answer one question: **Can this system be changed safely without violating
ownership or dependency boundaries?** Inspect the repository as evidence. Do
not infer runtime failure, security exposure, or product impact that the
available evidence does not establish.

## Inputs and scope

Consume the shared run manifest and project context. Consume the task model and
capture manifest when supplied, but do not invent them when absent. Read local
repository rules, package/workspace manifests, build configuration, public API
surfaces, dependency declarations, tests, and the smallest code slice needed to
support each conclusion.

Record the reviewed roots, excluded/generated/vendor paths, revision, languages,
and any analysis limitations. In pipeline mode, use the orchestrator's selected
revision and shared evidence baseline. A standalone run still emits the shared
artifacts and explicit input status.

## Method

Build a lightweight structural model before judging it:

- modules or packages and their declared responsibilities;
- import/dependency direction and cycles;
- public interfaces and cross-boundary data ownership;
- high fan-in/fan-out or change-amplification hotspots;
- duplicated infrastructure responsibilities and hidden global state;
- boundary tests, contract tests, and migration/rollback seams;
- generated, vendored, example, and test-only code that must not be mistaken for
  production architecture.

Prefer direct repository evidence and executable dependency/test output. A
pattern is not a finding merely because it differs from a preferred style.
Report only a demonstrated consequence: unsafe change propagation, ambiguous
ownership, inability to isolate or verify a change, circular initialization,
or a repeated defect mechanism.

Use consequence-based shared severity and separate numeric confidence. Preserve
specialist measures under `native_metrics`, such as cycle length, fan-in,
fan-out, dependency edges, affected packages, change-surface files, boundary
test gaps, or ownership ambiguity. Native measures never become severity by
formula.

Read `references/boundaries.md` before classifying overlap or proposing a handoff.
Use `references/report-template.md` for the report.

## Outputs

Write immutable runs under:

`<application-root>/audits/YYYY-MM-DD-architecture-maintainability/`

Add `-02`, `-03`, and so on when needed. Emit:

- `REPORT.md` using the formal template;
- `evidence.jsonl` with schema-valid shared evidence;
- `findings.jsonl` with schema-valid shared findings;
- `input-status.json` documenting consumed, missing, and degraded inputs.

Every finding needs repository/test/measurement evidence, affected scope,
consequence severity, confidence basis, recommendation, acceptance criteria,
and verification methods. Stable IDs come from the shared emitter. Findings
flow unchanged into synthesis, remediation, verification, and the persistent
ledger. Specialists do not assign synthesis priority.

Run the structured emitter:

```text
node scripts/emit-structured.mjs \
  --manifest <run-manifest.json> \
  --project-context <project-context.json> \
  [--task-model <task-model.json>] \
  [--capture-manifest <capture-manifest.json>] \
  --input <observation-packet.json> \
  --out <run-directory>
```

Pipeline mode and standalone mode are report-only. Never edit application code,
configuration, dependencies, or tests during this audit. Update
`audits/latest.md` through the shared orchestration flow. Never store product-specific audit results in the
repository that distributes this skill.
