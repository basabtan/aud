# Segmentation and extraction

Bad segmentation invalidates every downstream score. Validate it before tuning
prominence or demand.

## Atom invariant

One atom has one principal proposition, one semantic key, one scope/context, and
zero or more qualifiers. Ask whether the proposition could reasonably have a
different task demand from adjacent information: if yes, split; if no, merge.

## Merge and split rules

- Merge label + value + qualifier (`Revenue / $4.2M / YTD`).
- Split a multi-metric card into one atom per metric.
- Attach an ARIA label that repeats visible text as metadata, not another atom.
- Give a stateful control one atom with both `filter-state` and `control` roles.
- For tables, create atoms only for data cells. Identity is row header + column
  header + value; captions are metadata.
- For charts, represent title, series, legend, annotation, and explicit labels as
  semantic objects. Do not emit one atom per SVG mark.
- Emit one `UNSCORABLE` atom per canvas with its box. Do not OCR.
- Resolve `direction` and `writing-mode` from each block. Never assume the page's
  direction applies to Arabic or mixed-direction descendants.

The extractor honors portable author hints when present:
`data-audit-atom`, `data-label`, `data-value`, `data-qualifier`,
`data-metric`, `data-entity`, `data-period`, `data-scope`,
`data-semantic-role`, `data-audit-anchor`, and `data-audit-hover-target`.
These are adapters, not requirements; ordinary headings, controls, leaf text,
tables, SVG text, pseudo-content, and canvases are still extracted.

## Confidence

`MergeConfidence` combines DOM association, alignment, proximity, typography,
semantic compatibility, and ARIA association. Explicit atom markup and table
header relationships normally score high. Heuristic container merges score
lower. Under `0.70`, every downstream recommendation is `REVIEW`.

## Geometry and visibility

Use `Range.getClientRects()` for text geometry, never the card's area. Preserve
document and viewport positions. Sample `elementFromPoint` to detect occlusion,
and record clipping, fixed/sticky position, scroll container, opacity, transform,
z-index, and animation presence. Full-page screenshot coordinates must align
with the atom boxes used by the annotator.

## Debugger workflow

1. Run `extract.mjs --screenshot page.png --out atoms.json`.
2. Run `annotate.mjs --image page.png --atoms atoms.json --out overlay.png
   --html debugger.html`.
3. Inspect at least 20 random atoms, or all atoms on smaller pages.
4. Check boundaries, label/value binding, table headers, chart grouping, canvas
   placeholders, RTL direction, and hidden access states.
5. Correct adapter markup or extraction rules; do not tune scoring around a bad
   atom.

The PNG is the report artifact. The companion HTML uses the same boxes and lets
reviewers click or keyboard-focus any atom to inspect its ID, proposition,
semantic fields, DOM selector/path, access state, and segmentation confidence.
