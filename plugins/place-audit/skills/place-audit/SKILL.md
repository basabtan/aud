---
name: place-audit
description: Audit whether the right information is in the right place, at the right prominence, and should exist at all. Use when information feels far, buried, scattered, redundant, or like too much on screen; when asked "is this redundant", "what can I remove", "where should X go", "prioritize the information", "declutter", or "audit the layout/placement/hierarchy"; and proactively after building any information-dense page or dashboard. This audits information architecture, not functional correctness or visual polish.
---

# Place audit

## The governing idea

> Let perception determine how visible an information point currently is.
> Let the declared user task determine how visible it deserves to be.
> Never ask the same model to decide both.

Measure every information atom twice. Deterministic browser evidence produces
prominence; the declared, provenance-tagged task model produces demand. Keep the
passes blind, reconcile their ranks only after both are frozen, and prefer
`REVIEW` or `UNSCORABLE` to false precision.

This skill does not judge aesthetics, correctness, comprehension, or copy. It
flags placement and proposes; it never moves layout automatically.

## Arguments

Parse `$ARGUMENTS` without inventing missing values:

- `quick`: initial state only and the ten highest-severity findings.
- `standard` (default): initial plus one important interaction state and the
  full table.
- `full`: declared state manifest and requested breakpoint matrix. The v0.1
  scripts still support one viewport at a time, so mark additional breakpoints
  deferred rather than pretending they ran.
- `scope:<page-or-route-filter>` limits capture and reporting.
- `persona:<id>` and `stage:<id>` select exactly one persona and one journey
  stage from the task model.

Record parsed arguments in the report. Ask only for values that materially
change the audit and cannot be found in the repository.

## The ten-step loop

### 1. Render and freeze

Run `scripts/extract.mjs` against a fixed URL or HTML file at a declared viewport
(default `1440x900`). Use fixed data and role/auth state. Freeze animations but
record whether any existed. Capture a full-page screenshot and environment
manifest. Live data invalidates duplicate and state comparisons.

### 2. Extract and segment

The same `extract.mjs` pass collects text ranges, computed style, effective
background, contrast, block direction, geometry, access path, controls, table
header identity, pseudo-content, SVG text, and canvas placeholders. Enforce the
atom invariant: one proposition, one semantic key, one context. Merge
label/value/qualifier; split unrelated metrics; represent each table data cell
as row header + column header + value. Never OCR canvas.

### 3. Debug segmentation

Run `scripts/annotate.mjs` on the raw atoms before scoring. Inspect the overlay
and at least 20 random atoms when available. Any merge/split or table-header
error blocks score tuning. `confidence.segmentation < 0.70` gates every later
finding to `REVIEW`.

### 4. Canonicalize

Run `scripts/canonical.mjs`. Compare duplicate candidates by canonical semantic
key, never raw strings. Same value with a different metric is not a duplicate;
same metric/context with a different value is `CONFLICTING_DUPLICATE`. Classify
repetition as `BENEFICIAL_CONTEXT`, `SYNCHRONIZED_MIRROR`,
`LIKELY_REDUNDANT`, or `CONFLICTING_DUPLICATE`. Human review decides whether
contextual repetition is useful.

### 5. Enumerate access states

For `standard`, declare initial plus one journey-relevant state (hover, selected
row, disclosure, tab, drawer). Link atoms across states by canonical key.
Hover-only information on touch is unavailable, not merely expensive. Do not
crawl a combinatorial state graph.

### 6. Compute prominence without interpreting it

Run `scripts/prominence.mjs` to produce deterministic `P_visual`, access cost,
and `P_effective`. At this point **do not open, summarize, quote, or pass the
prominence output into the demand conversation**. The script may finish, but its
result remains unread until step 7 is frozen. See `references/scoring.md`.

### 7. Score demand blind

Create a demand packet containing only semantic atom fields and the selected
task-model slice. Strip geometry, DOM order, style, access path, prominence,
FIT, screenshots, and designer opinion. Score the atom↔task relationship using
the exact 0–4 rubric in `references/task-model.md`; require task IDs for every
nonzero score. Score uncertain items twice more and keep the median plus
dispersion. Pairwise-rank borderline items A/B and B/A. Shuffle batch order.
Include one obvious-noise and one obvious-must calibration atom; drift
invalidates the batch. Freeze demand before reading prominence.

Record model id/version, prompt version, task-model hash, batch order, run
number, scores, confidence, and dispersion.

### 8. Reconcile ranks and verdicts

Only now read prominence. Compute `FIT = percentile_rank(D) -
percentile_rank(P_effective)`. Apply the thresholds and confidence gates in
`references/scoring.md`. Necessity remains separate from demand. Low task
evidence, unstable LLM passes, missing cross-state persistence, or segmentation
below `.70` means `REVIEW`, never a relocation.

### 9. Rank placement candidates

Enumerate existing regions: primary header, KPI row, task-object adjacency,
selected-object summary, sidebar, below-fold, disclosure, tooltip. Never emit
pixel coordinates. Give the best one or two regions, estimated prominence range,
task-distance reason, and disruption/accessibility tradeoff. Use only
`MOVE / MUTE / DISCLOSE / DEDUPLICATE / KEEP / REVIEW`.

### 10. Annotate and report

Run `scripts/annotate.mjs` for every audited state. Write `place-audit/REPORT.md`,
`atoms.json`, canonical and prominence JSON, and `overlay-<state>.png` in the
audited repository. Follow `references/report-template.md` exactly. Include the
run manifest, task provenance, calibration results, full sortable table, and
every blind-spot check marked checked or deferred. Every low-confidence finding
must read `REVIEW`.

## Task-model elicitation

If no reusable task model exists, ask the user for one persona, three to five
journey stages, and the tasks in the selected stage. For each task ask: verb,
object, success criterion, required information, frequency, criticality,
time-sensitivity, and user coverage (all weights `0..1`). Do not infer safety or
legal necessity. Store the result at `place-audit/task-model.json` with
`source: "session elicitation"` and `evidenceStrength: 0.5` for every elicited
task. Reuse it on later runs, but confirm stale assumptions.

## Verdict gates

- `FIT -14..+14`: matched; normally `KEEP`.
- `+15..+24` or `-15..-24`: potentially buried/over-prominent; `REVIEW`.
- `+25..+39`: `BURIED_CORE`; `-25..-39`:
  `OVEREMPHASIZED_LOW_VALUE`.
- `>= +40` or `<= -40`: severe under/over-prominence.
- Recommend relocation only when `|FIT| >= 25`, segmentation and task
  confidence are each at least `.70`, demand is stable, and the finding persists
  across audited states. Otherwise `REVIEW`.
- `DISCLOSE` requires low demand at this stage, tolerable retrieval cost, no
  status/error role, no repeated expert need, and intact accessibility.
- Never recommend contrast below WCAG `4.5:1` for text or `3:1` for large text
  and UI, even for low-demand atoms.

## Human authority

Humans retain final authority over journey correctness, safety/legal necessity,
expert-versus-novice tradeoffs, whether repetition is beneficial context,
structural moves, and every high-severity low-confidence finding. Report persona
conflicts; never average them away.

## Running the scripts

The scripts need `playwright` resolvable from the working directory
(`npm i -D playwright` in the project being audited) and a Chromium binary.

`extract.mjs` and `annotate.mjs` honour `CHROME_PATH`. Set it whenever the
browser is not where Playwright expects it — in a sandbox with a pre-installed
browser that is usually something like
`/opt/pw-browsers/chromium-<build>/chrome-linux/chrome`. Check what exists
rather than guessing the build number:

```bash
find /opt/pw-browsers -name chrome -o -name headless_shell

CHROME_PATH=/opt/pw-browsers/chromium-<build>/chrome-linux/chrome \
  node scripts/extract.mjs http://localhost:5173/ --out atoms.json
```

Without it, a mismatch between the installed `playwright` package and the
available browser build fails with "Please run the following command to
download new browsers". Do not run `npx playwright install` in a sandbox that
already ships a browser — point `CHROME_PATH` at the binary that is there.

## Bundled files

- `references/scoring.md` — prominence, demand, FIT, severity, and placement.
- `references/task-model.md` — schema, elicitation, and exact blind rubric.
- `references/segmentation.md` — atom rules, adapters, and debugger use.
- `references/report-template.md` — required report topology.
- `references/blind-spots.md` — trust checklist; run before reporting.
- `scripts/extract.mjs`, `prominence.mjs`, `canonical.mjs`, `annotate.mjs` —
  deterministic Playwright/Node stages; none calls an LLM.
