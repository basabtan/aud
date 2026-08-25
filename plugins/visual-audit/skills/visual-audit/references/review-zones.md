# Review zones

Read only the zones present on the surface in front of you. Judging a page as one
object is the mistake this file exists to prevent — a screen routinely has
excellent navigation, acceptable typography, weak cards and Tier 0 data display,
and only the weak zones should be touched.

Each zone lists what to look for and the upgrade that usually applies. Every one
of them is subject to the KEEP gate: would the interface be *materially* better
after the change? If not, keep it and say why.

## Contents

- [Page composition](#page-composition)
- [Typography](#typography)
- [Spacing and rhythm](#spacing-and-rhythm)
- [Cards and panels](#cards-and-panels)
- [Buttons and actions](#buttons-and-actions)
- [Forms and inputs](#forms-and-inputs)
- [Navigation](#navigation)
- [Tables](#tables)
- [Data and metrics](#data-and-metrics)
- [Information encoding](#information-encoding)
- [Charts](#charts)
- [Icons, chips and badges](#icons-chips-and-badges)
- [Interaction states](#interaction-states)
- [Empty, loading and error](#empty-loading-and-error)
- [Motion](#motion)
- [Responsive](#responsive)

---

## Page composition

Look at the page before any individual control.

Is there a clear entry point for the eye? Is the most important region visually
dominant, and are secondary regions actually quieter? Are major groups aligned to
something? Does whitespace create structure, or is it leftover area? Are there too
many equal-sized rectangles? Does the page read in the intended order?

The default failure is the uniform card grid — header, then three-by-three
identical boxes — which encodes "everything here matters equally", almost never
true. Stronger compositions when the content supports them: a dominant workspace
with a compact supporting rail; a summary strip above a detail area; grouped
sections with no containers at all; anchored controls with fluid content.

Only restructure when it serves the task. A uniform grid of genuinely equivalent
items is correct.

## Typography

Type creates more perceived quality than any decorative CSS, and is the most
common thing left at one decision deep.

**Title** — clearly the page title, and distinguishable from section headings? Is
metadata competing with it? Does it wrap badly at narrow width?

**Headings** — are levels distinguishable by weight and size rather than by
arbitrary colour? Is spacing above and below consistent? Are uppercase micro-labels
overused as a substitute for hierarchy?

**Labels vs values** — labels should be subordinate to the values they describe.
A very common Tier 1 signature is labels and values rendered identically, so
nothing can be scanned.

**Body** — line length reasonable, line-height readable, secondary notes actually
subdued.

**Numbers** — tabular numerals or monospace where alignment or technical meaning
benefits, not everywhere. Do not turn every metric into display type.

## Spacing and rhythm

Spacing should encode grouping:

```
same object      → tight
same group       → moderate
different group  → larger
different region → clearly separated
```

Look for: the same gap used at every level of hierarchy (the strongest signal
nobody chose), inconsistent gaps between siblings, cramped controls beside
over-padded cards, headers with weak separation from content, accidental empty
regions.

A polished interface usually has *fewer* spacing values, used more deliberately.

## Cards and panels

Cards are the most common source of basic-looking UI.

Does this information need a container at all? Are there too many? Do all cards
have identical visual weight regardless of importance? Does each card have
internal hierarchy, or is it a heading followed by undifferentiated text? Is
metadata subordinate? Is there a selected state? Does hover imply clickability on
things that are not clickable? Are borders doing the structural work because
nothing else is?

Usual upgrades: remove unnecessary containers, combine related cards, strengthen
internal typography, use spacing instead of borders, differentiate primary from
secondary panels.

Avoid: cards nested in cards, shadows on every panel, competing border colours,
making every panel visually special.

## Buttons and actions

Check primary, secondary, tertiary, destructive, icon-only — and for each:
default, hover, focus, active, disabled, loading.

Is the primary action obvious? Are too many buttons styled as primary (which
means none is)? Are destructive actions differentiated proportionately rather
than alarmingly? Are actions grouped by function? Do icon-only actions have
accessible names?

Do not make controls flashy to make them look custom.

## Forms and inputs

Forms expose the underlying component library more clearly than anything else.

Label placement and hierarchy; placeholder visually distinct from a filled value
(if you cannot tell them apart, that is a bug, not a style opinion); required
marking; validation adjacent to the field it concerns; error, disabled and focus
states; select menus, date controls, toggles, checkboxes and radios still at
browser default; grouped fields separated by rhythm rather than rules.

Never use placeholder text as the only label.

## Navigation

Can the user tell where they are without reading carefully? Are levels visually
distinct? Is the active state obvious without shouting? Are icons helping or
occupying space? Does navigation dominate content it should be supporting? Does
the collapsed/mobile form preserve orientation?

Do not restructure navigation architecture during a visual pass unless the user
asked for structural work.

## Tables

A plain table is not automatically basic — tables are frequently the correct
interface for dense comparison, and replacing one with cards to look modern makes
the product worse.

Improve through: typographic hierarchy between header, key column and the rest;
numeric alignment and formatting; row density suited to the data; sticky headers
where the table is long; a real selected-row treatment; visible sort and filter
state; sensible truncation with the full value available; subdued secondary
metadata; a designed empty state; and a deliberate narrow-width strategy.

Consider only when they serve the task: grouped rows, expandable detail, compact
status markers, inline trend indicators, a summary strip, a pinned key column.

## Data and metrics

Raw data is the fastest way to make an app feel unfinished. Check decimals, units,
thousands separators, date and time formatting, percentages, coordinate precision,
null rendering, statuses, and raw identifiers reaching the UI.

```
31089.684187   →  31,089.68
0.87321        →  87.3%
2026-08-23T22:39:15.368Z  →  23 Aug 2026, 22:39
isl-tafsir     →  Tafsir
```

Never change data semantics for aesthetics, and never round away precision that
the user needs.

## Information encoding

Ask whether something important is only *printed* where it could be *shown*:
status indicator, severity bar, progress, trend sparkline, comparison bar, rank,
heat intensity, confidence marker, timeline position, delta from baseline.

Use encoding when it reduces reading effort. Do not add miniature charts to
information that is already immediately understandable.

## Charts

Purpose, then type, then everything else. Check the title, axis formatting, direct
labelling versus a legend, annotation, tooltip, selected state, colour carrying
meaning rather than decoration, contrast, and the empty state.

Remove chartjunk. No 3D. No categorical colours that are hard to tell apart. No
animation that makes values harder to compare. Directed relationships need
arrowheads — a directed graph drawn as plain lines is wrong, not minimal.

## Icons, chips and badges

Icons: consistent family, stroke weight, size and alignment; carrying meaning
rather than filling space; not duplicating an adjacent label. Never mix icon
families.

Badges: use when they encode status, category, ownership, severity or environment.
Do not turn ordinary text into pills for decoration, and watch for several badges
competing in one row.

## Interaction states

A component is not finished if only the resting state is designed:

```
default  hover  focus  active  selected  disabled
loading  error  empty  expanded  collapsed  dragging
```

Hover must not be the only signal — it does not exist on touch and is invisible to
keyboard users. Focus must remain visible. Selected and hover must not look
identical. Disabled must stay readable. Loading must not shift layout.

## Empty, loading and error

**Empty** answers three questions: what is this area, why is it empty, what can I
do next. "No data." answers none of them. Match the treatment to the importance of
the state — not every empty needs an illustration.

**Loading** should preserve structure. Skeletons where layout is known, a local
spinner where the operation is small. Avoid layout shift on resolve.

**Error** should say what failed, where, whether data may be stale, and offer a
retry. Show technical detail only where it helps. Do not escalate a field
validation into a full-width alarm.

## Motion

Motion should explain a state change, expansion, navigation, or object continuity.
A drawer entering from the edge it belongs to explains something; a card bouncing
does not.

Keep transitions short. Avoid continuous decorative animation, large scale jumps,
parallax, and every element animating independently. Honour
`prefers-reduced-motion`.

## Responsive

Do not evaluate by shrinking the window and confirming nothing overflows. Ask
whether the interface still makes sense.

At narrow widths hierarchy may need to change, navigation to collapse, secondary
information to move or hide behind disclosure, columns to stack, tables to adopt a
deliberate strategy. Check `scrollWidth - clientWidth === 0` where horizontal
scroll is not intentional, and give wide tables their own scroll container so the
page does not scroll sideways.

Do not force desktop density onto mobile, and do not stack every card vertically
and call it responsive.
