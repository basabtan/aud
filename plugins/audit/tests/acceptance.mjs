#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = join(plugin, 'skills', 'audit');

for (const path of [
  join(plugin, '.claude-plugin', 'plugin.json'),
  join(skill, 'SKILL.md'),
  join(skill, 'references', 'drivers.md'),
  join(skill, 'references', 'playwright.md'),
  join(skill, 'references', 'report-template.md'),
  join(skill, 'references', 'ux-heuristics.md'),
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

console.log('PASS — functional audit core is portable, report-only in pipelines, and placeholder-free.');
