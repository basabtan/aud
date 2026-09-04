#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateRecord } from '../../../shared/validators/schema-registry.mjs';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(plugin, '..', '..');
const skill = join(plugin, 'skills', 'architecture-maintainability-audit');
const emitter = join(skill, 'scripts', 'emit-structured.mjs');
for (const path of [join(plugin, '.claude-plugin', 'plugin.json'), join(skill, 'SKILL.md'), join(skill, 'references', 'boundaries.md'), join(skill, 'references', 'report-template.md'), emitter, join(plugin, 'fixtures', 'input.json')]) assert.ok(readFileSync(path, 'utf8').length > 0, `missing ${path}`);

const instructions = readFileSync(join(skill, 'SKILL.md'), 'utf8');
for (const phrase of ['explicitly asks', 'report-only', 'native_metrics', 'Specialists do not assign synthesis priority', '<application-root>/audits/YYYY-MM-DD-architecture-maintainability/']) assert.ok(instructions.includes(phrase), `missing architecture rule ${phrase}`);
const reportTemplate = readFileSync(join(skill, 'references', 'report-template.md'), 'utf8');
for (const phrase of ['## 2. Structural model', '## 4. Normalized findings', 'severity 0–4', 'confidence 0–1', 'native_metrics', 'report-only']) assert.ok(reportTemplate.includes(phrase), `missing architecture report rule ${phrase}`);
assert.equal(spawnSync(process.execPath, ['--check', emitter], { cwd: root, encoding: 'utf8' }).status, 0, 'architecture emitter has invalid syntax');

const temp = mkdtempSync(join(tmpdir(), 'aud-architecture-'));
try {
  const manifest = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'integration', 'run-manifest.json'), 'utf8'));
  manifest.selected_audits = ['architecture-maintainability-audit'];
  const manifestPath = join(temp, 'run-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const output = join(temp, 'output');
  const args = [emitter, '--manifest', manifestPath, '--project-context', join(root, 'tests', 'fixtures', 'integration', 'project-context.json'), '--input', join(plugin, 'fixtures', 'input.json'), '--out', output];
  const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const findings = readFileSync(join(output, 'findings.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const evidence = readFileSync(join(output, 'evidence.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].source_audit, 'architecture-maintainability-audit');
  assert.equal(findings[0].native_metrics.cycle_length, 2);
  assert.equal(validateRecord(findings[0], 'finding').valid, true);
  assert.ok(evidence.every(item => validateRecord(item, 'evidence').valid));
  assert.ok(evidence.some(item => item.type === 'repository'));
  assert.ok(findings[0].acceptance_criteria.length > 0 && findings[0].verification_method.length > 0);

  const invalid = JSON.parse(readFileSync(join(plugin, 'fixtures', 'input.json'), 'utf8'));
  invalid.findings[0].category = 'security.authorization';
  const invalidPath = join(temp, 'invalid.json');
  writeFileSync(invalidPath, `${JSON.stringify(invalid)}\n`);
  const rejected = spawnSync(process.execPath, [emitter, '--manifest', manifestPath, '--project-context', join(root, 'tests', 'fixtures', 'integration', 'project-context.json'), '--input', invalidPath, '--out', join(temp, 'invalid-output')], { cwd: root, encoding: 'utf8' });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /BOUNDARY_VIOLATION/);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('PASS — architecture-maintainability-audit emits shared evidence/findings and enforces its authority boundary.');
