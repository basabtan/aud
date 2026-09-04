#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = join(plugin, 'skills', 'functional-audit');

for (const path of [
  join(plugin, '.claude-plugin', 'plugin.json'),
  join(skill, 'SKILL.md'),
  join(skill, 'references', 'drivers.md'),
  join(skill, 'references', 'playwright.md'),
  join(skill, 'references', 'report-template.md'),
  join(skill, 'references', 'ux-heuristics.md'),
  join(skill, 'scripts', 'emit-structured.mjs'),
]) assert.ok(existsSync(path), `missing ${path}`);

const portable = [
  join(skill, 'SKILL.md'),
  join(skill, 'references', 'drivers.md'),
  join(skill, 'references', 'playwright.md'),
].map(path => readFileSync(path, 'utf8')).join('\n');
assert.doesNotMatch(portable, new RegExp(['REPLACE', 'THIS', 'FILE'].join(' ')));
assert.doesNotMatch(portable, /\bzeal\b|atlas|ZEAL_TABLES|pg-scratch|netlify/i);
assert.match(portable, /Pipeline mode is report-only/);
assert.match(portable, /project profile/);
assert.match(portable, /flow-contract\.json/);
assert.match(portable, /remediation-plan\.json/);
assert.match(portable, /does not independently redesign|Do not reinterpret/);

assert.equal(JSON.parse(readFileSync(join(plugin, '.claude-plugin', 'plugin.json'), 'utf8')).name, 'functional-audit');

console.log('PASS — functional-audit is portable, contract-aware, report-only in pipelines, and placeholder-free.');
