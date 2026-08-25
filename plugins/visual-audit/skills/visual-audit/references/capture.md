# Capturing the interface

Everything here assumes Playwright and a Chromium binary. Install into the project
being audited (`npm i -D playwright`), and set `CHROME_PATH` if the browser is not
where Playwright expects it. In sandboxes with a pre-installed browser, that is
usually something like `/opt/pw-browsers/chromium-<build>/chrome-linux/chrome` —
check what exists rather than guessing the build number.

Old Playwright releases launch `--headless=old`, which recent Chromium builds have
removed. If launch fails with "Old Headless mode has been removed", the fix is to
upgrade Playwright, not to hunt for the binary.

## Getting past client-side state

An audit run against a clean browser profile inventories the signed-out or
not-found view and reports it as the design. Anything behind auth, localStorage, or
a loaded record needs its state seeded first.

Drive the app once, save the state, then reuse it:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto('http://localhost:5173/');
await page.getByRole('button', { name: 'Elmira 1991' }).click();   // reach a populated route
await page.waitForURL(/\/m\//);

await ctx.storageState({ path: 'state.json' });                    // cookies + localStorage
console.log(page.url());                                           // the route worth auditing
await browser.close();
```

Then:

```bash
node scripts/inventory.mjs "<url>" --storage state.json --wait "table.dense"
```

`--wait` holds until the real content exists, so the inventory does not describe a
loading skeleton. If the element count comes back under about 60, the script says
so — treat that as "I probably captured an empty state", not "this page is simple".

## Multi-route, multi-viewport capture

```js
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ROUTES = [['library', '/'], ['setup', '/m/ID?tab=setup'], ['analysis', '/m/ID?tab=analysis']];
const SIZES = [['desktop', 1440, 900], ['narrow', 390, 844]];
const BASE = 'http://localhost:5173';

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

for (const [sizeName, width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, storageState: 'state.json' });
  const page = await ctx.newPage();
  for (const [name, path] of ROUTES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(400);                       // let entry transitions finish
    await page.screenshot({ path: `shots/${sizeName}-${name}.png`, fullPage: true });

    const overflow = await page.evaluate(() =>
      document.body.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) console.log(`${sizeName}/${name}: page scrolls sideways by ${overflow}px`);
  }
  await ctx.close();
}
await browser.close();
```

Capture `fullPage: true`. A viewport-only shot hides everything below the fold,
which is exactly where unfinished sections live.

## Forcing the states nobody designed

Waiting to catch these naturally does not work. Force them.

```js
// hover and focus
await page.locator('.btn').first().hover();
await page.screenshot({ path: 'shots/state-hover.png' });
await page.keyboard.press('Tab');                        // focus-visible needs keyboard, not .focus()
await page.screenshot({ path: 'shots/state-focus.png' });

// disabled / loading / selected — set them directly when there is no easy path
await page.evaluate(() => {
  document.querySelector('.btn')?.setAttribute('disabled', '');
  document.querySelector('.row')?.classList.add('is-loading');
});

// empty state: clear the store the app reads from
await page.evaluate(() => localStorage.clear());
await page.reload();

// error state: fail the request the page depends on
await page.route('**/api/**', r => r.abort());
await page.reload();
```

`.focus()` often does not produce `:focus-visible` — browsers reserve that for
keyboard interaction, so tab to the element instead. If a focus ring never appears
after tabbing, that is a finding, not a harness problem.

## Real-content stress

```js
await page.evaluate(() => {
  const el = document.querySelector('h1');
  if (el) el.textContent = 'A deliberately long title that will expose wrapping and truncation problems';
});
```

Also worth pushing through: a long unbroken token (`AAAAAAAAAAAAAAAAAAAAAAAAA`),
zero, null, a very large number, many tags, no tags, and RTL text
(`مرحبا بكم في هذا التطبيق`) if the product supports it. Watch for clipping,
alignment collapse, unequal card heights, and controls pushed off-screen.

## Reading a screenshot at three distances

The three distances find different things, so do all three.

```js
// zoomed out: fragmentation, focal point, rhythm
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => { document.body.style.zoom = '0.35'; });
await page.screenshot({ path: 'shots/zoom-out.png', fullPage: true });

// squinted: does any hierarchy survive when the words are illegible?
await page.evaluate(() => { document.body.style.zoom = '1'; document.body.style.filter = 'blur(3px)'; });
await page.screenshot({ path: 'shots/squint.png' });

// close: baselines, 1px misalignment, icon centring, focus rings
await page.evaluate(() => { document.body.style.filter = ''; });
await page.locator('.panel').first().screenshot({ path: 'shots/close.png' });
```

Reset `zoom` and `filter` before measuring anything. Document `zoom` in particular
puts `getBoundingClientRect()` and `clientWidth` into different coordinate spaces,
and mixing them produces measurements that look like real bugs.

## Gotchas that otherwise eat an hour

- **A dev harness emits benign 404s and connection errors.** Filter them before
  treating console output as evidence of a defect.
- **`text-transform: uppercase` changes `innerText`.** Case-sensitive assertions
  fail against text that is correct in the source.
- **`getByRole` matches more than you expect** — a rail link and an in-page tab
  with the same name both match. Scope to a container or add `data-testid`.
- **`clientWidth` is 0 before layout.** Anything sized from it renders empty; that
  is a harness artefact, not a design defect.
- **Screenshot before fonts settle and you capture the fallback.** Await
  `document.fonts.ready`, and check the inventory's WEBFONTS section before
  making any claim about typography — a family that failed to download makes every
  type judgement describe the fallback instead.
