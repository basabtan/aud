import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeAtomic, writeJsonAtomic } from '../orchestration/persistence.mjs';
import { assertValidRecord } from '../validators/schema-registry.mjs';
import { stableId } from '../validators/stable-ids.mjs';
import { assertBaselineAcceptanceAllowed, buildReliabilitySummary, evaluateCase, evaluateQualityGates, expectationsHash, thresholdsHash } from './engine.mjs';
import { renderCalibrationReport, renderDriftReport } from './reports.mjs';

export function readSuite(path) { const suite = JSON.parse(readFileSync(resolve(path), 'utf8')); assertValidRecord(suite, 'calibration-suite'); return suite; }
export function selectCases(suite, { tier = 'full', caseIds = [] } = {}) {
  const selected = caseIds.length ? suite.cases.filter(item => caseIds.includes(item.case_id)) : suite.cases.filter(item => item.tiers.includes(tier));
  const unknown = caseIds.filter(id => !suite.cases.some(item => item.case_id === id)); if (unknown.length) throw new Error(`UNKNOWN_CALIBRATION_CASE: ${unknown.join(', ')}`);
  return selected.sort((a, b) => a.case_id.localeCompare(b.case_id));
}
export function runCalibration({ suite, tier = 'full', caseIds = [], baseline = null, generatedAt = new Date().toISOString(), evaluator }) {
  assertValidRecord(suite, 'calibration-suite'); if (baseline) assertValidRecord(baseline, 'calibration-baseline'); const cases = selectCases(suite, { tier, caseIds }); if (!cases.length) throw new Error('NO_CALIBRATION_CASES_SELECTED');
  const actualTier = caseIds.length ? 'selected' : tier; const results = cases.map(item => evaluateCase(suite, item, evaluator, generatedAt));
  const summary = buildReliabilitySummary(suite, cases, results, actualTier, evaluator, generatedAt); const gates = evaluateQualityGates(suite, summary, baseline, evaluator, generatedAt);
  const resultSet = { schema_version: 'aud-calibration-result-set-v1', result_set_id: stableId('CALSET', suite.suite_id, { suite_version: suite.suite_version, tier: actualTier, results: results.map(item => item.result_id) }), suite_id: suite.suite_id, suite_version: suite.suite_version, tier: actualTier, generated_at: generatedAt, results };
  assertValidRecord(resultSet, 'calibration-result-set');
  return { cases, results, resultSet, summary, gates, calibrationReport: renderCalibrationReport(summary, gates, results), driftReport: renderDriftReport(gates) };
}
export function writeCalibrationArtifacts(outputDirectory, run) {
  const target = resolve(outputDirectory); assertValidRecord(run.resultSet, 'calibration-result-set'); assertValidRecord(run.summary, 'reliability-summary'); assertValidRecord(run.gates, 'quality-gate-result');
  writeJsonAtomic(join(target, 'calibration-results.json'), run.resultSet);
  writeJsonAtomic(join(target, 'reliability-summary.json'), run.summary); writeJsonAtomic(join(target, 'quality-gate-result.json'), run.gates);
  writeAtomic(join(target, 'calibration-report.md'), run.calibrationReport); writeAtomic(join(target, 'drift-report.md'), run.driftReport); return target;
}
export function acceptBaseline({ path, suite, run, rationale, evaluator, acceptedAt, approvePolicyChanges = false }) {
  const target = resolve(path); const existing = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : null;
  assertBaselineAcceptanceAllowed(suite, existing, rationale, approvePolicyChanges);
  const baseline = { schema_version: 'aud-calibration-baseline-v1', baseline_id: `BASELINE-${run.summary.summary_id}`, suite_id: suite.suite_id, suite_version: suite.suite_version, accepted_at: acceptedAt, rationale, evaluator, threshold_hash: thresholdsHash(suite), expectations_hash: expectationsHash(suite), cases: run.summary.cases, case_ids: run.cases.map(item => item.case_id), metrics: run.summary.metrics.map(item => ({ name: item.name, status: item.status, value: item.value })) };
  assertValidRecord(baseline, 'calibration-baseline');
  writeJsonAtomic(target, baseline); return baseline;
}
