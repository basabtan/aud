import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { schemaFiles, schemaVersions, validateRecord } from '../shared/validators/schema-registry.mjs';
import { evidenceId, findingId, stableId } from '../shared/validators/stable-ids.mjs';

const fixtureRoot = join('tests', 'fixtures', 'schemas');

for (const name of Object.keys(schemaFiles)) {
  const valid = JSON.parse(readFileSync(join(fixtureRoot, name, 'valid.json'), 'utf8'));
  const before = structuredClone(valid);
  const accepted = validateRecord(valid, name);
  assert.equal(accepted.valid, true, `${name} valid fixture failed:\n${JSON.stringify(accepted.errors, null, 2)}`);
  assert.deepEqual(valid, before, `${name} validation mutated the artifact`);

  const invalid = JSON.parse(readFileSync(join(fixtureRoot, name, 'invalid.json'), 'utf8'));
  const invalidResult = validateRecord(invalid, name);
  assert.equal(invalidResult.valid, false, `${name} invalid fixture passed`);
  assert.ok(invalidResult.errors.length > 0, `${name} invalid fixture produced no actionable errors`);

  const incompatible = structuredClone(valid);
  incompatible.schema_version = `${schemaVersions[name]}-future`;
  const rejected = validateRecord(incompatible, name);
  assert.equal(rejected.valid, false, `${name} accepted an incompatible schema version`);
  assert.equal(rejected.errors[0].code, 'INCOMPATIBLE_SCHEMA_VERSION');
}

const finding = JSON.parse(readFileSync(join(fixtureRoot, 'finding', 'valid.json'), 'utf8'));
finding.severity = { level: 4, rationale: 'Potential data exposure if the finding is true.' };
finding.confidence = { score: 0, basis: 'The risk has not yet been reproduced.' };
finding.native_metrics = { specialist_score: 91, nested: { verdict: 'REVIEW' } };
assert.equal(validateRecord(finding, 'finding').valid, true, 'confidence incorrectly constrained severity or native metrics');
assert.deepEqual(finding.native_metrics, { specialist_score: 91, nested: { verdict: 'REVIEW' } });

const prematurePriority = { ...finding, priority: 'P0' };
assert.equal(validateRecord(prematurePriority, 'finding').valid, false, 'specialist finding assigned synthesis priority');

const duplicateTasks = JSON.parse(readFileSync(join(fixtureRoot, 'task-model', 'valid.json'), 'utf8'));
duplicateTasks.tasks.push(structuredClone(duplicateTasks.tasks[0]));
assert.equal(validateRecord(duplicateTasks, 'task-model').errors.some(error => error.code === 'DUPLICATE_ID'), true);

const identityA = { b: 2, a: 1 };
const identityB = { a: 1, b: 2 };
assert.equal(stableId('TASK', 'model', identityA), stableId('TASK', 'model', identityB), 'object key order changed stable ID');
assert.notEqual(stableId('TASK', 'model-a', identityA), stableId('TASK', 'model-b', identityA), 'namespace did not isolate IDs');
assert.match(findingId(finding), /^F-[A-F0-9]{20}$/);
const evidence = JSON.parse(readFileSync(join(fixtureRoot, 'evidence', 'valid.json'), 'utf8'));
assert.match(evidenceId(evidence), /^EV-[A-F0-9]{20}$/);

const temp = mkdtempSync(join(tmpdir(), 'aud-schema-'));
try {
  const jsonl = join(temp, 'findings.jsonl');
  writeFileSync(jsonl, `${JSON.stringify(finding)}\n${JSON.stringify(finding)}\n`);
  const cli = spawnSync(process.execPath, ['shared/validators/validate.mjs', 'finding', jsonl], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  const output = JSON.parse(cli.stdout);
  assert.equal(output.results.length, 2);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(`PASS — ${Object.keys(schemaFiles).length} schemas, fixtures, versions, semantic checks, and stable IDs validated.`);
