#!/usr/bin/env node
/** Compute deterministic DOM prominence and access-decayed effective prominence. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const VERSION = '0.1.1';

function parseArgs(argv) {
  const opts = { positionals: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' || argv[i] === '--anchor') opts[argv[i]] = argv[++i];
    else if (argv[i].startsWith('--')) opts[argv[i]] = true;
    else opts.positionals.push(argv[i]);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.positionals[0]) {
  console.error('usage: node prominence.mjs atoms.json [--out prominence.json] [--anchor <atom-id-or-selector>]');
  process.exit(1);
}

const input = JSON.parse(readFileSync(resolve(opts.positionals[0]), 'utf8'));
const atoms = input.atoms ?? [];
if (!atoms.length) throw new Error('No atoms found in input');

const viewport = input.manifest?.viewport ?? { width: 1440, height: 900 };
const diagonal = Math.hypot(viewport.width, viewport.height);
const selectedAnchor = opts['--anchor'];
const anchorAtom = selectedAnchor
  ? atoms.find(a => a.atom_id === selectedAnchor || a.dom?.selector === selectedAnchor)
  : null;
const declaredAnchor = input.task_anchors?.[0];
const anchorBox = anchorAtom?.geometry?.bbox ?? declaredAnchor?.bbox
  ?? [viewport.width / 2, viewport.height / 2, 0, 0];
const anchor = [anchorBox[0] + anchorBox[2] / 2, anchorBox[1] + anchorBox[3] / 2];

const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const round = value => Math.round(value * 100) / 100;
const center = atom => {
  const b = atom.geometry?.bbox ?? [0, 0, 0, 0];
  return [b[0] + b[2] / 2, b[1] + b[3] / 2];
};
const ranker = values => value => {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length <= 1) return 0.5;
  const below = finite.filter(v => v < value).length;
  const equal = finite.filter(v => v === value).length;
  return clamp((below + Math.max(0, equal - 1) / 2) / (finite.length - 1));
};
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
};
const rgb = value => {
  const hex = String(value ?? '').match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
  const m = String(value ?? '').match(/rgba?\(([^)]+)\)/i);
  return m ? m[1].split(/[\s,]+/).slice(0, 3).map(Number) : [0, 0, 0];
};
const colorDistance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i])) / Math.sqrt(3 * 255 ** 2);

const fontSizes = atoms.map(a => a.style?.font_size ?? 0).filter(v => v > 0);
const pageMedianFont = median(fontSizes) || 16;
const typoRaw = atoms.map(a => Math.log2(Math.max(1, a.style?.font_size ?? pageMedianFont) / pageMedianFont));
const weightRaw = atoms.map(a => a.style?.font_weight ?? 400);
const contrastRaw = atoms.map(a => a.style?.contrast_ratio ?? 1);
const areaRaw = atoms.map(a => Math.log1p((a.geometry?.text_rects ?? []).reduce((sum, r) => sum + r[2] * r[3], 0)
  || (a.geometry?.bbox?.[2] ?? 0) * (a.geometry?.bbox?.[3] ?? 0)));
const typoRank = ranker(typoRaw);
const weightRank = ranker(weightRaw);
const areaRank = ranker(areaRaw);

const regionAtoms = new Map();
for (const atom of atoms) {
  const key = atom.region ?? 'page';
  if (!regionAtoms.has(key)) regionAtoms.set(key, []);
  regionAtoms.get(key).push(atom);
}
const localContrastRanks = new Map();
for (const group of regionAtoms.values()) {
  const r = ranker(group.map(a => a.style?.contrast_ratio ?? 1));
  group.forEach(a => localContrastRanks.set(a.atom_id, r(a.style?.contrast_ratio ?? 1)));
}

const computed = atoms.map((atom, index) => {
  const [x, y] = center(atom);
  const distance = Math.hypot(x - anchor[0], y - anchor[1]);
  const F = Math.exp(-((distance / (0.35 * diagonal)) ** 2));
  const direction = atom.style?.direction ?? 'ltr';
  const writing = atom.style?.writing_mode ?? 'horizontal-tb';
  let reading;
  if (writing.startsWith('vertical')) reading = 1 - clamp(x / viewport.width);
  else if (direction === 'rtl') reading = clamp(x / viewport.width) * 0.55 + (1 - clamp(y / viewport.height)) * 0.45;
  else reading = (1 - clamp(x / viewport.width)) * 0.55 + (1 - clamp(y / viewport.height)) * 0.45;
  const group = regionAtoms.get(atom.region ?? 'page') ?? atoms;
  const regionY = group.map(a => center(a)[1]);
  const localPriority = 1 - ranker(regionY)(y);
  const Q = clamp(0.60 * F + 0.25 * reading + 0.15 * localPriority);

  const T = clamp(0.70 * typoRank(typoRaw[index]) + 0.30 * weightRank(weightRaw[index]));
  const absoluteContrast = clamp(Math.log(Math.max(1, contrastRaw[index])) / Math.log(21));
  const C = clamp(0.50 * absoluteContrast + 0.50 * (localContrastRanks.get(atom.atom_id) ?? 0.5));
  const A = areaRank(areaRaw[index]);

  const peers = group.filter(a => a.atom_id !== atom.atom_id);
  const peerColor = peers.length
    ? `rgb(${[0, 1, 2].map(channel => Math.round(peers.reduce((sum, a) => sum + rgb(a.style?.color)[channel], 0) / peers.length)).join(',')})`
    : atom.style?.color;
  const deltaColor = colorDistance(atom.style?.color, peerColor);
  const role = atom.semantic?.semanticRole ?? [];
  const distinctive = [
    atom.style?.border && !/^0px none/.test(atom.style.border),
    atom.style?.background_color && !/rgba?\(0, 0, 0, 0\)|transparent/.test(atom.style.background_color),
    atom.style?.text_transform === 'uppercase',
    role.some(r => ['kpi', 'status', 'alert', 'selected'].includes(r)),
    atom.geometry?.fixed || atom.geometry?.sticky,
  ].filter(Boolean).length / 5;
  const E = clamp(0.50 * deltaColor + 0.50 * distinctive);

  const tag = atom.dom?.tag ?? '';
  const headingScore = /^h[1-6]$/.test(tag) ? (7 - Number(tag[1])) / 6 : 0;
  const depth = String(atom.dom?.path ?? '').split('>').length;
  const nesting = clamp(1 - (depth - 1) / 8);
  const listPosition = 1 - clamp(index / Math.max(1, atoms.length - 1));
  const sticky = atom.geometry?.fixed || atom.geometry?.sticky ? 1 : 0;
  const H = clamp(0.45 * headingScore + 0.25 * nesting + 0.15 * listPosition + 0.15 * sticky);

  const pDom = 100 * (0.25 * Q + 0.25 * T + 0.20 * C + 0.10 * A + 0.10 * E + 0.10 * H);
  const accessCost = atom.access?.cost;
  const effective = accessCost == null ? 0 : pDom * Math.exp(-0.45 * accessCost);
  return {
    ...atom,
    prominence: {
      components: { Q: round(Q), T: round(T), C: round(C), A: round(A), E: round(E), H: round(H) },
      anchor_distance: round(distance),
      anchor_source: anchorAtom ? `atom:${anchorAtom.atom_id}` : declaredAnchor ? `declared:${declaredAnchor.selector}` : 'viewport-center-fallback',
      P_DOM: round(pDom), P_visual: round(pDom), access_cost: accessCost, P_effective: round(effective),
      static_marker: input.manifest?.animations_existed ? 'UNSCORABLE_STATIC' : null,
    },
  };
});

const effectiveRank = ranker(computed.map(a => a.prominence.P_effective));
computed.forEach(atom => { atom.prominence.percentile_rank = round(effectiveRank(atom.prominence.P_effective) * 100); });

const result = {
  schema_version: 'place-audit-prominence-v1',
  script: { name: 'prominence.mjs', version: VERSION },
  source_schema: input.schema_version,
  formula: 'P_DOM=100*(.25Q+.25T+.20C+.10A+.10E+.10H); P_effective=P_visual*exp(-.45*AccessCost)',
  anchor: { point: anchor, source: computed[0].prominence.anchor_source },
  atoms: computed,
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (opts['--out']) {
  const full = resolve(opts['--out']);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, json);
}
process.stdout.write(json);
