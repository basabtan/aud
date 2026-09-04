# Phase 7 selective capability review

This review was performed after Phase 6 passed, the accepted calibration
baseline was compatible, and the worktree was clean. Candidates were evaluated
for question ownership, current coverage gap, evidence availability,
calibratability, authority risk, overlap, and integration cost.

| Candidate | Coverage finding | Decision |
|---|---|---|
| Architecture/maintainability | No existing specialist owns dependency direction, module ownership, coupling, change amplification, or structural verification seams. Repository and test evidence can support deterministic findings. | **Add now.** Distinct, high-value, first in the brief's recommended order, and compatible with shared contracts. |
| Security/privacy | Functional audit can expose runtime symptoms, but a credible specialist needs explicit threat-model, trust-boundary, data-classification, and privacy-jurisdiction inputs. Adding a generic checklist would create false assurance. | **Defer.** Define those foundations and a security-specific calibration corpus first. |
| Evidence integrity | Evidence provenance, revision compatibility, hashing, reuse, stale-input rejection, verification proof, and calibration gates already enforce this responsibility. | **Reject as a separate specialist.** Strengthen shared evidence infrastructure when a measured gap appears. |
| Decision quality | Synthesis already preserves contradictions, qualifies root-cause inference, assigns priority, records human decisions, and orders remediation. | **Reject as duplicative.** Add synthesis calibration cases instead of another authority layer. |
| Dedicated performance/reliability | Functional audit already owns measurement, Web Vitals/long-task probes, stress fixtures, and performance verification adapters. No calibration evidence currently shows that separation improves decisions. | **Defer.** Split only if functional calibration demonstrates missed or low-quality performance findings. |

## Added capability

`architecture-maintainability-audit` asks whether the system can be changed
safely without violating ownership or dependency boundaries. It consumes shared
project/run context, emits shared evidence and findings, participates in AUD
selection, synthesis, remediation, verification, ledger persistence, latest-run
indexing, and calibration, and remains report-only.

Its authority excludes product content, information placement, user flow,
visual language, runtime correctness, security verdicts, priority assignment,
and implementation. Cross-specialist implications remain traceable handoffs for
synthesis rather than overwritten facts.

## Reconsideration triggers

Deferred modules become justified only when a measured corpus gap shows that an
existing owner misses or misclassifies their distinct decisions, and when the
required context can be represented without inventing evidence. Any future
module needs executable positive and prohibited-false-positive cases before it
enters broad routing.
