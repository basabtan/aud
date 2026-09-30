# AUD framework compatibility

## Supported runtime and platforms

Framework 0.2.0 supports Node.js 22, 23, and 24. The release CI target is Node
22 on both `ubuntu-latest` and `windows-latest`. Runtime paths are normalized
and tested with POSIX and Windows forms.

The root package is private and distributes the framework as a GitHub-hosted
plugin marketplace; 0.2.0 is not an npm publication.

## Commands

| Command | Status in 0.2.0 |
|---|---|
| `aud` | Primary broad and multi-specialist entry point |
| `content-audit`, `place-audit`, `flow-audit`, `visual-audit` | Supported direct specialists |
| `functional-audit` | Canonical functional and accepted-contract verifier |
| `architecture-maintainability-audit` | Supported selective repository specialist |
| `audit` | Deprecated compatibility alias for `functional-audit` |

## Structured artifacts

All Phase 1 v1 project, task, run, evidence, finding, content, flow, synthesis,
and calibration schemas remain supported. The framework emits
`aud-remediation-plan-v2` and `aud-verification-result-v2`; their documented v1
forms remain accepted only as legacy inputs.

Audit and verification plan schemas accept five entries for immutable Phase
3–6 artifacts and up to six entries for 0.2.0. Integrations must key by the
`audit` or `specialist` field, tolerate unknown skipped/deferred specialists,
and never rely on array position.

Finding severity continues to mean consequence only. Confidence stays separate,
priority remains synthesis-owned, native specialist scoring stays under
`native_metrics`, and unresolved ledger records carry forward across runs.

## Upgrade behavior

- Existing direct specialist commands keep working.
- Existing application-owned `audits/` directories and ledgers need no data
  migration.
- Broad requests should move to `aud` if they still invoke a specialist
  heuristically.
- New functional integrations should replace `audit` with `functional-audit`.
- Automation validating plan decision counts must allow six entries.
- Architecture review is not selected by a generic product/UX request; request
  it explicitly, use `all`, or supply a qualifying architecture risk profile.

## Unsupported or deferred

The framework does not claim a security/privacy specialist, automated
language-specific architecture extraction, deployment support, or permission to
modify audited applications. These are not compatibility regressions; they are
intentional authority and evidence boundaries.
