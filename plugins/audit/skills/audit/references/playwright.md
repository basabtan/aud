# Playwright driver

Use the Playwright version pinned in the audit-tools lockfile or the target
application's explicitly compatible version. Install its matching Chromium
revision with `npx playwright install chromium`; do not rely on an arbitrary
system browser.

## Launch contract

1. Read the target application's `audits/project-profile/audit-profile.json` when
   present.
2. Start the declared development or preview command without changing production
   configuration.
3. Wait for the declared health URL and fail with the captured process output if
   it does not become ready.
4. Launch Chromium headlessly by default. Use a visible browser only when the
   user needs to inspect or control it.
5. Record Playwright, browser, operating-system, locale, timezone, color-scheme,
   device-scale-factor, and viewport versions in the run manifest.
6. Stop every process the audit started, including on failure.

## Harness contract

A harness URL must be supplied by the project profile or discovered from the
target application's own test configuration. Never assume a filename, query
parameter, authentication bypass, or fixture switch. A valid harness:

- renders the same components and routing behavior as production;
- uses target-owned, non-secret fixtures;
- prevents destructive writes or redirects them to an isolated adapter;
- exposes named fixture states needed by the audit; and
- is excluded from production output.

If no safe harness can be established, test the accessible deployed/local
surface and explicitly mark blocked states and roles as untested.

## Error capture and allowlists

Attach console, page-error, request-failure, and HTTP status capture before the
first navigation. The benign allowlist starts empty. Add an entry only when the
target project documents the exact URL pattern and why it is harmless; include
the applied allowlist in the report.

## Text assertion gotcha

CSS `text-transform` can change `innerText`. Prefer accessible-name assertions or
case-insensitive matching when the visual case is intentional. Use `textContent`
when the assertion must check the source string rather than rendered casing.
