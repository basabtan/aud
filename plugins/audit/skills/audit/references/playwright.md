# Playwright driver

REPLACE THIS FILE with your existing `references/playwright.md` (launch path,
harness structure, benign-404 and text-transform gotchas). It was not included in
the uploaded skill and is referenced by SKILL.md and drivers.md.

Minimum it must contain:
- Chromium launch path and headless flags that work in this environment
- How to start the Vite dev server and the `app-demo.html` / `atlas-demo.html` harness URLs
- `?fixture=` and `?auth=off` query handling in the harness
- The benign-404 allowlist
- The `text-transform` / `innerText` gotcha
