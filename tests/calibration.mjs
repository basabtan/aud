import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compareBaseline, compareDeterministicRuns, evaluateCase } from '../shared/calibration/engine.mjs';
import { acceptBaseline, readSuite, runCalibration, selectCases, writeCalibrationArtifacts } from '../shared/calibration/runner.mjs';
import { validateRecord } from '../shared/validators/schema-registry.mjs';

const suite = readSuite('calibration/corpus/suite.json');
const baseline = JSON.parse(readFileSync('calibration/baselines/accepted.json', 'utf8'));
const evaluator = { name: 'aud-calibration-test', version: '1.0.0', source_revision: 'abcdef1' };
const at = suite.created_at;
const clone = value => structuredClone(value);
const metric = (summary, name) => summary.metrics.find(item => item.name === name);

assert.equal(suite.cases.length, 20, 'canonical corpus must retain all required cases');
assert.equal(selectCases(suite, { tier: 'fast' }).length, 12, 'fast tier changed unexpectedly');
assert.equal(selectCases(suite, { tier: 'full' }).length, 20, 'full tier must cover the complete corpus');
assert.equal(suite.corpus_policy.redistributable, true);
assert.equal(suite.corpus_policy.contains_sensitive_evidence, false);
assert.deepEqual(suite.corpus_policy.application_mutations, []);
for (const phrase of ['major', 'minor', 'cosmetic', 'non-issue', 'ambiguous', 'insufficient', 'duplicate', 'reinforce', 'contradict', 'root cause', 'unrelated', 'blocking', 'ordering', 'partial', 'failed', 'regression', 'resolved', 'stale', 'incompatible', 'degraded']) {
  assert.ok(suite.cases.some(item => item.title.toLowerCase().includes(phrase)), `missing canonical ${phrase} case`);
}

const full = runCalibration({ suite, tier: 'full', baseline, generatedAt: at, evaluator });
assert.equal(full.gates.verdict, 'pass');
assert.equal(full.results.length, 20);
assert.equal(full.gates.baseline_comparison.status, 'compatible');
assert.deepEqual(full.gates.baseline_comparison.new_cases, []);
for (const artifact of [[full.resultSet, 'calibration-result-set'], [full.summary, 'reliability-summary'], [full.gates, 'quality-gate-result']]) {
  assert.equal(validateRecord(artifact[0], artifact[1]).valid, true, `${artifact[1]} did not validate`);
}
for (const result of full.results) assert.equal(validateRecord(result, 'calibration-result').valid, true);
assert.ok(full.results.every(result => result.verdict === 'pass'));
assert.deepEqual(full.results.find(item => item.case_id === 'CALCASE-01-MAJOR').actual_outcome.findings[0].native_metrics, { failed_steps: 1 }, 'specialist native metrics were not preserved');
assert.equal(full.results.find(item => item.case_id === 'CALCASE-20-DEGRADED').actual_outcome.authority_checks.verify_no_fix_implementation, true);
for (const name of ['finding_precision', 'finding_recall', 'false_positive_rate', 'false_negative_rate', 'severity_agreement', 'confidence_calibration', 'duplicate_clustering_precision', 'duplicate_clustering_recall', 'contradiction_detection_accuracy', 'relationship_accuracy', 'root_cause_accuracy', 'priority_agreement', 'remediation_order_validity', 'verification_outcome_accuracy', 'regression_detection_accuracy', 'lifecycle_transition_legality', 'deterministic_rerun_agreement', 'schema_validity', 'provenance_completeness']) {
  assert.ok(metric(full.summary, name), `missing reliability metric ${name}`);
}
assert.equal(metric(full.summary, 'confidence_calibration').status, 'measured');
assert.equal(metric(full.summary, 'confidence_calibration').bins.length, 3);
for (const name of ['duplicate_clustering_precision', 'duplicate_clustering_recall', 'contradiction_detection_accuracy', 'root_cause_accuracy', 'priority_agreement', 'remediation_order_validity', 'verification_outcome_accuracy', 'regression_detection_accuracy']) assert.equal(metric(full.summary, name).value, 1, name);
for (const name of ['critical_false_negatives', 'mutation_violations', 'unstable_stable_ids', 'verified_without_evidence', 'fabricated_results']) assert.equal(metric(full.summary, name).value, 0, name);
assert.ok(full.summary.specialist_results.every(item => item.finding_precision !== null && item.finding_recall !== null), 'specialist precision/recall must be reported');
assert.match(full.calibrationReport, /False positives: 0; false negatives: 0/);
assert.match(full.calibrationReport, /Specialist results/);
assert.match(full.driftReport, /Baseline status: \*\*compatible\*\*/);

const major = clone(suite.cases[0]);
const timestampOnly = compareDeterministicRuns([
  { output: { id: 'F-STABLE', generated_at: '2026-01-01T00:00:00Z', nested: { captured_at: '2026-01-01T00:00:00Z' } } },
  { output: { id: 'F-STABLE', generated_at: '2026-02-01T00:00:00Z', nested: { captured_at: '2026-02-01T00:00:00Z' } } },
]);
assert.equal(timestampOnly.agreement, 1, 'runtime timestamps should not cause drift');
const changedId = compareDeterministicRuns([{ output: { findings: [{ id: 'F-A' }] } }, { output: { findings: [{ id: 'F-B' }] } }]);
assert.equal(changedId.agreement, 0);
assert.deepEqual(changedId.unstable_fields, ['/findings/0/id']);

major.observed_runs[0].output.findings[0].severity = 2;
const badBounds = evaluateCase(suite, major, evaluator, at);
assert.equal(badBounds.checks.find(item => item.dimension.endsWith(':severity')).status, 'fail');
assert.equal(badBounds.checks.find(item => item.dimension === 'bounded:/findings/0/severity').status, 'fail');
assert.equal(badBounds.verdict, 'fail');
major.observed_runs[0].output.findings[0].confidence = 0.99;
major.observed_runs[0].output.findings[0].evidence_sufficient = false;
const badConfidence = evaluateCase(suite, major, evaluator, at);
assert.equal(badConfidence.checks.find(item => item.dimension.endsWith(':confidence')).status, 'pass');
assert.equal(badConfidence.checks.find(item => item.dimension.endsWith(':evidence')).status, 'fail');

const oneCase = runCalibration({ suite, caseIds: ['CALCASE-01-MAJOR'], generatedAt: at, evaluator });
assert.equal(oneCase.summary.tier, 'selected');
assert.equal(metric(oneCase.summary, 'confidence_calibration').status, 'insufficient_sample');
assert.equal(metric(oneCase.summary, 'duplicate_clustering_precision').status, 'not_applicable');
assert.throws(() => selectCases(suite, { caseIds: ['CALCASE-NOT-REAL'] }), /UNKNOWN_CALIBRATION_CASE/);

const mutationSuite = clone(suite);
mutationSuite.cases.at(-1).observed_runs[0].output.mutations = ['src/application.js'];
const mutationRun = runCalibration({ suite: mutationSuite, tier: 'full', generatedAt: at, evaluator });
assert.equal(metric(mutationRun.summary, 'mutation_violations').value, 1);
assert.equal(mutationRun.gates.verdict, 'fail');
assert.ok(mutationRun.gates.hard_failures.some(item => item.metric === 'mutation_violations'));

const unstableSuite = clone(suite);
unstableSuite.cases[0].observed_runs[1] = { run_label: 'run-2', generated_at: '2026-09-04T00:01:00Z', output: clone(unstableSuite.cases[0].observed_runs[0].output) };
unstableSuite.cases[0].observed_runs[1].output.findings[0].id = 'F-CAL-UNSTABLE';
const unstableRun = runCalibration({ suite: unstableSuite, tier: 'full', generatedAt: at, evaluator });
assert.equal(metric(unstableRun.summary, 'unstable_stable_ids').value, 1);
assert.ok(unstableRun.gates.hard_failures.some(item => item.metric === 'unstable_stable_ids'));
assert.ok(unstableRun.summary.system_results.unstable_fields.includes('/findings/0/id'));

const schemaFailureSuite = clone(suite);
schemaFailureSuite.cases[0].observed_runs[0].output.schema_valid = false;
const schemaFailure = runCalibration({ suite: schemaFailureSuite, tier: 'full', generatedAt: at, evaluator });
assert.ok(schemaFailure.gates.hard_failures.some(item => item.metric === 'schema_validity'));

const warningSuite = clone(suite);
warningSuite.cases[3].observed_runs[0].output.findings.push({ issue_id: 'intentional-plain-style', id: 'F-FALSE-POSITIVE', specialist: 'visual-audit', affected_area: 'decoration', severity: 1, confidence: 0.9, evidence_sufficient: true });
const warningRun = runCalibration({ suite: warningSuite, tier: 'full', generatedAt: at, evaluator });
assert.equal(warningRun.gates.verdict, 'pass', 'warning gates must not masquerade as hard failures');
assert.ok(warningRun.gates.warnings.some(item => item.metric === 'false_positive_rate'));
assert.equal(metric(warningRun.summary, 'finding_recall').value, 1);
assert.ok(metric(warningRun.summary, 'finding_precision').value < 1);

const severitySuite = clone(suite);
severitySuite.cases[0].observed_runs[0].output.findings[0].severity = 2;
const severityRun = runCalibration({ suite: severitySuite, tier: 'full', generatedAt: at, evaluator });
assert.ok(metric(severityRun.summary, 'severity_agreement').value < 1);
assert.ok(severityRun.gates.warnings.some(item => item.metric === 'severity_agreement'));

const worseSummary = clone(full.summary);
metric(worseSummary, 'finding_precision').value = 0.5;
const drift = compareBaseline(worseSummary, suite, baseline);
assert.ok(drift.regressions.some(item => item.startsWith('finding_precision:')));
const betterBaseline = clone(baseline);
betterBaseline.metrics.find(item => item.name === 'finding_precision').value = 0.5;
assert.ok(compareBaseline(full.summary, suite, betterBaseline).improvements.some(item => item.startsWith('finding_precision:')));
const incompatibleBaseline = clone(baseline);
incompatibleBaseline.cases[0].case_version = '2.0.0';
assert.equal(compareBaseline(full.summary, suite, incompatibleBaseline).status, 'incompatible');

const temp = mkdtempSync(join(tmpdir(), 'aud-calibration-test-'));
try {
  const posixStyle = join(temp, 'posix', 'style');
  const windowsStyle = `${temp}\\windows\\style`;
  writeCalibrationArtifacts(posixStyle, full);
  writeCalibrationArtifacts(windowsStyle, full);
  for (const directory of [posixStyle, windowsStyle]) {
    for (const file of ['calibration-results.json', 'reliability-summary.json', 'quality-gate-result.json', 'calibration-report.md', 'drift-report.md']) assert.equal(existsSync(join(directory, file)), true, `${directory} missing ${file}`);
  }
  const target = join(temp, 'accepted.json');
  assert.throws(() => acceptBaseline({ path: target, suite, run: full, rationale: '', evaluator, acceptedAt: at }), /BASELINE_RATIONALE_REQUIRED/);
  acceptBaseline({ path: target, suite, run: full, rationale: 'Reviewed test baseline.', evaluator, acceptedAt: at });
  assert.equal(validateRecord(JSON.parse(readFileSync(target, 'utf8')), 'calibration-baseline').valid, true);
  const changedPolicy = clone(suite);
  changedPolicy.quality_gates.hard[0].value = 0.99;
  assert.throws(() => acceptBaseline({ path: target, suite: changedPolicy, run: full, rationale: 'Reviewed policy change.', evaluator, acceptedAt: at }), /POLICY_CHANGE_APPROVAL_REQUIRED/);
  acceptBaseline({ path: target, suite: changedPolicy, run: full, rationale: 'Explicitly reviewed test-only threshold change.', evaluator, acceptedAt: at, approvePolicyChanges: true });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

const cli = spawnSync(process.execPath, ['shared/calibration/cli.mjs', '--suite', 'calibration/corpus/suite.json', '--tier', 'fast', '--baseline', 'calibration/baselines/accepted.json', '--check'], { encoding: 'utf8' });
assert.equal(cli.status, 0, cli.stderr || cli.stdout);
assert.equal(JSON.parse(cli.stdout).cases, 12);

console.log('PASS — Phase 6 corpus, metrics, consistency, drift, gates, mutation boundaries, CLI, paths, and reports validated.');
