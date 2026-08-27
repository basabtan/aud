---
name: content-audit
description: Audit WHAT information should exist and WHEN it should appear before deciding where to place it. Use when a page feels overloaded, repetitive, like the same idea is shown in several forms, when source views/summary/comparison sections overlap, when deciding what to show vs hide, merge, disclose, or remove, or before redesigning an information-dense reader/analytical interface. Detect semantic, paraphrase, derived-summary, and cross-representation duplication; define a unique job for every view; rank content by task value and distinct information gain; and produce a minimum first-read plus progressive-disclosure architecture. Do not use for visual polish, functional correctness, factual truth, or final placement/prominence — hand the surviving content to place-audit afterward.
---

# Content audit

A layout can be perfectly arranged and still be overloaded because the wrong
information set was accepted as fixed.

This skill runs **before layout design**. Its job is to decide which information
deserves the user's attention at each stage, which information is genuinely new,
which is only a restatement, and which representations should not coexist at the
same time.

## Governing idea

> Content is not free.
>
> Every visible proposition consumes attention. It earns that cost only if it
> answers a user question, changes interpretation, supports trust, enables a
> decision, or provides necessary context.

Do not design a page that "accommodates everything." First reduce the information
set to what the user needs now, then progressively disclose what they may need
next.

A successful audit can conclude that an entire section, view, rail, metric row,
or representation should disappear.

## Freeze information responsibilities, not interaction architecture

The content audit may freeze the surviving information model, content
requirements, role boundaries, and view responsibilities. It must **not** freeze
the final reader interaction architecture unless the evidence specifically
proves that architecture is necessary.

Names such as `Source`, `Compare`, `Evidence`, `Synthesis`, and `Related context`
may survive as information responsibilities or exclusive user questions. Their
eventual visual representation, ordering, default state, navigation, and whether
they appear as views, tabs, lenses, inline interactions, or another structure
remain open for first-principles design. Treat current-UI arrangements as
temporary implementation evidence, never as permanent design constraints.

## Boundary with the other audits

Keep the instruments separate:

| Audit | Primary question |
|---|---|
| `content-audit` | **What information deserves to exist, once, and at what stage?** |
| `place-audit` | Where should the approved information live, and how prominent should it be? |
| `visual-audit` | Has the visual treatment been deliberately designed? |
| `audit` | Does the implementation work correctly and remain usable? |

`place-audit` may detect duplicate atoms and low-demand information, but it is
placement-centric. This skill owns higher-order content architecture:
paraphrases, summaries that merely restate source material, view overlap,
reader/editor mixing, repeated representations of the same proposition, and the
question of whether a whole section or mode deserves to exist.

## Arguments

Parse `$ARGUMENTS` without inventing missing values:

- `quick` — one route/state; block-level inventory; top 10 content decisions.
- `standard` — default; initial state plus one important drill-down; full
  duplication clusters and view contracts.
- `full` — all declared reader stages, relevant routes, important roles, and
  breakpoints where content changes.
- `scope:<route-or-feature>` — limit the audit.
- `persona:<id>` — select one persona.
- `stage:<id>` — select one journey stage.
- `role:reader|editor|admin|...` — evaluate content visibility for one role.

Record the arguments in the report.

## Run artifact location

Keep this reusable skill in the audit-tools repository, but write every
application-specific run into the target application repository at
`<application-root>/audits/YYYY-MM-DD-content/`. Put `REPORT.md`, task models,
and evidence inside that run directory. Update
`<application-root>/audits/latest.md` so its Content row links to the newest run,
while preserving older runs. If the same type runs twice on one date, append
`-02`, `-03`, and so on rather than overwriting evidence.

In a monorepo, `application-root` is the nearest directory that owns the app's
runtime/build configuration. Never store product-specific audit results in the
repository that distributes this skill.

## The twelve-step loop

### 1. Freeze the audience and stage

Identify the primary user, their role, and the current journey stage.

A content decision is meaningless without a stage. Information that is
indispensable while verifying evidence may be noise while scanning a topic list.

If the task model is missing, create a provisional one from explicit repository
evidence and label every inference. Ask the user only where the answer would
materially change the architecture.

### 2. Inventory content blocks before atoms

Enumerate the page's **blocks/views**, not only DOM nodes.

Examples:

- topic summary
- KPI/fact row
- source essay
- comparison matrix
- claim list
- evidence rail
- citations
- timeline
- map
- synthesis
- related topics
- authoring controls

For each block record:

- block ID
- role/persona visibility
- user question it appears to answer
- source of truth
- inputs
- outputs
- interaction needed to reveal it
- whether it is source material, derived material, navigation, metadata, or
  authoring chrome

### 3. Build the provenance/derivation graph

Record how information is transformed.

Example:

`primary text → source essay → claims → comparison facet → synthesis`

This graph is essential. Two blocks may use different wording but still carry
the same underlying proposition. The audit must know whether a later block
actually transforms the information or merely repeats it.

Never treat a derived summary as automatically valuable because it is shorter.

### 4. Convert blocks into semantic propositions

Segment content into propositions: one claim, fact, relationship, question,
qualification, or instruction.

Preserve provenance.

Canonicalize meaning, not wording. Exact-string matching is insufficient.

Classify each proposition as one of:

- `SOURCE` — what a source/tradition/person actually says
- `EVIDENCE` — citation, quote, provenance, support strength
- `COMPARISON` — relationship among two or more sources/items
- `SYNTHESIS` — a higher-order conclusion that depends on several inputs
- `CONTEXT` — framing needed to understand the rest
- `STATUS` — current state, warning, completeness, conflict
- `NAVIGATION` — where to go next
- `AUTHORING` — controls or information for editors/admins

### 5. Cluster semantic duplication

Use the taxonomy in `references/rubric.md`.

At minimum detect:

- exact duplicate
- paraphrase duplicate
- derived restatement
- cross-representation duplicate
- repeated metadata
- repeated evidence
- role leakage
- beneficial contextual repetition
- useful transformation

Do not call two items duplicates merely because they discuss the same subject.
The test is whether the second item gives the reader **distinct information
gain**.

### 6. Score task value blind to current prominence

For each block/proposition, score task relevance using the declared task model.

Use ordinal values only:

- `0` — no declared task uses it
- `1` — orientation/context only
- `2` — useful
- `3` — required for an important task
- `4` — indispensable

Also classify necessity:

`Must / Should / Nice / Noise`

Do not use current visual prominence as evidence of importance.

### 7. Score distinct information gain

For every repeated or derived item, ask:

> If the user has already consumed the earlier material, what new understanding
> does this item add?

Use:

- `0 NONE` — no new proposition or useful transformation
- `1 TRACE` — mainly provenance/verification
- `2 CONTEXT` — reframes or compresses usefully
- `3 TRANSFORM` — reveals a relationship, comparison, consequence, or pattern
- `4 NEW` — materially new information

A synthesis that only rewrites all source claims scores `0–1`.
A synthesis that identifies agreement, conflict, uncertainty, and implications
can score `3–4`.

### 8. Write a contract for every view

Every major view/section must have **one primary user question** that is not
already owned by another visible view.

Use `references/view-contracts.md`.

If two simultaneously visible views have:

- the same primary question,
- substantially the same inputs,
- the same journey stage,
- and low distinct information gain,

they are competing representations. Recommend `MERGE`, `REMOVE`, or make one an
on-demand lens.

Do not preserve a view simply because it already has code or data.

### 9. Separate reader content from authoring content

Evaluate role visibility explicitly.

Reader paths should not carry editing controls, extraction tools, conflict
marking controls, drafting UI, diagnostic counts, or implementation metadata
unless the reader needs them.

Use:

- `HIDE_BY_ROLE`
- `MOVE_TO_AUTHORING_MODE`
- `KEEP_SHARED`

Do not solve role leakage by visually muting the controls. Remove them from the
reader information field.

### 10. Define the minimum first-read

Produce the smallest information set that lets the user answer the first-stage
questions correctly.

The default surface should contain only:

- orientation
- the most important distinctions
- critical uncertainty/conflict
- the obvious next action or drill-down

Everything else must justify being simultaneously visible.

Then define progressive disclosure levels:

1. `FIRST_READ`
2. `COMPARE`
3. `INVESTIGATE`
4. `VERIFY`
5. `AUTHOR`

These are conceptual levels, not required tabs.

### 11. Decide each block

Use only:

- `KEEP_PRIMARY` — belongs in the default reading field
- `KEEP_SECONDARY` — useful, but not first-read
- `MERGE` — combine with another block; name the surviving owner
- `DISCLOSE` — keep behind a deliberate drill-down
- `LINK_NOT_REPEAT` — preserve provenance/navigation without repeating content
- `REMOVE` — no sufficient value
- `HIDE_BY_ROLE` — valid content for another role
- `SPLIT` — block contains multiple jobs that should separate
- `REVIEW` — task/provenance evidence is insufficient

Never recommend a visual treatment here. No colors, typography, card styles, or
pixel positions.

### 12. Produce the handoff contract

Write `REPORT.md` in the current timestamped Content run directory using
`references/report-template.md`.

The final section must contain a **surviving content contract** for the next
design pass:

- first-read content
- secondary content
- on-demand lenses
- removed/merged content
- role-gated content
- each surviving view's exclusive job
- unresolved decisions

Only after the information responsibilities are frozen should `place-audit`
determine location/prominence. The final reader flow and interaction architecture
remain open unless the audit evidence establishes a necessary constraint.

## The key anti-patterns

### "Everything is useful"

Useful is not enough. Simultaneous visibility requires stage-specific value.

### "The summary is different wording, so it is new"

Wording is not information gain.

### "The table and prose are different representations"

A new representation is valuable only if it makes a relationship easier to
perceive or supports a different task.

### "More evidence increases trust"

Repeated evidence labels can reduce trust by making the interface look defensive
or noisy. Keep provenance accessible; do not repeat it everywhere.

### "The user may need it eventually"

Eventually is a progressive-disclosure argument, not a default-visibility
argument.

### "There is room on the screen"

Available space is not permission to consume attention.

## Confidence gates

Use `REVIEW` rather than a destructive recommendation when:

- persona or journey stage is unclear
- a block's source of truth is unknown
- semantic equivalence is uncertain
- the content has legal/safety/compliance implications not declared by the user
- the second representation may serve an expert workflow not yet modeled
- an apparent duplicate is actually needed for provenance or comparison

For removal of a whole view, require:

1. clear task model,
2. low unique information gain or strong overlap,
3. no exclusive role/task,
4. preserved access to source/evidence where needed.

## Human authority

Humans retain final authority over:

- the task model
- which interpretations count as distinct
- editorial policy
- legal/safety/compliance content
- acceptable repetition for teaching or persuasion
- expert vs novice tradeoffs
- whether a synthesis is sufficiently transformative

Do not average conflicting personas. Report them separately.

## Recommended audit order for overloaded interfaces

For an existing information-dense page:

Before first-principles design:

`content-audit → place-audit → flow-audit → first-principles redesign`

After implementation:

`visual-audit → audit`

Do not run visual polish first when the problem is information overload. That
risks making redundant content look better instead of removing it.
