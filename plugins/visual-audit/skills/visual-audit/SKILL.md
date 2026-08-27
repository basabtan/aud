---
name: visual-audit
description: Audit a running interface for visual quality — render every route in a real browser, inventory the computed styles against a default-tier rubric, read the screenshots at three distances, then rank findings by visual impact and offer to apply the top 20%, 50%, or all of them. Use whenever the user asks whether something looks basic, plain, generic, bland, unpolished, cheap, or "like a template"; asks for a facelift, polish pass, visual upgrade, theme improvement, design review, or UI refinement; asks to improve the design, visuals, graphics, styling, or look of a page; says a screen "needs work" or should feel "more premium", "more professional", or "less default"; or wants to know if something is presentable before showing it to anyone. Also use it proactively after building any page, dashboard, or interactive component — a screen that passes every test and every correctness audit can still be entirely browser-default, and no typecheck, test suite, or functional audit can see that.
---

# Visual audit

A functional audit asks whether the thing works. This one asks whether anyone
decided how it should look. Different failures, different instruments — and a
screen can pass every test in the suite while reading like a wireframe someone
forgot to finish.

Run this *before* the functional audit, then run the functional one after
applying changes: restyling breaks click targets, focus order, overflow and
pointer behaviour, and a beautiful page that broke during the facelift is not an
improvement.

## Run artifact location

Keep this reusable skill in the audit-tools repository, but write every
application-specific run into the target application repository at
`<application-root>/audits/YYYY-MM-DD-visual/`. Put the report, screenshots,
inventories, comparisons, and other evidence inside that run directory. Update
`<application-root>/audits/latest.md` so its Visual row links to the newest run,
while preserving older runs. If the same type runs twice on one date, append
`-02`, `-03`, and so on rather than overwriting evidence.

In a monorepo, `application-root` is the nearest directory that owns the app's
runtime/build configuration. Never store product-specific audit results in the
repository that distributes this skill.

## The governing idea

**"Basic" is not a matter of taste — it is a decision nobody made.**

Every default-tier element is one where the browser, the framework, or the first
draft of the CSS chose on your behalf and nobody went back. A native `<select>`
is not a style choice, it is the absence of one. Thirteen distinct greys in a
project with four colour tokens is not a palette, it is thirteen separate moments
of picking whatever looked close.

That framing is what makes this checkable. "Make it prettier" is neither
actionable nor arguable. "This control is browser-default, here is the decision
that got skipped, here is what deciding looks like in your existing design
language" is both.

The corollary matters just as much: **an element that was decided and came out
plain is finished.** A restrained divider doing its job, a checkbox that is
legible and consistent, a table that is dense because the data is dense — these
are correct. Changing them so the audit has output is the single most common way
this work goes wrong. `KEEP` is a successful finding, and a good audit contains
many.

### Each defect class needs its own instrument

| Instrument | The defects only it finds |
|---|---|
| Computed styles, inventoried | Unchosen values — the 13 greys, one type size doing every job, four border treatments |
| The page at 25% zoom | Fragmentation, too many equal boxes, no focal point, broken rhythm |
| The page squinted/blurred | Whether any hierarchy survives when you cannot read the words |
| The page at 200% | Where craftsmanship is won: baselines, 1px misalignment, uneven control heights, icon centring |
| The same element across every route | Inconsistency — three button styles each convinced it is *the* button style |
| State-by-state capture | The states nobody designed. Empty and error, nearly always |
| Real content, deliberately hostile | Clipping, wrapping, alignment collapse under long strings, nulls, RTL |
| Arithmetic | Spacing off any scale, type with no ratio, contrast under threshold |
| The project's own design rules | Drift — and your worst instinct, "improving" past a deliberate constraint |

Skip an instrument and you ship that class. The inventory earns its place because
it finds what eyes cannot: nobody *perceives* "13 greys", they perceive "cheap".

## What "basic" means, concretely

Rate each region. The tier describes how far the decisions got — it is not a
judgement of whoever wrote it.

**Tier 0 — browser default.** Native `select`, `input[type=file]`, checkbox,
radio, `progress`; UA focus ring; a `table` styled only by borders; the default
scrollbar inside a styled panel. Test: deleting the stylesheet would not change
it.

**Tier 1 — first draft.** Styled, but one decision deep. A single type size doing
every job. Borders as the only thing separating anything. Flat fills, no
elevation model. Hover exists; focus, disabled, loading, empty and error do not.
Spacing is whatever looked right at the time — inline `marginTop: 8`.

**Tier 2 — considered.** A type scale used with intent. Hierarchy readable at a
squint. States designed rather than inherited. Density chosen to suit the data.

**Tier 3 — crafted.** Motion that explains a change rather than decorating it.
Depth applied consistently. Iconography that carries meaning rather than filling
space. Data that reads at a glance before it reads in detail.

Then attach a decision, which is what actually gets acted on:

- **KEEP** — decided, and right. Say why, briefly, so it is visibly a judgement
  rather than an oversight.
- **REFINE** — right shape, imprecise execution. Alignment, spacing, weight.
- **UPGRADE** — the decision was never made. Most Tier 0 and Tier 1 findings.
- **REDESIGN** — the composition itself is wrong. Rare, and never chosen merely
  because a different design is possible.

Real screens are a mix, and the mix *is* the finding: a Tier 3 header above a
Tier 0 form is extremely common and worth naming precisely.

## Ranking by visual impact, and the three doses

Findings are useless unsorted — thirty of them reads as "rewrite everything" and
gets nothing done. Score each on what fixing it changes for a person looking at
the screen:

- **Reach** — one component, one page, or every page? A token or shared-component
  fix compounds; a one-off does not.
- **Prominence** — primary reading path, or a panel nobody opens?
- **Tier gap** — Tier 0 → 2 shifts perception far more than Tier 2 → 3.
- **Effort** — cheap fixes rank *up*. A one-line token change outranking a new
  component is the point, not a compromise.

When two score alike, prefer the one that fixes a system over the one that fixes
an instance.

Then present the ranked list and offer three doses — all three, every time, even
when you have a recommendation:

- **Top 20% — first impression.** The few that change how the product reads at a
  glance. If the user does nothing else, this is the set.
- **Top 50% — coherent.** Adds the consistency work: one button treatment, one
  table treatment, states that exist everywhere they should.
- **100% — finished.** The long tail of polish.

Say roughly how large each diff would be so the choice is informed. Let the user
pick before applying anything.

## The loop

### 1. Learn the design language before judging it

Read the project's rules first: `.cursorrules`, `CLAUDE.md`, `AGENTS.md`, a
tokens file, `styles/`, `components/ui/`, `DESIGN.md`, the Tailwind config.
Write down the observed contract — geometry, type roles, surface levels, colour
roles, motion, density — before proposing anything.

This step is the whole difference between a useful audit and generated slop. A
skill that turns up recommending gradients, rounded corners and emoji to a
project whose rules say `border-radius: 0`, no emoji, four colours has produced
noise and burned the user's trust in everything else it says. Constraints are the
design. Work inside them.

Where the project already has a strong screen, treat it as the reference and
raise the weak ones toward it rather than inventing a third direction.

If there is no declared system, that is the highest-reach finding on the list —
there is no scale to be off.

### 2. Make it drivable and capture every surface

Get the app running and reachable without auth. If the repo has a functional-audit
skill documenting a fixture harness or a presentational/container seam, reuse it
rather than building a second one.

Capture every route, both themes if themes exist, and a narrow viewport.
Screenshots must show realistic populated content — an empty table hides every
density and hierarchy problem you are looking for, which is why an audit run on a
fresh install finds nothing.

`references/capture.md` has a working multi-route, multi-state driver.

### 3. Capture the states nobody designed

Per control: default, hover, focus-visible, active, disabled, loading. Per
container: empty, error, and a densely populated case. Force them — set the
class, pass the prop, throw the error, block the request — rather than hoping to
catch them.

Empty and error are where audits find the most, because they only appear when
something has gone wrong and so nobody ever sat and looked at them.

### 4. Inventory the computed styles

```bash
node scripts/inventory.mjs http://localhost:5173/ http://localhost:5173/settings
```

Reports distinct type sizes, weights and families; text, background and border
colours; radii, shadows, spacing values, transitions; flags controls still
rendering at browser default; lists text failing WCAG contrast.

Read the counts as evidence. Four type sizes across an app is a scale; eleven is
an accident. One radius is a decision; five is drift. The script makes no
aesthetic claim — it shows which decisions were never made *once*.

### 5. Look at the screenshots yourself, at three distances

The inventory cannot see composition.

**Zoomed out (~25%).** Is there a focal point? Too many equally-weighted
rectangles? Does vertical rhythm hold? Is colour distributed or scattered?

**Squinted (blur until text is illegible).** Can you still identify the primary
region, the main action, the selected state? If everything has the same weight,
hierarchy is the finding, and no amount of colour work will fix it.

**Close (200%).** Baseline alignment, icon centring, 1px border-tone mismatches,
uneven control heights, one-off radii, clipping, weak focus rings.

Then read normally and ask: where does the eye land first, and is that the thing
that matters? Can I tell primary from secondary action without reading labels? Is
anything the product is *for* rendered as undifferentiated plain text? Is a raw
identifier, ISO timestamp, or full-precision float reaching a human? Would a
stranger know what to do here?

### 6. Stress it with real content

A design that only works with ideal content is not finished. Push in: a very long
title, a very long single-word value, zero, null, a huge number, many tags, no
tags, a dense list, a one-item list, and RTL/Arabic text if the product supports
it. Watch for clipping, awkward wrapping, alignment collapse, unequal card
heights, controls pushed off-screen.

### 7. Measure what you would otherwise argue about

Contrast ratios rather than impressions. The ratio between type levels. Whether
spacing sits on the declared scale. Overflow: `scrollWidth - clientWidth` must be
0 where horizontal scroll is not intentional. This turns "feels cramped" into
"padding is 6/8/12/14/16px against a 4px scale, three values off-scale" — fixable,
and not a matter of opinion.

### 8. Apply the chosen dose, in this order

Structure before surface, always:

```
tokens → composition → typography → spacing → surfaces → controls
  → data formatting → interaction states → responsive → motion → decoration
```

The order is load-bearing. If typography and composition are wrong, decorative
work is premature — **a weak page with better colours is still a weak page.**
When the request is explicitly a theme change, separate structural design from
theme expression and say which contract rules you are deliberately replacing.

Prefer a token or shared-component change over a local override every time; local
overrides are how the 13 greys happened. After applying, sweep for values you
introduced — new colours, radii, spacing, shadows — and ask whether the change
improved the system or only improved one screenshot.

### 9. Report honestly

Show before and after images, not descriptions of them. Name the routes and
states you captured and the ones you could not reach. Separate:

```
implemented and visually verified
implemented but not browser-verified
recommended, not implemented
intentionally kept
```

Distinguish "measured" from "looks better to me" — the first is evidence, the
second is an opinion you are entitled to and should label as one. Then recommend
the functional audit, since visual changes routinely break behaviour.

Occasionally the honest finding is that the design language itself is the ceiling:
no accent in the palette, no elevation model, a type stack that cannot express
hierarchy. Say so separately, clearly marked, as a proposal. Redesigning someone's
design language is a conversation, not something you slip into a diff.

## What actually reads as premium

None of these are premium by themselves, and reaching for them is the most
reliable way to make a product look cheaper: gradients, glassmorphism, blur, glow,
giant type, oversized whitespace, dark mode, gold accents, rounded cards,
animated backgrounds, floating panels, drop shadows on everything, custom
scrollbars.

Perceived quality comes from proportion, hierarchy, restraint, consistency,
typography, alignment, complete interaction states, data formatted for humans,
and small details being correct. When a page feels cheap, the cause is nearly
always one of those — not a missing effect.

## Traps

- **Webfonts that fail in the harness.** With no network, Google Fonts silently
  falls back and every judgement you make about type describes the fallback, not
  the design. Confirm the intended family loaded (`document.fonts.check`) before
  saying a word about typography.
- **Styled and still unstyled.** An element can carry a rule and lose it: a
  `tr.eq` background loses to `tr:nth-child(even) td` because the stripe paints
  the cell and the tint paints the row. Always read *computed* style, never the
  stylesheet, or you will confirm fixes that never applied.
- **`text-transform` breaks case-sensitive assertions** — `innerText` returns
  rendered casing, not source.
- **Zero-size measurements.** `clientWidth` is 0 before layout; anything sized
  from it renders empty and reads as a bug that is not there.
- **Do not add a library to solve a visual problem.** A dependency for an icon set
  or an animation carries a maintenance cost; propose it, do not install it.
- **A plain table is not automatically basic.** Tables are often the right answer
  for dense comparison. Improve them with typography, alignment, number
  formatting and a selected-row treatment — do not convert them to cards to look
  modern.
- **Let fonts and animation settle before capturing**, or you audit a frame
  mid-transition and report a bug that lasts 200ms.
- **Never reduce contrast to look subtle**, or hide useful information for
  minimalism. A visual upgrade that costs accessibility is a regression.

## Bundled files

- `scripts/inventory.mjs` — computed-style inventory, default-control detector,
  contrast check.
- `references/capture.md` — the browser driver: launch, multi-route, multi-state
  and multi-viewport capture, plus the gotchas that otherwise eat an hour.
- `references/review-zones.md` — per-zone review prompts (composition, type,
  spacing, cards, buttons, forms, navigation, tables, data, charts, icons,
  badges, states, motion, responsive). Read the zones relevant to the surface in
  front of you rather than all of them.
