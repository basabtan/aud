#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, '..');
const skill = join(plugin, 'skills', 'flow-audit');
const fixture = join(plugin, 'fixtures', 'journey-model.json');
const analysisPath = join(plugin, 'fixtures', 'graph-analysis.json');

const results = [];
function test(number, name, fn) {
  try {
    fn();
    results.push({ number, name, status: 'PASS' });
    console.log(`PASS ${number} — ${name}`);
  } catch (error) {
    results.push({ number, name, status: 'FAIL' });
    console.error(`FAIL ${number} — ${name}\n${error.stack}`);
  }
}

test(1, 'plugin topology and manifest are complete', () => {
  for (const path of [
    join(plugin, '.claude-plugin', 'plugin.json'),
    join(skill, 'SKILL.md'),
    join(skill, 'references', 'flow-model.md'),
    join(skill, 'references', 'observation.md'),
    join(skill, 'references', 'scoring.md'),
    join(skill, 'references', 'report-template.md'),
    join(skill, 'scripts', 'validate-flow.mjs'),
  ]) assert.ok(existsSync(path), `missing ${path}`);
  assert.equal(JSON.parse(readFileSync(join(plugin, '.claude-plugin', 'plugin.json'), 'utf8')).name, 'flow-audit');
});

test(2, 'skill preserves audit boundaries and design stop condition', () => {
  const text = readFileSync(join(skill, 'SKILL.md'), 'utf8');
  for (const phrase of [
    'Treat the current UI as evidence, not as the workflow',
    'Do not equate efficiency with click count',
    'Never silently override',
    'Do **not** specify cards, tabs, rails',
    'content-audit → place-audit → flow-audit → first-principles redesign',
  ]) assert.ok(text.includes(phrase), `missing guardrail: ${phrase}`);
});

if (existsSync(analysisPath)) rmSync(analysisPath);
const validation = spawnSync(process.execPath, [join(skill, 'scripts', 'validate-flow.mjs'), fixture, '--out', analysisPath], {
  cwd: plugin,
  encoding: 'utf8',
});

test(3, 'fixture graph validates deterministically', () => {
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  assert.ok(existsSync(analysisPath), 'analysis file missing');
  const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
  assert.equal(analysis.valid, true);
  assert.equal(analysis.summary.nodes, 6);
  assert.equal(analysis.summary.scenarios, 4);
  assert.equal(analysis.summary.errors, 0);
});

test(4, 'validator exposes cycles and structural review prompts', () => {
  const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
  assert.ok(analysis.summary.cycles >= 1, 'expected return cycle to be surfaced');
  assert.ok(analysis.issues.some(issue => issue.code === 'CYCLE_TO_REVIEW'));
});

test(5, 'fixture covers required variants and full node record', () => {
  const model = JSON.parse(readFileSync(fixture, 'utf8'));
  const variants = new Set(model.scenarios.map(scenario => scenario.variant));
  for (const variant of ['novice', 'expert', 'sparse', 'mature']) assert.ok(variants.has(variant), `missing ${variant}`);
  const required = ['stage', 'userQuestion', 'userAction', 'systemResponse', 'resultingState', 'contextRetained', 'contextLost', 'nextLikelyQuestion', 'branchingChoices', 'returnPath', 'interactionCost', 'cognitiveCost', 'failureRisk'];
  for (const node of model.nodes) for (const field of required) assert.ok(field in node, `${node.id} missing ${field}`);
});

test(6, 'report contract contains every required audit section', () => {
  const template = readFileSync(join(skill, 'references', 'report-template.md'), 'utf8');
  for (const heading of [
    '## 2. Intended reader goals',
    '## 3. Current observed journeys',
    '## 5. Friction findings',
    '## 6. Representation-transition analysis',
    '## 8. Novice vs expert flow',
    '## 9. Sparse vs mature topic behavior',
    '## 10. Conflicts with upstream audits',
    '## 11. Recommended logical flow contract',
  ]) assert.ok(template.includes(heading), `missing heading ${heading}`);
});

const failed = results.filter(result => result.status === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} acceptance tests passed.`);
if (failed.length) process.exit(1);
