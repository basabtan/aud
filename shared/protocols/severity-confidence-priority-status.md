# Severity, confidence, priority, and lifecycle protocol

## Severity: consequence only

Common severity describes the consequence if the finding is true. It does not
encode confidence, effort, ease of detection, specialist score, or scheduling.

| Level | Meaning |
|---:|---|
| 0 | Intentional behavior or no demonstrated problem |
| 1 | Cosmetic or negligible task effect |
| 2 | Noticeable friction, confusion, or localized quality loss |
| 3 | Major task failure, repeated loss, serious exclusion, or material risk |
| 4 | Blocking core task, data loss/exposure, critical security, or severe safety/compliance risk |

Every finding records `severity.level` and a consequence-based rationale.

## Confidence: evidence strength only

Confidence is a numeric `0..1` score with a written evidence basis. It describes
how strongly the available evidence supports the finding. It must never be
multiplied into, subtracted from, or otherwise used to reduce severity.

- High severity and high confidence: prioritize remediation during synthesis.
- High severity and low confidence: prioritize investigation during synthesis.
- Low severity and high confidence: schedule normally.
- Low severity and low confidence: defer or close only with recorded rationale.

## Native metrics

Specialist scoring belongs unchanged under `native_metrics`. The object is
specialist-owned and intentionally open-ended. Validators preserve it but never
translate it into common severity, confidence, or priority.

## Priority: synthesis only

Specialist findings do not contain priority. Synthesis may assign `P0` through
`P4` when it creates remediation items, with a written rationale considering
severity, task criticality, reach, frequency, urgency, confidence/investigation
need, root-cause leverage, dependencies, effort, and change risk. No opaque
multiplication formula is authoritative.

## Finding lifecycle

Allowed transitions are:

```text
open -> needs_evidence | accepted | waived
needs_evidence -> open | accepted | waived
accepted -> planned | waived
planned -> implemented | waived
implemented -> verified | partial | failed | waived
partial -> implemented | verified | failed | reopened | waived
failed -> reopened
verified -> reopened
waived -> reopened
reopened -> needs_evidence | accepted | planned | implemented | waived
```

Idempotent same-status updates are allowed. Every status change appended by the
ledger merge records status, timestamp, reason, and run ID. A failed verification
produces a `failed` verification result and updates the finding to `reopened`.
Only `verified` and `waived` close a finding; absence from a later run does not.
