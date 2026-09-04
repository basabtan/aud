#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = join(plugin, 'skills', 'visual-audit');
const inventory = join(skill, 'scripts', 'inventory.mjs');

for (const path of [
  join(plugin, '.claude-plugin', 'plugin.json'),
  join(skill, 'SKILL.md'),
  join(skill, 'references', 'capture.md'),
  join(skill, 'references', 'review-zones.md'),
  inventory,
]) assert.ok(existsSync(path), `missing ${path}`);

assert.equal(JSON.parse(readFileSync(join(plugin, '.claude-plugin', 'plugin.json'), 'utf8')).name, 'visual-audit');
const instructions = readFileSync(join(skill, 'SKILL.md'), 'utf8');
for (const phrase of [
  'A plain table is not automatically basic',
  'Look at the screenshots yourself, at three distances',
  '<application-root>/audits/YYYY-MM-DD-visual/',
  'Pipeline mode is report-only',
]) assert.ok(instructions.includes(phrase), `missing visual guardrail: ${phrase}`);

const syntax = spawnSync(process.execPath, ['--check', inventory], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

console.log('PASS — visual-audit topology, guardrails, and inventory script validated.');
