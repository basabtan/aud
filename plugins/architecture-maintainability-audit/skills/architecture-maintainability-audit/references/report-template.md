# Architecture and maintainability audit

## 1. Scope and revision

- Repository revision:
- Reviewed roots/packages:
- Excluded generated/vendor/example paths:
- Languages/build systems:
- Missing or degraded inputs:

## 2. Structural model

Summarize module responsibilities, dependency direction, state/data ownership,
public interfaces, and test seams. Link every claim to evidence IDs.

## 3. Boundary and dependency observations

Record cycles, direction violations, coupling hotspots, ownership ambiguity,
change amplification, migration/rollback constraints, and confirmed keeps.

## 4. Normalized findings

For each finding include its stable ID, consequence-based severity 0–4,
confidence 0–1, affected areas, evidence IDs, native_metrics, recommendation,
acceptance criteria, and verification methods. Do not assign priority.

## 5. Cross-specialist handoffs

List possible reinforcing, causal, or contradictory relationships without
overwriting another specialist's facts or authority.

## 6. Limitations and unreviewed areas

Distinguish absent evidence from a clean result. State whether dependency graph,
history, tests, ownership metadata, generated code, or runtime evidence was
unavailable.

## 7. Verification handoff

List executable dependency assertions, boundary/contract tests, build checks,
or candidate-revision inspections for accepted remediation.

This audit is report-only and makes no application changes.
