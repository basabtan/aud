# Flow scoring and finding severity

Score each scenario separately. Quality scores are `0..4`, where `4` is strong.
Do not average different intents or variants into one headline score.

## Quality dimensions

| Dimension | 0 | 2 | 4 |
|---|---|---|---|
| Progress efficiency | blocked/no useful progress | some justified and some forced steps | every step materially advances the intent |
| Discoverability | next action absent or misleading | findable after scanning/prior knowledge | obvious from the user's current question |
| Context preservation | topic/selection/work lost | core topic retained, local position lost | all relevant conceptual and spatial context retained |
| Reversibility | no safe return | return exists but partially resets | exploration and exact return are reliable |
| Branch clarity | choices indistinguishable | labels differ but consequences are unclear | each branch maps clearly to a user question |
| Cognitive continuity | mental model resets | moderate reconstruction | representation changes preserve the mental model |
| Representation switching | repeated costly reconstruction | one meaningful switch with some cost | switches are absent or anchored and task-justified |
| Premature complexity | expert detail blocks novice goal | some unnecessary complexity | complexity appears only when the question requires it |
| Redundant traversal | repeated reading/steps dominate | one repeated segment | no repeated traversal without new value |
| Goal-completion confidence | user cannot tell if answered | partial signal or unresolved ambiguity | answer, uncertainty, and next option are explicit |

Use `1` and `3` for intermediate states. Explain every score at `0`, `1`, or
`4`; these anchors often reveal the important finding.

## Finding impact model

Score the concrete finding:

- completion impact `0..4`
- repeated unnecessary effort `0..3`
- confusion `0..3`
- context loss `0..4`
- error/recovery cost `0..3`
- frequency `0..3`
- affected user coverage `0..3`

`Impact = sum`, range `0..23`.

| Impact | Severity |
|---:|---|
| 1–6 | S1 minor |
| 7–11 | S2 moderate |
| 12–16 | S3 major |
| 17–23 | S4 blocking/critical |

Structural floors override the total:

- an essential-goal `DEAD_END` is at least `S4`
- a repeatable `LOOP` is at least `S3`
- context loss that prevents exact recovery is at least `S3`
- a role gate that prevents the primary persona completing a required goal is
  at least `S3`

Lower confidence changes the verdict to `REVIEW`; it does not make a proven
structural issue cosmetic.

## Finding vocabulary

| Verdict | Use when |
|---|---|
| `KEEP` | path is justified, discoverable, and preserves required context |
| `SHORTEN` | remove avoidable traversal while retaining distinct steps |
| `MERGE_STEP` | adjacent steps answer one question and add no useful boundary |
| `REMOVE_STEP` | step adds no progress, protection, or necessary orientation |
| `DISCLOSE_LATER` | complexity is valid only after a later question arises |
| `PRESERVE_CONTEXT` | transition is useful but loses selection/orientation |
| `ADD_RETURN_PATH` | exploration lacks a reliable exact return |
| `CLARIFY_BRANCH` | distinct choices exist but their consequences are unclear |
| `DIRECT_LINK` | a known intent should bypass prerequisite traversal |
| `SPLIT_FLOW` | novice/expert, role, or intent paths should diverge |
| `ROLE_GAP` | the intended role cannot access a required task or sees another role's work |
| `DEAD_END` | a reachable state has no path to the active goal or recovery |
| `LOOP` | user can repeat states without progress or exit |
| `REVIEW` | evidence is missing, conflicting, or below confidence threshold |

## Logical recommendation rules

- Recommend a branch when the next likely questions differ.
- Recommend optional/on-demand access when the question may never arise.
- Recommend direct access when the user can arrive with that intent and has
  enough context to understand the destination.
- Recommend sequencing only when a later responsibility genuinely depends on an
  earlier answer.
- Do not translate these rules into screens, tabs, cards, drawers, rails, or
  component architecture.
