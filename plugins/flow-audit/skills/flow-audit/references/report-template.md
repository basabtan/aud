# Flow Audit Report

Use every heading. Add detail beneath them; do not remove sections.

```markdown
# Flow audit — <product/surface> — <date>

## 1. Scope, method, and confidence

- Persona and variants:
- Depth/scope:
- Repositories/commits:
- Upstream audits:
- Live/fixture/data evidence:
- Tested scenarios:
- Deferred scenarios:
- Confidence:

## 2. Intended reader goals

| Goal | Starting intent | Completion signal | Shortest reasonable logical path |
|---|---|---|---|

## 3. Current observed journeys

| Scenario | Observed path | Useful progress | Forced/redundant steps | Completion/return result | Evidence |
|---|---|---|---|---|---|

## 4. Flow graph and context ledger

Link `journey-model.json` and `evidence/graph-analysis.json`. Summarize important
branches, direct entries, context retained/lost, cycles, and dead ends.

## 5. Friction findings

| Rank | Severity | Verdict | Scenario/transition | Finding | Impact | Confidence | Evidence |
|---:|---|---|---|---|---:|---:|---|

## 6. Representation-transition analysis

| From → to | Trigger question | Discoverability | Context retained | Context lost | Return behavior | Cost | Verdict |
|---|---|---|---|---|---|---|---|

Cover overview, compare, source, evidence, synthesis, and chronology where they
exist or are required by the task model.

## 7. Flow quality scores

| Scenario | Progress | Discoverability | Context | Reversibility | Branches | Continuity | Switching | Complexity | Redundancy | Confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|

Explain material divergence; do not publish an averaged total.

## 8. Novice vs expert flow

State where needs diverge, what must remain optional, and which expert intents
need direct access.

## 9. Sparse vs mature topic behavior

Distinguish `N/A`, `NOT_RESEARCHED`, `UNAVAILABLE`, and `NO_CONSENSUS`.
Identify empty-state dead ends and scaling/repeated-reading risks.

## 10. Conflicts with upstream audits

| Upstream recommendation | Flow evidence | Conflict? | Resolution/status |
|---|---|---|---|

Never silently override content/place findings.

## 11. Recommended logical flow contract

- Immediately answerable questions:
- Branches:
- Optional/on-demand responsibilities:
- Direct-access entry points:
- Context that must persist:
- Required return paths:
- Sparse-state behavior:
- Completion signals:

Do not specify visual UI or final interaction architecture.

## 12. Verification status and evidence

- Executed and passing:
- REVIEW/deferred:
- Files:
```
