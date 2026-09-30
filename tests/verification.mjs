import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mergeFinding } from '../shared/ledger/merge.mjs';
import { runAud } from '../shared/orchestration/orchestrator.mjs';
import { buildVerificationPlan, executeVerification, applyVerificationToFindings, methodCategory, summarizeVerification } from '../shared/verification/engine.mjs';
import { renderRegressionReport, renderVerificationReport } from '../shared/verification/reports.mjs';
import { writeVerificationArtifacts } from '../shared/verification/runner.mjs';
import { validateRecord } from '../shared/validators/schema-registry.mjs';

const fixtures = resolve('tests/fixtures/schemas');
const baseline = 'da063c38731f3f797bfd5000374daa5c14952782';
const candidate = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const at = '2026-09-04T12:00:00Z';
const runId = 'RUN-VERIFY-001';
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const clone = structuredClone;

function baseInput() {
  const finding = clone(json(join(fixtures, 'finding/valid.json')));
  finding.status = 'implemented';
  const evidence = clone(json(join(fixtures, 'evidence/valid.json')));
  evidence.id = 'EV-014'; evidence.provenance.source_revision = baseline;
  const remediationPlan = clone(json(join(fixtures, 'remediation-plan/valid.json')));
  const item = remediationPlan.items[0];
  item.finding_refs = [finding.id]; item.acceptance_criteria = clone(finding.acceptance_criteria); item.status = 'accepted';
  const capture = clone(json(join(fixtures, 'capture-manifest/valid.json')));
  return {
    runId, generatedAt: at, baselineRevision: baseline, candidateRevision: candidate,
    remediationPlan, findings: [finding], originalEvidence: [evidence], baselineCapture: capture,
    implementationStatus: { [item.remediation_id]: { status: 'complete', candidate_revision: candidate } },
    selectedRemediationIds: [item.remediation_id], candidateEnvironment: capture.environment,
    availableFixtures: capture.fixtures, persistentDataMode: 'isolated',
    inputRefs: { run_manifest: 'run-manifest.json', project_context: 'project-context.json', remediation_plan: 'remediation-plan.json', synthesis: null, capture_manifest: 'baseline-capture.json', ledger: 'findings-ledger.jsonl' },
  };
}

function evidence(id = 'EV-VERIFY-001', revision = candidate) {
  return { schema_version: 'aud-evidence-v1', id, run_id: runId, type: 'test', artifact_ref: `evidence/${id}.json`, exact_observation: 'The original interaction now preserves comparison state.', provenance: { source: 'verification fixture', captured_by: 'test adapter', source_revision: revision }, strength: 'direct', environment: { browser: 'chromium', os: 'fixture' }, route: '/compare', state: 'source-selected', viewport: '1280x800', data_fixture: 'mature', timestamp: at, hash: null };
}

function adapter(caseRecord, outcome = 'passed', comparison = 'fixed', overrides = {}) {
  const ev = evidence(overrides.evidence_id);
  return {
    outcome, comparison, current_observation: 'The selected source and scroll anchor are restored.', rationale: `Adapter recorded ${outcome}.`,
    category: 'browser_interaction', adapter: 'fixture-browser', manual: false, provenance: 'Deterministic verification fixture',
    environment: { browser: 'chromium', os: 'fixture' }, evidence: [ev],
    acceptance_results: caseRecord.acceptance_criteria.map(item => ({ criterion_id: item.id, status: outcome === 'passed' ? 'pass' : outcome === 'partially_passed' || outcome === 'failed' ? 'fail' : 'not_run', evidence_refs: [ev.id], notes: outcome })),
    regressions: [], ...overrides,
  };
}

const input = baseInput();
for (const [instrument, category] of [['unit test', 'automated_test'], ['browser', 'browser_interaction'], ['visual screenshot', 'visual_comparison'], ['content inspection', 'content_inspection'], ['axe accessibility', 'accessibility_check'], ['performance timing', 'performance_measurement'], ['manual expert review', 'manual_expert_review'], ['evidence investigation', 'evidence_only_investigation']]) assert.equal(methodCategory({ instrument, procedure: 'Execute the declared check.' }), category);
const first = buildVerificationPlan(input);
const second = buildVerificationPlan(input);
assert.deepEqual(first, second, 'verification planning is not deterministic');
assert.equal(validateRecord(first, 'verification-plan').valid, true);
assert.equal(first.cases.length, 1);
assert.deepEqual(first.specialist_decisions.filter(item => item.disposition === 'selected').map(item => item.specialist), ['flow-audit', 'functional-audit']);
assert.equal(buildVerificationPlan({ ...baseInput(), fullRegression: true }).specialist_decisions.every(item => item.disposition === 'selected'), true);

const architectureInput = baseInput();
architectureInput.findings[0].source_audit = 'architecture-maintainability-audit';
architectureInput.findings[0].category = 'architecture.dependency-cycle';
architectureInput.findings[0].affected_areas = ['dependency graph', 'module ownership'];
architectureInput.findings[0].native_metrics = { cycle_length: 2, dependency_edges: 2 };
architectureInput.remediationPlan.items[0].affected_areas = ['dependency graph', 'module ownership'];
const architecturePlan = buildVerificationPlan(architectureInput);
assert.ok(
  architecturePlan.specialist_decisions.some(item => item.specialist === 'architecture-maintainability-audit' && item.disposition === 'selected'),
  'architecture remediation did not select the architecture specialist for targeted verification',
);

const missingCriteria = baseInput();
missingCriteria.findings[0].acceptance_criteria = []; missingCriteria.findings[0].verification_absence_reason = 'No approved criterion exists.';
assert.match(buildVerificationPlan(missingCriteria).cases[0].readiness.reasons.join(' '), /no acceptance criteria/i);
const missingMethod = baseInput(); missingMethod.findings[0].verification_method = []; missingMethod.findings[0].verification_absence_reason = 'No approved method exists.';
assert.match(buildVerificationPlan(missingMethod).cases[0].readiness.reasons.join(' '), /no verification methods/i);
const incomplete = baseInput(); incomplete.implementationStatus[first.cases[0].remediation_id].status = 'in_progress';
assert.equal(buildVerificationPlan(incomplete).cases[0].readiness.state, 'deferred');
assert.match(buildVerificationPlan(incomplete).cases[0].readiness.reasons.join(' '), /not reported complete/i);
const degradedInput = baseInput(); degradedInput.degradedReasons = ['Candidate uses the approved fallback viewport.'];
assert.equal(buildVerificationPlan(degradedInput).cases[0].readiness.state, 'degraded');

const dependency = baseInput();
const dependencyFinding = clone(dependency.findings[0]); dependencyFinding.id = 'F-DEPENDENCY-001'; dependencyFinding.evidence_refs = ['EV-DEPENDENCY-001'];
const dependencyEvidence = clone(dependency.originalEvidence[0]); dependencyEvidence.id = 'EV-DEPENDENCY-001';
const dependencyItem = clone(dependency.remediationPlan.items[0]); dependencyItem.remediation_id = 'R-DEPENDENCY-001'; dependencyItem.finding_refs = [dependencyFinding.id]; dependencyItem.dependencies = []; dependencyItem.wave = 1;
dependency.remediationPlan.items[0].dependencies = [dependencyItem.remediation_id]; dependency.remediationPlan.items[0].wave = 2;
dependency.remediationPlan.items.push(dependencyItem); dependency.remediationPlan.waves = [{ wave: 1, remediation_refs: [dependencyItem.remediation_id], parallel_ready: false }, { wave: 2, remediation_refs: [dependency.remediationPlan.items[0].remediation_id], parallel_ready: false }];
dependency.findings.push(dependencyFinding); dependency.originalEvidence.push(dependencyEvidence);
assert.match(buildVerificationPlan(dependency).cases[0].readiness.reasons.join(' '), /Dependency R-DEPENDENCY-001/i);

assert.throws(() => buildVerificationPlan({ ...baseInput(), candidateRevision: baseline }), /UNCHANGED_CANDIDATE_REVISION/);
assert.throws(() => buildVerificationPlan({ ...baseInput(), baselineRevision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }), /BASELINE_REVISION_MISMATCH/);

for (const [outcome, comparison] of [['passed', 'fixed'], ['partially_passed', 'improved_but_incomplete'], ['failed', 'unchanged'], ['inconclusive', 'unable_to_compare']]) {
  const supplied = adapter(first.cases[0], outcome, comparison, { evidence_id: `EV-${outcome.toUpperCase().replaceAll('_', '-')}` });
  const executed = executeVerification({ plan: first, findings: input.findings, adapterResults: { [first.cases[0].case_id]: supplied }, generatedAt: at, environment: input.candidateEnvironment });
  assert.equal(executed.verificationResults.results[0].outcome, outcome);
  assert.equal(validateRecord(executed.verificationResults, 'verification-result').valid, true);
}
const blockedPlan = buildVerificationPlan(missingCriteria);
assert.equal(executeVerification({ plan: blockedPlan, findings: missingCriteria.findings, generatedAt: at, environment: input.candidateEnvironment }).verificationResults.results[0].outcome, 'blocked');
assert.equal(executeVerification({ plan: first, findings: input.findings, generatedAt: at, environment: input.candidateEnvironment }).verificationResults.results[0].outcome, 'not_run');

const manualInput = baseInput(); manualInput.remediationPlan.items[0].verification_method = [{ instrument: 'manual expert review', procedure: 'Reviewer checks the restored context.' }];
const manualPlan = buildVerificationPlan(manualInput);
assert.equal(manualPlan.cases[0].execution_status, 'pending_manual');
assert.equal(executeVerification({ plan: manualPlan, findings: manualInput.findings, generatedAt: at, environment: input.candidateEnvironment }).verificationResults.results[0].outcome, 'not_run');
assert.equal(executeVerification({ plan: manualPlan, findings: manualInput.findings, adapterResults: { [manualPlan.cases[0].case_id]: adapter(manualPlan.cases[0]) }, generatedAt: at, environment: input.candidateEnvironment }).verificationResults.results[0].outcome, 'not_run');

const noLonger = executeVerification({ plan: first, findings: input.findings, adapterResults: { [first.cases[0].case_id]: adapter(first.cases[0], 'passed', 'no_longer_reproducible') }, generatedAt: at, environment: input.candidateEnvironment });
assert.equal(noLonger.verificationResults.results[0].outcome, 'inconclusive');

const illegalInput = baseInput(); illegalInput.findings[0].status = 'open';
const illegalPlan = buildVerificationPlan(illegalInput);
const illegal = executeVerification({ plan: illegalPlan, findings: illegalInput.findings, adapterResults: { [illegalPlan.cases[0].case_id]: adapter(illegalPlan.cases[0]) }, generatedAt: at, environment: input.candidateEnvironment });
assert.equal(illegal.verificationResults.results[0].lifecycle_transition.applied, false);
assert.match(illegal.verificationResults.results[0].lifecycle_transition.reason, /illegal/i);

const multi = baseInput(); const secondFinding = clone(multi.findings[0]); secondFinding.id = 'F-MULTI-002'; secondFinding.evidence_refs = ['EV-MULTI-002']; secondFinding.locations[0].component = 'SecondLink';
const secondEvidence = clone(multi.originalEvidence[0]); secondEvidence.id = 'EV-MULTI-002'; multi.findings.push(secondFinding); multi.originalEvidence.push(secondEvidence); multi.remediationPlan.items[0].finding_refs.push(secondFinding.id);
const multiPlan = buildVerificationPlan(multi); assert.equal(multiPlan.cases.length, 2, 'shared remediation did not produce finding-specific cases');

const reusable = evidence('EV-REUSED-001');
const reusedAdapter = { ...adapter(first.cases[0]), evidence: [], evidence_refs: [reusable.id] }; reusedAdapter.acceptance_results = reusedAdapter.acceptance_results.map(item => ({ ...item, evidence_refs: [reusable.id] }));
const reused = executeVerification({ plan: first, findings: input.findings, candidateEvidence: [reusable], adapterResults: { [first.cases[0].case_id]: reusedAdapter }, generatedAt: at, environment: input.candidateEnvironment });
assert.deepEqual(reused.evidence.map(item => item.id), [reusable.id]);
assert.throws(() => executeVerification({ plan: first, findings: input.findings, candidateEvidence: [evidence('EV-STALE', baseline)], generatedAt: at, environment: input.candidateEnvironment }), /STALE_CANDIDATE_EVIDENCE/);

const regressionAdapter = adapter(first.cases[0]);
regressionAdapter.regressions = [{ classification: 'newly_introduced_regression', scope: ['/compare', 'NeighborCard'], comparison: 'worsened', outcome: 'failed', baseline_observation: 'Neighbor card remained operable.', current_observation: 'Neighbor card no longer opens.', evidence_refs: [regressionAdapter.evidence[0].id], rationale: 'Targeted neighboring interaction failed after remediation.', finding: { title: 'Neighbor card no longer opens', statement: 'The neighboring comparison card does not open on the candidate revision.', locations: [{ route: '/compare', component: 'NeighborCard', state: 'default' }], affected_areas: ['functional behavior'], severity: { level: 3, rationale: 'A comparison path is unavailable.' }, confidence: { score: 0.95, basis: 'Reproduced by the candidate browser check.' }, recommendation: { action: 'Restore the neighboring card interaction.', alternatives: [], estimated_effort: 'S', change_risk: 'medium' } } }];
const regression = executeVerification({ plan: first, findings: input.findings, adapterResults: { [first.cases[0].case_id]: regressionAdapter }, generatedAt: at, environment: input.candidateEnvironment });
assert.equal(regression.newFindings.length, 1); assert.equal(validateRecord(regression.newFindings[0], 'finding').valid, true); assert.equal(regression.verificationResults.results[0].lifecycle_transition.applied, false);

const passed = executeVerification({ plan: first, findings: input.findings, adapterResults: { [first.cases[0].case_id]: adapter(first.cases[0]) }, generatedAt: at, environment: input.candidateEnvironment });
const passedAgain = executeVerification({ plan: first, findings: input.findings, adapterResults: { [first.cases[0].case_id]: adapter(first.cases[0]) }, generatedAt: at, environment: input.candidateEnvironment });
assert.deepEqual(passed, passedAgain, 'identical verification execution changed IDs or ordering');
const annotated = applyVerificationToFindings(input.findings, passed.verificationResults);
assert.equal(annotated[0].status, 'verified'); assert.equal(annotated[0].severity.level, input.findings[0].severity.level); assert.deepEqual(annotated[0].native_metrics, input.findings[0].native_metrics);
const mergedTwice = mergeFinding(annotated[0], annotated[0], { at }); assert.equal(mergedTwice.verification_history.length, 1, 'verification attempt was duplicated');
const laterCandidate = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const laterInput = baseInput(); laterInput.candidateRevision = laterCandidate; laterInput.findings = annotated; laterInput.implementationStatus[first.cases[0].remediation_id].candidate_revision = laterCandidate;
const laterPlan = buildVerificationPlan(laterInput); const failedAdapter = adapter(laterPlan.cases[0], 'failed', 'worsened', { evidence_id: 'EV-LATER-FAILED' }); failedAdapter.evidence[0].provenance.source_revision = laterCandidate;
const laterResult = executeVerification({ plan: laterPlan, findings: annotated, adapterResults: { [laterPlan.cases[0].case_id]: failedAdapter }, generatedAt: '2026-09-05T12:00:00Z', environment: input.candidateEnvironment });
const reopened = applyVerificationToFindings(annotated, laterResult.verificationResults)[0]; const historyMerge = mergeFinding(annotated[0], reopened, { at: '2026-09-05T12:00:00Z' });
assert.equal(historyMerge.status, 'reopened'); assert.equal(historyMerge.verification_history.length, 2, 'later failed attempt erased prior verification history');
const summary = summarizeVerification(first, passed.verificationResults, passed.regressionResults, input.findings);
assert.equal(validateRecord(summary, 'verification-summary').valid, true);
assert.match(renderVerificationReport(summary, passed.verificationResults), new RegExp(first.cases[0].case_id));
assert.match(renderRegressionReport(summary, passed.regressionResults), /untested scope is not a pass/i);

const temp = mkdtempSync(join(tmpdir(), 'aud-verify-'));
try {
  const app = join(temp, 'app'); const run = join(app, 'audits', '2026-09-04-aud'); const ledger = join(app, 'audits', 'findings-ledger.jsonl');
  mkdirSync(run, { recursive: true });
  const runnerInput = { ...input, plan: first, adapterResults: { [first.cases[0].case_id]: adapter(first.cases[0]) }, candidateEvidence: [] };
  const one = writeVerificationArtifacts({ applicationRoot: app, runDirectory: run, ledgerPath: ledger, inputs: runnerInput });
  assert.throws(() => writeVerificationArtifacts({ applicationRoot: app, runDirectory: run, ledgerPath: ledger, inputs: runnerInput }), /IMMUTABLE_VERIFICATION_ARTIFACTS/);
  const ledgerFinding = JSON.parse(readFileSync(ledger, 'utf8').trim()); assert.equal(ledgerFinding.verification_history.length, 1);
  for (const file of ['verification-plan.json', 'verification-results.json', 'regression-results.json', 'verification-summary.json', 'verification-report.md', 'regression-report.md']) assert.equal(existsSync(join(run, file)), true, `${file} missing`);
  assert.equal(readdirSync(run).some(name => name.includes('.tmp-')), false, 'atomic writer left a temporary file');
} finally { rmSync(temp, { recursive: true, force: true }); }

const orchestrationTemp = mkdtempSync(join(tmpdir(), 'aud-verify-orchestrator-'));
try {
  const app = join(orchestrationTemp, 'app'); mkdirSync(join(app, 'audits'), { recursive: true });
  const project = clone(json(resolve('tests/fixtures/integration/project-context.json'))); project.project.application_root = 'app'; project.project.revision = candidate;
  const tasks = clone(json(resolve('tests/fixtures/integration/task-model.json'))); tasks.project_revision = candidate;
  const projectPath = join(orchestrationTemp, 'project-context.json'); const taskPath = join(orchestrationTemp, 'task-model.json');
  const remediationPath = join(orchestrationTemp, 'remediation-plan.json'); const capturePath = join(orchestrationTemp, 'baseline-capture.json'); const evidencePath = join(orchestrationTemp, 'original-evidence.jsonl');
  writeFileSync(projectPath, JSON.stringify(project)); writeFileSync(taskPath, JSON.stringify(tasks)); writeFileSync(remediationPath, JSON.stringify(input.remediationPlan)); writeFileSync(capturePath, JSON.stringify(input.baselineCapture)); writeFileSync(evidencePath, `${JSON.stringify(input.originalEvidence[0])}\n`);
  writeFileSync(join(app, 'index.txt'), 'immutable application content'); writeFileSync(join(app, 'audits/findings-ledger.jsonl'), `${JSON.stringify(input.findings[0])}\n`);
  const orchestration = runAud({
    projectContextPath: projectPath, taskModelPath: taskPath, requestBase: orchestrationTemp,
    request: {
      mode: 'verify', current_revision: candidate, generated_at: at, scope: { aspects: ['flow'], routes: [], states: [], persona_refs: [] },
      remediation_plan: remediationPath, baseline_capture_manifest: capturePath, original_evidence: evidencePath,
      selected_remediation_ids: input.selectedRemediationIds, implementation_status: input.implementationStatus,
      verification_environment: input.candidateEnvironment, available_fixtures: input.availableFixtures,
      capture: { routes: ['/compare'], states: ['source-selected'], fixtures: ['mature'], viewports: ['1280x800'], environment: input.candidateEnvironment, artifacts: [], required_artifact_keys: [] },
      verification_adapter_results: { [first.cases[0].case_id]: adapter(first.cases[0]) },
    },
  });
  assert.equal(orchestration.execution.verification.status, 'complete');
  assert.equal(existsSync(join(orchestration.runDirectory, 'verification-results.json')), true);
  assert.equal(readFileSync(join(app, 'index.txt'), 'utf8'), 'immutable application content', 'verify mode modified the audited application');
  assert.equal(orchestration.ledger[0].status, 'verified');
  const rerun = runAud({
    projectContextPath: projectPath, taskModelPath: taskPath, requestBase: orchestrationTemp,
    request: {
      mode: 'verify', current_revision: candidate, generated_at: at, scope: { aspects: ['flow'], routes: [], states: [], persona_refs: [] },
      remediation_plan: remediationPath, baseline_capture_manifest: capturePath, original_evidence: evidencePath,
      selected_remediation_ids: input.selectedRemediationIds, implementation_status: input.implementationStatus,
      verification_environment: input.candidateEnvironment, available_fixtures: input.availableFixtures,
      capture: { routes: ['/compare'], states: ['source-selected'], fixtures: ['mature'], viewports: ['1280x800'], environment: input.candidateEnvironment, artifacts: [], required_artifact_keys: [] },
      verification_adapter_results: { [first.cases[0].case_id]: adapter(first.cases[0]) },
    },
  });
  assert.notEqual(rerun.runDirectory, orchestration.runDirectory, 'identical rerun overwrote immutable artifacts');
  assert.equal(json(join(rerun.runDirectory, 'verification-results.json')).result_set_id, json(join(orchestration.runDirectory, 'verification-results.json')).result_set_id);
  assert.equal(rerun.ledger[0].verification_history.length, 1, 'identical rerun duplicated ledger verification history');
} finally { rmSync(orchestrationTemp, { recursive: true, force: true }); }

const rejectedTemp = mkdtempSync(join(tmpdir(), 'aud-verify-rejected-'));
try {
  const app = join(rejectedTemp, 'app'); mkdirSync(app, { recursive: true });
  const project = clone(json(resolve('tests/fixtures/integration/project-context.json'))); project.project.application_root = 'app'; project.project.revision = candidate;
  const projectPath = join(rejectedTemp, 'project-context.json'); writeFileSync(projectPath, JSON.stringify(project));
  assert.throws(() => runAud({ projectContextPath: projectPath, requestBase: rejectedTemp, request: { mode: 'verify', current_revision: candidate, generated_at: at, scope: {} } }), /REMEDIATION_PLAN_REQUIRED/);
  assert.equal(existsSync(join(app, 'audits')), false, 'failed verify preflight created audit artifacts');
} finally { rmSync(rejectedTemp, { recursive: true, force: true }); }

console.log('PASS — Phase 5 planning, readiness, adapters, comparisons, regressions, lifecycle, persistence, schemas, reports, and mutation boundaries validated.');
