# Content audit rubric

## 1. Duplication taxonomy

Classify repeated information by meaning and function.

| Class | Definition | Default treatment |
|---|---|---|
| `EXACT_DUPLICATE` | Same proposition and same role repeated | Remove one |
| `PARAPHRASE_DUPLICATE` | Different wording, same proposition, same role | Merge/remove |
| `DERIVED_RESTATEMENT` | Later summary repeats inputs without adding relationships or conclusions | Rewrite or remove |
| `CROSS_REP_DUPLICATE` | Same proposition in prose/table/card/rail with no task advantage | Keep one owner; link to it |
| `METADATA_REPEAT` | Same counts/status/source coverage repeated in multiple nearby regions | One canonical location |
| `EVIDENCE_REPEAT` | Same citations/provenance repeated despite already being available in context | Link/disclose |
| `ROLE_LEAKAGE` | Editor/admin content visible in reader path | Hide by role |
| `BENEFICIAL_CONTEXT` | Repetition prevents disorientation after navigation/state change | Keep, but keep compact |
| `TRACEABILITY_REPEAT` | Repeated identifier/provenance needed to verify a derived statement | Keep as trace/link |
| `TRANSFORMATIVE_REP` | Same inputs represented in a way that reveals a new pattern/relationship | Keep if task-relevant |

## 2. Distinct information gain

Ask after prior content has been consumed:

- `0 NONE` — nothing new
- `1 TRACE` — chiefly verification/provenance
- `2 CONTEXT` — useful compression/reframing
- `3 TRANSFORM` — exposes relationship, comparison, consequence, pattern
- `4 NEW` — materially new proposition

## 3. Task value

- `0 NONE`
- `1 CONTEXTUAL`
- `2 USEFUL`
- `3 REQUIRED`
- `4 INDISPENSABLE`

Necessity remains `Must / Should / Nice / Noise`.

## 4. Simultaneous visibility rule

A block earns default simultaneous visibility when it is:

1. task-relevant in the current stage, and
2. either new/transformative, or essential context/status, and
3. not already owned by another visible block.

If it fails (2), merge/remove.
If it fails only (1), disclose for a later stage.
If it belongs to another role, hide by role.

## 5. View survival test

A whole view survives only if at least one is true:

- it answers an exclusive high-value user question
- it provides a transformative representation unavailable elsewhere
- it is the canonical evidence/provenance surface
- it supports a materially different role or workflow and is role-gated
- removing it would make an important task impossible or substantially harder

"Users may like it" and "the data already exists" are not survival criteria.
