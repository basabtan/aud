# Place-audit report template

Use this topology and headings. Add rows; do not remove sections.

```markdown
# Place audit — <page/route> — <date>

## Run manifest

| Field | Value |
|---|---|
| Spec version | 1.0 |
| Plugin/script version | 0.1.1 |
| Prompt version | place-demand-v1 |
| Model id/version | <model> |
| Depth / scope | <arguments> |
| Task-model hash | <sha256> |
| Viewport / DPR | <width>x<height> / <dpr> |
| Engine / locale / direction | <values> |
| Theme / fonts / fixture / auth | <values> |
| States | <ids> |
| Animations frozen / existed | <values> |

## Declared task model

Persona, selected stage, tasks, weights, required information, source, and
evidenceStrength. State what remains human-owned.

## Blind demand protocol

Confirm the semantic-only packet was scored and frozen before prominence was
read. Record batch order, runs, dispersion, calibration atoms and result.

## Calibration

| Atom | Expected | Scores | Result |
|---|---:|---|---|
| <obvious noise> | 0 | <runs> | PASS/INVALID |
| <obvious must> | 4 | <runs> | PASS/INVALID |

## Findings

| Atom | Necessity | Demand | Prominence | FIT | Access | Dup | Conf | Verdict |
|---|---|---:|---:|---:|---|---|---:|---|
| <atom> | Must/Should/Nice/Noise | 0–100 | 0–100 | -100..+100 | visible/scroll/hover/... | class/— | 0..1 | MOVE/MUTE/DISCLOSE/DEDUPLICATE/KEEP/REVIEW |

## Placement candidates

For each non-KEEP finding, give current rank deviation, one or two existing
regions, estimated prominence range, task-distance reason, disruption, and
accessibility constraints. Never give pixel coordinates.

## Annotated states

- `<state>` — `overlay-<state>.png`: BURIED_CORE, OVEREMPHASIZED, DUPLICATE,
  low-confidence segmentation, hidden-access items.

## Blind-spot checklist

Include all 18 rows from `references/blind-spots.md`, each marked CHECKED or
DEFERRED with a reason.

## Verification status

- Executed and passing: extraction, segmentation, canonicalization,
  prominence, annotation, report checks.
- REVIEW / UNSCORABLE: <items and reasons>.
- Not run / deferred: <items and reasons>.

## Files

List `atoms.json`, canonical JSON, prominence JSON, screenshots, overlays,
task model, `input-status.json`, `evidence.jsonl`, schema-valid
`findings.jsonl`, and this report. Identify the shared run manifest and consumed
content-contract version. Duplicate candidates must remain proposals for content
or synthesis, never independent deletion decisions.
```

Every low-confidence finding (`Conf < .70` from segmentation or task evidence)
must have verdict `REVIEW`. `UNSCORABLE` is a successful honest output, not a
failed run.
