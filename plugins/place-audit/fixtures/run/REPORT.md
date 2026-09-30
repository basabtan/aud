# Place audit — dark dashboard fixture — 2026-08-25

## Run manifest

| Field | Value |
|---|---|
| Spec version | 1.0 |
| Plugin/script version | 0.1.1 |
| Prompt version | place-demand-v1 |
| Model id/version | Codex session model (GPT-5 family; exact build identifier unavailable) |
| Depth / scope | standard / single fixture page / persona `ops-lead` / stage `orient` |
| Task-model hash | `1851d26999f806dfe1357c5768236b62d6dcc8b4813672fa57f8259406039bab` |
| Viewport / DPR | 1440x900 / 1 |
| Engine / locale / direction | Chromium 151.0.7922.34 / en-US / per-block (`ltr`, Arabic block `rtl`) |
| Theme / fonts / fixture / auth | dark / Inter fallback to Segoe UI / fixed single-file fixture / none |
| States | `initial`, `hover` |
| Animations frozen / existed | yes / yes (declared CSS transitions) |

## Declared task model

Persona: expert operations lead. Stage `orient`: identify current operational
performance and the line needing attention. T1 succeeds when revenue, orders,
returns, OEE, and downtime can be compared without navigation; required
information also includes regional status. Deterministic task weight:
`0.40(.8)+0.25(.9)+0.20(.9)+0.15(.8)=0.845`.

Source is `acceptance fixture definition`; `evidenceStrength=0.8`. Journey
correctness, safety necessity, expert exceptions, useful repetition, and any
structural relocation remain human-owned.

## Blind demand protocol

The demand packet contained atom ID, text, and semantic fields only. Region,
DOM, geometry, style, access, prominence, FIT, screenshots, and designer opinion
were excluded. Demand was frozen before prominence output was read. Batch order:
`a12, a4, a16, a7, a1, a14, a9, a11, a3, a6, a15, a2, a5, a10, a13, a8`.
Uncertain and calibration items ran three times; median dispersion was zero.
Prompt `place-demand-v1`, task hash, model family, batch order, and raw runs are
recorded in `demand.json`.

## Calibration

| Atom | Expected | Scores | Result |
|---|---:|---|---|
| `a12` question-mark control (obvious noise) | 0 | 0 / 0 / 0 | PASS |
| `a4` current-shift downtime (obvious must) | 4 | 4 / 4 / 4 | PASS |

## Findings

| Atom | Necessity | Demand | Prominence | FIT | Access | Dup | Conf | Verdict |
|---|---|---:|---:|---:|---|---|---:|---|
| `a1` Revenue KPI | Must | 84.50 | 54.93 | 0.00 | visible | LIKELY_REDUNDANT 2× | .80 | KEEP primary |
| `a2` Orders KPI | Must | 84.50 | 54.50 | +6.66 | visible | — | .80 | KEEP |
| `a3` Returns KPI | Must | 84.50 | 57.16 | -6.67 | visible | — | .80 | KEEP |
| `a4` Downtime KPI | Must | 84.50 | 54.41 | +13.33 | visible | — | .80 | KEEP |
| `a5` Arabic regional status | Should | 63.38 | 60.06 | -46.67 | visible | — | .80 | REVIEW — confirm cross-state overemphasis |
| `a6` Repeated Revenue summary | Must | 84.50 | 32.35 | +66.66 | scroll | LIKELY_REDUNDANT 2× | .80 | DEDUPLICATE — human confirms context |
| `a7` Line 4 OEE | Must | 84.50 | 48.21 | +20.00 | visible | — | .80 | REVIEW — potentially buried |
| `a8` Line 4 downtime | Must | 84.50 | 46.38 | +33.33 | visible | — | .80 | REVIEW — persistence not established |
| `a9` Line 7 OEE | Must | 84.50 | 45.25 | +40.00 | visible | — | .80 | REVIEW — persistence not established |
| `a10` Line 7 downtime | Must | 84.50 | 43.40 | +46.66 | visible | — | .80 | REVIEW — persistence not established |
| `a11` All systems reporting | Nice | 21.13 | 32.79 | +3.34 | visible | — | .80 | KEEP |
| `a12` Explain-latency control | Noise | 0.00 | 29.61 | 0.00 | visible | — | .80 | KEEP control; no proposition demand |
| `a13` Line operations heading | Nice | 21.13 | 72.26 | -83.33 | visible | — | .68 | REVIEW — low segmentation confidence |
| `a14` Production lines heading | Nice | 21.13 | 62.17 | -76.66 | visible | — | .68 | REVIEW — low segmentation confidence |
| `a15` Monthly summary heading | Nice | 21.13 | 46.77 | -30.00 | scroll | — | .68 | REVIEW — low segmentation confidence |
| `a16` Latency note | Nice | 42.25 | 35.14 | +13.33 | hover | — | .62 | REVIEW — low segmentation confidence |

Demand and prominence columns show raw 0–100 scores; FIT uses percentile ranks.
`Conf` is the lowest relevant gate among segmentation, task evidence, and stable
scorer confidence.

## Placement candidates

- `a5`: demand rank 40, prominence rank 86.67. Before muting, confirm the Arabic
  status is not a safety/operational exception and that overemphasis persists in
  the interaction state. Candidate: keep within the regional-status panel with
  ordinary supporting-text prominence (estimated 35–50), never below WCAG.
- `a6`: demand rank 73.33, prominence rank 6.67, but it repeats `a1` exactly.
  Best candidate is deletion of the below-fold mirror while keeping the primary
  KPI; alternate is `BENEFICIAL_CONTEXT` only if the monthly-summary journey
  needs local revenue context. Human decides.
- `a7`–`a10`: demand rank 73.33 versus prominence ranks 53.33 down to 26.67.
  If the gap persists in a selected-line state, candidate one is a selected-line
  summary adjacent to the production table (estimated 65–80); candidate two is
  stronger hierarchy inside the existing row (estimated 55–70). No pixel moves.
- `a13`–`a16`: segmentation confidence is below `.70`; no structural or
  prominence change is permitted until atom boundaries/roles are confirmed.

## Annotated states

- `initial` — `overlay-initial.png`: visible, below-fold, duplicate, and
  low-confidence boxes.
- `hover` — `overlay-hover.png`: hover-only tooltip location and REVIEW gate.

## Blind-spot checklist

| # | Check | Status |
|---:|---|---|
| 1 | 20 random atoms manually verified (boundaries + label/value binding) | CHECKED — all 16 fixture atoms verified because the page has fewer than 20 |
| 2 | Charts represented as semantic objects, not per-mark atoms | DEFERRED — fixture has no chart |
| 3 | Canvas regions emitted as UNSCORABLE, not silently missing | DEFERRED — fixture has no canvas |
| 4 | Direction resolved per block; no global LTR assumption (Arabic pages) | CHECKED — `a5` resolved `rtl` |
| 5 | Task anchor used; geometric center only as declared fallback | CHECKED — `#kpi-anchor` used |
| 6 | Below-fold, hover-only, and disclosure content carry access cost; hover-only on touch = unavailable | CHECKED — `a6` scroll, `a16` hover and touch unavailable |
| 7 | Sticky/fixed occlusion tested (geometry is not visibility) | CHECKED — elementFromPoint sampling plus sticky geometry recorded |
| 8 | Demand pass saw no styling/position (blind order enforced) | CHECKED — excluded fields recorded in `demand.json` |
| 9 | Item order shuffled between demand passes; calibration atoms stable | CHECKED — shuffled order recorded; both calibrators stable |
| 10 | Rubric + prompt version frozen and recorded | CHECKED — exact rubric; `place-demand-v1` |
| 11 | No necessity derived from frequency alone (rare error warnings = Must) | CHECKED — necessity scored independently |
| 12 | Task model has provenance + evidenceStrength; low-evidence tasks damp severity | CHECKED — source and `.8` evidence recorded |
| 13 | Expert vs novice conflicts reported, never averaged | DEFERRED — one expert persona in MVP fixture |
| 14 | No MUTE recommendation below WCAG 4.5:1 / 3:1 | CHECKED — no contrast-reduction recommendation |
| 15 | Repetition judged by class (BENEFICIAL_CONTEXT is a keep) | CHECKED — revenue is LIKELY_REDUNDANT pending human context decision |
| 16 | Same-key-different-value conflicts surfaced as integrity flags | CHECKED — canonical conflict branch executed by unit logic; fixture has none |
| 17 | Weights untouched since last calibration set; page classes not mixed | CHECKED — v1 coefficients unchanged; one dashboard fixture only |
| 18 | Every low-confidence finding is REVIEW, not MOVE | CHECKED — `a13`–`a16` are REVIEW |

## Verification status

- Executed and passing: fixture shape, extraction/segmentation, deterministic
  prominence, canonical duplicates, PNG annotation, and report-contract checks.
- REVIEW / UNSCORABLE: `a5`, `a7`–`a10`, and all low-confidence `a13`–`a16`;
  no canvas was present.
- Not run / deferred: touch emulation, canvas/chart adapters, novice persona,
  breakpoint matrix, full state graph, saliency, OCR, auto-layout changes.

## Files

- `atoms.json`
- `canonical.json`
- `prominence.json`
- `demand.json`
- `fixture.png`
- `overlay-initial.png`
- `overlay-hover.png`
- `debugger.html`
- `../task-model.json`
- `REPORT.md`
