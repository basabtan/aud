#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = join(plugin, 'skills', 'content-audit');

for (const path of [
  join(plugin, '.claude-plugin', 'plugin.json'),
  join(skill, 'SKILL.md'),
  join(skill, 'references', 'report-template.md'),
  join(skill, 'references', 'rubric.md'),
  join(skill, 'references', 'view-contracts.md'),
  join(skill, 'scripts', 'emit-structured.mjs'),
]) assert.ok(existsSync(path), `missing ${path}`);

assert.equal(JSON.parse(readFileSync(join(plugin, '.claude-plugin', 'plugin.json'), 'utf8')).name, 'content-audit');
const instructions = readFileSync(join(skill, 'SKILL.md'), 'utf8');
for (const phrase of [
  'narrow question of WHAT information should exist and WHEN it should appear',
  'Where should the approved information live',
  'Has the visual treatment been deliberately designed',
  'Does the implementation work correctly',
  '<application-root>/audits/YYYY-MM-DD-content/',
]) assert.ok(instructions.includes(phrase), `missing content boundary: ${phrase}`);

const template = readFileSync(join(skill, 'references', 'report-template.md'), 'utf8');
for (const heading of [
  '## 1. Scope and confidence',
  '## 3. Content-block inventory',
  '## 5. Duplication clusters',
  '## 6. View contracts',
  '## 12. Surviving content contract',
]) assert.ok(template.includes(heading), `missing report section: ${heading}`);

for (const phrase of ['content-contract.json', 'findings.jsonl', 'project-context.json', 'task-model.json', 'CONTENT-*']) {
  assert.ok(instructions.includes(phrase), `missing structured-output rule: ${phrase}`);
}

console.log('PASS — content-audit topology, boundaries, and report contract validated.');
