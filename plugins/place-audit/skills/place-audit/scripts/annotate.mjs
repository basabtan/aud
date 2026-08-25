#!/usr/bin/env node
/** Render a deterministic PNG overlay from an extraction screenshot and atoms. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION = '0.1.0';

async function loadChromium() {
  const roots = [process.cwd(), ...(process.env.PLAYWRIGHT_ROOT ? [process.env.PLAYWRIGHT_ROOT] : [])];
  const pick = mod => mod?.chromium ?? mod?.default?.chromium;
  for (const spec of ['playwright', 'playwright-core']) {
    try { const got = pick(await import(spec)); if (got) return got; } catch { /* continue */ }
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
  const flags = new Set(['--image', '--atoms', '--out', '--state', '--html']);
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (flags.has(argv[i])) opts[argv[i]] = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts['--image'] || !opts['--atoms'] || !opts['--out']) {
  console.error('usage: node annotate.mjs --image page.png --atoms atoms.json --out overlay.png [--state initial] [--html debugger.html]');
  process.exit(1);
}

const imagePath = resolve(opts['--image']);
const atomPath = resolve(opts['--atoms']);
const outPath = resolve(opts['--out']);
const htmlPath = opts['--html'] ? resolve(opts['--html']) : null;
mkdirSync(dirname(outPath), { recursive: true });
if (htmlPath) mkdirSync(dirname(htmlPath), { recursive: true });
const input = JSON.parse(readFileSync(atomPath, 'utf8'));
const state = opts['--state'];
const atoms = (input.atoms ?? []).filter(atom => !state || atom.state_id === state);
const mime = extname(imagePath).toLowerCase() === '.jpg' || extname(imagePath).toLowerCase() === '.jpeg' ? 'image/jpeg' : 'image/png';
const dataUrl = `data:${mime};base64,${readFileSync(imagePath).toString('base64')}`;
const chromium = await loadChromium();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });

try {
  const page = await browser.newPage({ viewport: input.manifest?.viewport ?? { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#05070a}#stage{position:relative;width:max-content;line-height:0}
    #base{display:block}.box{position:absolute;box-sizing:border-box;border:2px solid var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);pointer-events:none}
    .label{position:absolute;left:-2px;top:-19px;min-width:max-content;padding:2px 5px;background:var(--c);color:#05070a;font:700 11px/15px ui-monospace,monospace;letter-spacing:.02em;pointer-events:none}
    .box.near-top .label{top:0}.legend{position:fixed;right:12px;top:12px;z-index:9;padding:8px 10px;border:1px solid #5b6573;background:#10151ddd;color:#fff;font:12px/1.5 system-ui}
    .box{cursor:pointer;padding:0;pointer-events:auto;appearance:none}.box:focus{outline:3px solid #fff;outline-offset:2px}
    #inspector{position:fixed;right:12px;bottom:12px;z-index:10;width:min(520px,calc(100vw - 24px));max-height:45vh;overflow:auto;padding:12px;border:1px solid #789;background:#071019ee;color:#edf5ff;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap}
  </style></head><body><div id="stage"><img id="base" src="${dataUrl}" alt=""><div class="legend">green visible · amber hidden access · magenta low confidence · red duplicate/conflict</div></div><pre id="inspector">Click or focus a box to inspect atom ID, semantic fields, DOM path, and confidence.</pre><script>
    document.addEventListener('click', event => {
      const box = event.target.closest('.box');
      if (box) document.querySelector('#inspector').textContent = JSON.stringify(JSON.parse(box.dataset.atom), null, 2);
    });
    document.addEventListener('focusin', event => {
      const box = event.target.closest('.box');
      if (box) document.querySelector('#inspector').textContent = JSON.stringify(JSON.parse(box.dataset.atom), null, 2);
    });
  </script></body></html>`);
  await page.locator('#base').evaluate(img => img.complete ? true : new Promise(resolve => { img.onload = resolve; }));
  await page.evaluate(items => {
    const stage = document.querySelector('#stage');
    for (const atom of items) {
      const [x, y, width, height] = atom.geometry?.bbox ?? [];
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;
      const duplicate = atom.duplicate?.candidate || atom.verdict === 'CONFLICTING_DUPLICATE';
      const low = (atom.confidence?.segmentation ?? 1) < 0.70;
      const hidden = atom.access?.path && atom.access.path !== 'visible';
      const color = duplicate ? '#ff5c5c' : low ? '#ff58d6' : hidden ? '#ffbf47' : '#3de68b';
      const box = document.createElement('button');
      box.type = 'button';
      box.className = `box${y < 22 ? ' near-top' : ''}`;
      box.style.cssText = `--c:${color};left:${x}px;top:${y}px;width:${Math.max(2, width)}px;height:${Math.max(2, height)}px`;
      box.setAttribute('aria-label', `Inspect ${atom.atom_id}: ${atom.text}`);
      box.dataset.atom = JSON.stringify({
        atom_id: atom.atom_id,
        text: atom.text,
        semantic: atom.semantic,
        dom: atom.dom,
        access: atom.access,
        confidence: atom.confidence,
      });
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = `${atom.atom_id} ${atom.access?.path ?? ''}${low ? ' REVIEW' : ''}`;
      box.append(label);
      stage.append(box);
    }
  }, atoms);
  const imageSize = await page.locator('#base').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight }));
  await page.setViewportSize({ width: Math.max(320, imageSize.width), height: Math.min(Math.max(200, imageSize.height), 1200) });
  if (htmlPath) writeFileSync(htmlPath, await page.content());
  await page.locator('#inspector').evaluate(el => { el.style.display = 'none'; });
  await page.locator('#stage').screenshot({ path: outPath, type: 'png', animations: 'disabled' });
  process.stdout.write(`${JSON.stringify({ schema_version: 'place-audit-annotation-v1', script: { name: 'annotate.mjs', version: VERSION }, output: outPath, debugger: htmlPath, width: imageSize.width, height: imageSize.height, boxes: atoms.length })}\n`);
} finally {
  await browser.close();
}
