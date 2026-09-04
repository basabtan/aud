#!/usr/bin/env node
/** Canonicalize semantic values and emit exact/semantic duplicate candidates. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const VERSION = '0.1.1';

function parseArgs(argv) {
  const opts = { positionals: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') opts[argv[i]] = argv[++i];
    else if (argv[i].startsWith('--')) opts[argv[i]] = true;
    else opts.positionals.push(argv[i]);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.positionals[0]) {
  console.error('usage: node canonical.mjs atoms.json [--out canonical.json]');
  process.exit(1);
}

const source = JSON.parse(readFileSync(resolve(opts.positionals[0]), 'utf8'));
const atoms = structuredClone(source.atoms ?? []);
const text = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const keyPart = value => text(value).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}.:+-]+/gu, '_').replace(/^_+|_+$/g, '') || '_';

function canonicalValue(atom) {
  const semantic = atom.semantic ?? {};
  const raw = text(semantic.raw_value ?? semantic.value);
  if (!raw) return null;
  const compact = raw.replaceAll(',', '').trim();
  const currency = compact.match(/^([$€£]|USD\s*|EUR\s*|GBP\s*)?\s*(-?\d+(?:\.\d+)?)\s*([kmb])?$/i);
  if (currency && (currency[1] || semantic.unit?.toLowerCase().includes('currency'))) {
    const code = currency[1]?.trim() === '$' ? 'USD' : currency[1]?.trim() === '€' ? 'EUR' : currency[1]?.trim() === '£' ? 'GBP'
      : currency[1]?.trim().toUpperCase() || semantic.unit?.split(':').at(-1)?.toUpperCase() || 'UNKNOWN';
    const scale = { k: 1e3, m: 1e6, b: 1e9 }[currency[3]?.toLowerCase()] ?? 1;
    return { kind: 'currency', normalized: Number(currency[2]) * scale, unit: code, key: `currency:${code}/${Number(currency[2]) * scale}` };
  }
  const percent = compact.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    const normalized = Number(percent[1]) / 100;
    return { kind: 'ratio', normalized, unit: 'ratio', key: `ratio/${normalized}` };
  }
  const duration = compact.match(/^(-?\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|min|mins|minute|minutes)$/i);
  if (duration) {
    const hours = /^h|^hour/i.test(duration[2]) ? Number(duration[1]) : Number(duration[1]) / 60;
    return { kind: 'duration', normalized: hours, unit: 'hours', key: `duration/${hours}h` };
  }
  const compactNumber = compact.match(/^(-?\d+(?:\.\d+)?)\s*([kmb])$/i);
  if (compactNumber) {
    const normalized = Number(compactNumber[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[compactNumber[2].toLowerCase()]);
    return { kind: 'number', normalized, unit: semantic.unit ?? null, key: `number/${normalized}` };
  }
  const number = compact.match(/^-?\d+(?:\.\d+)?$/);
  if (number) {
    const normalized = Number(compact);
    return { kind: 'number', normalized, unit: semantic.unit ?? null, key: `number/${normalized}${semantic.unit ? `:${keyPart(semantic.unit)}` : ''}` };
  }
  const date = new Date(raw);
  if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(raw) && Number.isFinite(date.valueOf())) {
    const normalized = date.toISOString();
    return { kind: 'date', normalized, unit: 'iso8601', key: `date/${normalized}` };
  }
  return { kind: 'text', normalized: raw.normalize('NFKC').toLowerCase(), unit: semantic.unit ?? null, key: `text/${keyPart(raw)}` };
}

for (const atom of atoms) {
  const s = atom.semantic ?? {};
  const value = canonicalValue(atom);
  const metric = keyPart(s.metric);
  const context = [s.entity, s.period, s.scope, s.aggregation, value?.unit ?? s.unit].map(keyPart).join('|');
  atom.canonical = {
    metric,
    value,
    context_key: `${metric}|${context}`,
    semantic_key: value ? `${metric}|${context}|${value.key}` : `${metric}|${context}|_`,
  };
  atom.duplicate = { candidate: false, class: null, group_id: null, peers: [] };
}

const eligible = atoms.filter(a => a.canonical.value && a.canonical.metric !== '_');
const byContext = new Map();
for (const atom of eligible) {
  const key = atom.canonical.context_key;
  if (!byContext.has(key)) byContext.set(key, []);
  byContext.get(key).push(atom);
}

const duplicates = [];
let groupIndex = 0;
for (const group of byContext.values()) {
  if (group.length < 2) continue;
  const values = new Map();
  for (const atom of group) {
    const key = atom.canonical.value.key;
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(atom);
  }
  if (values.size > 1) {
    const id = `d${++groupIndex}`;
    const members = group.map(a => a.atom_id);
    for (const atom of group) atom.duplicate = { candidate: true, class: 'CONFLICTING_DUPLICATE', group_id: id, peers: members.filter(x => x !== atom.atom_id) };
    duplicates.push({ group_id: id, class: 'CONFLICTING_DUPLICATE', canonical_context: group[0].canonical.context_key, atom_ids: members, values: [...values.keys()] });
    continue;
  }
  const exact = [...values.values()][0];
  if (exact.length < 2) continue;
  const id = `d${++groupIndex}`;
  const roles = exact.flatMap(a => a.semantic?.semanticRole ?? []);
  const regions = new Set(exact.map(a => a.region));
  const classification = roles.includes('beneficial-context') ? 'BENEFICIAL_CONTEXT'
    : roles.includes('contextual-mirror') || (regions.size > 1 && roles.includes('header')) ? 'SYNCHRONIZED_MIRROR'
      : 'LIKELY_REDUNDANT';
  const members = exact.map(a => a.atom_id);
  for (const atom of exact) atom.duplicate = { candidate: true, class: classification, group_id: id, peers: members.filter(x => x !== atom.atom_id) };
  duplicates.push({ group_id: id, class: classification, canonical_key: exact[0].canonical.semantic_key, atom_ids: members });
}

const result = {
  schema_version: 'place-audit-canonical-v1',
  script: { name: 'canonical.mjs', version: VERSION },
  source_schema: source.schema_version,
  duplicate_rule: 'metric + context + normalized value; raw equality is never sufficient',
  duplicates,
  atoms,
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (opts['--out']) {
  const full = resolve(opts['--out']);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, json);
}
process.stdout.write(json);
