# Bader UI Design Guide — Agent Integration

The reusable source lives in `basabtan/aud`. Each app needs an accessible local copy and instructions pointing to it. A coding agent does not automatically read a separate GitHub repository, and installing `basabtan/services` does not install or activate this guide.

## Make the guide available

1. Choose a reviewed commit containing this package in `basabtan/aud`. Copy these three files together into the new application's `docs/` directory:
   - `bader-ui-design-guide.md`
   - `bader-ui-evidence.md`
   - `bader-ui-agent-integration.md`
2. Commit the copies with the app. Preserve their filenames and sibling relationships so the local links work. The evidence file's GitHub links are pinned to the audit-source snapshot and do not require copying the audit plugins.
3. Add the block below to the application's applicable `AGENTS.md`, preserving existing instructions. For an agent that uses another instruction filename, place the same text in that agent's supported project instruction file. Do not assume every agent recognizes `AGENTS.md`.
4. Use the project's existing design record and token files. If no design record exists, use `docs/design-decisions.md` (suggested default S4). Record the package's originating `basabtan/aud` commit separately from the audit-source commit already listed in the evidence map.
5. For a later update, compare a reviewed new package with the local copies, preserve explicit app decisions, update all three files together, and record the new package commit. Do not silently track changing `main` during an implementation session.

In a monorepo, place these files at the application root owning the UI and build configuration, and adjust the instruction paths relative to that root. An existing versioned shared-document mechanism is also workable if the files are present and readable in every agent environment; repository-local copies are the default.

The style-tile record needs only: offer/choice status, the user's response or unanswered optional-offer outcome, preview location if created, whether a direction is proposed or accepted, token/component locations, and explicit exceptions. An accepted tile records palette and semantic colors, type roles, spacing, corners, borders, surfaces, component states, and motion rules. Implement these through the project's normal token and component system, not documentation alone.

## Copy-ready project instructions

The paths below assume the three documents are in the application's `docs/` directory. Resolve them from that application root.

```markdown
## Bader UI design

Before designing or implementing UI, read `docs/bader-ui-design-guide.md` and
apply it alongside this project's requirements, brand/reference direction,
design tokens, and established components. Read `docs/bader-ui-evidence.md`
on first use and when interpreting a rule, default, or conflict. Read
`docs/bader-ui-agent-integration.md` when setting up or updating this package.
Do not rely on chat memory or automatic access to a separate repository.

Preserve the distinction between confirmed preferences, derived principles,
and suggested defaults. Bader prefers practical, understandable interfaces,
concise text, and sharp or consistently sharply curved panels/cards/boxes.
Apply the guide's spatially continuous floating detail behavior when a
pop-up card is requested. Do not infer a universal palette, theme, font,
density, or decorative style. Follow explicit project or user direction;
record material exceptions and ask only when an unresolved conflict would
materially change the work.

Plan the audience, task, section responsibilities, hierarchy, and journey
before substantial visual implementation. Preserve necessary context and
return behavior; implement accessible interaction and data states. Verify
the changed interface in a browser with representative content, and report
what was exercised versus inferred or unverified. Scale checks to the work;
this guide does not add mandatory audit runs or approval gates.

For a NEW APP, check the project design record and current request first.
If a style tile is already requested, create it without asking again. If
the user declined, said "skip," or requested immediate execution, build
directly. Otherwise, before substantial visual implementation ask ONCE:

"Would you like a quick style tile first, or should I build directly using your UI guide?"

The initial choice is optional. If an optional input tool returns no answer,
proceed using sensible defaults. Do not repeatedly ask on each page,
routine edit, resumed session, or package update. Follow supplied brand or
reference direction on either path. Continue content, hierarchy, and flow
planning independently of the visual choice.

If a tile is chosen, make one compact browser-viewable HTML/CSS preview
using representative app content. Include palette and semantic colors,
typography hierarchy, spacing, corners, borders, surfaces, buttons, inputs,
and a representative card/panel. Include relevant hover, focus, selected,
and disabled states and enough working interaction to judge the treatment.
Present one coherent direction by default; add alternatives only on request
or for a meaningful unresolved choice. Do not build the full app in the tile.

Ask the user to accept or adjust that direction BEFORE applying it across
the app. No reply to this acceptance request is not acceptance; continue
independent work. If the user instead asks to skip the tile, build directly.
Once accepted, record and implement the choices as project design tokens
and component rules, then continue the build.

Use the existing project design record or, if absent,
`docs/design-decisions.md`. Keep the tile offer/choice status, proposed or
accepted direction, preview and token/component locations, package origin
commit, and explicit exceptions there. Keep this record in the repository
so later agents can continue without repeating the offer.
```

## Integration behavior checks

| Scenario | Expected agent behavior |
|---|---|
| New app without a prior choice | Read local guidance, offer once, and continue independent planning. |
| User already requested a tile | Create the focused tile immediately; ask for acceptance or adjustment when it is viewable. |
| User declines or says “skip” | Record the decision and build directly. |
| User requests immediate execution | Build directly without introducing the style-tile offer. |
| Optional offer returns no answer | Record that outcome and use sensible defaults; do not re-ask. |
| Chosen tile awaits acceptance | Continue independent content/flow work; do not apply the unaccepted direction across the app. |
| Supplied brand or reference | Follow that direction with either the tile or direct-build path. |
| Routine edit or resumed session | Read applicable rules and the existing record; do not restart the offer. |
| Another coding agent or offline session | Local guide and recorded choices remain usable; remote evidence links are provenance, not a runtime dependency. |

This package adds construction guidance only. Existing audit tools keep their own behavior when invoked. It requires no component-library installation, hosting service, database provider, or new app scaffolding.
