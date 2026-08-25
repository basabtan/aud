#!/usr/bin/env node
/**
 * Computed-style inventory for a visual audit.
 *
 * Reads what the browser actually resolved, not what the stylesheet says — an
 * element can carry a rule and still lose it to specificity, and the stylesheet
 * will happily tell you about a style that never painted.
 *
 * Usage:
 *   node inventory.mjs <url> [url...] [--viewport 1440x900] [--json out.json]
 *                       [--storage state.json] [--wait <selector>]
 *
 * --storage seeds cookies and localStorage from a Playwright storageState file.
 * Without it the browser starts empty, so any route behind client-side state
 * renders its signed-out or not-found view and the inventory describes that
 * instead of the real screen. See references/capture.md for producing one.
 *
 * Needs playwright. Set CHROME_PATH if chromium is not in the default location.
 */

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/**
 * Resolve playwright from wherever it actually lives. ESM ignores NODE_PATH, and
 * this script is run from arbitrary repos, so a bare `import 'playwright'` fails
 * whenever the package is not a sibling of the script.
 */
async function loadChromium() {
  const roots = [process.cwd(), ...(process.env.PLAYWRIGHT_ROOT ? [process.env.PLAYWRIGHT_ROOT] : [])];
  // playwright is CommonJS, so depending on how it is resolved `chromium` lands
  // either as a named export or under `default`. Accept both.
  const pick = mod => mod?.chromium ?? mod?.default?.chromium;
  for (const spec of ['playwright', 'playwright-core']) {
    try {
      const got = pick(await import(spec));
      if (got) return got;
    } catch { /* not resolvable from here */ }
    for (const root of roots) {
      try {
        const req = createRequire(`${root.replace(/\/?$/, '/')}package.json`);
        const got = pick(await import(pathToFileURL(req.resolve(spec)).href));
        if (got) return got;
      } catch { /* try the next candidate */ }
    }
  }
  console.error(
    'Could not find playwright.\n' +
    '  Install it in this project:  npm i -D playwright\n' +
    '  or point at an existing copy: PLAYWRIGHT_ROOT=/path/to/project node inventory.mjs ...',
  );
  process.exit(1);
}

const VALUE_FLAGS = new Set(['--viewport', '--json', '--storage', '--wait']);
const opts = {};
const urls = [];
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // Consume a flag's value explicitly. Sniffing by shape instead ("does it end
    // in .json?") silently swallows things like `--wait table.dense` as a URL.
    if (VALUE_FLAGS.has(a)) { opts[a] = argv[++i]; continue; }
    if (a.startsWith('--')) { opts[a] = true; continue; }
    urls.push(a);
  }
}
const [vw, vh] = (opts['--viewport'] || '1440x900').split('x').map(Number);
const jsonOut = opts['--json'];
const storage = opts['--storage'];
const waitFor = opts['--wait'];

if (!urls.length || !Number.isFinite(vw) || !Number.isFinite(vh)) {
  console.error(
    'usage: node inventory.mjs <url> [url...]\n' +
    '         [--viewport 1440x900] [--json out.json] [--storage state.json] [--wait <selector>]',
  );
  process.exit(1);
}

/** Runs inside the page. Kept self-contained so it can be pasted into a devtools console too. */
function collect() {
  const px = v => Math.round(parseFloat(v) || 0);
  const bump = (m, k) => k && m.set(k, (m.get(k) || 0) + 1);

  const fontSize = new Map(), fontWeight = new Map(), fontFamily = new Map();
  const textColor = new Map(), bgColor = new Map(), borderColor = new Map();
  const radius = new Map(), shadow = new Map(), spacing = new Map(), transition = new Map();
  const defaults = [], contrast = [];

  // --- colour helpers -----------------------------------------------------
  const rgb = c => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  /** Walk ancestors for the first non-transparent background — what the text is really on. */
  const effectiveBg = el => {
    for (let n = el; n && n !== document.documentElement.parentNode; n = n.parentElement) {
      const c = rgb(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.9) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const label = el => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  const NATIVE = { SELECT: 'select', PROGRESS: 'progress', METER: 'meter' };
  const seenDefault = new Set();

  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const box = el.getBoundingClientRect();
    if (!box.width && !box.height) continue;

    bump(fontSize, s.fontSize);
    bump(fontWeight, s.fontWeight);
    bump(fontFamily, (s.fontFamily || '').split(',')[0].replace(/["']/g, '').trim());
    if (s.color) bump(textColor, s.color);

    const bg = rgb(s.backgroundColor);
    if (bg && bg.a > 0) bump(bgColor, s.backgroundColor);

    if (px(s.borderTopWidth) || px(s.borderLeftWidth)) bump(borderColor, s.borderTopColor);
    bump(radius, s.borderTopLeftRadius);
    if (s.boxShadow && s.boxShadow !== 'none') bump(shadow, s.boxShadow);
    if (s.transitionDuration && s.transitionDuration !== '0s') {
      bump(transition, `${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`);
    }
    for (const p of ['paddingTop', 'paddingLeft', 'marginTop', 'marginLeft', 'gap']) {
      const v = px(s[p]);
      // `margin: auto` resolves to a large used value that reflects the viewport,
      // not a spacing decision; counting it invents scale violations.
      if (v > 0 && v <= 160) bump(spacing, String(v));
    }

    // --- Tier 0 detection ---------------------------------------------------
    const tag = el.tagName;
    const appearance = s.appearance || s.webkitAppearance;
    let why = null;
    if (NATIVE[tag] && appearance !== 'none') why = `native ${NATIVE[tag]} (appearance: ${appearance})`;
    else if (tag === 'INPUT') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'file') why = 'native file input — also unreachable by keyboard when wrapped in a label';
      else if ((t === 'checkbox' || t === 'radio') && appearance !== 'none') why = `native ${t}`;
      else if (t === 'range' && appearance !== 'none') why = 'native range';
    } else if (tag === 'BUTTON' && /rgb\(239, 239, 239\)|buttonface/i.test(s.backgroundColor) && px(s.paddingLeft) <= 6) {
      why = 'button appears to be at UA default styling';
    }
    if (why) {
      const key = `${label(el)}|${why}`;
      if (!seenDefault.has(key)) { seenDefault.add(key); defaults.push({ el: label(el), why }); }
    }

    // --- contrast on real text ---------------------------------------------
    const direct = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (direct) {
      const fg = rgb(s.color);
      if (fg && fg.a > 0.5) {
        const r = ratio(fg, effectiveBg(el));
        const size = parseFloat(s.fontSize);
        const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
        const need = large ? 3 : 4.5;
        if (r < need) {
          contrast.push({
            el: label(el),
            text: el.textContent.trim().slice(0, 40),
            ratio: Math.round(r * 100) / 100,
            need,
            color: s.color,
            size: s.fontSize,
          });
        }
      }
    }
  }

  // Does any stylesheet define a visible focus treatment at all?
  let focusRules = 0;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && /:focus(-visible)?/.test(rule.selectorText)) focusRules++;
      }
    } catch { /* cross-origin sheet */ }
  }

  // document.fonts.check() is not usable here: it answers "can this text be
  // rendered" and returns true after silently falling back, so a webfont that
  // failed to download still reports as available. Measure instead — render a
  // string in the family stacked over a fallback, and compare with the bare
  // fallback. Identical widths mean the family never loaded. Two fallbacks,
  // because a target genuinely resembling one would give a false negative.
  const generics = new Set(['ui-monospace', 'monospace', 'sans-serif', 'serif', 'system-ui', 'ui-sans-serif', 'ui-serif', 'cursive', 'fantasy']);
  const probe = document.createElement('span');
  probe.textContent = 'MMMMwwwwiiiil1 0Oo — handgloves';
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:96px;white-space:nowrap;visibility:hidden';
  document.body.appendChild(probe);
  const widthIn = stack => { probe.style.fontFamily = stack; return probe.getBoundingClientRect().width; };
  const loaded = {};
  for (const f of [...new Set(fontFamily.keys())].filter(Boolean)) {
    if (generics.has(f.toLowerCase())) { loaded[f] = null; continue; }   // generic: nothing to load
    try {
      loaded[f] = ['monospace', 'sans-serif'].some(fb => widthIn(`"${f}", ${fb}`) !== widthIn(fb));
    } catch { loaded[f] = null; }
  }
  probe.remove();

  const top = (m, n = 40) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    counts: {
      elements: document.querySelectorAll('*').length,
      fontSize: fontSize.size, fontWeight: fontWeight.size, fontFamily: fontFamily.size,
      textColor: textColor.size, bgColor: bgColor.size, borderColor: borderColor.size,
      radius: radius.size, shadow: shadow.size, spacing: spacing.size, transition: transition.size,
      focusRules,
    },
    fontSize: top(fontSize), fontWeight: top(fontWeight), fontFamily: top(fontFamily),
    textColor: top(textColor), bgColor: top(bgColor), borderColor: top(borderColor),
    radius: top(radius), shadow: top(shadow, 12), spacing: top(spacing), transition: top(transition, 12),
    defaults, contrast: contrast.slice(0, 40), fontsLoaded: loaded,
    overflow: document.body.scrollWidth - document.documentElement.clientWidth,
  };
}

// --- reporting --------------------------------------------------------------
const bar = (n, warn, bad) => (n >= bad ? '  <-- drift' : n >= warn ? '  <-- worth a look' : '');
const list = (rows, unit = '') =>
  rows.map(([v, c]) => `      ${String(v).slice(0, 62).padEnd(64)} ${c}${unit}`).join('\n');

function report(url, d) {
  const c = d.counts;
  const out = [];
  out.push(`\n${'='.repeat(78)}\n${url}\n${'='.repeat(78)}`);
  out.push(`  elements: ${c.elements}${c.elements < 60 ? '  <-- sparse: is this an empty/not-found state? seed with --storage' : ''}   focus rules in CSS: ${c.focusRules}${c.focusRules === 0 ? '  <-- none: focus is UA default' : ''}`);
  out.push(`  horizontal overflow: ${d.overflow}px${d.overflow > 0 ? '  <-- page scrolls sideways' : ''}`);

  out.push('\n  DISTINCT VALUES  (few and deliberate beats many and accidental)');
  out.push(`    type sizes    ${String(c.fontSize).padStart(3)}${bar(c.fontSize, 6, 9)}`);
  out.push(`    type weights  ${String(c.fontWeight).padStart(3)}${bar(c.fontWeight, 4, 6)}`);
  out.push(`    families      ${String(c.fontFamily).padStart(3)}${bar(c.fontFamily, 4, 5)}`);
  out.push(`    text colours  ${String(c.textColor).padStart(3)}${bar(c.textColor, 7, 11)}`);
  out.push(`    backgrounds   ${String(c.bgColor).padStart(3)}${bar(c.bgColor, 8, 12)}`);
  out.push(`    border cols   ${String(c.borderColor).padStart(3)}${bar(c.borderColor, 4, 6)}`);
  out.push(`    radii         ${String(c.radius).padStart(3)}${bar(c.radius, 3, 5)}`);
  out.push(`    shadows       ${String(c.shadow).padStart(3)}${bar(c.shadow, 4, 6)}`);
  out.push(`    spacing vals  ${String(c.spacing).padStart(3)}${bar(c.spacing, 10, 16)}`);
  out.push(`    transitions   ${String(c.transition).padStart(3)}${c.transition === 0 ? '  <-- no state transitions anywhere' : ''}`);

  out.push('\n  TYPE SIZES');
  out.push(list(d.fontSize, ' uses'));
  out.push('\n  SPACING VALUES  (look for values off the declared scale)');
  out.push(list(d.spacing, ' uses'));
  out.push('\n  TEXT COLOURS');
  out.push(list(d.textColor, ' uses'));
  out.push('\n  BACKGROUNDS');
  out.push(list(d.bgColor, ' uses'));

  const unloaded = Object.entries(d.fontsLoaded).filter(([, v]) => v === false);
  out.push(`\n  WEBFONTS  (${unloaded.length} not loaded)`);
  out.push(unloaded.length
    ? unloaded.map(([f]) => `      ${f}  <-- FALLING BACK: every judgement about type here describes the fallback`).join('\n')
    : '      all named families resolved');

  out.push(`\n  TIER 0 — BROWSER DEFAULT CONTROLS  (${d.defaults.length})`);
  out.push(d.defaults.length
    ? d.defaults.map(x => `      ${x.el.padEnd(40)} ${x.why}`).join('\n')
    : '      none found');

  out.push(`\n  CONTRAST FAILURES  (${d.contrast.length})`);
  out.push(d.contrast.length
    ? d.contrast.map(x => `      ${String(x.ratio).padStart(5)}:1 (needs ${x.need})  ${x.el.padEnd(28)} "${x.text}"`).join('\n')
    : '      none found');

  return out.join('\n');
}

const chromium = await loadChromium();
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const context = await browser.newContext({
  viewport: { width: vw, height: vh },
  ...(storage ? { storageState: storage } : {}),
});
const page = await context.newPage();
const all = {};

for (const url of urls) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
  if (waitFor) {
    try {
      await page.waitForSelector(waitFor, { timeout: 10_000 });
    } catch {
      console.error(`  ! "${waitFor}" never appeared on ${url} — the page may be in an empty or error state.`);
    }
  }
  // Let fonts and entry transitions settle, or the inventory describes a frame mid-animation.
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(600);
  const data = await page.evaluate(collect);
  all[url] = data;
  console.log(report(url, data));
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(all, null, 2));
  console.log(`\nwrote ${jsonOut}`);
}

await browser.close();
