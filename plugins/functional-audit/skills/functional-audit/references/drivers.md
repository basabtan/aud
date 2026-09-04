# Drivers

Portable Playwright snippets for the instruments in SKILL.md. Launch and harness
rules are in `playwright.md`. All snippets assume `page` is an open Playwright
page and the target project's profile has supplied `BASE`, routes, and any
documented benign-error allowlist.

Contents
- Error capture
- Navigation: route crawl, deep links, back/forward, link integrity
- Control matrix: no-op detection, submit guards, keyboard
- Required states
- Accessibility (axe-core)
- Viewport matrix, overflow, touch targets, zoom
- Visual regression baselines
- Performance probe

---

## Error capture

Attach before the first `goto`. Assert the collectors are empty at the end of every
test. Keep the allowlist tiny and documented.

```ts
const BENIGN = []; // Populate only from the target project's documented profile.

function attachCapture(page) {
  const errors = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push({ kind: 'console', text: m.text() });
  });
  page.on('pageerror', e => errors.push({ kind: 'exception', text: e.message }));
  page.on('response', r => {
    if (r.status() >= 400 && !BENIGN.some(rx => rx.test(r.url())))
      errors.push({ kind: 'http', text: `${r.status()} ${r.url()}` });
  });
  page.on('requestfailed', r => {
    if (!BENIGN.some(rx => rx.test(r.url())))
      errors.push({ kind: 'netfail', text: `${r.failure()?.errorText} ${r.url()}` });
  });
  // unhandled rejections surface as pageerror in Chromium; belt and braces:
  page.addInitScript(() => {
    window.addEventListener('unhandledrejection', e =>
      console.error('unhandledrejection: ' + (e.reason?.message ?? e.reason)));
  });
  return errors;
}
```

Slow requests: wrap `page.waitForResponse` with a 10 s timeout per request the
feature makes, and report any that exceed it.

---

## Navigation

### Route inventory

Export the route table from the router file so tests read it rather than
hand-maintain a copy:

```ts
// src/routes.ts (example; adapt to the target router)
export const ROUTES = [
  { path: '/', heading: 'Home', auth: false },
  { path: '/account', heading: 'Account', auth: true },
  // ...
];
```

### Cold deep link

```ts
for (const r of ROUTES) {
  await page.goto(`${BASE}#${r.path}`);           // or BASE + r.path for history mode
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(r.heading);
  await expect(page.getByTestId('error-boundary')).toHaveCount(0);
}
```

### In-app navigation and link integrity

```ts
await page.goto(BASE);
const links = await page.locator('a[href], [role=link], nav button').all();
for (const link of links) {
  const before = page.url();
  const label = (await link.innerText()).trim();
  await link.click();
  await page.waitForLoadState('networkidle');
  const after = page.url();
  if (after === before) findings.push({ issue: `Nav control "${label}" did not change URL` });
  await expect(page.locator('#root')).not.toBeEmpty();
  await page.goBack();
}
```

External links: `await expect(link).toHaveAttribute('rel', /noopener/)` when
`target="_blank"`.

### Unknown route and auth redirect

```ts
await page.goto(`${BASE}#/definitely-not-a-route`);
await expect(page.getByTestId('not-found')).toBeVisible();

// `signedOutUrl` and `TARGET_ROUTE` come from the project profile
await page.goto(signedOutUrl(TARGET_ROUTE));
await expect(page).toHaveURL(/login/);
await page.getByTestId('demo-login').click();
await expect(page).toHaveURL(TARGET_ROUTE); // returned to intended route
```

### Back / forward restores state

```ts
await page.goto(routeUrl(TARGET_ROUTE));
await page.getByRole('button', { name: 'Active' }).click();
await page.getByRole('link', { name: 'Details' }).click();
await page.goBack();
await expect(page.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true');
```

---

## Control matrix

### No-op detection

A control must change the URL, mutate the DOM, fire a request, or show feedback.

```ts
async function exerciseControls(page, findings) {
  const controls = await page.locator(
    'button, [role=button], [role=tab], [role=switch], [role=menuitem], input[type=checkbox], input[type=radio], select'
  ).all();

  for (const c of controls) {
    if (!(await c.isVisible()) || !(await c.isEnabled())) continue;
    const name = (await c.getAttribute('aria-label')) ?? (await c.innerText()).trim() ?? '(unnamed)';
    const urlBefore = page.url();
    const domBefore = await page.locator('#root').innerHTML();
    let requestFired = false;
    const off = page.on('request', () => { requestFired = true; });

    await c.click({ trial: false }).catch(e => findings.push({ issue: `"${name}" not clickable: ${e.message}` }));
    await page.waitForTimeout(250);

    const changed =
      page.url() !== urlBefore ||
      (await page.locator('#root').innerHTML()) !== domBefore ||
      requestFired;
    if (!changed) findings.push({ issue: `No-op control: "${name}"`, severity: 3 });

    page.off('request', off);
    // recover: Escape closes anything opened
    await page.keyboard.press('Escape');
  }
}
```

Run this per route. Scope the locator to the page region if the nav rail would be
re-exercised every time.

### Submit guards

```ts
let posts = 0;
page.on('request', r => { if (r.method() === 'POST') posts++; });
const save = page.getByRole('button', { name: 'Save' });
await save.click();
await expect(save).toBeDisabled();          // in-flight
await save.click({ force: true });          // second click must be ignored
await page.waitForResponse(r => r.request().method() === 'POST');
expect(posts).toBe(1);
await expect(page.getByRole('status')).toContainText(/saved/i);
```

Failure path: make the harness API reject, then assert a human-readable error
and that the form still holds the user's input.

### Disabled and destructive

```ts
const disabled = page.locator('button[disabled], [aria-disabled=true]');
for (const d of await disabled.all()) {
  await d.focus().catch(() => {});
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BUTTON'); // unfocusable
}
const del = page.getByRole('button', { name: /delete/i });
await del.click();
await expect(page.getByRole('dialog')).toContainText(/confirm|undo/i);
```

### Keyboard reach

```ts
const targets = await page.locator('a, button, input, select, [tabindex]:not([tabindex="-1"])').count();
const reached = new Set();
for (let i = 0; i < targets + 5; i++) {
  await page.keyboard.press('Tab');
  reached.add(await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  const ring = await page.evaluate(() => {
    const el = document.activeElement; if (!el) return false;
    const s = getComputedStyle(el);
    return s.outlineStyle !== 'none' || s.boxShadow !== 'none';
  });
  if (!ring) findings.push({ issue: 'No visible focus ring', severity: 2 });
}
if (reached.size < targets) findings.push({ issue: `${targets - reached.size} controls unreachable by Tab`, severity: 3 });
```

Activate with `Enter` and `Space` on the focused control and assert the same
effect as click.

---

## Required states

The project profile supplies `fixtureUrl(variant, route)`; do not assume a query
parameter or route format.

```ts
for (const v of ['loading', 'empty', 'error', 'partial', 'large']) {
  await page.goto(fixtureUrl(v, TARGET_ROUTE));
  await page.screenshot({ path: `shots/${ROUTE_ID}-${v}.png`, fullPage: true });
}
await page.goto(fixtureUrl('empty', TARGET_ROUTE));
await expect(page.getByTestId('empty-state')).toContainText(/add|create|import/i);
await page.goto(fixtureUrl('error', TARGET_ROUTE));
await expect(page.getByRole('alert')).not.toContainText(/at |Error:|\{/); // no stack, no JSON
await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
await page.goto(fixtureUrl('partial', TARGET_ROUTE));
expect(await page.locator('#root').innerText()).not.toMatch(/\b(undefined|null|NaN)\b/);
```

Layout shift on load: record `getBoundingClientRect()` of the primary action
before and after data resolves; they must match.

---

## Accessibility

```ts
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page }).analyze();
for (const v of results.violations) {
  const sev = { critical: 4, serious: 3, moderate: 2, minor: 1 }[v.impact];
  findings.push({ issue: `${v.id}: ${v.help}`, severity: sev, nodes: v.nodes.length });
}
```

Fail the audit on severity ≥ 3. Run on every route and on every open overlay.

Reduced motion:

```ts
await page.emulateMedia({ reducedMotion: 'reduce' });
// assert the globe is not auto-rotating: sample a marker position twice, 500 ms apart
```

Overlay focus:

```ts
await page.getByRole('button', { name: 'Compose' }).click();
const dialog = page.getByRole('dialog');
await expect(dialog).toBeVisible();
expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
await page.keyboard.press('Escape');
await expect(dialog).toBeHidden();
expect(await page.evaluate(() => document.activeElement?.textContent)).toContain('Compose'); // focus returned
```

---

## Viewport matrix, overflow, touch targets, zoom

```ts
const VIEWPORTS = [[360, 800], [768, 1024], [1280, 800]];
for (const [w, h] of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: h });
  for (const r of ROUTES) {
    await page.goto(`${BASE}#${r.path}`);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) findings.push({ issue: `Horizontal overflow ${overflow}px at ${w}`, page: r.path, severity: 3 });

    const primary = page.getByTestId('primary-action');
    if (await primary.count()) {
      const box = await primary.boundingBox();
      if (!box || box.y + box.height > h) findings.push({ issue: 'Primary action below fold', page: r.path, severity: 2 });
    }
    await page.screenshot({ path: `shots/${r.heading}-${w}.png`, fullPage: true });
  }
}
```

Touch targets on 360:

```ts
const small = await page.evaluate(() =>
  [...document.querySelectorAll('button,a,[role=button],input,select')]
    .filter(el => el.offsetParent !== null)
    .map(el => ({ el: el.outerHTML.slice(0, 60), r: el.getBoundingClientRect() }))
    .filter(x => x.r.width < 44 || x.r.height < 44)
    .map(x => x.el));
small.forEach(el => findings.push({ issue: `Touch target < 44px: ${el}`, severity: 2 }));
```

200% zoom (WCAG reflow): `await page.setViewportSize({ width: 640, height: 400 })`
approximates 1280 at 200%. Rerun the overflow and fold checks.

Note the repo trap: `html { zoom }` in `tokens.css` makes `getBoundingClientRect`
return zoomed pixels. Read `clientWidth` for layout math.

---

## Visual regression baselines

```ts
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';

function diff(currentPath, baselinePath, outPath) {
  const a = PNG.sync.read(fs.readFileSync(currentPath));
  const b = PNG.sync.read(fs.readFileSync(baselinePath));
  if (a.width !== b.width || a.height !== b.height) return 1;
  const out = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 });
  fs.writeFileSync(outPath, PNG.sync.write(out));
  return n / (a.width * a.height);
}
```

Baselines live in the current timestamped Functional run directory at
`baselines/<route>-<width>.png`. A ratio > 0.005 that
the change did not intend is a finding. Mask timestamps and dynamic canvases
(`mask: [page.locator('canvas')]` in `screenshot`) to avoid noise.

---

## Performance probe

Long tasks during first interaction with the `large` fixture:

```ts
await page.goto(fixtureUrl('large', TARGET_ROUTE));
await page.evaluate(() => {
  window.__long = [];
  new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(e.duration)))
    .observe({ type: 'longtask', buffered: true });
});
await page.getByRole('button', { name: 'Apply filter' }).click();
await page.waitForTimeout(1000);
const long = await page.evaluate(() => window.__long);
const worst = Math.max(0, ...long);
if (worst > 100) findings.push({ issue: `Long task ${Math.round(worst)}ms on filter`, severity: 2 });
```

rAF leak after unmount:

```ts
await page.evaluate(() => {
  window.__rafCount = 0;
  const orig = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => { window.__rafCount++; return orig(cb); };
});
await page.getByRole('link', { name: 'Dashboard' }).click(); // leave the animated view
const before = await page.evaluate(() => window.__rafCount);
await page.waitForTimeout(1000);
const after = await page.evaluate(() => window.__rafCount);
if (after > before) findings.push({ issue: 'rAF loop still running after unmount', severity: 3 });
```

Lighthouse: `npx lighthouse <harness-url> --preset=desktop --output=json` and read
`lcp`, `cls`, and `total-blocking-time`. Measure the bundle directory declared by
the target project; do not assume a framework or output path.
