# Bader UI Design Guide — Evidence Map

This file explains the basis of the [guide](bader-ui-design-guide.md). An auditor's recommendation is evidence for a design principle, not proof of Bader's taste. **P** marks confirmed personal preferences, **D** marks derived principles, and **S** marks suggested defaults. Explicit workflow requirements are recorded separately from taste.

Source snapshot: `basabtan/aud` commit [`da063c38731f3f797bfd5000374daa5c14952782`](https://github.com/basabtan/aud/tree/da063c38731f3f797bfd5000374daa5c14952782), reviewed 2026-09-13. The links below pin that snapshot so copying this package does not detach its provenance. Section names identify the source passages; they are not instructions to run the audits.

## Confirmed personal preferences

The first four preferences were explicitly supplied in the user's “Bader UI Design Guide” task attachment and reaffirmed in the implementation request on 2026-09-13. P5 was supplied in the session's `AGENTS.md` instructions, which identify its original request date as 2026-09-09, and was explicitly included in the accepted implementation plan. These user statements are recorded here because the chat attachment and session instructions are not repository source files; no repository citation is fabricated for them.

| ID | Confirmed preference | Boundary |
|---|---|---|
| P1 | Practical, simple, understandable interfaces. | Simplicity does not authorize removing necessary information or useful workflows. |
| P2 | Concise user-facing text. | Preserve meaning, necessary context, and recovery instructions. |
| P3 | Panels, cards, and boxes use sharp corners or consistently sharp curves; avoid soft or mixed rounding styles. | This does not mandate a particular radius value or one geometry for every possible semantic shape. |
| P4 | Offer an optional style tile when starting a new app. | Once per app, before substantial visual implementation; not every page or edit. |
| P5 | A requested pop-up card expands from its originating compact panel into a floating detail card and contracts back. Details use a modest portrait beside title and identity, structured information, restrained accents, visible close, internal scrolling, and reduced-motion support. | Apply conditionally when requested. Adapt to the theme and relevant identity content; do not require portraits or overlays everywhere. Product-specific reference names and paths are omitted. |

## User-specified style-tile workflow

The task explicitly supplies the exact offer, immediate-execution and skip exceptions, unanswered-optional-input behavior, and non-repetition rule. It also specifies a compact interactive HTML/CSS preview, representative content, token and component coverage, one direction by default, acceptance or adjustment before broad application, and project-level recording of accepted choices.

These are confirmed workflow instructions, not conclusions extracted from audit procedures. Only the initial choice is optional without an answer. Once a tile is chosen, no response to its acceptance request does not mean acceptance. Independent content and flow planning can continue. A later request to skip the tile resumes direct implementation.

## Derived design principles

| ID | Actionable principle | Source paths and sections | Interpretation and limits |
|---|---|---|---|
| D1 | Establish persona, intent, journey stage, and success before choosing UI; label assumptions and separate material role or experience variants. | [Content skill](#source-c), “1. Freeze the audience and stage”; [Flow skill](#source-f), “1. Freeze intent and upstream contracts” and “9. Separate variants and conflicts”; [Place task model](#source-pt), “Schema” and “Rubric — use verbatim.” | Translate task evidence into a short construction brief. Do not require weighted task-model JSON or invent user goals. |
| D2 | Give sections exclusive questions; preserve information responsibilities without freezing tabs, screens, or sequence. | [Content skill](#source-c), “Freeze information responsibilities, not interaction architecture” and “8. Write a contract for every view”; [View contracts](#source-cv), opening fields and “Collision test”; [Flow scoring](#source-fs), “Logical recommendation rules.” | A responsibility may become an inline region, route, lens, or other appropriate structure. Existing code is not a reason a redundant section must survive. |
| D3 | Remove semantic restatement; retain transformative representations, contextual repetition, and traceability; separate roles and plan first-read disclosure. | [Content rubric](#source-cr), “Duplication taxonomy,” “Simultaneous visibility rule,” and “View survival test”; [Content skill](#source-c), steps 9–11 and “Confidence gates”; [Place scoring](#source-ps), “Duplicate normalization.” | Same subject or equal value does not prove duplication. Preserve verification access and report contradictory values rather than silently reconciling them. |
| D4 | Set prominence from task demand and necessity; account for retrieval effort and preserve critical status and frequent expert access. | [Place skill](#source-p), “The governing idea” and “Verdict gates”; [Place task model](#source-pt), “Demand weight”; [Place scoring](#source-ps), “Access costs” and “Placement candidates.” | Retain the separation between importance and appearance, not the scoring machinery. Infrequent information can still be necessary. |
| D5 | Place information near the relevant task object; bind labels, values, units, qualifiers, and table headers; respect actual reading direction. | [Place scoring](#source-ps), “Q — position relative to the task anchor”; [Place segmentation](#source-pg), “Atom invariant,” “Merge and split rules,” and “Geometry and visibility”; [Place blind spots](#source-pb), rows 4–7. | Geometry alone does not prove visibility. Avoid universal screen-center or left-to-right placement rules. |
| D6 | Design intent-led branches, direct entry, completion signals, and exact return with context preserved; distinguish missing, unavailable, and genuinely inapplicable data. | [Flow skill](#source-f), governing question and steps 2, 5–6, 9–10; [Flow model](#source-fm), “Context ledger”; [Flow observation](#source-fo), “Return-path test,” “Sparse-state distinctions,” and “Expert path”; [Functional heuristics](#source-ah), “Heuristic scorecard,” rows 3, 6, 9. | Adapt the context ledger to the app, including drafts where relevant. Shorter click paths do not justify losing work or orientation. |
| D7 | Establish intentional tokens and component rules; use hierarchy, alignment, and grouping before decorative effects; improve shared patterns first. | [Visual skill](#source-v), governing idea, steps 1, 4–5, 8, and “What actually reads as premium”; [Review zones](#source-vz), “Page composition,” “Spacing and rhythm,” and “Cards and panels.” | Keep deliberate plainness. Uniform grids suit genuinely equivalent items; containers and elevation are choices, not mandatory signs of quality. |
| D8 | Use readable type roles, task-appropriate tables and charts, honest data formatting, consistent icons, and meaningful visual encoding. | [Review zones](#source-vz), “Typography,” “Tables,” “Data and metrics,” “Information encoding,” “Charts,” and “Icons, chips and badges”; [Visual skill](#source-v), “Traps.” | Do not force a fixed font count or transform tables into cards for novelty. Preserve needed precision and native behavior where it helps. |
| D9 | Implement relevant interaction and data states with outcome labels, local feedback, recoverable errors, retained input, and guarded writes. | [Review zones](#source-vz), “Buttons and actions,” “Forms and inputs,” “Interaction states,” and “Empty, loading and error”; [Functional skill](#source-a), steps 4–5; [Functional drivers](#source-ad), “Submit guards” and “Required states”; [Functional heuristics](#source-ah), “Microcopy pass” and scorecard rows 3, 5, 9. | Data states are meaningful product conditions, not decorative placeholders. Confirmation or undo for consequential product actions does not create an agent approval gate. |
| D10 | Make tasks usable with keyboard, meaningful semantics, visible focus, measured contrast, responsive layouts, supported directions, and reduced motion; manage overlay focus and dismissal. | [Functional skill](#source-a), steps 6–7; [Functional drivers](#source-ad), “Accessibility”; [Review zones](#source-vz), “Interaction states,” “Motion,” and “Responsive”; [Place blind spots](#source-pb), rows 4, 6–7, 14. | Apply correct semantics per control. A small viewport simulation is useful evidence but not proof of all zoom or accessibility behavior. The guide does not claim standards certification. |
| D11 | Inspect composed screens, computed styles, and realistic stressful content; verify again after visual changes. | [Visual skill](#source-v), steps 2–7, 9; [Visual capture](#source-vc), “Real-content stress,” “Reading a screenshot at three distances,” and “Gotchas that otherwise eat an hour.” | Check actual loaded fonts and settled states. A passing build cannot establish visual quality; a screenshot cannot establish functional correctness. |
| D12 | Exercise visible results and return paths; collect runtime errors; scale verification and label evidence limits. | [Functional skill](#source-a), instrument table, “Scale to the ask,” steps 2–5, 10, 13–16; [Functional drivers](#source-ad), “Error capture” and “Navigation”; [Flow observation](#source-fo), “Evidence labels”; [Functional report](#source-ar), “Verification status.” | Translate into appropriate project checks. A network request or changed DOM is only a diagnostic signal, not proof the user's goal succeeded. Use app-specific persistence and deployment checks only when relevant. |

## Suggested defaults

| ID | Default | Basis and override |
|---|---|---|
| S1 | Use `border-radius: 0` for panels when no direction resolves geometry. | A concrete, replaceable implementation choice within P3; the user also allows consistently sharp curves. |
| S2 | Start from existing tokens, components, and a strong relevant screen; otherwise define a small coherent set. | A suggested starting workflow supported by D7. Explicit redesign or brand instructions may replace existing expression. |
| S3 | Start with one coherent direction while deciding palette, fonts, density, and theme per app. | The one-direction workflow is explicitly requested; the selected aesthetic values remain suggestions until specified or accepted. |
| S4 | Use `docs/design-decisions.md` only if the project has no suitable design record. Record offer status, accepted direction, token locations, and exceptions there. | An integration convenience, not an audit requirement or confirmed aesthetic preference. Preserve the existing project's equivalent record when available. |

## Source tensions and resolutions

| Tension | Resolution for reusable guidance |
|---|---|
| The visual skill calls native controls an absence of choice, but also recognizes deliberate plainness and successful KEEP decisions. | Use its broader principle of intentional, usable consistency. Retain native controls when deliberately selected; custom rendering is not a universal quality requirement. |
| The functional heuristic checklist limits visible type sizes to three, while the visual method favors a task-appropriate type scale. | Require clear, consistent type roles rather than a universal count. The number is a heuristic, not a personal preference. |
| The functional sources demand important content and primary actions above the fold; content, placement, and responsive methods allow later disclosure and scrolling. | Keep immediate orientation and consequential status discoverable in the active task context. Do not compress every necessary detail into one viewport or automatically add sticky controls. |
| Removing duplication and reducing first-read content could conflict with context retention and expert efficiency. | Preserve compact orientation and traceability; disclose only when retrieval cost and task frequency permit. The content rubric explicitly recognizes beneficial repetition. |
| Functional snippets describe every disabled control as unfocusable and every control as keyboard reachable. | Keep disabled actions inert and explained, while using focus and activation behavior appropriate to native or ARIA semantics. Do not copy the snippets as a universal component contract. |
| Some audit procedures require fix-dose choices, formal reports, or explicit approvals for audit changes. | Those procedures govern an invoked audit. This guide adds no audit approval workflow to authorized construction. The user-selected tile's acceptance step is the explicit exception for adopting its visual direction. |
| The older placement [build spec](#source-spec) §0 recommends visual → functional → placement. Current [README](#source-readme), Content, and Flow skills place content → placement → flow before design, then visual → functional after implementation. | Follow the current coordinated method as a reasoning order, not a mandatory sequence of tool invocations. Leave the historical spec and all tools unchanged. |

Source limitations do not block this package: the functional browser-launch [reference](#source-ap) is an unfilled placeholder; the functional method embeds product-specific paths, fixtures, schemas, and host rules; placement coefficients are described as engineering priors rather than established measurements of perception. None is copied into the portable instructions. Actual app runtime setup and evidence quality must be established in that app. No unresolved aesthetic choice needs to be standardized here.

## Source index

Each entry names an exact repository path at the snapshot above. All five skills and every bundled Markdown reference were reviewed; report templates informed evidence honesty, not new report obligations. The content classification cases and placement spec were also read for nuance and historical conflicts.

### Source C

[`plugins/content-audit/skills/content-audit/SKILL.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/content-audit/skills/content-audit/SKILL.md)

### Source CR

[`plugins/content-audit/skills/content-audit/references/rubric.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/content-audit/skills/content-audit/references/rubric.md)

### Source CV

[`plugins/content-audit/skills/content-audit/references/view-contracts.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/content-audit/skills/content-audit/references/view-contracts.md)

### Source P

[`plugins/place-audit/skills/place-audit/SKILL.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/place-audit/skills/place-audit/SKILL.md)

### Source PT

[`plugins/place-audit/skills/place-audit/references/task-model.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/place-audit/skills/place-audit/references/task-model.md)

### Source PS

[`plugins/place-audit/skills/place-audit/references/scoring.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/place-audit/skills/place-audit/references/scoring.md)

### Source PG

[`plugins/place-audit/skills/place-audit/references/segmentation.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/place-audit/skills/place-audit/references/segmentation.md)

### Source PB

[`plugins/place-audit/skills/place-audit/references/blind-spots.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/place-audit/skills/place-audit/references/blind-spots.md)

### Source F

[`plugins/flow-audit/skills/flow-audit/SKILL.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/flow-audit/skills/flow-audit/SKILL.md)

### Source FM

[`plugins/flow-audit/skills/flow-audit/references/flow-model.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/flow-audit/skills/flow-audit/references/flow-model.md)

### Source FO

[`plugins/flow-audit/skills/flow-audit/references/observation.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/flow-audit/skills/flow-audit/references/observation.md)

### Source FS

[`plugins/flow-audit/skills/flow-audit/references/scoring.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/flow-audit/skills/flow-audit/references/scoring.md)

### Source V

[`plugins/visual-audit/skills/visual-audit/SKILL.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/visual-audit/skills/visual-audit/SKILL.md)

### Source VZ

[`plugins/visual-audit/skills/visual-audit/references/review-zones.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/visual-audit/skills/visual-audit/references/review-zones.md)

### Source VC

[`plugins/visual-audit/skills/visual-audit/references/capture.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/visual-audit/skills/visual-audit/references/capture.md)

### Source A

[`plugins/audit/skills/audit/SKILL.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/audit/skills/audit/SKILL.md)

### Source AD

[`plugins/audit/skills/audit/references/drivers.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/audit/skills/audit/references/drivers.md)

### Source AH

[`plugins/audit/skills/audit/references/ux-heuristics.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/audit/skills/audit/references/ux-heuristics.md)

### Source AR

[`plugins/audit/skills/audit/references/report-template.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/audit/skills/audit/references/report-template.md)

### Source AP

[`plugins/audit/skills/audit/references/playwright.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/plugins/audit/skills/audit/references/playwright.md)

### Source Spec

[`specs/place-audit-build-spec-v1.0.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/specs/place-audit-build-spec-v1.0.md)

### Source README

[`README.md`](https://github.com/basabtan/aud/blob/da063c38731f3f797bfd5000374daa5c14952782/README.md)
