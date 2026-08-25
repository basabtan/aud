#!/usr/bin/env node
/**
 * Deterministic information-atom extractor.
 *
 * Usage:
 *   node extract.mjs <url-or-html> [--out atoms.json] [--screenshot page.png]
 *     [--viewport 1440x900] [--state initial] [--wait selector]
 *     [--storage storage-state.json] [--touch]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION = '0.1.0';

async function loadChromium() {
  const roots = [process.cwd(), ...(process.env.PLAYWRIGHT_ROOT ? [process.env.PLAYWRIGHT_ROOT] : [])];
  const pick = mod => mod?.chromium ?? mod?.default?.chromium;
  for (const spec of ['playwright', 'playwright-core']) {
    try {
      const got = pick(await import(spec));
      if (got) return got;
    } catch { /* continue */ }
    for (const root of roots) {
      try {
        const req = createRequire(`${root.replace(/[\\/]?$/, '/')}package.json`);
        const got = pick(await import(pathToFileURL(req.resolve(spec)).href));
        if (got) return got;
      } catch { /* continue */ }
    }
  }
  throw new Error('Could not resolve playwright. Install it with: npm i -D playwright');
}

function parseArgs(argv) {
  const valueFlags = new Set(['--out', '--screenshot', '--viewport', '--state', '--wait', '--storage']);
  const opts = { positionals: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valueFlags.has(arg)) {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      opts[arg] = argv[++i];
    } else if (arg.startsWith('--')) {
      opts[arg] = true;
    } else {
      opts.positionals.push(arg);
    }
  }
  return opts;
}

function outputPath(path) {
  if (!path) return null;
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  return full;
}

const opts = parseArgs(process.argv.slice(2));
const targetArg = opts.positionals[0];
const [width, height] = String(opts['--viewport'] ?? '1440x900').split('x').map(Number);
if (!targetArg || !Number.isFinite(width) || !Number.isFinite(height)) {
  console.error('usage: node extract.mjs <url-or-html> [--out atoms.json] [--screenshot page.png] [--viewport 1440x900]');
  process.exit(1);
}

const target = /^[a-z]+:\/\//i.test(targetArg) ? targetArg : pathToFileURL(resolve(targetArg)).href;
const outPath = outputPath(opts['--out']);
const screenshotPath = outputPath(opts['--screenshot']);
const stateId = opts['--state'] ?? 'initial';
const chromium = await loadChromium();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});

try {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: 'en-US',
    ...(opts['--storage'] ? { storageState: resolve(opts['--storage']) } : {}),
    ...(opts['--touch'] ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await context.newPage();
  try {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
  if (opts['--wait']) await page.waitForSelector(opts['--wait'], { timeout: 10_000 });
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(100);

  const animationInfo = await page.evaluate(() => ({
    existed: document.getAnimations().length > 0 || [...document.querySelectorAll('*')].some(el => {
      const s = getComputedStyle(el);
      return s.animationName !== 'none' || s.transitionDuration.split(',').some(v => parseFloat(v) > 0);
    }),
    active: document.getAnimations().length,
  }));
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
      caret-color: transparent !important;
    }
  ` });

  const collect = ({ runState, accessPath = null, rootSelector = null }) => {
    const root = rootSelector ? document.querySelector(rootSelector) : document;
    if (!root) return [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const covered = new Set();
    const atoms = [];
    const select = selector => [
      ...(root.matches?.(selector) ? [root] : []),
      ...(root.querySelectorAll?.(selector) ?? []),
    ];

    const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();
    const slug = text => clean(text).toLowerCase().normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || null;
    const visible = el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
    };
    const cssPath = el => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      for (let n = el; n?.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
        let part = n.tagName.toLowerCase();
        const stable = [...n.classList].find(c => !/^css-|^sc-|^_[a-z0-9]/i.test(c));
        if (stable) part += `.${CSS.escape(stable)}`;
        if (n.parentElement) {
          const peers = [...n.parentElement.children].filter(x => x.tagName === n.tagName);
          if (peers.length > 1) part += `:nth-of-type(${peers.indexOf(n) + 1})`;
        }
        parts.unshift(part);
        if (parts.length >= 6) break;
      }
      return parts.join(' > ');
    };
    const rgba = value => {
      const m = String(value ?? '').match(/rgba?\(([^)]+)\)/i);
      if (!m) return null;
      const p = m[1].replaceAll('/', ' ').split(/[\s,]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: Number.isFinite(p[3]) ? p[3] : 1 };
    };
    const over = (front, back) => {
      const a = front.a + back.a * (1 - front.a);
      if (!a) return { r: 255, g: 255, b: 255, a: 1 };
      return {
        r: (front.r * front.a + back.r * back.a * (1 - front.a)) / a,
        g: (front.g * front.a + back.g * back.a * (1 - front.a)) / a,
        b: (front.b * front.a + back.b * back.a * (1 - front.a)) / a,
        a,
      };
    };
    const effectiveBg = el => {
      let result = { r: 255, g: 255, b: 255, a: 1 };
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) layers.push(c);
      }
      for (const layer of layers.reverse()) result = over(layer, result);
      return result;
    };
    const luminance = c => {
      const f = v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const contrast = (a, b) => {
      if (!a || !b) return null;
      const hi = Math.max(luminance(a), luminance(b));
      const lo = Math.min(luminance(a), luminance(b));
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    const hex = c => `#${[c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
    const textRects = el => {
      const rects = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!clean(n.textContent)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.width && r.height) rects.push([r.x + scrollX, r.y + scrollY, r.width, r.height]);
        }
      }
      return rects;
    };
    const union = (rects, fallback) => {
      if (!rects.length) return [fallback.x + scrollX, fallback.y + scrollY, fallback.width, fallback.height];
      const x1 = Math.min(...rects.map(r => r[0]));
      const y1 = Math.min(...rects.map(r => r[1]));
      const x2 = Math.max(...rects.map(r => r[0] + r[2]));
      const y2 = Math.max(...rects.map(r => r[1] + r[3]));
      return [x1, y1, x2 - x1, y2 - y1];
    };
    const region = el => {
      const n = el.closest('[data-region]') || el.closest('section, article, aside, main, header, footer, nav');
      return n?.dataset.region || n?.id || (n ? slug(n.getAttribute('aria-label') || n.querySelector(':scope > h1, :scope > h2, :scope > h3')?.textContent || n.tagName) : 'page');
    };
    const clipping = el => {
      let rect = el.getBoundingClientRect();
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (!/(hidden|clip|scroll|auto)/.test(`${s.overflow}${s.overflowX}${s.overflowY}`)) continue;
        const r = n.getBoundingClientRect();
        if (rect.left < r.left || rect.right > r.right || rect.top < r.top || rect.bottom > r.bottom) return true;
      }
      return false;
    };
    const occluded = el => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(vw - 1, r.left + r.width / 2));
      const y = Math.max(0, Math.min(vh - 1, r.top + r.height / 2));
      if (r.bottom <= 0 || r.top >= vh) return false;
      const top = document.elementFromPoint(x, y);
      return Boolean(top && top !== el && !el.contains(top) && !top.contains(el));
    };
    const pseudo = el => ['::before', '::after'].map(which => {
      const content = getComputedStyle(el, which).content;
      return content && content !== 'none' && content !== 'normal' ? content.replace(/^['"]|['"]$/g, '') : '';
    }).filter(Boolean);
    const parseRoles = (el, fallback = []) => {
      const roles = clean(el.dataset.semanticRole).split(/[\s,]+/).filter(Boolean);
      return [...new Set([...roles, ...fallback])];
    };
    const markCovered = el => { covered.add(el); el.querySelectorAll('*').forEach(n => covered.add(n)); };

    function add(el, kind, details = {}) {
      if (!el || !visible(el)) return;
      const s = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const rects = kind === 'canvas' ? [] : textRects(el);
      const bbox = union(rects, rect);
      let label = details.label ?? clean(el.querySelector?.('[data-label]')?.textContent);
      let value = details.value ?? clean(el.querySelector?.('[data-value]')?.textContent);
      let qualifier = details.qualifier ?? clean(el.querySelector?.('[data-qualifier]')?.textContent);
      const inputValue = el.matches?.('input, select, textarea') ? clean(el.value) : '';
      if (!value && inputValue) value = inputValue;
      let text = details.text ?? clean([label, value, qualifier].filter(Boolean).join(' '));
      if (!text) text = clean(el.innerText || el.textContent || el.getAttribute('aria-label'));
      const generated = pseudo(el);
      if (generated.length) text = clean(`${text} ${generated.join(' ')}`);
      if (!text && kind !== 'canvas') return;

      const documentY = bbox[1];
      let path = accessPath;
      if (!path) path = documentY >= scrollY + vh || bbox[1] + bbox[3] <= scrollY ? 'scroll' : 'visible';
      const costs = { visible: 0, scroll: 0.35, hover: 0.50, focus: 0.50, disclosure: 0.70, tab: 0.90, modal: 1.20, unavailable: null };
      const bg = effectiveBg(el);
      const fg = rgba(s.color);
      const ariaRole = el.getAttribute('role');
      const explicitConfidence = Number(el.dataset.auditConfidence);
      const confidence = Number.isFinite(explicitConfidence)
        ? explicitConfidence
        : kind === 'explicit' ? 0.94 : kind === 'table-cell' ? 0.96 : kind === 'control' ? 0.86 : kind === 'canvas' ? 1 : 0.68;
      const rawValue = value || details.rawValue || null;
      const numeric = rawValue ? Number(String(rawValue).replace(/[^0-9.+-]/g, '')) : null;
      const metricLabel = details.columnHeader || label || el.dataset.metric || (kind === 'control' ? el.getAttribute('aria-label') : text);
      const fallbackRoles = kind === 'table-cell' ? ['table-cell']
        : kind === 'control' ? ['control']
          : region(el)?.includes('kpi') ? ['kpi'] : [];
      const position = s.position;
      atoms.push({
        state_id: runState,
        region: region(el),
        dom: {
          selector: cssPath(el), path: cssPath(el), tag: el.tagName.toLowerCase(),
          aria_role: ariaRole, accessible_name: clean(el.getAttribute('aria-label')) || null,
          ancestry: cssPath(el.parentElement), generated_content: generated,
        },
        text,
        semantic: {
          entity: el.dataset.entity || details.entity || null,
          metric: el.dataset.metric || details.metric || slug(metricLabel),
          value: Number.isFinite(numeric) ? numeric : rawValue,
          raw_value: rawValue,
          unit: el.dataset.unit || null,
          period: el.dataset.period || null,
          aggregation: el.dataset.aggregation || null,
          scope: el.dataset.scope || details.scope || null,
          qualifiers: qualifier ? [qualifier] : [],
          semanticRole: parseRoles(el, fallbackRoles),
          ...(details.rowHeader ? { row_header: details.rowHeader } : {}),
          ...(details.columnHeader ? { column_header: details.columnHeader } : {}),
          ...(kind === 'canvas' ? { unscorable_reason: 'CANVAS_NO_OCR_V1' } : {}),
        },
        geometry: {
          bbox,
          text_rects: rects,
          viewport_rel: [bbox[0] / vw, (bbox[1] - scrollY) / vh, bbox[2] / vw, bbox[3] / vh],
          occluded: occluded(el), clipped: clipping(el), fixed: position === 'fixed', sticky: position === 'sticky',
          scroll_container: cssPath(el.closest('[data-scroll-container]') || document.scrollingElement),
        },
        style: {
          font_family: s.fontFamily, font_size: parseFloat(s.fontSize), font_weight: Number(s.fontWeight) || 400,
          line_height: s.lineHeight, letter_spacing: s.letterSpacing, color: s.color,
          effective_bg: hex(bg), contrast_ratio: contrast(fg, bg), direction: s.direction,
          writing_mode: s.writingMode, opacity: Number(s.opacity), transform: s.transform, z_index: s.zIndex,
          background_color: s.backgroundColor, border: s.border, text_transform: s.textTransform,
        },
        access: { path, cost: costs[path], touch_available: path === 'hover' ? false : true },
        confidence: { segmentation: confidence },
        verdict: kind === 'canvas' ? 'UNSCORABLE' : null,
        extraction_kind: kind,
      });
    }

    for (const el of select('[data-audit-atom]')) {
      add(el, 'explicit');
      markCovered(el);
    }

    for (const cell of select('table td')) {
      if (covered.has(cell)) continue;
      const row = cell.closest('tr');
      const table = cell.closest('table');
      const cells = row ? [...row.children] : [];
      const colIndex = cells.indexOf(cell);
      const headerRow = table?.tHead?.rows?.[table.tHead.rows.length - 1];
      const columnHeader = clean(cell.getAttribute('headers') && document.getElementById(cell.getAttribute('headers'))?.textContent)
        || clean(headerRow?.cells?.[colIndex]?.textContent)
        || `Column ${colIndex + 1}`;
      const rowHeader = clean(row?.querySelector('th[scope=row], th')?.textContent) || `Row ${row?.rowIndex ?? 0}`;
      add(cell, 'table-cell', {
        text: `${rowHeader} — ${columnHeader}: ${clean(cell.textContent)}`,
        value: clean(cell.textContent), rowHeader, columnHeader,
        entity: slug(rowHeader), metric: slug(columnHeader), scope: table?.dataset.scope || table?.id || 'table',
      });
      markCovered(cell);
    }

    const controlSelector = 'input, select, textarea, button, [role=button], [role=tab], [role=status], [role=alert]';
    for (const el of select(controlSelector)) {
      if (covered.has(el)) continue;
      add(el, 'control');
      markCovered(el);
    }

    for (const el of select('canvas')) {
      if (!covered.has(el)) add(el, 'canvas', { text: el.getAttribute('aria-label') || 'Canvas region' });
      markCovered(el);
    }

    const genericSelector = 'h1, h2, h3, h4, h5, h6, p, dt, dd, li, figcaption, caption, svg text, [role=heading]';
    for (const el of select(genericSelector)) {
      if (covered.has(el) || [...el.children].some(child => visible(child) && clean(child.textContent))) continue;
      add(el, 'generic');
      markCovered(el);
    }

    return atoms;
  };

  const atoms = await page.evaluate(collect, { runState: stateId });
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  if (!opts['--touch']) {
    const triggers = await page.locator('[data-audit-hover-target], [aria-describedby]').all();
    for (const trigger of triggers) {
      const targetSelector = await trigger.evaluate(el => {
        const declared = el.getAttribute('data-audit-hover-target');
        if (declared) return declared.startsWith('#') || declared.startsWith('.') || declared.startsWith('[') ? declared : `#${CSS.escape(declared)}`;
        const id = el.getAttribute('aria-describedby');
        return id ? `#${CSS.escape(id)}` : null;
      });
      if (!targetSelector) continue;
      await trigger.hover();
      await page.waitForTimeout(30);
      const hoverAtoms = await page.evaluate(collect, { runState: 'hover', accessPath: 'hover', rootSelector: targetSelector });
      atoms.push(...hoverAtoms);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const atom of atoms) {
    const key = `${atom.state_id}|${atom.dom.path}|${atom.text}|${atom.access.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    atom.atom_id = `a${unique.length + 1}`;
    unique.push(atom);
  }

  const pageData = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    dpr: devicePixelRatio,
    direction: getComputedStyle(document.documentElement).direction,
    locale: document.documentElement.lang || navigator.language,
    theme: getComputedStyle(document.documentElement).colorScheme || 'normal',
    body_font: getComputedStyle(document.body).fontFamily,
    user_agent: navigator.userAgent,
  }));
  const anchors = await page.locator('[data-audit-anchor]').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect();
    return { selector: el.id ? `#${CSS.escape(el.id)}` : '[data-audit-anchor]', bbox: [r.x + scrollX, r.y + scrollY, r.width, r.height] };
  }));

  const result = {
    schema_version: 'place-audit-atoms-v1',
    script: { name: 'extract.mjs', version: VERSION },
    manifest: {
      target, viewport: { width, height }, browser_engine: 'chromium', browser_version: browser.version(),
      zoom: 1, animations_frozen: true, animations_existed: animationInfo.existed,
      animation_count_before_freeze: animationInfo.active, touch: Boolean(opts['--touch']),
      state_ids: [...new Set(unique.map(a => a.state_id))], ...pageData,
    },
    task_anchors: anchors,
    atoms: unique,
  };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (outPath) writeFileSync(outPath, json);
  process.stdout.write(json);
  await context.close();
} finally {
  await browser.close();
}
