# Phase 6 calibration and reliability

Phase 6 adds an isolated, versioned quality harness for the AUD framework. It
does not audit or modify a product. The checked-in corpus is synthetic,
redistributable, free of sensitive evidence, and records an empty application
mutation set.

## Contracts and artifacts

The registry now validates `expected-outcome`, `calibration-case`,
`calibration-suite`, `calibration-result`, `calibration-result-set`,
`reliability-summary`, `quality-gate-result`, and `calibration-baseline` v1
contracts. A run writes these derived artifacts atomically:

- `calibration-results.json` — versioned result set containing one immutable
  result for each selected case;
- `reliability-summary.json` — metrics, specialist breakdowns, explicit
  not-applicable/insufficient-sample states, and limitations;
- `quality-gate-result.json` — hard failures, warnings, informational values,
  baseline comparison, and policy drift;
- `calibration-report.md` and `drift-report.md` — human-readable views derived
  from the structured artifacts.

The canonical suite lives at `calibration/corpus/suite.json`; its reviewed
baseline is `calibration/baselines/accepted.json`. Corpus cases use exact
expectations for categorical or structured decisions and bounded expectations
for values such as severity, confidence, and inferred root-cause confidence.

## Metrics and consistency

The evaluator reports precision, recall, false-positive and false-negative
rates, consequence-severity agreement, confidence calibration with reliability
bins, duplicate precision/recall, contradiction accuracy, typed-relationship
F1, root-cause accuracy, priority-band agreement, remediation order validity,
verification and regression accuracy, lifecycle legality, deterministic rerun
agreement, schema validity, and provenance completeness.

Severity and confidence are checked independently. Cross-specialist cases
exercise shared consequence ranges. Deterministic comparisons ignore only
declared runtime timestamp fields; all other differing JSON-pointer paths are
reported, including unstable IDs. Counts for critical misses, mutations,
evidence-free verification, and fabricated results are never hidden inside an
aggregate score.

## Gates and baseline policy

Hard gates fail on invalid schemas, nondeterminism, illegal lifecycle
transitions, incomplete provenance, critical false negatives, application
mutation, unstable IDs, evidence-free verification, or fabricated execution.
Warning gates cover false positives, severity disagreement, duplicate quality,
contradiction accuracy, and verification accuracy. Remaining reliability
metrics are informational until their sample is large enough and policy is
explicitly revised.

Accepting or replacing a baseline requires a non-empty review rationale.
Changes to expected outcomes or gate thresholds additionally require the
explicit `--approve-policy-changes` flag. This prevents a failing run from
silently weakening its own test or threshold.

## Commands

Run the standard fast gate used by normal repository validation:

```text
npm run calibrate:fast
```

Run the complete mandatory suite:

```text
npm run calibrate:full
```

Run selected cases or write reports to a chosen directory:

```text
node shared/calibration/cli.mjs --suite calibration/corpus/suite.json \
  --cases CALCASE-01-MAJOR,CALCASE-07-DUPLICATE --out <directory>
```

Compare against a baseline by passing `--baseline <file>`. Accept a reviewed
baseline with `--accept-baseline --rationale "..."`; add
`--approve-policy-changes` only after reviewing intentional expectation or gate
changes. `--check` uses a temporary output directory and leaves the repository
unchanged.

The fast tier is the local-development and pull-request default and normally
finishes in under a second because it uses deterministic fixture observations.
The full tier is also lightweight today, but remains a separate command so
future release-only cases can grow without slowing every edit. Use the full
tier for release qualification and before accepting any baseline.

## Limits

The corpus is deterministic ground truth for framework behavior, not a claim
about population-wide audit accuracy. Confidence calibration is reported as
insufficient when fewer than five scored findings are selected. Phase 6 does
not self-tune prompts, change model routing, mutate applications, implement
remediation, or add Phase 7 release governance.

## Phase 7 entry criteria

Phase 7 may be proposed only after both tiers pass on supported Ubuntu and
Windows Node 22 CI, the full result is compatible with the accepted baseline,
hard failures are empty, warning regressions are reviewed, corpus changes have
explicit rationale, and repeated runs show stable IDs and output ordering.
Entering Phase 7 remains a separate decision and implementation phase.
