# Shared schema protocol

AUD structured artifacts use JSON Schema draft 2020-12. Each document carries a
required `schema_version` discriminator. Version names are immutable; a breaking
change creates a new major version and a new registry entry.

Supported versions through Phase 7:

| Artifact | Version |
|---|---|
| Project context | `aud-project-context-v1` |
| Task model | `aud-task-model-v1` |
| Run manifest | `aud-run-manifest-v1` |
| Audit plan | `aud-audit-plan-v1` |
| Capture manifest | `aud-capture-manifest-v1` |
| Evidence | `aud-evidence-v1` |
| Finding | `aud-finding-v1` |
| Content contract | `aud-content-contract-v1` |
| Flow contract | `aud-flow-contract-v1` |
| Issue cluster | `aud-issue-cluster-v1` |
| Contradiction | `aud-contradiction-v1` |
| Synthesis result | `aud-synthesis-result-v1` |
| Remediation item | `aud-remediation-item-v1` |
| Remediation plan | `aud-remediation-plan-v2` |
| Verification case | `aud-verification-case-v1` |
| Verification plan | `aud-verification-plan-v1` |
| Verification result | `aud-verification-result-v2` |
| Regression result | `aud-regression-result-v1` |
| Verification summary | `aud-verification-summary-v1` |
| Calibration case | `aud-calibration-case-v1` |
| Expected outcome | `aud-expected-outcome-v1` |
| Calibration suite | `aud-calibration-suite-v1` |
| Calibration result | `aud-calibration-result-v1` |
| Calibration result set | `aud-calibration-result-set-v1` |
| Reliability summary | `aud-reliability-summary-v1` |
| Quality-gate result | `aud-quality-gate-result-v1` |
| Calibration baseline | `aud-calibration-baseline-v1` |

Unknown versions fail with `INCOMPATIBLE_SCHEMA_VERSION`; the validator never
guesses or coerces a major version. JSON Lines files validate one document per
non-empty line and report the failing line.

`aud-remediation-plan-v1` and `aud-verification-result-v1` remain accepted as
legacy inputs; Phase 4 synthesis generates only `aud-remediation-plan-v2`, and
Phase 5 generates only `aud-verification-result-v2`.

The Phase 7 architecture/maintainability specialist uses the existing finding,
evidence, synthesis, remediation, verification, ledger, and calibration schemas;
it does not introduce a parallel artifact protocol. Audit and verification plans
may contain six specialist decisions. Their schemas retain a five-decision minimum
only so immutable Phase 3–6 runs remain readable.

Run validation with:

```text
npm run validate:schema -- finding path/to/findings.jsonl
npm run validate:schema -- project-context path/to/project-context.json
```

The registry also performs constraints JSON Schema cannot express compactly:
duplicate stable IDs, local reference integrity, self-references, time ordering,
and current-status/history agreement.
