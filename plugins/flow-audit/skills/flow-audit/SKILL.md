---
name: flow-audit
description: Audit HOW a user moves from intent to understanding, decision, or completion after content responsibilities and placement priorities are known. Use when a journey feels long, forced, fragmented, hard to discover, hard to reverse, or loses filters, selection, scroll position, comparison context, or conceptual orientation across overview, compare, source, evidence, synthesis, and related representations. Model workflows as intent-led graphs, test novice/expert and sparse/mature paths, inspect browser history and return behavior, and produce a logical flow contract without prescribing screens, tabs, cards, layout, styling, or final UI architecture. Do not use to decide what information exists (content-audit), where it is prominent (place-audit), how it looks (visual-audit), or whether implementation is generally correct (audit).
---

# Flow audit

## Governing question

> How efficiently and naturally can a user move from intent to understanding,
> decision, or completion, and does the interface preserve context while doing
> so?

Do not equate efficiency with click count. A one-click transition that destroys
selection, filters, comparison position, or conceptual orientation can be worse
than a two-step transition with a clean return path.

Treat the current UI as evidence, not as the workflow. Names such as Source,
Compare, Evidence, and Synthesis describe information responsibilities inherited
from `content-audit`; they do not prove a required sequence, navigation model,
default state, or visual representation.

## Boundary with the other audits

| Audit | Primary question |
|---|---|
| `content-audit` | What information should exist, once, and at what stage? |
| `place-audit` | Where should surviving information live and how prominent should it be? |
| `flow-audit` | How should intent branch through those responsibilities while preserving context? |
| `visual-audit` | Has the visual treatment been deliberately designed? |
| `functional-audit` | Does the implemented experience work correctly and remain usable? |

Read existing content/place reports, task models, and evidence before observing
the flow. Never silently override their information or prominence decisions. If
flow evidence conflicts, record the exact recommendation, evidence on each side,
and whether the conflict is resolved or remains human-owned.

## Arguments

Parse `$ARGUMENTS` without inventing missing values:

- `quick` — one primary intent, initial route, and one drill-down/return path.
- `standard` — default; primary journey plus novice/expert and sparse/mature
  variants, important representation transitions, and browser Back.
- `full` — every declared scenario, entry route, branch, recovery path, role,
  and relevant device/input variant.
- `scope:<route-or-feature>` — limit observation and reporting.
- `persona:<id>` — select one primary persona while reporting material variants.
- `scenario:<id>` — select one declared scenario.

Record the parsed arguments and all untested paths in the report.

## Run artifact location

Keep this reusable skill in the audit-tools repository, but write every
application-specific run into the target application repository at
`<application-root>/audits/YYYY-MM-DD-flow/`. Put `REPORT.md`, journey/task
models, and evidence inside that run directory. Update
`<application-root>/audits/latest.md` so its Flow row links to the newest run,
while preserving older runs. If the same type runs twice on one date, append
`-02`, `-03`, and so on rather than overwriting evidence.

In a monorepo, `application-root` is the nearest directory that owns the app's
runtime/build configuration. Never store product-specific audit results in the
repository that distributes this skill.

## Shared inputs and structured output

Consume and validate the shared `run-manifest.json`, `project-context.json`, and
`task-model.json`, plus `content-contract.json` when available. Reference their
task, persona, and stable content IDs directly. If an upstream artifact is
missing, record the exact absence in `input-status.json`, mark required-input
loss as degraded, and do not manufacture IDs or decisions.

Run `scripts/emit-structured.mjs` to emit `flow-contract.json`,
`evidence.jsonl`, schema-valid `findings.jsonl`, and `input-status.json`. Every
accepted flow recommendation must contain explicit acceptance criteria and
executable verification methods for `functional-audit`; an accepted item
without both is invalid. Preserve scenario scores and other native measures
under `native_metrics`, separate from consequence-only severity and numeric
confidence.

## The ten-step loop

### 1. Freeze intent and upstream contracts

State the primary persona, starting intent, success condition, and evidence
source. Read upstream audit artifacts. Freeze their surviving information model,
role boundaries, view responsibilities, and placement constraints—but keep the
reader interaction architecture open.

If no task model exists, infer only from explicit repository/product evidence,
label the inference, and use `REVIEW` where a different intent would change the
finding.

### 2. Declare scenarios before browsing

List the questions users actually arrive with, not the screens they currently
visit. Include direct-entry intents as well as browse-first intents.

For `standard`, include at least:

- quick orientation/understanding
- comparison without sequential source reading
- drill-down from comparison to one source
- claim-to-evidence verification and exact return
- broader conclusion/synthesis
- sparse or incomplete content
- mature or contested content
- expert direct entry

Record the shortest reasonable logical path for each before observing the
current implementation. This is a hypothesis, not a design specification.

### 3. Observe current journeys

Drive the real interface when safely available. Record URLs, visible actions,
loading/empty states, history behavior, scroll/selection/filter state, and the
exact result of Back or a supplied return action. Use realistic fixtures derived
from the actual schema when live data or authentication prevents observation;
label fixture evidence and never invent another domain model.

Observe at least one complete path from initial intent to goal. Do not infer a
return path merely because a Back control exists—exercise it.

### 4. Build the flow graph

Create `journey-model.json` in the current timestamped Flow run directory following
`references/flow-model.md`. Each node must contain:

- stage
- user question
- user action
- system response
- resulting state
- context retained and lost
- next likely question
- branching choices
- return path
- interaction and cognitive cost
- failure/dead-end risk

Edges must state transition kind, reversibility, history behavior, and context
delta. Run `scripts/validate-flow.mjs` before interpreting the graph.

### 5. Trace intent-to-goal paths

For every scenario, compare:

- shortest reasonable logical path
- current observed path
- forced steps that do not answer the active question
- missing direct access
- alternative branches
- recovery/backtracking cost

Count interactions, but report them beside cognitive and context costs. A step
is justified only when it creates useful progress, prevents an error, or
preserves necessary orientation.

### 6. Audit representation transitions

Evaluate each relevant transition among overview, compare, source, evidence,
synthesis, chronology, and related context.

For every transition record:

- what question triggered it
- whether the trigger was discoverable
- what topic, source, facet, claim, filter, scroll anchor, and history state
  survived
- what had to be mentally reconstructed
- whether the user can return to the exact prior context
- whether opening the destination unnecessarily replaced useful context

Representation switching is not inherently bad. It is costly when the reader
must rebuild the same mental model.

### 7. Score flow quality

Use all ten dimensions and the anchored `0..4` rubric in
`references/scoring.md`:

1. progress efficiency
2. discoverability
3. context preservation
4. reversibility
5. branch clarity
6. cognitive continuity
7. representation switching cost
8. premature complexity
9. redundant traversal
10. goal-completion confidence

Score each scenario separately. Never average novice and expert paths, sparse
and mature states, or unrelated intents into one reassuring number.

### 8. Classify and rank findings

Use only:

- `KEEP`
- `SHORTEN`
- `MERGE_STEP`
- `REMOVE_STEP`
- `DISCLOSE_LATER`
- `PRESERVE_CONTEXT`
- `ADD_RETURN_PATH`
- `CLARIFY_BRANCH`
- `DIRECT_LINK`
- `SPLIT_FLOW`
- `ROLE_GAP`
- `DEAD_END`
- `LOOP`
- `REVIEW`

Apply the impact model and structural floors in `references/scoring.md`.
Successful completion, repeated effort, confusion, context loss,
error/recovery cost, frequency, and affected user coverage determine severity.
Cosmetic inconvenience never outranks structural failure.

### 9. Separate variants and conflicts

Report novice versus expert divergence explicitly. Experts may need direct
entry; novices may need optional orientation. Do not force either group through
the other's path.

Report sparse versus mature behavior explicitly. Empty responsibilities should
not become dead ends; missing perspectives should be shown honestly, including
explicit `N/A` where the domain genuinely has no answer rather than merely
missing research.

Record every conflict with content/place findings. Flow may change ordering,
branching, optionality, or return behavior, but it may not resurrect removed
content or demote a required information responsibility without explicit
evidence and a logged conflict.

### 10. Write the logical flow contract

Write `REPORT.md` in the current timestamped Flow run directory using
`references/report-template.md`. The final
contract defines:

- questions answerable immediately
- optional or on-demand questions
- branches and direct-access entry points
- context that must persist
- required return paths
- sparse-state behavior
- completion signals

Do **not** specify cards, tabs, rails, screen layout, colors, typography, pixel
positions, component names, or final UI architecture. Stop after the report and
evidence unless the user separately requests design or implementation.

## Required evidence discipline

- Distinguish observed, repository-inferred, data-inferred, fixture-observed,
  and recommended states.
- A DOM route or component does not prove discoverability; observe the available
  affordance.
- A URL does not prove browser Back restores state; exercise it.
- An empty dataset does not prove `N/A`; distinguish no answer, no research, and
  unavailable data.
- Preserve contradictory evidence and lower confidence rather than forcing a
  clean narrative.
- Mark unexercised transitions `REVIEW` or `DEFERRED`, never implicitly passing.

## Human authority

Humans retain final authority over journey correctness, persona priority,
interpretive and safety requirements, whether `N/A` is genuine, acceptable
expert shortcuts, and conflicts among content, placement, and flow evidence.

## Recommended audit order

Before first-principles design:

`content-audit → place-audit → flow-audit → first-principles redesign`

After implementation:

`visual-audit → functional-audit`

## Bundled files

- `references/flow-model.md` — graph schema and context ledger.
- `references/observation.md` — runtime observation and transition protocol.
- `references/scoring.md` — dimension anchors, costs, severity, and vocabulary.
- `references/report-template.md` — required report topology.
- `scripts/validate-flow.mjs` — deterministic graph validation and structural
  warnings; it does not decide findings.
- `scripts/emit-structured.mjs` — shared-ID, normalized finding, and executable
  flow-contract output.
