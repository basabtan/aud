#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, '..');
const scripts = join(plugin, 'skills', 'place-audit', 'scripts');
const fixture = join(plugin, 'fixtures', 'dark-dashboard.html');
const runDir = join(plugin, 'fixtures', 'run');
const atomsPath = join(runDir, 'atoms.json');
const screenshotPath = join(runDir, 'fixture.png');
const prominencePath = join(runDir, 'prominence.json');
const canonicalPath = join(runDir, 'canonical.json');
const overlayPath = join(runDir, 'overlay-initial.png');
const overlayHoverPath = join(runDir, 'overlay-hover.png');
const debuggerPath = join(runDir, 'debugger.html');
const reportPath = join(runDir, 'REPORT.md');

mkdirSync(runDir, { recursive: true });
for (const path of [atomsPath, screenshotPath, prominencePath, canonicalPath, overlayPath, overlayHoverPath, debuggerPath]) {
  if (existsSync(path)) rmSync(path);
}

function run(script, args) {
  const proc = spawnSync(process.execPath, [join(scripts, script), ...args], {
    cwd: resolve(plugin, '..', '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env },
  });
  assert.equal(proc.status, 0, `${script} exited ${proc.status}\nSTDOUT:\n${proc.stdout}\nSTDERR:\n${proc.stderr}`);
}

const results = [];
function test(number, name, fn) {
  try {
    fn();
    results.push({ number, name, status: 'PASS' });
    console.log(`PASS ${number} — ${name}`);
  } catch (error) {
    results.push({ number, name, status: 'FAIL', error: error.stack });
    console.error(`FAIL ${number} — ${name}\n${error.stack}`);
  }
}

test(1, 'fixture contains every required state and content class', () => {
  const html = readFileSync(fixture, 'utf8');
  for (const marker of ['primary-kpi-row', '<table', 'role="tooltip"', 'below-fold', 'duplicate-revenue', 'arabic-block']) {
    assert.ok(html.includes(marker), `fixture missing ${marker}`);
  }
});

run('extract.mjs', [fixture, '--out', atomsPath, '--screenshot', screenshotPath, '--viewport', '1440x900']);
const extracted = JSON.parse(readFileSync(atomsPath, 'utf8'));

test(2, 'extraction merges pairs, binds table headers, captures hover, and resolves RTL', () => {
  const atoms = extracted.atoms;
  const initialRevenue = atoms.find(a => a.semantic.metric === 'revenue' && a.region === 'primary-kpi-row');
  assert.ok(initialRevenue, 'merged Revenue KPI missing');
  assert.match(initialRevenue.text, /Revenue.*\$4\.2M.*Current month/i);
  assert.ok(!atoms.some(a => a.text === 'Revenue'), 'label was emitted as a standalone atom');
  const tableAtom = atoms.find(a => a.semantic.row_header === 'Line 4' && a.semantic.column_header === 'OEE');
  assert.ok(tableAtom, 'table atom lacks row + column header identity');
  assert.match(tableAtom.text, /Line 4.*OEE.*84\.3%/);
  const tooltip = atoms.find(a => a.dom.aria_role === 'tooltip');
  assert.equal(tooltip?.access.path, 'hover');
  const arabic = atoms.find(a => a.dom.selector.includes('arabic'));
  assert.equal(arabic?.style.direction, 'rtl');
});

run('prominence.mjs', [atomsPath, '--out', prominencePath]);
const prominence = JSON.parse(readFileSync(prominencePath, 'utf8'));

test(3, 'below-fold and hover atoms have lower effective prominence than visible KPIs', () => {
  const visibleKpis = prominence.atoms.filter(a => a.region === 'primary-kpi-row' && a.access.path === 'visible');
  assert.ok(visibleKpis.length >= 4, 'visible KPI set incomplete');
  const kpiAverage = visibleKpis.reduce((sum, a) => sum + a.prominence.P_effective, 0) / visibleKpis.length;
  const below = prominence.atoms.find(a => a.region === 'below-fold' && a.semantic.metric === 'revenue');
  const hover = prominence.atoms.find(a => a.dom.aria_role === 'tooltip');
  assert.ok(below && hover, 'below-fold or hover atom missing');
  assert.ok(kpiAverage - below.prominence.P_effective >= 5, `below-fold gap too small: KPI ${kpiAverage}, below ${below.prominence.P_effective}`);
  assert.ok(kpiAverage - hover.prominence.P_effective >= 5, `hover gap too small: KPI ${kpiAverage}, hover ${hover.prominence.P_effective}`);
});

run('canonical.mjs', [atomsPath, '--out', canonicalPath]);
const canonical = JSON.parse(readFileSync(canonicalPath, 'utf8'));

test(4, 'canonical duplicate logic distinguishes semantic identity from value equality', () => {
  const revenue = canonical.atoms.filter(a => a.semantic.metric === 'revenue');
  assert.equal(revenue.length, 2, 'expected exactly two revenue atoms');
  assert.ok(revenue.every(a => a.duplicate.candidate), 'duplicated revenue was not flagged');
  assert.ok(revenue.every(a => a.duplicate.class === 'LIKELY_REDUNDANT'), 'duplicated revenue classification unexpected');
  const orders = canonical.atoms.find(a => a.semantic.metric === 'orders');
  const returns = canonical.atoms.find(a => a.semantic.metric === 'returns');
  assert.equal(orders.canonical.value.normalized, returns.canonical.value.normalized, 'fixture values should match');
  assert.equal(orders.duplicate.candidate, false, 'orders falsely marked duplicate');
  assert.equal(returns.duplicate.candidate, false, 'returns falsely marked duplicate');
});

run('annotate.mjs', ['--image', screenshotPath, '--atoms', canonicalPath, '--out', overlayPath, '--state', 'initial', '--html', debuggerPath]);
run('annotate.mjs', ['--image', screenshotPath, '--atoms', canonicalPath, '--out', overlayHoverPath, '--state', 'hover']);

test(5, 'annotator writes a non-empty PNG overlay with bounding boxes', () => {
  assert.ok(existsSync(overlayPath), 'overlay PNG missing');
  const bytes = readFileSync(overlayPath);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(statSync(overlayPath).size > 10_000, 'overlay PNG unexpectedly small');
  const debuggerHtml = readFileSync(debuggerPath, 'utf8');
  assert.match(debuggerHtml, /id="inspector"/);
  assert.match(debuggerHtml, /data-atom=/);
  assert.match(debuggerHtml, /Inspect a1:/);
});

test(6, 'dry-run report matches the template, includes §17, and gates low confidence to REVIEW', () => {
  assert.ok(existsSync(reportPath), 'dry-run REPORT.md missing');
  const report = readFileSync(reportPath, 'utf8');
  for (const heading of ['# Place audit —', '## Run manifest', '## Declared task model', '## Blind demand protocol', '## Calibration', '## Findings', '## Placement candidates', '## Annotated states', '## Blind-spot checklist', '## Verification status', '## Files']) {
    assert.ok(report.includes(heading), `template heading missing: ${heading}`);
  }
  for (let i = 1; i <= 18; i++) assert.match(report, new RegExp(`\\|\\s*${i}\\s*\\|[^\\n]+\\|\\s*(CHECKED|DEFERRED)`), `blind-spot row ${i} not completed`);
  const low = canonical.atoms.filter(a => (a.confidence?.segmentation ?? 1) < 0.70);
  assert.ok(low.length > 0, 'fixture should contain a low-confidence atom');
  for (const atom of low) {
    const row = report.split('\n').find(line => line.includes(`\`${atom.atom_id}\``));
    assert.ok(row, `report row missing low-confidence atom ${atom.atom_id}`);
    assert.match(row, /\|\s*REVIEW(?:\s|\|)/, `low-confidence atom ${atom.atom_id} was not REVIEW`);
  }
});

const failed = results.filter(r => r.status === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} acceptance tests passed.`);
if (failed.length) process.exit(1);
