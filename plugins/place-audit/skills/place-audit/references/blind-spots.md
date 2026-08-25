# Blind-spot runbook

Complete this table before trusting a report. Mark each row `CHECKED` or
`DEFERRED — <reason>`; an empty status is not acceptable.

| # | Check | Status |
|---:|---|---|
| 1 | 20 random atoms manually verified (boundaries + label/value binding) | |
| 2 | Charts represented as semantic objects, not per-mark atoms | |
| 3 | Canvas regions emitted as UNSCORABLE, not silently missing | |
| 4 | Direction resolved per block; no global LTR assumption (Arabic pages) | |
| 5 | Task anchor used; geometric center only as declared fallback | |
| 6 | Below-fold, hover-only, and disclosure content carry access cost; hover-only on touch = unavailable | |
| 7 | Sticky/fixed occlusion tested (geometry is not visibility) | |
| 8 | Demand pass saw no styling/position (blind order enforced) | |
| 9 | Item order shuffled between demand passes; calibration atoms stable | |
| 10 | Rubric + prompt version frozen and recorded | |
| 11 | No necessity derived from frequency alone (rare error warnings = Must) | |
| 12 | Task model has provenance + evidenceStrength; low-evidence tasks damp severity | |
| 13 | Expert vs novice conflicts reported, never averaged | |
| 14 | No MUTE recommendation below WCAG 4.5:1 / 3:1 | |
| 15 | Repetition judged by class (BENEFICIAL_CONTEXT is a keep) | |
| 16 | Same-key-different-value conflicts surfaced as integrity flags | |
| 17 | Weights untouched since last calibration set; page classes not mixed | |
| 18 | Every low-confidence finding is REVIEW, not MOVE | |

Human-authoritative always: journey correctness, safety/legal necessity,
expert-workflow exceptions, whether a repeat is useful context, structural
relocations, and high-severity low-confidence findings.
