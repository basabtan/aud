# Specialist-to-shared mapping

Native specialist vocabulary remains evidence under `native_metrics`; it does
not replace shared severity, confidence, lifecycle status, or later synthesis
priority.

## Content

| Native decision | Content-contract decision | Shared treatment |
|---|---|---|
| `KEEP_PRIMARY`, `KEEP_SECONDARY` | `keep` | Preserve role/stage refs and native task/gain scores. |
| `DISCLOSE`, `LINK_NOT_REPEAT` | `disclose` | Preserve the retrieval/provenance constraint. |
| `MERGE` | `merge` | Require `merged_into`; synthesis/content owns acceptance. |
| `REMOVE` | `remove` | Record consequence, evidence, acceptance, and verification. |
| `HIDE_BY_ROLE` | `keep` | Narrow `role_refs`; do not treat valid role content as globally removed. |
| `SPLIT`, `REVIEW` | `human_decision` | Record the unresolved decision explicitly. |

## Place

`MOVE`, `MUTE`, and `DISCLOSE` remain placement recommendations.
`DEDUPLICATE` maps to the finding category `duplicate_candidate`; it never maps
to a content deletion or merge. `FIT`, demand, prominence, access cost, and
segmentation confidence remain under `native_metrics`. `KEEP` may be emitted as
a shared `keep` finding when preserving the successful decision is useful.

## Flow

Flow classifications remain native metrics. Proposed recommendations stay
`proposed`; only explicit acceptance produces an `accepted` flow-contract item.
Every accepted item must carry at least one acceptance criterion and executable
verification method. `REVIEW` does not silently become acceptance.

## Visual

`KEEP`, `REFINE`, `UPGRADE`, and `REDESIGN` remain visual decisions under
`native_metrics`. Shared severity describes the consequence of leaving the
condition unresolved, while numeric confidence describes evidence strength.
Dose rank is not shared priority.

## Functional

Legacy `Fixed` maps to `implemented` until a separate verification establishes
`verified`. `Deferred` maps to `open` or `planned` only when an accepted plan
exists. `Out of scope` remains `open` unless a human explicitly records
`waived`. A failed accepted-contract check is `open` or `reopened`; functional
verification cannot rewrite the accepted specialist contract.
