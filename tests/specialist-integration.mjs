import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateRecord } from '../shared/validators/schema-registry.mjs';

const root = resolve('.');
const fixtures = join(root, 'tests', 'fixtures', 'integration');
const manifest = join(fixtures, 'run-manifest.json');
const project = join(fixtures, 'project-context.json');
const task = join(fixtures, 'task-model.json');
const remediation = join(fixtures, 'remediation-plan.json');
const temp = mkdtempSync(join(tmpdir(), 'aud-phase2-'));

const scripts = {
  content: join(root, 'plugins', 'content-audit', 'skills', 'content-audit', 'scripts', 'emit-structured.mjs'),
  place: join(root, 'plugins', 'place-audit', 'skills', 'place-audit', 'scripts', 'emit-structured.mjs'),
  placeFilter: join(root, 'plugins', 'place-audit', 'skills', 'place-audit', 'scripts', 'filter-applicable.mjs'),
  flow: join(root, 'plugins', 'flow-audit', 'skills', 'flow-audit', 'scripts', 'emit-structured.mjs'),
  visual: join(root, 'plugins', 'visual-audit', 'skills', 'visual-audit', 'scripts', 'emit-structured.mjs'),
  functional: join(root, 'plugins', 'functional-audit', 'skills', 'functional-audit', 'scripts', 'emit-structured.mjs'),
};

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${script}\n${result.stderr}\n${result.stdout}`);
  return result;
}

function runFailure(script, args, pattern) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1, `expected ${script} to reject the input`);
  assert.match(result.stderr, pattern);
}

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function jsonl(path) {
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function materialize(source, output, replacements) {
  let text = readFileSync(source, 'utf8');
  for (const [token, value] of Object.entries(replacements)) text = text.replaceAll(token, value);
  writeFileSync(output, text, 'utf8');
}

function commonArgs(input, out) {
  return ['--manifest', manifest, '--project-context', project, '--task-model', task, '--input', input, '--out', out];
}

function verifySpecialistOutput(directory, sourceAudit) {
  const evidence = jsonl(join(directory, 'evidence.jsonl'));
  const findings = jsonl(join(directory, 'findings.jsonl'));
  const evidenceIds = new Set(evidence.map(item => item.id));
  assert.ok(findings.length > 0, `${sourceAudit} emitted no findings`);
  for (const record of evidence) {
    assert.equal(validateRecord(record, 'evidence').valid, true, `${sourceAudit} invalid evidence`);
    assert.equal(record.run_id, 'RUN-2026-09-04-002');
  }
  for (const finding of findings) {
    const result = validateRecord(finding, 'finding');
    assert.equal(result.valid, true, `${sourceAudit}: ${JSON.stringify(result.errors)}`);
    assert.equal(finding.source_audit, sourceAudit);
    assert.equal(finding.run_id, 'RUN-2026-09-04-002');
    assert.ok(finding.locations.length && finding.affected_areas.length);
    assert.ok(finding.recommendation.action && finding.verification_method.length);
    assert.ok(finding.evidence_refs.every(id => evidenceIds.has(id)), `${sourceAudit} references foreign evidence`);
    assert.equal(typeof finding.severity.level, 'number');
    assert.equal(typeof finding.confidence.score, 'number');
    assert.equal(typeof finding.native_metrics, 'object');
  }
  const status = json(join(directory, 'input-status.json'));
  assert.equal(status.manifest_ref, resolve(manifest));
  assert.equal(status.pipeline_report_only, true);
  return { evidence, findings, status };
}

try {
  const contentOut = join(temp, 'content');
  run(scripts.content, commonArgs(join(fixtures, 'content-input.json'), contentOut));
  const content = verifySpecialistOutput(contentOut, 'content-audit');
  const contentContract = json(join(contentOut, 'content-contract.json'));
  assert.equal(validateRecord(contentContract, 'content-contract').valid, true);
  const surviving = contentContract.content_items.find(item => item.decision === 'keep').id;
  const removed = contentContract.content_items.find(item => item.decision === 'remove').id;
  assert.match(surviving, /^CONTENT-[A-F0-9]{20}$/);

  const repeatOut = join(temp, 'content-repeat');
  run(scripts.content, commonArgs(join(fixtures, 'content-input.json'), repeatOut));
  assert.deepEqual(
    json(join(repeatOut, 'content-contract.json')).content_items.map(item => item.id),
    contentContract.content_items.map(item => item.id),
    'content IDs changed for identical project revision and block identity',
  );

  const placeInput = join(temp, 'place-input.json');
  materialize(join(fixtures, 'place-input.json'), placeInput, {
    __SURVIVING_CONTENT_ID__: surviving,
    __REMOVED_CONTENT_ID__: removed,
  });
  const candidateInput = join(temp, 'place-candidates.json');
  const candidateOutput = join(temp, 'place-applicable.json');
  materialize(join(fixtures, 'place-candidates.json'), candidateInput, {
    __SURVIVING_CONTENT_ID__: surviving,
    __REMOVED_CONTENT_ID__: removed,
  });
  run(scripts.placeFilter, ['--content-contract', join(contentOut, 'content-contract.json'), '--input', candidateInput, '--out', candidateOutput]);
  const applicable = json(candidateOutput);
  assert.deepEqual(applicable.included.map(item => item.record_id), ['ATOM-KEEP']);
  assert.deepEqual(applicable.skipped.map(item => item.record_id), ['ATOM-REMOVE']);
  const placeOut = join(temp, 'place');
  run(scripts.place, [...commonArgs(placeInput, placeOut), '--content-contract', join(contentOut, 'content-contract.json')]);
  const place = verifySpecialistOutput(placeOut, 'place-audit');
  assert.equal(place.findings.length, 1, 'place scored content removed upstream');
  assert.equal(place.findings[0].category, 'duplicate_candidate');
  assert.equal(place.findings[0].native_metrics.FIT, -18);
  assert.doesNotMatch(place.findings[0].recommendation.action, /\b(delete|remove)\b/i);
  assert.equal(place.status.skipped_findings[0].reason, 'content_removed_or_merged_upstream');

  const deletingPlaceInput = join(temp, 'place-delete-input.json');
  const deletingPlace = json(placeInput);
  deletingPlace.findings[1].recommendation.action = 'Delete the duplicate immediately.';
  writeFileSync(deletingPlaceInput, `${JSON.stringify(deletingPlace, null, 2)}\n`, 'utf8');
  runFailure(scripts.place, [...commonArgs(deletingPlaceInput, join(temp, 'place-invalid')), '--content-contract', join(contentOut, 'content-contract.json')], /BOUNDARY_VIOLATION/);

  const degradedOut = join(temp, 'place-degraded');
  run(scripts.place, commonArgs(placeInput, degradedOut));
  const degraded = json(join(degradedOut, 'input-status.json'));
  assert.equal(degraded.degraded, true);
  assert.ok(degraded.inputs.some(item => item.kind === 'content-contract' && item.state === 'missing'));

  const flowInput = join(temp, 'flow-input.json');
  materialize(join(fixtures, 'flow-input.json'), flowInput, { __SURVIVING_CONTENT_ID__: surviving });
  const flowOut = join(temp, 'flow');
  run(scripts.flow, [...commonArgs(flowInput, flowOut), '--content-contract', join(contentOut, 'content-contract.json')]);
  const flow = verifySpecialistOutput(flowOut, 'flow-audit');
  const flowContract = json(join(flowOut, 'flow-contract.json'));
  const flowValidation = validateRecord(flowContract, 'flow-contract');
  assert.equal(flowValidation.valid, true, JSON.stringify(flowValidation.errors));
  assert.deepEqual(flowContract.content_refs, [surviving]);
  assert.equal(flowContract.recommendations[0].status, 'accepted');
  assert.ok(flowContract.recommendations[0].acceptance_criteria.length > 0);
  assert.ok(flowContract.recommendations[0].verification_methods.length > 0);

  const visualOut = join(temp, 'visual');
  run(scripts.visual, commonArgs(join(fixtures, 'visual-input.json'), visualOut));
  const visual = verifySpecialistOutput(visualOut, 'visual-audit');
  assert.equal(visual.findings[0].native_metrics.visual_tier, 1);

  const functionalOut = join(temp, 'functional');
  const functionalInput = join(temp, 'functional-input.json');
  materialize(join(fixtures, 'functional-input.json'), functionalInput, {
    __FLOW_RECOMMENDATION_ID__: flowContract.recommendations[0].id,
  });
  run(scripts.functional, [
    ...commonArgs(functionalInput, functionalOut),
    '--flow-contract', join(flowOut, 'flow-contract.json'),
    '--remediation-plan', remediation,
  ]);
  const functional = verifySpecialistOutput(functionalOut, 'functional-audit');
  assert.equal(functional.status.accepted_flow_contract_items, 1);
  assert.equal(functional.status.remediation_items, 1);
  assert.deepEqual(functional.findings[0].native_metrics.contract_refs, [flowContract.recommendations[0].id, 'R-CONTEXT-001']);
  assert.match(functional.findings[0].recommendation.action, /accepted/);

  const redesignInput = join(temp, 'functional-redesign-input.json');
  const redesign = json(functionalInput);
  redesign.findings[0].recommendation.action = 'Redesign the journey and restyle the comparison.';
  writeFileSync(redesignInput, `${JSON.stringify(redesign, null, 2)}\n`, 'utf8');
  runFailure(scripts.functional, [
    ...commonArgs(redesignInput, join(temp, 'functional-invalid')),
    '--flow-contract', join(flowOut, 'flow-contract.json'),
    '--remediation-plan', remediation,
  ], /BOUNDARY_VIOLATION/);

  const allStatuses = [content.status, place.status, flow.status, visual.status, functional.status];
  assert.ok(allStatuses.every(item => item.manifest_ref === resolve(manifest)), 'specialists did not reference one manifest');
  console.log('PASS — content→place, content→flow, and flow→functional handoffs emit valid shared artifacts.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
