# Repo-Specific Traps

Each entry has already bitten once. Check directly; add new ones at the bottom
with the date and the audit that found them.

- **`html { zoom }` in `tokens.css`** — `getBoundingClientRect()` returns zoomed
  pixels; layout, CSS transforms, `clientWidth`, and `offsetWidth` do not. Never mix
  them. Canvas sizing must come from `clientWidth` / `clientHeight`.

- **`<StrictMode>` in `main.tsx`** — every effect mounts twice. Cleanups must reset
  handles (`frameRef.current = 0`), not merely cancel them.

- **`setPointerCapture` on `pointerdown`** — steals the subsequent click from child
  elements. Capture only after the pointer passes a movement threshold.

- **RLS is owner-only** — every table needs the `owner_all` policy, the `revoke`
  from `anon` / `public`, and grants to `authenticated`. New tables also belong in
  `ZEAL_TABLES` in `lib/queries.ts` or the nightly backup silently misses them.

- **New queries against new tables** should degrade rather than throw, so the page
  still works before a migration has been applied.

- **Netlify `/zeal/*` catch-all** — any runtime fetch without its own rule in
  `netlify.toml` is answered with the app's HTML and fails with a JSON parse error.
  Trace every new fetch path to a real file in `zeal/dist/`.

- **CSS `text-transform: uppercase`** — `innerText` comes back uppercased; use
  case-insensitive matchers or `textContent`.

- **Ambiguous roles** — `getByRole('button', { name })` matches both a rail button
  and a list row. Add `data-testid` rather than positional selectors.

- **Marker collision hides elements on purpose** — a hidden marker is a feature
  working, not a bug. Assert on the collision indicator, not on marker count.

- **Dev harness 404s** — `favicon.ico` and the demo entry produce benign 404s.
  Keep them on the error-capture allowlist and nothing else.
