# Bader UI Design Guide

Use this guide before and during interface implementation, then use its final checklist to verify the result. It carries consistent design judgment across apps while leaving each app's palette, theme, density, and character open. Read the project's own requirements, brand direction, tokens, and established components first.

Evidence labels distinguish **confirmed preferences (P)**, **derived design principles (D)**, and **suggested defaults (S)**. Their sources and qualifications live in the [evidence map](bader-ui-evidence.md). These are construction instructions, not a requirement to execute every audit or reproduce its reports.

## 1. Confirmed preferences

- **P1 — Practical and understandable:** build simple interfaces that make the user's task clear.
- **P2 — Concise text:** use short, specific labels and explanations. Preserve the context and qualifications needed to understand them.
- **P3 — Consistent sharp geometry:** panels, cards, and boxes use sharp corners or consistently sharp curves. Avoid soft or mixed rounding styles.
- **P4 — Optional style tile:** offer it once at the start of a new app, following section 3.
- **P5 — Requested pop-up cards:** a compact clickable panel grows smoothly from its position into a floating detail card, then contracts into its origin when closed. Preserve spatial continuity. Use a modest portrait beside the title and identity where appropriate, structured details below, restrained theme-matched accents, a visible close control, responsive internal scrolling, and reduced-motion support. Adapt portrait size and colors to the app. This applies when a pop-up card is requested; it does not make every card an overlay.

These preferences do not establish a universal dark theme, accent color, font, density, or visual style. Follow supplied brand systems, references, and explicit project direction. Make any material conflict visible rather than silently inventing a preference.

## 2. Plan the information and journey first

**Start with the task (D1).** State who uses the interface, what they arrive to do, and what observable result means success. Use product and repository evidence; label assumptions. Ask only about unknowns that materially change the build. Separate novice, expert, and role-specific needs when they differ.

**Give every section a job (D2).** Before choosing cards, tabs, or screens, write each major section's primary user question, information source, role, and stage of use. Two sections answering the same question from the same inputs need a distinct benefit to coexist. These responsibilities do not prescribe the final navigation or layout.

**Keep information that earns attention (D2–D3).** Remove restatements, not merely repeated wording. A summary that repeats the same facts beside their source adds little; a comparison that reveals differences may justify another representation. Keep a canonical owner for each fact and link to supporting detail. Preserve compact repetition when it prevents disorientation, identifies the current object, or enables verification. Never hide conflicting values by treating them as harmless duplicates.

**Choose the first useful view (D3–D4).** Show orientation, the distinctions needed now, critical uncertainty or status, and a recognizable next action. Disclose details when a later question calls for them. Keep critical errors and recovery information visible in context, and avoid repeatedly hiding controls experts need. Put editor or diagnostic information in the appropriate role or mode rather than merely dimming it in a reader's path.

**Assign hierarchy from need (D4–D5).** Decide importance before visual prominence. Frequency alone does not determine necessity: a rare but consequential warning can deserve immediate attention. Place information and actions near the object or decision they concern. Keep label, value, unit, time period, and qualifier meaningfully bound; table values retain row and column context. Do not assume screen center, top-left placement, or current font size proves importance.

**Design progress and return together (D6).** For a core journey, identify entry, next action, system response, completion signal, and return behavior. Sequence steps only when there is a real dependency. Offer direct access for users who already know their intent, with optional orientation for newcomers. Name branches by what they help the user accomplish.

Define which filters, selection, drafts, comparison position, and scroll anchor must survive each transition. For example, opening an item's details from a filtered list should return to that item in the same list context. Check browser Back as well as an in-app return control. Fewer clicks are useful only when users retain orientation and progress. Treat sparse data as a designed path with a next step, not a dead end.

## 3. Offer the optional style tile

Before substantial visual implementation of a new app, ask once:

> Would you like a quick style tile first, or should I build directly using your UI guide?

This choice is optional, not an approval gate for starting work. If the user already requested a tile, create it without asking again. If they decline, say “skip,” or request immediate execution, build directly. If an optional input tool returns no answer, proceed with sensible defaults. Do not repeat the offer for each page or routine edit. Keep content, hierarchy, and flow planning moving independently. Follow supplied brand or reference direction in either path. [User-specified workflow](bader-ui-evidence.md#user-specified-style-tile-workflow)

If a tile is chosen:

1. Create one compact, browser-viewable HTML/CSS preview with representative content from the proposed app. Show palette and semantic colors; typography hierarchy; spacing and corners; borders and surfaces; buttons and inputs; and a representative card or panel.
2. Include meaningful hover, focus, selected, and disabled states. Make a small interaction work, such as selecting an item or expanding details, so the treatment can be judged. Keep the preview focused on visual language rather than building the app inside it.
3. Present one coherent direction by default. Add alternatives only on request or when a meaningful unresolved choice warrants them.
4. Ask the user to accept or adjust the direction before applying it throughout the app. An unanswered acceptance request is not acceptance; continue independent work. If the user changes course and asks to skip the tile, proceed directly.
5. Record accepted choices as project-level design tokens and component rules, then continue implementation.

Keep a brief project record of whether the tile was offered, requested, skipped, or accepted so another session does not repeat the question. Use the project's existing design record, or the fallback described in the [integration instructions](bader-ui-agent-integration.md).

## 4. Establish a deliberate visual system

**Define roles before values (D7).** Choose a focal region, primary and secondary actions, type hierarchy, spacing relationships, surface levels, semantic colors, borders, control heights, and motion behavior. Use shared tokens and components so the same role looks and behaves consistently across routes. Improve the system before adding local exceptions.

**Make composition express importance (D7–D8).** Use alignment, typography, and spacing to group related information. Give different groups more separation than elements belonging to one object. Avoid equally emphasized boxes when the tasks have different priorities. Equivalent items may use an even grid. Add a container only when it clarifies grouping, interaction, or boundaries; plain sections and dense tables can be the right answer.

**Choose readable type and honest data formatting (D8).** Distinguish page titles, section headings, values, labels, and secondary notes. Keep line lengths and line heights readable. Use aligned numerals where comparison benefits. Format dates, units, quantities, and status in the user's language without changing meaning or rounding away needed precision. Display a meaningful missing-value treatment rather than raw `null`, `undefined`, or internal identifiers.

**Use visual encoding for a task (D8).** Use a chart, status marker, or trend only when it reduces interpretation effort. Retain labels and meaningful relationships; color alone must not carry the answer. Keep icon families consistent and provide accessible names for icon-only actions. A badge, shadow, gradient, animation, or custom control is not an improvement by itself. Deliberate native controls are acceptable when they fit the task and remain usable.

**Suggested defaults, not personal preferences:**

- **S1:** use square panel corners (`border-radius: 0`) when no project direction resolves geometry. A consistently sharp curve also satisfies P3.
- **S2:** reuse the existing project's tokens, components, and strongest relevant screen as the starting point. If none exists, define a small coherent set before multiplying components.
- **S3:** begin with one visual direction, and leave colors, fonts, density, and theme to the app's content, audience, and supplied references.

## 5. Implement the full interaction

**Finish every relevant state (D9).** Design default, hover, focus-visible, active, selected, disabled, expanded, and collapsed treatments where the component uses them. Hover must not imply clickability on inert content or provide the only access to information. Keep selected and hover states distinguishable. Disabled controls remain understandable and truly inert; choose focus behavior appropriate to the control's semantics.

| Situation | Build this behavior |
|---|---|
| Loading | Show local progress promptly and preserve layout; use a skeleton when the eventual structure is known. |
| Empty | Explain what belongs here, why it is empty, and a useful next action where one exists. |
| Partial or unavailable | Distinguish missing information, a real zero, and a request failure. Do not infer “not applicable” from absent data. |
| Error | Explain what failed and how to recover; retain entered data and show stale-data status when relevant. Place validation beside the affected field. |
| Success | Confirm the actual result of the operation; reset or navigate only when that supports the task. |
| Pending write | Prevent duplicate submissions and show progress; support both success and failure outcomes. |

Use outcome labels such as “Save entry” rather than mechanism labels such as “Submit.” A placeholder is not a field label. Keep destructive actions distinguishable and provide confirmation or undo proportionate to the consequence. These are product interactions, not blanket approval requests to the coding agent.

**Preserve access across devices and input methods (D10).** Use semantic controls, accessible names, meaningful heading and reading order, visible keyboard focus, and appropriate text alternatives. Measure contrast for text and essential controls; do not achieve subtlety by making information unreadable. Complete core tasks by keyboard. For modal overlays, manage focus within the dialog, provide a visible close control and Escape dismissal, and return focus to the trigger or a logical surviving element.

At narrow widths and zoom, preserve task hierarchy and usable targets. Adapt navigation and disclose secondary information deliberately. Put genuinely wide comparisons in their own accessible scroll region instead of forcing the entire page sideways. Check sticky elements and floating cards for occlusion and reachable close controls. Test supported RTL and mixed-direction content per block rather than assuming global left-to-right order. Motion should explain change and continuity; under reduced motion, minimize or remove movement while preserving state and focus.

## 6. Verify the interface that users receive

**Use complementary evidence (D11–D12).** Run appropriate static checks, then exercise the built interface in a real browser. Walk through the touched core tasks, failure and recovery, keyboard access, and return paths. Capture console and network errors and verify visible outcomes; a request firing or a DOM mutation alone does not prove success.

Inspect screenshots of representative routes and states at normal size, zoomed out for composition, and close up for alignment and control detail. Confirm fonts loaded and transitions settled. Check computed styles, contrast, and overflow when measurements can settle uncertainty. Exercise realistic populated content as well as empty, single-item, dense, long-string, and partial-data cases; include supported language and input variants. Repeat affected interaction checks after visual changes.

Scale verification to the change. Expand into performance, data persistence, and deployed-route checks when the feature depends on them. Use the app's own environment and data model. Report what was exercised, what was inferred, and what could not be verified with a reason. The guide does not require installing an audit plugin or adding a formal audit gate to every edit.

### Final checklist

- [ ] Each visible section answers a task-relevant question with distinct value.
- [ ] First-view priorities, qualifiers, critical status, and disclosure choices are deliberate.
- [ ] Navigation advances intent and preserves required context on return.
- [ ] Typography, spacing, geometry, components, and data formatting form a coherent system.
- [ ] Relevant interaction and data states communicate progress, results, and recovery.
- [ ] Keyboard, focus, contrast, narrow layouts, zoom, reduced motion, and supported languages work.
- [ ] Style-tile choice is recorded; any chosen direction was accepted before broad application.
- [ ] Browser and visual verification cover the changed behavior; remaining uncertainty is stated.
