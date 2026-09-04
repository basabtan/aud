# place-audit — Information Placement Auditor · Build Spec v1.0

Status: implemented v1 decision record. AUD v2 owns current cross-specialist
workflow and authority boundaries; this document remains authoritative only for
the place-audit v1 internals that have not been superseded.
Sources: merged from three deep-research reports (ChatGPT = architectural spine,
Grok = starting coefficients + dark-theme features, Perplexity = pairwise-scoring
reliability + RTL emphasis). Disagreements resolved in §18 Decision Log.

Governing principle (verbatim, do not dilute):

> Let perception determine how visible an information point currently is.
> Let the declared user task determine how visible it deserves to be.
> Never ask the same model to decide both.

---

## 0. Product form & repo integration

Originally shipped as the third plugin in `github.com/basabtan/aud`:

| Plugin | Command | What it asks |
|---|---|---|
| `visual-audit` | `/visual-audit:visual-audit` | Did anyone decide how this should look? |
| `audit` | `/audit:audit` | Does this work, and is it good to use? |
| **`place-audit`** | `/place-audit:place-audit` | **Is the right information in the right place, at the right prominence — and should it exist at all?** |

Current workflow correction: in the AUD v2 pipeline, content responsibility is
established before placement, then flow is evaluated; visual and functional
verification follow implementation. `place-audit` remains independently usable
for a narrow placement question when missing upstream contracts are disclosed.

Folder layout (mirrors existing plugins):

```
plugins/place-audit/
  .claude-plugin/plugin.json
  skills/place-audit/
    SKILL.md
    references/
      scoring.md          # all formulas + coefficients (this spec §9–§12)
      task-model.md       # task model schema + elicitation script + rubric
      segmentation.md     # atom rules, adapters, debugger usage
      report-template.md  # audit table + annotated screenshot format
      blind-spots.md      # §17 runbook, checked before any report is trusted
    scripts/
      extract.mjs         # Playwright: render, freeze, extract atoms per state
      prominence.mjs      # deterministic P_DOM / P_effective computation
      canonical.mjs       # semantic canonicalization + duplicate candidates
      annotate.mjs        # screenshot overlay renderer
```

Marketplace entry to append to `.claude-plugin/marketplace.json`:

```json
{
  "name": "place-audit",
  "source": "./plugins/place-audit",
  "description": "Audit where information sits on a page versus where the user's declared tasks need it — per-atom demand vs prominence, redundancy detection, and ranked relocation flags."
}
```

Division of labor inside the skill (this is the core design win of the skill
form): the `scripts/` are deterministic and produce JSON; **Claude itself is the
demand-scoring LLM and the report writer**, following the blind-scoring protocol
in §10. No external LLM API needed.

---

## 1. The question & scope

Per information atom on a rendered page, answer four questions:

1. WHERE should it be — relative to the user's task locus, not the geometric
   screen center (see §18-D1).
2. WHETHER it should exist — necessity class: must / should / nice / noise.
3. HOW prominent — visual weight and access cost matched to demand.
4. WHETHER it is redundant — same semantic fact shown in multiple places, and
   whether that repetition is beneficial or waste.

Out of scope for v1: comprehension testing, copy quality, aesthetic judgment
(that is `visual-audit`), functional correctness (that is `audit`), automatic
layout rewriting (the skill flags and proposes; a human moves).

---

## 2. Architecture

Two independent measurements per atom, reconciled by rank:

```
                    ┌─────────────────────┐
                    │ DECLARED TASK MODEL │  (human-owned, provenance-tagged)
                    └──────────┬──────────┘
                               ▼
                      Claude: relevance only   (blind — sees no styling)
                               │
                            DEMAND
                               │
PAGE ─► STATES ─► ATOMS ───────┼──────────────► FIT (rank-based)
                   │           │                  │
                   ▼           │                  ▼
             SEMANTIC ID       │            FLAG / REVIEW
                   │           │                  │
                   ▼           │                  ▼
              DUPLICATES       │          placement candidates (regions)
                               │
SCREENSHOT + DOM ─► PROMINENCE─┘
                        ├─ visual hierarchy (deterministic DOM features)
                        ├─ position / task anchor
                        └─ access cost (multiplicative decay)
```

Pipeline order (also the build order — see §15):
render+freeze → extract → segment → canonicalize → enumerate states →
prominence (deterministic) → demand (Claude, blind) → FIT → placement
candidates → report.

Every finding carries one of four verdict states (axe-core pattern):
`PASS / FAIL / REVIEW / UNSCORABLE`. REVIEW and UNSCORABLE are successful
outputs, not failures — false precision is the enemy.

---

## 3. Data model

### 3.1 Information atom

Atom invariant: **one principal proposition, one semantic key, one
scope/context, zero or more qualifiers.** Test: "could this proposition
reasonably have a different task demand from the information immediately beside
it?" If no → merge; if yes → split.

```json
{
  "atom_id": "a42",
  "state_id": "initial",
  "region": "primary-kpi-row",
  "dom": { "selector": "...", "path": "...", "tag": "span", "aria_role": null },
  "text": "Downtime 7.3 h (shift)",
  "semantic": {
    "entity": "line_4", "metric": "downtime", "value": 7.3,
    "unit": "hours", "period": "current_shift",
    "aggregation": "sum", "scope": "production", "qualifiers": [],
    "semanticRole": ["kpi"]
  },
  "geometry": { "bbox": [1,2,3,4], "text_rects": [], "viewport_rel": [],
                "occluded": false, "clipped": false, "fixed": false },
  "style": { "font_family": "...", "font_size": 13, "font_weight": 600,
             "color": "#F1EDE3", "effective_bg": "#101A24",
             "contrast_ratio": 9.8, "direction": "ltr", "opacity": 1 },
  "access": { "path": "visible", "cost": 0 },
  "confidence": { "segmentation": 0.86 }
}
```

Notes:
- Text-node geometry from DOM `Range.getClientRects()`, never the parent card's
  `getBoundingClientRect()` (a KPI must not inherit its card's area).
- ARIA labels duplicating visible text attach as metadata to the same atom —
  never counted as a second displayed atom.
- Controls carrying state ("Region: Riyadh") get dual `semanticRole`:
  `["filter-state","control"]` — one atom, both roles.

### 3.2 Task model (human-owned, machine-readable)

```json
{
  "persona": { "role": "conflict analyst", "experience": "expert" },
  "stages": [
    { "id": "orient",      "goal": "understand current position" },
    { "id": "interrogate", "goal": "evaluate moves from focus state" }
  ],
  "tasks": [
    {
      "id": "T1", "stage": "interrogate",
      "verb": "identify", "object": "credible sanction against improvement",
      "successCriterion": "sanction chain located",
      "frequency": 0.9, "criticality": 0.8,
      "timeSensitivity": 0.5, "userCoverage": 0.9,
      "requiredInformation": ["sanction chain", "rank delta"],
      "source": "designer walkthrough", "evidenceStrength": 0.6
    }
  ]
}
```

Every task carries `source` + `evidenceStrength`; recommendation severity is
scaled by it (§11). If the user has no task model, the skill elicits one
conversationally (3–5 stages, tasks with the four weights) before scoring —
and labels every elicited task `source: "session elicitation",
evidenceStrength: 0.5`.

### 3.3 Environment manifest (frozen per run)

viewport w/h, DPR, browser engine, zoom, theme, locale, direction, font set,
data fixture, auth/role, breakpoint, UI state, animation-freeze flag. Fixed
data fixtures are required — live data creates false duplicates and false
segmentation diffs between runs.

---

## 4. S1 — Render & freeze

- Playwright, real browser context. One fixed desktop viewport for v1
  (declare it; 1440×900 default), plus the breakpoint matrix in v2.
- Disable/freeze animation for the static baseline; record that animation
  existed (`UNSCORABLE_STATIC` candidates).
- Record the full environment manifest in the report header.

## 5. S2 — Extraction

Per visible candidate node collect: selector/path, tag, ARIA role + accessible
name, ancestry, bounding + text rects, viewport/document position, scroll
container, visibility/occlusion/clipping (elementFromPoint sampling), opacity,
transform, z-index, font family/size/weight/line-height/letter-spacing, text
color, **effective background** (composited walk up the tree), WCAG contrast
ratio, direction + writing-mode (resolved per block, never global — mixed
English/Arabic pages are first-class), interactive role, tabindex, href/action,
fixed/sticky, current state.

Also extract: input/select values, button labels, SVG `<text>`, pseudo-element
generated content, table row/column headers, captions, status/alert regions.

Canvas-rendered content: **do not OCR in v1.** Emit one `UNSCORABLE` atom per
canvas region with its bbox, and recommend app-level instrumentation. (§20)

## 6. S3 — Segmentation (highest-risk subsystem)

**Bad segmentation silently invalidates every later metric.** DOM topology
alone is not perceptual structure (VIPS lesson); combine DOM + geometry.

Three levels: `PAGE → REGION/PANEL → ATOM`.

Merge/split rules:
- Label + value + qualifier merge into one atom
  (`Revenue / $4.2M / YTD` → one atom). Splitting them destroys meaning.
- A card listing three metrics is **three atoms**, not one card.
- Tables: atom identity = row header + column header + cell value. Never one
  atom per table; never headers as free-floating atoms.
- Charts: chart-level adapter — represent chart object, series, legend, title,
  annotations, explicit labels as semantic objects. Never one atom per SVG
  mark. Expand individual marks only when a declared task requires reading them.

MergeConfidence = f(DOMAssociation, SpatialAlignment, Proximity,
TypographyCompatibility, SemanticCompatibility, ARIAAssociation). Store it as
`confidence.segmentation`; below 0.70 the atom can only ever yield REVIEW.

**Build the segmentation debugger before anything else** (§15): annotated
screenshot where clicking a box shows atom id, parsed fields, DOM nodes,
confidence. Manual correction here is worth more than any weight tuning.

## 7. S4 — Canonicalization & duplicates

Normalize values before comparison:
`$4,200,000 → currency:USD/4200000` · `4.2M → 4200000` · `7.3 hrs →
duration/7.3h` · `18.0% → ratio/0.18` · dates → normalized + period context.

Duplicate logic on semantic keys (never raw string equality):

| Case | Verdict |
|---|---|
| same value, different metric | NOT duplicate ("Orders 12 / Returns 12") |
| same metric + value + context | duplicate candidate |
| same metric, different context/period | NOT duplicate |
| same metric + context, **different value** | `CONFLICTING_DUPLICATE` — data-integrity flag, highest severity |

Duplicate candidates classify into:
`BENEFICIAL_CONTEXT` (local repetition that saves navigation cost — keep) ·
`SYNCHRONIZED_MIRROR` (e.g., header echo of KPI — usually keep one primary +
one contextual) · `LIKELY_REDUNDANT` (flag) · `CONFLICTING_DUPLICATE` (FAIL).

Embeddings ("OEE" ≈ "Overall equipment effectiveness") generate candidates
only; equality is decided on canonical keys, never on embedding similarity.

## 8. S5 — State enumeration

State manifest declared per audit (not crawled — state space is combinatorial;
the task journey decides which transitions matter):

```yaml
states:
  - id: initial
  - id: row_selected      # actions: click first row
  - id: details_expanded
  - id: chart_hover       # hover-only info gets its true access cost
```

v1 scope: `initial` + one important post-interaction state. Atoms are linked
across states by semantic key. Touch-only targets: hover-only information is
**unavailable**, not costed — flag it, do not score it.

## 9. S6 — Prominence (deterministic)

Two layers, never collapsed early:

- `P_visual` — prominence once exposed.
- `P_effective = P_visual × e^(−0.45 · AccessCost)` — after exposure effort.
  (A 28px tooltip is still invisible until someone finds the hover target.)

### 9.1 DOM prominence

```
P_DOM = 100 × (0.25·Q + 0.25·T + 0.20·C + 0.10·A + 0.10·E + 0.10·H)
```

All components page-local robust percentiles in [0,1]. Coefficients are
engineering priors, not psychophysics — freeze them, then calibrate (§16).

**Q — position (task anchor, not screen center):**
```
F = exp(−(d(atom, anchor) / (0.35·D))²)      D = viewport diagonal
Q = 0.60·F + 0.25·R + 0.15·L
```
Anchor priority: primary task object → selected row/card → active chart →
active filter → decision/action region → panel center → viewport center
(fallback only). R = reading-order prior derived from **actual** dir/writing-
mode/bidi per block (never `x smaller = earlier`). L = local panel priority.
F-pattern: weak conditional prior for long LTR text pages only. Z-pattern:
weight zero.

**T — typography:** `T = 0.70·pct[log2(fontSize/medianPageFontSize)] +
0.30·T_weight`. Relative, because 13px means different things on different
pages.

**C — contrast:** `C = 0.5·(log(CR)/log(21)) + 0.5·C_localrank` — absolute
WCAG ratio plus rank against neighbors (AA-passing text can still be the most
muted thing in its panel). **WCAG is a floor, not a feature: never propose
contrast below 4.5:1 text / 3:1 large-text-and-UI, regardless of demand.**

**A — area:** `pct[log(1 + paintedTextPixels)]` — text rects, not parent card.

**E — emphasis:** difference from siblings, not raw colorfulness:
`E = 0.5·ΔColor_sibling + 0.5·StyleDistinctiveness` (badge, border, fill,
icon, uppercase, glow, selected state). ΔColor against the page/panel mean
keeps this dark-theme safe (Grok's contribution). Motion → `UNSCORABLE_STATIC`
marker, not a static score.

**H — hierarchy:** heading level, panel nesting depth, list position, sticky
status.

### 9.2 Access cost ladder

| Access path | Cost |
|---|---|
| Visible in initial viewport | 0 |
| One viewport of scroll | 0.35 |
| Hover/focus reveal | 0.50 |
| One disclosure click | 0.70 |
| Tab/panel switch | 0.90 |
| Modal/drawer/navigation | 1.20 |
| Each additional interaction | +0.60 |

### 9.3 Saliency models

**Not in v1.** When added (v2+): `P_visual = 0.65·S_UI + 0.35·P_DOM` with a
UI-trained model only (UEyes-class or Dashboard Vision), sensitivity-tested at
0.50/0.65/0.80 — if top findings flip across that range, the system is not
robust enough to recommend. Natural-image models (DeepGaze) are comparison
baselines only. Dark analytical UIs are out-of-domain for all of them; treat
model outputs as a feature, never truth.

## 10. S7 — Demand (Claude, blind protocol)

Deterministic task weight (human inputs, never LLM):
```
W_t = 0.40·Criticality + 0.25·Frequency + 0.20·UserCoverage + 0.15·TimeSensitivity
```

Claude scores only the atom↔task relationship, ordinal 0–4 mapped to
r ∈ {0, .25, .5, .75, 1}. Rubric (use verbatim in `references/task-model.md`):

> Evaluate only against the declared tasks. Never invent another user goal or
> requirement. Ignore the item's current position, size, color, and styling.
> 0 None — no declared task uses this information.
> 1 Contextual — may help orientation; not needed for progress.
> 2 Useful — directly helps a declared task; task executable without it.
> 3 Required — directly needed for an important/frequent task; absence causes
>   significant searching, delay, or error risk.
> 4 Indispensable — the task cannot be completed correctly/safely without it.
> Return only: score, task IDs, necessity class, confidence, one-line reason
> grounded exclusively in task-model fields. No task ID = score 0.

Aggregation (noisy-OR — multi-task atoms rise without exploding):
```
D = 100 × (1 − Π_t (1 − W_t · r_t))
```

Necessity is a **separate variable** (never derived from D alone):
Must = correctness/safety/irreversible decision/critical status/accessibility
(a rare error warning stays Must at low frequency — criticality floor) ·
Should = materially speeds an important task, workaround exists ·
Nice = orientation/explanation/occasional · Noise = serves nothing declared.

Variance protections (all six, non-negotiable):
1. **Blind**: the demand pass never sees position, size, color, prominence,
   current FIT, or the designer's opinion. In-skill this means demand scoring
   happens from the semantic atom list *before* reading `prominence.mjs`
   output — enforce by pipeline order, and the SKILL.md must say so.
2. Ordinal 0–4 only, never 0–100 free-form.
3. Task-ID evidence required for any nonzero score.
4. Uncertain items scored twice more; median kept; dispersion stored.
5. Borderline items pairwise-ranked within a task, both A/B and B/A order
   (pairwise reliability ≫ absolute ratings — Perplexity's number: 0.98
   split-half).
6. Two calibration atoms per run (one obvious-noise, one obvious-must); if
   either drifts, invalidate the batch and rescore.

Record per run: model id/version, prompt version, task-model hash, batch
order, run number, scores + dispersion.

## 11. S8 — FIT & verdicts

**Rank-based** (absolute D − P subtracts uncalibrated scales — rejected, §18-D3):
```
FIT = percentile_rank(D) − percentile_rank(P_effective)     ∈ [−100, +100]
```

| FIT | Reading |
|---|---|
| −14 … +14 | Matched |
| +15 … +24 | Potentially buried — REVIEW |
| +25 … +39 | BURIED_CORE flag |
| ≥ +40 | Severe under-prominence |
| −15 … −24 | Potentially over-prominent — REVIEW |
| −25 … −39 | OVEREMPHASIZED_LOW_VALUE flag |
| ≤ −40 | Severe over-prominence |

```
Severity = |FIT| × Conf_seg × Conf_task × Conf_LLM × M_necessity
M_necessity: must 1.25 · should 1.00 · nice 0.75 · noise 0.75
```

A relocation is recommended only when ALL hold: |FIT| ≥ 25, Conf_seg ≥ .70,
Conf_task ≥ .70, LLM result stable across passes, finding persists across
audited states. Otherwise verdict = REVIEW.

Recommendation vocabulary: `MOVE / MUTE / DISCLOSE / DEDUPLICATE / KEEP /
REVIEW`. KEEP is a successful finding (house rule shared with `visual-audit`).
DISCLOSE only when: demand low at this stage AND retrieval cost tolerable AND
not status/error info AND experts don't need it repeatedly AND accessibility
intact.

## 12. S9 — Placement candidates

Never emit pixel coordinates. Enumerate the page's candidate regions
(primary header, KPI row, chart adjacency, selected-object region, sidebar,
below-fold, disclosure panel, tooltip) and cost each:

```
J(slot) = |P_predicted(slot) − D| + λ·TaskDistance + μ·LayoutDisruption
          + ν·RedundancyPenalty + AccessibilityPenalty
```

Report the best 1–2 slots with estimated prominence range and the reason,
e.g.: "Current deviation — demand rank 91, prominence rank 34, FIT +57.
Move into selected-machine summary adjacent to deviation chart
(est. prominence 78–88). Must-have during diagnosis; currently 1.4 viewports
of scroll away."

## 13. S10 — Report outputs

Two complementary views, both written to the audited repo (e.g.
`REPORT.md` + `overlay-<state>.png` + `atoms.json` in the current timestamped
Place run directory):

1. Annotated screenshot per state: BURIED_CORE, OVEREMPHASIZED, DUPLICATE,
   low-confidence segmentation, hidden-access items.
2. Sortable audit table:

| Atom | Necessity | Demand | Prominence | FIT | Access | Dup | Conf | Verdict |
|---|---|---|---|---|---|---|---|---|
| Current deviation | Must | 91 | 34 | +57 | scroll | — | .91 | MOVE near analysis chart |
| Export CSV | Nice | 34 | 74 | −40 | rest | — | .89 | MUTE |
| OEE 84.3% | Must | 88 | 90 | −2 | rest | 3× | .95 | KEEP one primary + 1 contextual |

Plus: run manifest, task model with provenance, calibration-atom results,
and the §17 checklist with each line marked checked/deferred.

## 14. SKILL.md outline

The current frontmatter deliberately limits automatic selection to explicit,
narrow placement questions. Broad audit and redesign requests belong to the AUD
orchestrator; duplicate observations are candidates for content or synthesis,
not independent deletion decisions.

Body sections:
1. The governing idea (demand vs prominence; the separation principle).
2. `$ARGUMENTS`: depth (`quick` = initial state, top-10 flags; `standard` =
   +1 interaction state, full table; `full` = state manifest + breakpoints),
   scope (page/route filter), `persona:<id>`, `stage:<id>`.
3. The 10-step loop (S1–S10 above), each step naming its script or protocol.
4. Task-model elicitation script (if none exists in repo, ask; store as
   `task-model.json` in the current timestamped Place run for reuse; label
   evidenceStrength).
5. Blind-scoring order enforcement (demand before reading prominence output).
6. Verdict rules + gating thresholds (from §11).
7. What stays human (from §17 tail): journey correctness, safety necessity,
   expert-vs-novice tradeoffs, whether repetition is context, structural moves.

## 15. MVP cut (v0.1) & build order

In: Playwright extraction · hybrid label/value segmentation + debugger ·
semantic canonicalization · deterministic P_DOM + access decay · declared task
model + blind 0–4 demand · exact/semantic duplicate candidates · rank FIT ·
annotated screenshot + table. One viewport, initial + one state, one persona,
one stage at a time.

Out (until MVP is validated): saliency models, OCR/canvas, full state graphs,
breakpoint matrix, placement optimizer beyond region ranking, auto-applied
changes.

Build order (priority = failure isolation, not CV-first):
**segmentation correctness → task-model correctness → access-state coverage →
demand scoring → simple prominence → duplicate detection → human validation →
UI saliency → placement optimization.**
A 5% saliency gain cannot rescue a mis-segmented atom or a hallucinated need.

## 16. Validation protocol

Validate four things separately:
1. **Segmentation**: hand-annotate representative pages; measure
   AtomExactMatchRate, label-value binding, table-header association,
   merge/split error rates. Gate: do not tune scores while segmentation errors
   are frequent.
2. **Prominence**: sanity-rank against expert judgment on your own pages; v2:
   benchmark vs UEyes/Dashboard Vision subsets — but note domain shift (dark
   analytical UI) and build a small in-house benchmark (5–10 pages, 3 experts
   ranking top-10 most/least prominent atoms).
3. **Demand**: agreement with blinded human task judgments (weighted kappa on
   necessity classes; Spearman on demand rank).
4. **End-to-end**: Precision@10 of top flags vs expert review; A/B one page's
   accepted changes → task time / first-click correctness / unnecessary
   navigation.

Must beat: random, screen-center heuristic, font-size-only, no-change.
Separate calibration pages from test pages — never tune and test on the same
five dashboards. Release criterion: held-out metric CI clears the simple
baselines AND applied changes improve ≥1 task measure without degrading others
or accessibility.

Longitudinal: log every reviewer decision (accepted / rejected / modified +
reason + which subsystem was wrong). Analyze false positives by cause
(segmentation / prominence / task-map / intentional-redundancy /
expert-exception / missing-state / business-constraint) — this dataset is the
long-term moat.

## 17. Blind-spot runbook (checked before trusting any report)

Condensed to the checks that bite; full table in `references/blind-spots.md`.

- [ ] 20 random atoms manually verified (boundaries + label/value binding)
- [ ] Charts represented as semantic objects, not per-mark atoms
- [ ] Canvas regions emitted as UNSCORABLE, not silently missing
- [ ] Direction resolved per block; no global LTR assumption (Arabic pages)
- [ ] Task anchor used; geometric center only as declared fallback
- [ ] Below-fold, hover-only, and disclosure content carry access cost;
      hover-only on touch = unavailable
- [ ] Sticky/fixed occlusion tested (geometry ≠ visibility)
- [ ] Demand pass saw no styling/position (blind order enforced)
- [ ] Item order shuffled between demand passes; calibration atoms stable
- [ ] Rubric + prompt version frozen and recorded
- [ ] No necessity derived from frequency alone (rare error warnings = Must)
- [ ] Task model has provenance + evidenceStrength; low-evidence tasks damp
      severity
- [ ] Expert vs novice: if personas disagree radically, report the conflict,
      never average it
- [ ] No MUTE recommendation below WCAG 4.5:1 / 3:1
- [ ] Repetition judged by class (BENEFICIAL_CONTEXT is a keep)
- [ ] Same-key-different-value conflicts surfaced as integrity flags
- [ ] Weights untouched since last calibration set; page classes not mixed
- [ ] Every low-confidence finding is REVIEW, not MOVE

Human-authoritative always: journey correctness, safety/legal necessity,
expert-workflow exceptions, whether a repeat is useful context, structural
relocations, high-severity low-confidence findings.

## 18. Decision log (disagreements resolved)

| # | Question | Grok said | ChatGPT said | Decision |
|---|---|---|---|---|
| D1 | Position anchor | screen-center distance | task locus, center fallback | **ChatGPT** — evidence (UEyes type-dependence, Dashboard Vision) + revises the original "closer to center" brief |
| D2 | Access cost | additive term, w=0.15 | multiplicative e^(−0.45C) | **ChatGPT** — tooltip argument; additive lets huge hidden text stay prominent |
| D3 | FIT | absolute D−P, ±0.25/0.30 | rank percentiles, ±25/40 | **ChatGPT** — scales aren't calibrated; absolute FIT deferred until human calibration data exists |
| D4 | LLM scoring | 0–10 rubric, 3-run mean | ordinal 0–4, blind, noisy-OR, pairwise for borderline | **ChatGPT** + Perplexity's pairwise emphasis |
| D5 | Weights | .40/.45/.15 (pos/vis/access) | .25/.25/.20/.10/.10/.10 six-feature | **ChatGPT's decomposition**; Grok's kept in `scoring.md` as an alternate prior for sensitivity testing |
| D6 | Color emphasis | deviation from page mean | sibling ΔColor + distinctiveness | **Merged** — both are deviation-based and dark-theme safe |
| D7 | Saliency in v1 | optional add-on | explicitly last | **Last** (both MVAs agree) |
| D8 | Data-ink | operationalize Tufte | Waste = Prominence×(1−TaskUtility) | **ChatGPT** — embellishment evidence is mixed; pixel minimization is not a law |

## 19. Versioning & provenance

Every report header: spec version, script versions, prompt version, task-model
hash, environment manifest, model id. A model or prompt update must bump the
version — otherwise audits silently drift months later.

## 20. Open problems (known, accepted)

1. Canvas-rendered charts: instrument the app (expose data attributes) —
   OCR is a last-resort v3 experiment.
2. No public benchmark for dark, dense, analytical UIs — the in-house
   benchmark (§16.2) is unavoidable and small is fine.
3. All coefficients are priors; the tool must not present them as science.
   The rank-FIT formulation + confidence gating is what makes it honest
   before calibration exists.
