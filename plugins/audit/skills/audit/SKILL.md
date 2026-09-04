---
name: audit
description: Run an isolated functional audit of a feature or application by driving it in a real browser, checking routes and controls, capturing runtime failures, exercising required states, and evaluating accessibility, responsiveness, performance, data behavior, and deployment paths. Use when the user explicitly asks for functional QA, behavioral verification, regression testing, or confirmation that an implementation works. Do not use for broad design review, content architecture, placement, flow redesign, or visual polish; those belong to their specialist audits or the AUD pipeline.
---

# Functional audit (`audit` compatibility command)

Verifying a change means running it, not reading it. This skill keeps the portable
functional method; application-specific paths, schemas, fixtures, and deployment
rules belong in a project profile owned by the application being audited.

## The governing idea

**Each class of defect needs a different instrument.** Skip an instrument and you
ship that category of defect. Quality has two halves — *does it work* and *is it
good to use* — and both need instruments.

| Instrument | The defects only it finds |
|---|---|
| Typecheck, lint, build | Gate. Cheap. Start, not end. |
| Error capture (console, network, rejections) | Silent JS errors, failed fetches, 4xx/5xx behind a "working" UI |
| A real browser, driven | Lifecycle, event, and interaction bugs |
| Route crawl + control matrix | Dead links, broken routing, buttons that do nothing |
| Precise assertions | Dead code paths that "look" wired |
| Required-states check | Missing empty / loading / error / success / zero-data screens |
| Accessibility (axe + manual) | Contrast, labels, focus order, keyboard traps |
| Viewport matrix + zoom + touch targets | Reflow breaks, hidden CTAs, unusable mobile controls |
| Your own eyes on a screenshot | Hierarchy, crowding, placeholder vs value, leaked identifiers |
| UX heuristic scorecard + walkthrough | Intuitiveness defects — not bugs, but the reason users leave |
| Measurement | Subtle visual wrongness you'd talk yourself out of |
| Performance probe | Jank, slow first paint, bundle bloat, long tasks |
| Real rows, queried | Data-model errors |
| Stress fixtures | Performance cliffs, overflow, unicode/RTL breakage |
| Deployed config | Production-only failures |

## Scale to the ask

The user controls depth.

- **Quick pass** — gate + error capture + drive the two or three interactions the change touched.
- **Standard** — quick pass + route crawl + control matrix + required states + screenshots + a11y on touched pages.
- **Full audit** — every instrument in the table, every page, scorecard, data layer, deploy, performance.

When unspecified, match the size of the change: a copy tweak does not earn a
Postgres instance; a new interactive page earns Standard; a new section or
navigation change earns Full.

Always say which instruments you used and which you skipped. An audit that quietly
skipped screenshots is worse than no audit — it buys false confidence.

## Operating modes and authorization

Pipeline mode is report-only. Capture evidence and findings without modifying the
target application. Standalone specialist runs are also report-only unless the
user explicitly authorizes a narrow fix mode. In fix mode, preserve the original
evidence, make only the authorized change, and verify it separately.

## Run artifact location

This skill is the functional audit. Keep the reusable skill in the audit-tools
repository, but write every application-specific run into the target application
repository at `<application-root>/audits/YYYY-MM-DD-functional/`. Put
`REPORT.md`, test outputs, screenshots, baselines, and other evidence inside that
run directory. Update `<application-root>/audits/latest.md` so its Functional
row links to the newest run, while preserving older runs. If the same type runs
twice on one date, append `-02`, `-03`, and so on rather than overwriting
evidence.

In a monorepo, `application-root` is the nearest directory that owns the app's
runtime/build configuration. Never store product-specific audit results in the
repository that distributes this skill.

## The loop

### 0. Gate

Typecheck, lint, and build using the target application's own commands. Green is
the start of the audit. Verify that development-only harness entries are absent
from the production output using the paths declared by the project profile.

### 1. Make it drivable

When authentication, live services, or destructive writes make the UI difficult
to exercise, use the harness declared by the project profile. If none exists,
prefer a development-only seam that preserves production behavior: separate the
rendering surface from data access, use realistic fixtures, and inject write APIs
so the harness can supply a non-destructive implementation.

Fixtures must pass through the same derivation and formatting functions as the
application or the harness and production UI will disagree. Include `empty`,
`single`, `large`, `longStrings`, `rtl`, and `unicode` variants where relevant.
Record every harness addition as audit infrastructure, not product behavior.

### 2. Turn on error capture before anything else

Every drive, every page, always. See `references/drivers.md` § Error capture.

- `console.error` / `console.warn` → collected, fail on error
- `pageerror` (uncaught exceptions) → fail
- Unhandled promise rejections → fail
- Every request with status ≥ 400 → fail unless on the benign allowlist
- Requests that never resolve within 10 s → report

This instrument is nearly free and catches the largest class of "it looks fine"
bugs. Never skip it, even on a quick pass.

### 3. Drive it in a browser

Use the repository-pinned Playwright version and browser revision.
`references/playwright.md` defines portable launch, harness, and error-allowlist
rules, including the CSS `text-transform`/`innerText` mismatch.

Assert on what a person sees — "the record shows the citation", "the globe
rotated" — never on internal state. Cover, at minimum:

- Happy path for each core task the change touches
- Every click, keypress, drag, and hover the change introduced
- Keyboard-only completion of the same path
- An invalid input, an empty dataset, a failed request
- Reload mid-flow, browser back, and a cold deep link to the same view

### 4. Crawl routes and exercise every control

This is the layer that catches "the button does nothing" and "the link 404s".
Snippets in `references/drivers.md` § Navigation and § Control matrix.

**Routes**
- Enumerate every route in the router. Visit each by cold load (deep link) and by
  in-app navigation. Assert: no error boundary, no blank root, a visible `h1` or
  page heading, URL matches.
- Unknown route renders the 404 view, not blank.
- Unauthenticated access to a protected route → login → returns to the intended
  route after auth.
- `goBack` / `goForward` restore the correct view *and* its state (filters,
  scroll, selection).
- Every `<a>` and nav control: click it, assert the URL and heading changed.
  External links open safely (`rel="noopener"`).

**Controls**
- Enumerate every `button`, `[role=button]`, `a`, `input`, `select`, toggle,
  and tab on each page.
- Click each. It must produce at least one of: URL change, DOM mutation, network
  request, or a visible feedback state. Anything producing none is a **no-op** —
  report it.
- Submit buttons: disable during in-flight request; a second click must not fire
  a second request; success and failure both produce visible feedback.
- Disabled controls: visually distinct, unfocusable, and truly inert.
- Destructive actions: confirmation or undo exists.
- Every control reachable by Tab, activated by Enter or Space, with a visible
  focus ring.

### 5. Check required states

Every data-driven view must render all of these. Drive each with the matching
fixture variant:

| State | Must show |
|---|---|
| Loading | Skeleton or spinner; layout does not jump when data arrives |
| Empty (zero rows) | Explanatory empty state with a next action — not a blank panel |
| Error (request failed) | Human message and a retry path — no raw stack or JSON |
| Success (after write) | Confirmation the write happened; form reset or navigation |
| Partial (some rows missing fields) | Graceful fallback, no `undefined` / `null` in the UI |

### 6. Accessibility

- Inject `axe-core` on every page (`references/drivers.md` § Accessibility). Fail
  on `critical` and `serious`; report `moderate`.
- Manual: Tab order follows reading order; focus is visible; no keyboard trap in
  modals; `Escape` closes overlays and returns focus to the trigger.
- Contrast: 4.5:1 body, 3:1 large text and UI borders. Measure, don't eyeball.
- Every icon-only control has an accessible name. Every image has alt or is
  marked decorative.
- `prefers-reduced-motion` disables non-essential animation (the globe spin
  counts).

### 7. Responsive matrix, zoom, touch, RTL

Run each page at `360×800`, `768×1024`, `1280×800`, and `1280×800` at 200% zoom.
At every size:

- `document.documentElement.scrollWidth - clientWidth === 0`
- Primary action visible without scrolling
- No text clipped or overlapping; no element hidden behind another
- Interactive targets ≥ 44×44 CSS px on the 360 viewport
- With the `rtl` fixture: `dir="rtl"` mirrors layout correctly, Arabic line-height
  and font fallback are acceptable, numbers and mixed-direction strings render
  in the right order

### 8. Look at the screenshots yourself

Capture every page and every state above. Read the images. Tests cannot see
contrast, hierarchy, or crowding, and this is where most UX defects live.

- Can I tell filled fields from placeholders?
- Is the primary action the most visually dominant thing?
- Is any raw identifier leaking (`isl-tafsir` instead of `Tafsir`)?
- Are numbers formatted for humans (`31.0897`, not `31.08968418781209`)?
- Does every screen answer: where am I, what can I do, what just happened?

### 9. Score intuitiveness

This converts "looks right to me" into a finding list. Use
`references/ux-heuristics.md`.

- **Cognitive walkthrough**: for each core task, at each step ask — would a
  first-time user know the next action exists, find it, recognize it as correct,
  and get feedback that it worked? Any "no" is a finding.
- **Heuristic scorecard**: score each page against the ten heuristics, severity
  0–4. Anything ≥ 2 goes in the report.
- **Microcopy pass**: vague labels, jargon, inconsistent verbs, buttons that
  don't say what they do.

### 10. Distrust your own tests

Test bugs masquerade as both failures and passes, and the passes are the
dangerous half. When an assertion fails, decide whether the app or the test is
wrong before changing either. When one passes, confirm it read the thing you
meant. If a selector is ambiguous or positional, add a `data-testid` — that is a
real improvement, not a concession.

### 11. Measure when something looks subtly off

If a thing looks a few pixels wrong, get the numbers. Compute where an element
should be, read where it is, look at the ratio — 1.2 pointed straight at the
document `zoom` in `tokens.css`. Two minutes of arithmetic beats an hour of
squinting.

### 12. Visual regression

On Full audits, keep baseline screenshots per page per viewport in the current
timestamped Functional run directory under `baselines/`. Diff with `pixelmatch`;
any diff above 0.5% that the
change did not intend is a finding. Update baselines only after the user accepts
the new look.

### 13. Performance probe

- Lighthouse on the dev harness: report LCP, CLS, TBT, bundle size. Flag LCP > 2.5 s,
  CLS > 0.1, any chunk > 300 kB gzipped.
- Drive the `large` fixture: initial render and first interaction must stay under
  100 ms of main-thread blocking. Use `PerformanceObserver` for long tasks.
- Canvas and globe: confirm `requestAnimationFrame` loops stop when the view
  unmounts or the tab is hidden.

### 14. Verify the data layer against real rows

Use only the target-owned data-check adapter declared by its project profile.
Apply migrations to an isolated disposable database, seed representative rows,
query them through the same access path as the application, and run the profile's
negative authorization tests. If no safe adapter exists, mark this instrument
skipped; never guess database commands or production credentials.

### 15. Check the deployed environment

Use the target-owned deploy-check adapter declared by its project profile. For
every runtime fetch and client-side route in scope, trace the deployed path to a
real asset, function, or intentional SPA fallback. Record unavailable deployment
access as a limitation rather than inferring success from local behavior.

### 16. Report, then fix only when authorized

Write the report before any remediation. In explicitly authorized standalone fix
mode, fix only local, unambiguous issues within the approved scope. Anything that
changes the data model, routing structure, content responsibility, flow contract,
visual language, or multiple components remains a remediation recommendation.

Report with `references/report-template.md`:

- Instruments used and skipped, with reasons
- Findings table: Issue · Page · Instrument · Severity 0–4 · Fixed / Deferred
- What was tested and passing vs what merely looks right vs what could not be
  verified (and why — e.g. proxy blocked the deploy preview)
- Update `<application-root>/audits/latest.md` with the newest Functional run
  and carry forward unresolved regressions or repeat offenders.

## Project profiles

Before driving the application, look for `audits/project-profile/` at its root.
The profile may declare harness commands, fixtures, known traps, data checks, and
deployment checks. Treat it as target-owned input: validate paths and never copy
its rules into this portable core. Without a profile, run only instruments that
can be established safely from the repository and report the rest as skipped.

## Bundled files

- `references/drivers.md` — Playwright snippets: error capture, route crawl,
  control matrix, axe, viewport matrix, touch targets, overflow, baselines.
- `references/playwright.md` — launch path and harness gotchas.
- `references/ux-heuristics.md` — scorecard, cognitive walkthrough, severity scale.
- `references/report-template.md` — findings table and latest-index format.
