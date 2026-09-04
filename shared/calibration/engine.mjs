import { createHash } from 'node:crypto';
import { assertValidRecord } from '../validators/schema-registry.mjs';
import { canonicalJson, stableId } from '../validators/stable-ids.mjs';

const ignoredRuntimeKeys = new Set(['timestamp', 'generated_at', 'evaluated_at', 'executed_at', 'captured_at', 'started_at', 'finished_at']);
const metricNames = ['finding_precision', 'finding_recall', 'false_positive_rate', 'false_negative_rate', 'severity_agreement', 'confidence_calibration', 'duplicate_clustering_precision', 'duplicate_clustering_recall', 'contradiction_detection_accuracy', 'relationship_accuracy', 'root_cause_accuracy', 'priority_agreement', 'remediation_order_validity', 'verification_outcome_accuracy', 'regression_detection_accuracy', 'lifecycle_transition_legality', 'deterministic_rerun_agreement', 'schema_validity', 'provenance_completeness', 'critical_false_negatives', 'mutation_violations', 'unstable_stable_ids', 'verified_without_evidence', 'fabricated_results'];

function hash(value) { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
function unique(values = []) { return [...new Set(values)].sort(); }
function pairKey(left, right) { return [left, right].sort().join('|'); }
function typedKey(item) { return `${item.source}|${item.target}|${item.type}`; }
function ratio(name, numerator, denominator, rationale, invert = false) {
  if (!denominator) return { name, status: 'not_applicable', value: null, numerator: null, denominator: null, rationale: `${rationale} No applicable observations were present.`, bins: [] };
  const raw = numerator / denominator;
  return { name, status: 'measured', value: Number((invert ? 1 - raw : raw).toFixed(4)), numerator, denominator, rationale, bins: [] };
}

function normalizeRuntime(value) {
  if (Array.isArray(value)) return value.map(normalizeRuntime);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !ignoredRuntimeKeys.has(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalizeRuntime(child)]));
  return value;
}

function diffFields(left, right, path = '') {
  if (canonicalJson(left) === canonicalJson(right)) return [];
  if (Array.isArray(left) && Array.isArray(right)) {
    const result = []; const size = Math.max(left.length, right.length);
    for (let index = 0; index < size; index += 1) result.push(...diffFields(left[index], right[index], `${path}/${index}`));
    return result;
  }
  if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    return unique([...Object.keys(left), ...Object.keys(right)]).flatMap(key => diffFields(left[key], right[key], `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`));
  }
  return [path || '/'];
}

export function compareDeterministicRuns(runs) {
  if (runs.length < 2) return { agreement: null, unstable_fields: [], status: 'not_applicable' };
  const reference = normalizeRuntime(runs[0].output);
  const fields = unique(runs.slice(1).flatMap(run => diffFields(reference, normalizeRuntime(run.output))));
  return { agreement: fields.length ? 0 : 1, unstable_fields: fields, status: 'measured' };
}

function resolveRuns(runs) {
  const byLabel = new Map();
  return runs.map(run => {
    const output = run.output ?? byLabel.get(run.same_as);
    if (!output) throw new Error(`UNKNOWN_CALIBRATION_RUN_REFERENCE: ${run.same_as}`);
    byLabel.set(run.run_label, output); return { ...run, output };
  });
}

function pointer(object, path) {
  return path.split('/').slice(1).reduce((value, token) => value?.[token.replaceAll('~1', '/').replaceAll('~0', '~')], object);
}

function check(dimension, passed, expected, actual, rationale, applicable = true) {
  return { dimension, status: applicable ? (passed ? 'pass' : 'fail') : 'not_applicable', expected, actual, rationale };
}

function pairs(groups = []) { return new Set(groups.flatMap(group => group.flatMap((left, index) => group.slice(index + 1).map(right => pairKey(left, right))))); }

export function evaluateCase(suite, calibrationCase, evaluator, evaluatedAt) {
  assertValidRecord(calibrationCase, 'calibration-case');
  const expected = calibrationCase.expected; const resolvedRuns = resolveRuns(calibrationCase.observed_runs); const actual = resolvedRuns[0].output;
  const checks = [];
  const selected = new Set(actual.specialists ?? []);
  checks.push(check('specialist_selection', expected.specialist_selection.must_include.every(item => selected.has(item)) && expected.specialist_selection.must_exclude.every(item => !selected.has(item)), expected.specialist_selection, actual.specialists ?? [], 'Required specialists must be present and excluded specialists absent.'));
  const findingByIssue = new Map((actual.findings ?? []).map(item => [item.issue_id, item]));
  for (const issue of expected.issues) {
    const finding = findingByIssue.get(issue.issue_id); const present = Boolean(finding);
    checks.push(check(`finding:${issue.issue_id}:presence`, present === issue.should_find, issue.should_find, present, 'Finding presence is evaluated by stable corpus issue ID.'));
    if (issue.should_find && finding) {
      checks.push(check(`finding:${issue.issue_id}:affected_area`, issue.affected_area === null || finding.affected_area === issue.affected_area, issue.affected_area, finding.affected_area ?? null, 'Affected area uses a stable semantic identifier label.'));
      checks.push(check(`finding:${issue.issue_id}:severity`, !issue.severity || (finding.severity >= issue.severity.min && finding.severity <= issue.severity.max), issue.severity, finding.severity ?? null, 'Severity is compared with the accepted consequence range.'));
      checks.push(check(`finding:${issue.issue_id}:confidence`, !issue.confidence || (finding.confidence >= issue.confidence.min && finding.confidence <= issue.confidence.max), issue.confidence, finding.confidence ?? null, 'Confidence is compared independently from severity.'));
      checks.push(check(`finding:${issue.issue_id}:evidence`, issue.evidence_sufficient === null || finding.evidence_sufficient === issue.evidence_sufficient, issue.evidence_sufficient, finding.evidence_sufficient ?? null, 'Evidence sufficiency remains explicit.'));
    }
  }
  const expectedDuplicates = pairs(expected.duplicate_groups); const actualDuplicates = pairs(actual.duplicate_groups ?? []);
  checks.push(check('duplicate_groups', [...expectedDuplicates].every(item => actualDuplicates.has(item)) && [...actualDuplicates].every(item => expectedDuplicates.has(item)), [...expectedDuplicates], [...actualDuplicates], 'Duplicate clustering compares unordered issue pairs.', expectedDuplicates.size + actualDuplicates.size > 0));
  const actualRelationships = new Set((actual.relationships ?? []).map(typedKey));
  checks.push(check('relationships', expected.relationships.every(item => actualRelationships.has(typedKey(item))), expected.relationships, actual.relationships ?? [], 'Relationships compare typed stable endpoints.', expected.relationships.length + actualRelationships.size > 0));
  const actualContradictions = new Set((actual.contradictions ?? []).map(item => pairKey(item.left, item.right)));
  checks.push(check('contradictions', expected.contradictions.every(item => actualContradictions.has(pairKey(item.left, item.right)) === item.present), expected.contradictions, actual.contradictions ?? [], 'Contradiction expectations include positive and negative pairs.', expected.contradictions.length > 0));
  const rootByIssue = new Map((actual.root_causes ?? []).map(item => [item.issue_id, item]));
  checks.push(check('root_causes', expected.root_causes.every(item => rootByIssue.get(item.issue_id)?.correct === item.correct), expected.root_causes, actual.root_causes ?? [], 'Root-cause correctness is evaluated without prose matching.', expected.root_causes.length > 0));
  const priorityByIssue = new Map((actual.priorities ?? []).map(item => [item.issue_id, item.level]));
  checks.push(check('priorities', expected.priorities.every(item => item.allowed.includes(priorityByIssue.get(item.issue_id))), expected.priorities, actual.priorities ?? [], 'Priority is checked against allowed bands.', expected.priorities.length > 0));
  const order = actual.remediation_order ?? [];
  checks.push(check('remediation_order', expected.remediation_order.every(item => order.indexOf(item.before) >= 0 && order.indexOf(item.before) < order.indexOf(item.after)), expected.remediation_order, order, 'Every required prerequisite precedes its dependent remediation.', expected.remediation_order.length > 0));
  const verificationByIssue = new Map((actual.verification ?? []).map(item => [item.issue_id, item]));
  checks.push(check('verification', expected.verification.every(item => item.allowed_outcomes.includes(verificationByIssue.get(item.issue_id)?.outcome) && (item.transition === null || verificationByIssue.get(item.issue_id)?.transition === item.transition)), expected.verification, actual.verification ?? [], 'Verification compares structured outcome and lifecycle transition.', expected.verification.length > 0));
  const regressionByIssue = new Map((actual.regressions ?? []).map(item => [item.issue_id, item.detected]));
  checks.push(check('regressions', expected.regressions.every(item => regressionByIssue.get(item.issue_id) === item.detected), expected.regressions, actual.regressions ?? [], 'Regression detection uses stable issue identity.', expected.regressions.length > 0));
  for (const item of expected.exact) { const actualValue = pointer(actual, item.path); checks.push(check(`exact:${item.path}`, canonicalJson(actualValue) === canonicalJson(item.value), item.value, actualValue ?? null, 'Exact structured expectation.')); }
  for (const item of expected.bounded) { const actualValue = pointer(actual, item.path); checks.push(check(`bounded:${item.path}`, typeof actualValue === 'number' && actualValue >= item.min && actualValue <= item.max, { min: item.min, max: item.max }, actualValue ?? null, 'Bounded numeric expectation.')); }
  const deterministic = compareDeterministicRuns(resolvedRuns);
  checks.push(check('deterministic_rerun', deterministic.agreement === 1, 1, deterministic.agreement, 'Runtime timestamps are ignored; all other differing fields are reported.', deterministic.status === 'measured'));
  checks.push(check('schema_validity', actual.schema_valid === true, true, actual.schema_valid ?? null, 'All emitted artifacts must validate.'));
  checks.push(check('provenance_completeness', actual.provenance_complete === true, true, actual.provenance_complete ?? null, 'Every decision and evidence record requires provenance.'));
  checks.push(check('mutation_policy', (actual.mutations ?? []).length === 0, [], actual.mutations ?? [], 'Calibration and audit execution must not mutate the audited application.'));
  const result = { schema_version: 'aud-calibration-result-v1', result_id: stableId('CALRES', suite.suite_id, { suite_version: suite.suite_version, case_id: calibrationCase.case_id, case_version: calibrationCase.case_version, input_revision: calibrationCase.input_revision, actual: normalizeRuntime(actual) }), suite_id: suite.suite_id, suite_version: suite.suite_version, case_id: calibrationCase.case_id, case_version: calibrationCase.case_version, input_revision: calibrationCase.input_revision, expected_outcome_id: expected.expected_id, expected_outcome: expected, actual_outcome: actual, verdict: checks.some(item => item.status === 'fail') ? 'fail' : 'pass', checks, unstable_fields: deterministic.unstable_fields, evaluator, evaluated_at: evaluatedAt };
  assertValidRecord(result, 'calibration-result'); return result;
}

function setMetrics(expectedSet, actualSet) {
  const intersection = [...actualSet].filter(item => expectedSet.has(item)).length;
  return { tp: intersection, fp: actualSet.size - intersection, fn: expectedSet.size - intersection };
}

export function buildReliabilitySummary(suite, cases, results, tier, evaluator, generatedAt) {
  const selected = cases.map((item, index) => ({ case: item, result: results[index], actual: resolveRuns(item.observed_runs)[0].output, expected: item.expected }));
  let tp = 0; let fp = 0; let fn = 0; let tn = 0; let criticalFn = 0; let severityOk = 0; let severityN = 0; let mutationViolations = 0; let verifiedWithoutEvidence = 0; let fabricated = 0; let legal = 0; let legalN = 0;
  const confidenceRows = []; const expectedDup = new Set(); const actualDup = new Set(); const expectedRel = new Set(); const actualRel = new Set(); let contradictionOk = 0; let contradictionN = 0; let rootOk = 0; let rootN = 0; let priorityOk = 0; let priorityN = 0; let orderOk = 0; let orderN = 0; let verificationOk = 0; let verificationN = 0; let regressionOk = 0; let regressionN = 0;
  for (const entry of selected) {
    const actualFindings = new Map((entry.actual.findings ?? []).map(item => [item.issue_id, item]));
    for (const issue of entry.expected.issues) {
      const found = actualFindings.has(issue.issue_id);
      if (issue.should_find && found) tp += 1; else if (issue.should_find) { fn += 1; if (issue.critical) criticalFn += 1; } else if (found) fp += 1; else tn += 1;
      if (issue.should_find && found && issue.severity) { severityN += 1; const value = actualFindings.get(issue.issue_id).severity; if (value >= issue.severity.min && value <= issue.severity.max) severityOk += 1; }
    }
    for (const finding of entry.actual.findings ?? []) confidenceRows.push({ confidence: finding.confidence, correct: entry.expected.issues.some(issue => issue.issue_id === finding.issue_id && issue.should_find) ? 1 : 0 });
    for (const pair of pairs(entry.expected.duplicate_groups)) expectedDup.add(`${entry.case.case_id}:${pair}`);
    for (const pair of pairs(entry.actual.duplicate_groups ?? [])) actualDup.add(`${entry.case.case_id}:${pair}`);
    for (const item of entry.expected.relationships) expectedRel.add(`${entry.case.case_id}:${typedKey(item)}`);
    for (const item of entry.actual.relationships ?? []) actualRel.add(`${entry.case.case_id}:${typedKey(item)}`);
    const contradictionSet = new Set((entry.actual.contradictions ?? []).map(item => pairKey(item.left, item.right)));
    for (const item of entry.expected.contradictions) { contradictionN += 1; if (contradictionSet.has(pairKey(item.left, item.right)) === item.present) contradictionOk += 1; }
    const roots = new Map((entry.actual.root_causes ?? []).map(item => [item.issue_id, item.correct])); for (const item of entry.expected.root_causes) { rootN += 1; if (roots.get(item.issue_id) === item.correct) rootOk += 1; }
    const priorities = new Map((entry.actual.priorities ?? []).map(item => [item.issue_id, item.level])); for (const item of entry.expected.priorities) { priorityN += 1; if (item.allowed.includes(priorities.get(item.issue_id))) priorityOk += 1; }
    const order = entry.actual.remediation_order ?? []; for (const item of entry.expected.remediation_order) { orderN += 1; if (order.indexOf(item.before) >= 0 && order.indexOf(item.before) < order.indexOf(item.after)) orderOk += 1; }
    const verifications = new Map((entry.actual.verification ?? []).map(item => [item.issue_id, item])); for (const item of entry.expected.verification) { verificationN += 1; const found = verifications.get(item.issue_id); if (found && item.allowed_outcomes.includes(found.outcome) && (item.transition === null || found.transition === item.transition)) verificationOk += 1; }
    const regressions = new Map((entry.actual.regressions ?? []).map(item => [item.issue_id, item.detected])); for (const item of entry.expected.regressions) { regressionN += 1; if (regressions.get(item.issue_id) === item.detected) regressionOk += 1; }
    for (const item of entry.actual.verification ?? []) { legalN += 1; if (item.legal === true) legal += 1; if (item.outcome === 'passed' && item.transition === 'verified' && !(item.evidence_refs?.length)) verifiedWithoutEvidence += 1; }
    mutationViolations += (entry.actual.mutations ?? []).length; fabricated += entry.actual.fabricated_results ?? 0;
  }
  const dup = setMetrics(expectedDup, actualDup); const rel = setMetrics(expectedRel, actualRel);
  const deterministicN = results.filter(item => item.checks.find(check => check.dimension === 'deterministic_rerun')?.status !== 'not_applicable').length;
  const deterministicOk = results.filter(item => item.checks.find(check => check.dimension === 'deterministic_rerun')?.status === 'pass').length;
  const schemaOk = selected.filter(item => item.actual.schema_valid === true).length; const provenanceOk = selected.filter(item => item.actual.provenance_complete === true).length;
  const unstableIdCases = results.filter(item => item.unstable_fields.some(path => /(?:^|[\/_])(?:id|refs?)(?:[\/_]|$)/i.test(path))).length;
  const confidenceValue = confidenceRows.length ? Number((confidenceRows.reduce((sum, row) => sum + (1 - Math.abs(row.confidence - row.correct)), 0) / confidenceRows.length).toFixed(4)) : null;
  const bins = confidenceRows.length >= 5 ? [[0, .5], [.5, .8], [.8, 1.0001]].map(([min, max]) => { const rows = confidenceRows.filter(row => row.confidence >= min && row.confidence < max); return { range: `${min}-${Math.min(max, 1)}`, count: rows.length, mean_confidence: rows.length ? Number((rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length).toFixed(4)) : null, observed_accuracy: rows.length ? Number((rows.reduce((sum, row) => sum + row.correct, 0) / rows.length).toFixed(4)) : null }; }) : [];
  const metrics = [
    ratio('finding_precision', tp, tp + fp, 'True positives divided by all emitted corpus findings.'), ratio('finding_recall', tp, tp + fn, 'True positives divided by all expected findings.'), ratio('false_positive_rate', fp, fp + tn, 'False positives divided by expected-negative opportunities.'), ratio('false_negative_rate', fn, fn + tp, 'Missed findings divided by expected-positive opportunities.'), ratio('severity_agreement', severityOk, severityN, 'Findings within accepted consequence ranges, including cross-specialist scenarios.'),
    { name: 'confidence_calibration', status: confidenceRows.length < 5 ? 'insufficient_sample' : 'measured', value: confidenceValue, numerator: confidenceValue === null ? null : Number((confidenceValue * confidenceRows.length).toFixed(4)), denominator: confidenceRows.length || null, rationale: confidenceRows.length < 5 ? 'Too few scored findings for a statistically strong calibration claim.' : 'Mean closeness between assigned confidence and corpus correctness; bins show reliability.', bins },
    ratio('duplicate_clustering_precision', dup.tp, dup.tp + dup.fp, 'Correct duplicate pairs divided by emitted duplicate pairs.'), ratio('duplicate_clustering_recall', dup.tp, dup.tp + dup.fn, 'Correct duplicate pairs divided by expected duplicate pairs.'), ratio('contradiction_detection_accuracy', contradictionOk, contradictionN, 'Correct positive and negative contradiction decisions.'), ratio('relationship_accuracy', rel.tp * 2, (2 * rel.tp) + rel.fp + rel.fn, 'F1 agreement for typed relationships.'), ratio('root_cause_accuracy', rootOk, rootN, 'Correct fixture root-cause classifications.'), ratio('priority_agreement', priorityOk, priorityN, 'Priorities within accepted bands.'), ratio('remediation_order_validity', orderOk, orderN, 'Dependency ordering constraints satisfied.'), ratio('verification_outcome_accuracy', verificationOk, verificationN, 'Verification outcomes and transitions within accepted sets.'), ratio('regression_detection_accuracy', regressionOk, regressionN, 'Correct regression presence decisions.'), ratio('lifecycle_transition_legality', legal, legalN, 'Legal lifecycle transitions divided by attempted transitions.'), ratio('deterministic_rerun_agreement', deterministicOk, deterministicN, 'Cases with identical normalized reruns.'), ratio('schema_validity', schemaOk, selected.length, 'Cases whose complete actual artifact set validates.'), ratio('provenance_completeness', provenanceOk, selected.length, 'Cases with complete evaluator and evidence provenance.'),
    { name: 'critical_false_negatives', status: 'measured', value: criticalFn, numerator: criticalFn, denominator: selected.filter(item => item.expected.issues.some(issue => issue.critical && issue.should_find)).length, rationale: 'Count of missed mandatory critical issues.', bins: [] }, { name: 'mutation_violations', status: 'measured', value: mutationViolations, numerator: mutationViolations, denominator: selected.length, rationale: 'Observed audited-application or fixture mutations.', bins: [] }, { name: 'unstable_stable_ids', status: 'measured', value: unstableIdCases, numerator: unstableIdCases, denominator: deterministicN, rationale: 'Cases with differing stable-ID or reference fields.', bins: [] }, { name: 'verified_without_evidence', status: 'measured', value: verifiedWithoutEvidence, numerator: verifiedWithoutEvidence, denominator: legalN, rationale: 'Verified outcomes that lack candidate evidence.', bins: [] }, { name: 'fabricated_results', status: 'measured', value: fabricated, numerator: fabricated, denominator: selected.length, rationale: 'Fixture-declared fabricated execution results.', bins: [] },
  ];
  const specialists = unique(selected.flatMap(entry => [
    ...(entry.actual.findings?.map(item => item.specialist).filter(Boolean) ?? []),
    ...entry.expected.issues.map(item => item.specialist ?? (entry.expected.specialist_selection.must_include.length === 1 ? entry.expected.specialist_selection.must_include[0] : null)).filter(Boolean),
  ])).map(specialist => {
    const rows = selected.flatMap(entry => (entry.actual.findings ?? []).filter(item => item.specialist === specialist).map(item => ({ item, expected: entry.expected.issues.find(issue => issue.issue_id === item.issue_id && (!issue.specialist || issue.specialist === specialist)) })));
    const expectedIssues = selected.flatMap(entry => entry.expected.issues.filter(issue => {
      const owner = issue.specialist ?? (entry.expected.specialist_selection.must_include.length === 1 ? entry.expected.specialist_selection.must_include[0] : (entry.actual.findings ?? []).find(item => item.issue_id === issue.issue_id)?.specialist);
      return owner === specialist && issue.should_find;
    }).map(issue => `${entry.case.case_id}:${issue.issue_id}`));
    const foundIssues = new Set(selected.flatMap(entry => (entry.actual.findings ?? []).filter(item => item.specialist === specialist).map(item => `${entry.case.case_id}:${item.issue_id}`)));
    const correct = rows.filter(row => row.expected?.should_find).length;
    const recalled = expectedIssues.filter(id => foundIssues.has(id)).length;
    const severityRows = rows.filter(row => row.expected?.severity);
    const severity = severityRows.filter(row => row.item.severity >= row.expected.severity.min && row.item.severity <= row.expected.severity.max).length;
    return { specialist, cases: rows.length, finding_precision: rows.length ? Number((correct / rows.length).toFixed(4)) : null, finding_recall: expectedIssues.length ? Number((recalled / expectedIssues.length).toFixed(4)) : null, severity_agreement: severityRows.length ? Number((severity / severityRows.length).toFixed(4)) : null };
  });
  const summary = { schema_version: 'aud-reliability-summary-v1', summary_id: stableId('RELSUM', suite.suite_id, { suite_version: suite.suite_version, tier, results: results.map(item => item.result_id) }), suite_id: suite.suite_id, suite_version: suite.suite_version, tier, generated_at: generatedAt, evaluator, cases: cases.map(item => ({ case_id: item.case_id, case_version: item.case_version, input_revision: item.input_revision })), case_ids: cases.map(item => item.case_id), case_result_refs: results.map(item => item.result_id), metrics, specialist_results: specialists, system_results: { cases: selected.length, passed_checks: results.flatMap(item => item.checks).filter(item => item.status === 'pass').length, failed_checks: results.flatMap(item => item.checks).filter(item => item.status === 'fail').length, false_positives: fp, false_negatives: fn, unstable_fields: unique(results.flatMap(item => item.unstable_fields)) }, limitations: confidenceRows.length < 5 ? ['Confidence sample is too small for a strong statistical claim; the reported value is descriptive only.'] : [] };
  if (new Set(metrics.map(item => item.name)).size !== metricNames.length) throw new Error('METRIC_COVERAGE_ERROR');
  assertValidRecord(summary, 'reliability-summary'); return summary;
}

function gatePass(actual, operator, threshold) { return operator === '>=' ? actual >= threshold : operator === '<=' ? actual <= threshold : actual === threshold; }
function evaluateGates(gates, metrics, hard) {
  const byName = new Map(metrics.map(item => [item.name, item]));
  return gates.map(gate => { const metric = byName.get(gate.metric); const applicable = metric && metric.value !== null; const passed = applicable ? gatePass(metric.value, gate.operator, gate.value) : !hard; return { metric: gate.metric, operator: gate.operator, threshold: gate.value, actual: metric?.value ?? null, passed, rationale: applicable ? gate.rationale : hard ? 'Hard-gated metric was not measurable.' : 'Metric was not applicable; warning threshold was not evaluated.' }; });
}

export function compareBaseline(summary, suite, baseline = null) {
  if (!baseline) return { status: 'not_supplied', improvements: [], regressions: [], unchanged: [], new_cases: summary.case_ids, incompatibilities: [] };
  const incompatibilities = [];
  if (baseline.schema_version !== 'aud-calibration-baseline-v1') incompatibilities.push(`Unsupported baseline version ${baseline.schema_version}.`);
  if (baseline.suite_id !== suite.suite_id) incompatibilities.push(`Suite ${baseline.suite_id} does not match ${suite.suite_id}.`);
  if (incompatibilities.length) return { status: 'incompatible', improvements: [], regressions: [], unchanged: [], new_cases: [], incompatibilities };
  const prior = new Map(baseline.metrics.map(item => [item.name, item.value])); const improvements = []; const regressions = []; const unchanged = [];
  for (const metric of summary.metrics.filter(item => item.value !== null)) {
    if (!prior.has(metric.name) || prior.get(metric.name) === null) continue;
    const lowerBetter = ['false_positive_rate', 'false_negative_rate', 'critical_false_negatives', 'mutation_violations', 'unstable_stable_ids', 'verified_without_evidence', 'fabricated_results'].includes(metric.name);
    const delta = metric.value - prior.get(metric.name); const direction = lowerBetter ? -delta : delta;
    (direction > 0 ? improvements : direction < 0 ? regressions : unchanged).push(`${metric.name}: ${prior.get(metric.name)} -> ${metric.value}`);
  }
  const knownCases = new Map((baseline.cases ?? []).map(item => [item.case_id, item])); const newCases = summary.case_ids.filter(id => !knownCases.has(id));
  for (const item of summary.cases) {
    const priorCase = knownCases.get(item.case_id);
    if (priorCase && (priorCase.case_version !== item.case_version || priorCase.input_revision !== item.input_revision)) incompatibilities.push(`${item.case_id} version or input revision differs from the accepted baseline.`);
  }
  return { status: incompatibilities.length ? 'incompatible' : 'compatible', improvements, regressions, unchanged, new_cases: newCases, incompatibilities };
}

export function evaluateQualityGates(suite, summary, baseline, evaluator, generatedAt) {
  const hard = evaluateGates(suite.quality_gates.hard, summary.metrics, true); const warnings = evaluateGates(suite.quality_gates.warning, summary.metrics, false);
  const comparison = compareBaseline(summary, suite, baseline); const thresholdHash = hash(suite.quality_gates); const policyChanges = baseline && baseline.threshold_hash !== thresholdHash ? ['Quality-gate thresholds differ from the accepted baseline.'] : [];
  const informational = suite.quality_gates.informational.map(name => { const metric = summary.metrics.find(item => item.name === name); return { metric: name, operator: 'report', threshold: null, actual: metric?.value ?? null, passed: true, rationale: metric?.rationale ?? 'Metric is not present.' }; });
  const result = { schema_version: 'aud-quality-gate-result-v1', gate_result_id: stableId('QG', summary.summary_id, { threshold_hash: thresholdHash, baseline: baseline?.baseline_id ?? null }), suite_id: suite.suite_id, suite_version: suite.suite_version, policy_version: suite.quality_gates.policy_version, threshold_hash: thresholdHash, generated_at: generatedAt, evaluator, verdict: hard.every(item => item.passed) ? 'pass' : 'fail', hard_failures: hard.filter(item => !item.passed), warnings: warnings.filter(item => !item.passed), informational, baseline_comparison: comparison, policy_changes: policyChanges };
  assertValidRecord(result, 'quality-gate-result'); return result;
}

export function expectationsHash(suite) { return hash(suite.cases.map(item => ({ case_id: item.case_id, case_version: item.case_version, expected: item.expected }))); }
export function thresholdsHash(suite) { return hash(suite.quality_gates); }

export function assertBaselineAcceptanceAllowed(suite, existingBaseline, rationale, approvePolicyChanges = false) {
  if (!rationale?.trim()) throw new Error('BASELINE_RATIONALE_REQUIRED: accepting a calibration baseline requires a rationale');
  if (!existingBaseline) return;
  const changes = [];
  if (existingBaseline.threshold_hash !== thresholdsHash(suite)) changes.push('thresholds');
  if (existingBaseline.expectations_hash !== expectationsHash(suite)) changes.push('expected outcomes');
  if (changes.length && !approvePolicyChanges) throw new Error(`POLICY_CHANGE_APPROVAL_REQUIRED: ${changes.join(' and ')} changed; pass explicit approval with review rationale`);
}
