# Scoring reference

All coefficients are frozen engineering priors, not psychophysics. Rank-based
reconciliation and confidence gates keep the system honest before calibration.

## Prominence

Keep exposure and access separate:

`P_effective = P_visual * exp(-0.45 * AccessCost)`

For v0.1, `P_visual = P_DOM`:

`P_DOM = 100 * (0.25Q + 0.25T + 0.20C + 0.10A + 0.10E + 0.10H)`

Components are page-local robust percentile scores in `[0,1]`.

### Q — position relative to the task anchor

`F = exp(-(d(atom, anchor) / (0.35D))^2)`, where `D` is viewport diagonal.

`Q = 0.60F + 0.25R + 0.15L`

Anchor priority: primary task object → selected row/card → active chart → active
filter → decision/action region → panel center → viewport center fallback.
Reading order `R` follows the atom block's direction, writing mode, and bidi;
smaller x is not universally earlier. `L` is local panel priority. An F-pattern
is only a weak prior for long LTR text; Z-pattern weight is zero.

### T — typography

`T = 0.70*pct(log2(fontSize/medianPageFontSize)) + 0.30*T_weight`

### C — contrast

`C = 0.5*(log(CR)/log(21)) + 0.5*C_localrank`

WCAG remains a floor: never propose below `4.5:1` for body text or `3:1` for
large text/UI.

### A — painted text area

`A = pct(log(1 + paintedTextPixels))`, using text rectangles, not cards.

### E — emphasis

`E = 0.5*DeltaColor_sibling + 0.5*StyleDistinctiveness`

Distinctiveness includes badge, border, fill, icon, uppercase, glow, and
selected state. Compare color with siblings/panel mean so dark themes remain
valid. Motion yields `UNSCORABLE_STATIC`, not a score boost.

### H — hierarchy

Combine heading level, panel depth, list position, and fixed/sticky status.

### Access costs

| Access path | Cost |
|---|---:|
| Visible in initial viewport | 0.00 |
| One viewport of scroll | 0.35 |
| Hover/focus reveal | 0.50 |
| One disclosure click | 0.70 |
| Tab/panel switch | 0.90 |
| Modal/drawer/navigation | 1.20 |
| Each additional interaction | +0.60 |

Hover-only content on touch is unavailable, not costed. Saliency models are out
of v0.1. A future UI model may use `P_visual = 0.65*S_UI + 0.35*P_DOM` with
sensitivity at `0.50/0.65/0.80`; natural-image models are baselines only.

The rejected alternate prior from the decision log is retained only for future
sensitivity testing: position/visibility/access weights `.40/.45/.15`. It must
not replace the six-feature v0.1 formula.

## Demand

`W_t = 0.40*Criticality + 0.25*Frequency + 0.20*UserCoverage +
0.15*TimeSensitivity`

Map ordinal relevance `0,1,2,3,4` to `0,.25,.5,.75,1`, then aggregate:

`D = 100 * (1 - product_t(1 - W_t*r_t))`

Necessity is independently `Must / Should / Nice / Noise`.

## FIT and verdict

`FIT = percentile_rank(D) - percentile_rank(P_effective)`, range `[-100,+100]`.

| FIT | Reading |
|---:|---|
| `-14..+14` | Matched |
| `+15..+24` | Potentially buried — REVIEW |
| `+25..+39` | BURIED_CORE |
| `>= +40` | Severe under-prominence |
| `-15..-24` | Potentially over-prominent — REVIEW |
| `-25..-39` | OVEREMPHASIZED_LOW_VALUE |
| `<= -40` | Severe over-prominence |

`Severity = abs(FIT) * Conf_seg * Conf_task * Conf_LLM * M_necessity`

Necessity multipliers: Must `1.25`, Should `1.00`, Nice `0.75`, Noise `0.75`.

Relocation requires all of: `abs(FIT) >= 25`, segmentation confidence `>=.70`,
task confidence `>=.70`, stable LLM passes, and persistence across audited
states. Otherwise verdict is `REVIEW`. Vocabulary is `MOVE`, `MUTE`,
`DISCLOSE`, `DEDUPLICATE`, `KEEP`, `REVIEW`.

## Duplicate normalization

Normalize currency, compact numbers, percentages, durations, and dates. Compare
metric + context + normalized value. Same value/different metric and same
metric/different period are not duplicates. Same metric/context/different value
is `CONFLICTING_DUPLICATE`, the highest-severity integrity flag.

## Placement candidates

Never output pixels. Rank existing slots with:

`J(slot) = abs(P_predicted(slot)-D) + lambda*TaskDistance +
mu*LayoutDisruption + nu*RedundancyPenalty + AccessibilityPenalty`

Report one or two candidate regions, estimated prominence range, task-distance
reason, and layout/accessibility tradeoff. `DISCLOSE` is permitted only for
low-stage demand, tolerable retrieval, non-status/non-error information, no
frequent expert need, and intact accessibility.

## Validation

Validate segmentation, prominence, demand, and end-to-end precision separately.
Baselines are random, screen-center, font-size-only, and no-change. Do not tune
and test on the same pages. Record reviewer accept/reject/modify decisions and
false-positive cause.
