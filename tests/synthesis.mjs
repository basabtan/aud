import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { annotateLedger, synthesize } from '../shared/synthesis/engine.mjs';
import { renderRemediationReport, renderSynthesisReport } from '../shared/synthesis/reports.mjs';
import { writeSynthesisArtifacts } from '../shared/synthesis/runner.mjs';
import { validateRecord } from '../shared/validators/schema-registry.mjs';

const root = resolve('.');
const schemaFixtures = join(root, 'tests', 'fixtures', 'schemas');
const integration = join(root, 'tests', 'fixtures', 'integration');
const revision = 'da063c38731f3f797bfd5000374daa5c14952782';
const runId = 'RUN-SYNTHESIS-001';
const at = '2026-09-04T14:00:00Z';
const temp = mkdtempSync(join(tmpdir(), 'aud-synthesis-'));

function json(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function clone(value) { return structuredClone(value); }
function relationSet(overrides = {}) { return { duplicates: [], reinforces: [], contradicts: [], depends_on: [], blocks: [], caused_by: [], ...overrides }; }

const baseFinding = json(join(schemaFixtures, 'finding', 'valid.json'));
const baseEvidence = json(join(schemaFixtures, 'evidence', 'valid.json'));

function finding(id, source, overrides = {}) {
  const value = clone(baseFinding);
  Object.assign(value, {
    id, run_id: runId, source_audit: source,
    relationships: relationSet(),
    ...overrides,
  });
  return value;
}

function evidence(id, source, observation) {
  const value = clone(baseEvidence);
  Object.assign(value, { id, run_id: runId, exact_observation: observation, artifact_ref: `evidence/${id}.json` });
  value.provenance = { source: `${source} fixture`, captured_by: source, source_revision: revision };
  return value;
}

const a = finding('F-SYN-A', 'flow-audit', {
  title: 'Comparison state is lost', statement: 'Returning from evidence resets the comparison state.', evidence_refs: ['EV-SYN-A'],
  root_cause_hypothesis: 'No canonical comparison-state owner.', relationships: relationSet({ contradicts: ['F-SYN-C'] }),
});
const b = finding('F-SYN-B', 'functional-audit', {
  title: 'Comparison state is lost', statement: 'Returning from evidence resets the comparison state.', evidence_refs: ['EV-SYN-B'],
  root_cause_hypothesis: 'No canonical comparison-state owner.', relationships: relationSet({ duplicates: ['F-SYN-A'] }),
  confidence: { score: 0.8, basis: 'Reproduced by the functional instrument.' },
});
const c = finding('F-SYN-C', 'visual-audit', {
  title: 'Keep local evidence context', statement: 'The local evidence context provides useful visual continuity.', evidence_refs: ['EV-SYN-C'],
  root_cause_hypothesis: 'No canonical comparison-state owner.',
  recommendation: { action: 'Keep the local evidence context unchanged.', alternatives: [], estimated_effort: 'S', change_risk: 'low' },
  confidence: { score: 0.75, basis: 'Observed in the visual review.' },
});
const d = finding('F-SYN-D', 'content-audit', {
  title: 'Unvalidated policy can expose restricted data', statement: 'A policy ambiguity may expose restricted data.', evidence_refs: ['EV-MISSING-HIGH'],
  severity: { level: 4, rationale: 'Potential restricted-data exposure.' }, confidence: { score: 0.3, basis: 'Policy source is unavailable.' },
  reach: 'system', frequency: 'unknown', urgency: 'immediate', root_cause_hypothesis: 'Unvalidated data-display policy.',
  recommendation: { action: 'Restrict the data until policy intent is confirmed.', alternatives: [], estimated_effort: 'M', change_risk: 'high' },
});
const e = finding('F-SYN-E', 'place-audit', {
  title: 'Secondary status dominates', statement: 'A secondary status card dominates the decision surface.', evidence_refs: ['EV-SYN-E'],
  severity: { level: 2, rationale: 'Decision scanning is slowed.' }, confidence: { score: 0.88, basis: 'Measured placement evidence.' },
  reach: 'surface', frequency: 'common', urgency: 'medium', root_cause_hypothesis: null,
  relationships: relationSet({ depends_on: ['F-SYN-D'] }),
});
const f = finding('F-SYN-F', 'architecture-maintainability-audit', {
  category: 'architecture.dependency-cycle', title: 'State packages form a dependency cycle',
  statement: 'Core state and the feature adapter depend on each other and cannot be tested independently.', evidence_refs: ['EV-SYN-F'],
  severity: { level: 3, rationale: 'Changes propagate across both packages and prevent isolated rollback.' },
  confidence: { score: 0.96, basis: 'The revision-pinned repository graph contains both directed edges.' },
  reach: 'system', frequency: 'continuous', urgency: 'high',
  native_metrics: { cycle_length: 2, dependency_edges: 2, affected_packages: 2 },
  root_cause_hypothesis: 'A feature adapter is owned by the core package instead of an outer integration boundary.',
  affected_areas: ['dependency graph', 'state ownership'],
  recommendation: { action: 'Restore one-way dependency direction behind a core-owned interface.', alternatives: [], estimated_effort: 'M', change_risk: 'medium' },
});
const findings = [a, b, c, d, e, f];
const evidenceRecords = [
  evidence('EV-SYN-A', 'flow-audit', 'State reset observed.'), evidence('EV-SYN-B', 'functional-audit', 'State reset reproduced.'),
  evidence('EV-SYN-C', 'visual-audit', 'Local context supports continuity.'), evidence('EV-SYN-E', 'place-audit', 'Secondary card has highest prominence.'),
  evidence('EV-SYN-F', 'architecture-maintainability-audit', 'The repository graph contains a two-node dependency cycle.'),
];

function inputs(overrides = {}) {
  const auditPlan = json(join(schemaFixtures, 'audit-plan', 'valid.json')); auditPlan.run_id = runId;
  const architectureDecision = auditPlan.decisions.find(item => item.audit === 'architecture-maintainability-audit');
  architectureDecision.disposition = 'selected'; architectureDecision.reason = 'Explicit architecture scope requested.';
  const runManifest = json(join(integration, 'run-manifest.json')); runManifest.run_id = runId;
  runManifest.selected_audits.push('architecture-maintainability-audit');
  const captureManifest = json(join(schemaFixtures, 'capture-manifest', 'valid.json')); captureManifest.run_id = runId;
  return {
    runId, generatedAt: at, projectRevision: revision,
    auditPlan, runManifest,
    projectContext: json(join(integration, 'project-context.json')),
    taskModel: json(join(integration, 'task-model.json')),
    captureManifest,
    findings, evidence: evidenceRecords, ledger: [],
    inputRefs: {
      audit_plan: 'audit-plan.json', run_manifest: 'run-manifest.json', project_context: 'project-context.json', task_model: 'task-model.json',
      content_contract: null, flow_contract: null, capture_manifest: 'capture-manifest.json', ledger: 'findings-ledger.jsonl',
      specialist_findings: ['flow/findings.jsonl', 'functional/findings.jsonl'], specialist_evidence: ['flow/evidence.jsonl', 'functional/evidence.jsonl'],
    },
    ...overrides,
  };
}

try {
  const first = synthesize(inputs());
  assert.equal(validateRecord(first.synthesis, 'synthesis-result').valid, true);
  assert.equal(validateRecord(first.remediationPlan, 'remediation-plan').valid, true);
  assert.ok(first.synthesis.clusters.every(item => validateRecord(item, 'issue-cluster').valid));
  assert.ok(first.remediationPlan.items.every(item => validateRecord(item, 'remediation-item').valid));
  const architectureItem = first.remediationPlan.items.find(item => item.finding_refs.includes('F-SYN-F'));
  assert.ok(architectureItem, 'architecture finding was not integrated into remediation planning');
  assert.ok(first.synthesis.clusters.some(item => item.finding_refs.includes('F-SYN-F')), 'architecture finding was not integrated into synthesis');

  const duplicate = first.synthesis.canonical_findings.find(item => item.source_finding_refs.includes('F-SYN-A'));
  assert.deepEqual(duplicate.source_finding_refs, ['F-SYN-A', 'F-SYN-B'], 'exact duplicates were not grouped');
  assert.ok(duplicate.combined_confidence.score > Math.max(a.confidence.score, b.confidence.score), 'reinforcement did not raise synthesis confidence');
  assert.ok(first.synthesis.relationships.some(item => item.type === 'duplicate_of' && item.source_finding_id === 'F-SYN-B'));
  assert.ok(first.synthesis.relationships.some(item => item.type === 'reinforces'), 'reinforcement relationship missing');
  assert.notEqual(first.synthesis.canonical_findings.find(item => item.source_finding_refs.includes('F-SYN-C')).canonical_id, duplicate.canonical_id, 'ambiguous candidate was unsafely merged');
  assert.ok(first.synthesis.relationships.some(item => item.type === 'related_to'), 'ambiguous relationship was not recorded');

  const causeCluster = first.synthesis.clusters.find(item => item.finding_refs.includes('F-SYN-A'));
  assert.deepEqual(causeCluster.finding_refs, ['F-SYN-A', 'F-SYN-B', 'F-SYN-C']);
  assert.equal(causeCluster.inferred_root_cause.inference, true);
  assert.equal(typeof causeCluster.root_cause_confidence.score, 'number');

  assert.equal(first.synthesis.contradictions.length, 1);
  assert.equal(first.synthesis.contradictions[0].resolution.status, 'unresolved');
  assert.ok(first.synthesis.contradictions[0].additional_evidence_required.length);
  const pairKey = first.synthesis.contradictions[0].finding_refs.join('|');
  const resolved = synthesize(inputs({ contradictionResolutions: {
    [pairKey]: { status: 'resolved', conflict_type: 'contextual', selected_finding_id: 'F-SYN-A', rationale: 'Flow evidence covers the interactive state; visual evidence covers only the static state.', additional_evidence_required: [] },
  } }));
  assert.equal(resolved.synthesis.contradictions[0].resolution.status, 'resolved');
  assert.equal(resolved.synthesis.contradictions[0].resolution.selected_finding_id, 'F-SYN-A');

  const highRisk = first.remediationPlan.items.find(item => item.finding_refs.includes('F-SYN-D'));
  const provisionalCause = first.synthesis.clusters.find(item => item.finding_refs.includes('F-SYN-D'));
  assert.equal(provisionalCause.inferred_root_cause.provisional, true);
  assert.equal(provisionalCause.root_cause_confidence.score, 0.3);
  assert.equal(highRisk.priority.level, 'critical');
  assert.equal(highRisk.priority.band, 'P0');
  assert.equal(highRisk.action_type, 'investigate', 'low confidence should change disposition to investigation');
  assert.equal(highRisk.priority.factors.consequence_severity, 4, 'confidence mathematically reduced severity');
  assert.ok(first.synthesis.evidence_limitations.some(item => /EV-MISSING-HIGH/.test(item)), 'missing evidence was not visible');

  const dependent = first.remediationPlan.items.find(item => item.finding_refs.includes('F-SYN-E'));
  assert.ok(dependent.dependencies.includes(highRisk.remediation_id));
  assert.ok(dependent.wave > highRisk.wave, 'dependency order was not respected');
  assert.ok(first.remediationPlan.waves.some(wave => wave.parallel_ready), 'independent remediation was not parallel-ready');

  const second = synthesize(inputs({ generatedAt: '2026-09-04T15:00:00Z' }));
  assert.equal(second.synthesis.synthesis_id, first.synthesis.synthesis_id);
  assert.equal(second.remediationPlan.plan_id, first.remediationPlan.plan_id);
  assert.deepEqual(second.remediationPlan.items.map(item => item.remediation_id), first.remediationPlan.items.map(item => item.remediation_id));
  assert.deepEqual(second.remediationPlan.waves, first.remediationPlan.waves, 'ordering changed for identical substantive inputs');

  const cycleD = clone(d); cycleD.relationships.depends_on = ['F-SYN-E']; cycleD.evidence_refs = ['EV-SYN-D'];
  const cycleEvidence = [...evidenceRecords, evidence('EV-SYN-D', 'content-audit', 'Policy dependency observed.')];
  const cyclic = synthesize(inputs({ findings: [a, b, c, cycleD, e], evidence: cycleEvidence }));
  assert.equal(cyclic.remediationPlan.cycle_detection.detected, true);
  assert.ok(cyclic.remediationPlan.cycle_detection.cycles[0].length >= 2);
  assert.ok(cyclic.remediationPlan.human_decisions.some(item => /cycle/i.test(item.question)));

  const annotated = annotateLedger(first.sourceFindings, first.synthesis, first.remediationPlan);
  assert.equal(annotated.find(item => item.id === 'F-SYN-A').severity.level, a.severity.level);
  assert.deepEqual(annotated.find(item => item.id === 'F-SYN-A').native_metrics, a.native_metrics);
  assert.ok(annotated.every(item => item.synthesis.remediation_refs.length));

  const applicationRoot = join(temp, 'application'); const runDirectory = join(applicationRoot, 'audits', '2026-09-04-aud');
  mkdirSync(runDirectory, { recursive: true });
  const ledgerPath = join(applicationRoot, 'audits', 'findings-ledger.jsonl');
  const written = writeSynthesisArtifacts({ applicationRoot, runDirectory, inputs: inputs(), ledgerPath });
  for (const name of ['synthesis.json', 'remediation-plan.json', 'synthesis-report.md', 'remediation-plan.md']) assert.ok(existsSync(join(runDirectory, name)), `${name} missing`);
  assert.equal(readFileSync(join(runDirectory, 'synthesis-report.md'), 'utf8'), renderSynthesisReport(written.synthesis));
  assert.equal(readFileSync(join(runDirectory, 'remediation-plan.md'), 'utf8'), renderRemediationReport(written.remediationPlan));
  assert.ok(written.ledger.every(item => item.status !== 'verified'), 'synthesis marked a finding verified');
  assert.deepEqual(written.remediationPlan.authority.application_mutations, []);
  const writtenAgain = writeSynthesisArtifacts({ applicationRoot, runDirectory, inputs: inputs(), ledgerPath });
  assert.equal(writtenAgain.ledger.find(item => item.id === 'F-SYN-A').synthesis.history.length, 1, 'idempotent rerun duplicated synthesis history');
  assert.equal(writtenAgain.ledger.find(item => item.id === 'F-SYN-A').status, a.status, 'idempotent rerun changed finding lifecycle status');
  assert.throws(() => writeSynthesisArtifacts({ applicationRoot, runDirectory: join(temp, 'outside'), inputs: inputs(), ledgerPath }), /MUTATION_PROHIBITED/);

  const mismatched = inputs(); mismatched.captureManifest.project_revision = 'ffffffffffffffffffffffffffffffffffffffff';
  assert.throws(() => synthesize(mismatched), /REVISION_MISMATCH/);
  assert.throws(() => synthesize(inputs({ findings: [], ledger: [] })), /INSUFFICIENT_SYNTHESIS_INPUTS/);

  console.log('PASS — synthesis deduplication, relationships, contradictions, root causes, priority, ordering, cycles, persistence, authority, schemas, and reports validated.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
