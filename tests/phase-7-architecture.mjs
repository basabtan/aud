import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runAud } from '../shared/orchestration/orchestrator.mjs';
import { buildAuditPlan } from '../shared/orchestration/planner.mjs';
import { validateRecord } from '../shared/validators/schema-registry.mjs';

const root = resolve('.');
const integration = join(root, 'tests', 'fixtures', 'integration');
const projectContext = JSON.parse(readFileSync(join(integration, 'project-context.json'), 'utf8'));
const taskModel = JSON.parse(readFileSync(join(integration, 'task-model.json'), 'utf8'));
const revision = projectContext.project.revision;
const generatedAt = '2026-09-04T16:00:00Z';
const currentCapture = { state: 'current', reason: 'Repository evidence baseline is current.', artifact_ref: 'capture-manifest.json', baseline_signature: 'a'.repeat(64), plan_state: 'current' };
const missingContent = { state: 'missing', reason: 'No content contract supplied.', artifact_ref: null, record: null };

function planFor(request, runId) {
  return buildAuditPlan({
    runId,
    request: {
      mode: 'diagnose', current_revision: revision, generated_at: generatedAt, allow_degraded: false,
      scope: { aspects: [], routes: ['/compare'], states: [], persona_refs: ['researcher'] },
      ...request,
    },
    projectContext,
    taskModel,
    priorLedger: [],
    contentContractAssessment: missingContent,
    captureAssessment: currentCapture,
    captureManifestRef: 'capture-manifest.json',
  });
}

const explicit = planFor({ scope: { aspects: ['architecture'], routes: ['/compare'], states: [], persona_refs: ['researcher'] } }, 'RUN-PHASE7-EXPLICIT');
assert.deepEqual(explicit.decisions.filter(item => item.disposition === 'selected').map(item => item.audit), ['architecture-maintainability-audit']);
assert.equal(explicit.decisions.find(item => item.audit === 'architecture-maintainability-audit').degraded, false);

const riskSelected = planFor({
  scope: { aspects: ['functional'], routes: ['/compare'], states: [], persona_refs: ['researcher'] },
  risk_profile: { architecture: 'high' },
}, 'RUN-PHASE7-RISK');
assert.deepEqual(riskSelected.decisions.filter(item => item.disposition === 'selected').map(item => item.audit), ['functional-audit', 'architecture-maintainability-audit']);

const broad = planFor({ scope: { aspects: ['ux'], routes: ['/compare'], states: [], persona_refs: ['researcher'] } }, 'RUN-PHASE7-BROAD');
assert.equal(broad.decisions.find(item => item.audit === 'architecture-maintainability-audit').disposition, 'skipped', 'generic product audit should not expand into repository architecture');
const all = planFor({ scope: { aspects: ['all'], routes: ['/compare'], states: [], persona_refs: ['researcher'] } }, 'RUN-PHASE7-ALL');
assert.equal(all.decisions.find(item => item.audit === 'architecture-maintainability-audit').disposition, 'selected');

const temp = mkdtempSync(join(tmpdir(), 'aud-phase7-'));
try {
  const application = join(temp, 'application');
  mkdirSync(application, { recursive: true });
  const localProject = structuredClone(projectContext);
  localProject.project.application_root = '.';
  const projectPath = join(application, 'project-context.json');
  writeFileSync(projectPath, `${JSON.stringify(localProject, null, 2)}\n`, 'utf8');
  const result = runAud({
    request: {
      mode: 'specialist', requested_specialist: 'architecture-maintainability-audit', current_revision: revision,
      generated_at: generatedAt, depth: 'standard', allow_degraded: false,
      scope: { aspects: ['architecture'], routes: ['/compare'], surfaces: [], states: [], persona_refs: ['researcher'] },
      specialist_inputs: { 'architecture-maintainability-audit': join(root, 'plugins', 'architecture-maintainability-audit', 'fixtures', 'input.json') },
    },
    projectContextPath: projectPath,
    requestBase: root,
  });
  const architectureResult = result.execution.results.find(item => item.audit === 'architecture-maintainability-audit');
  assert.equal(architectureResult.status, 'complete', 'repository-only specialist should not require task or browser capture context');
  const finding = JSON.parse(readFileSync(join(architectureResult.directory, 'findings.jsonl'), 'utf8').trim());
  const evidence = readFileSync(join(architectureResult.directory, 'evidence.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(validateRecord(finding, 'finding').valid, true);
  assert.equal(finding.source_audit, 'architecture-maintainability-audit');
  assert.deepEqual(finding.native_metrics, { cycle_length: 2, dependency_edges: 2, affected_packages: 2, boundary_test_gaps: 1 });
  assert.ok(evidence.every(item => validateRecord(item, 'evidence').valid));
  assert.ok(result.ledger.some(item => item.id === finding.id), 'architecture finding was not merged into the persistent ledger');
  assert.match(readFileSync(join(application, 'audits', 'latest.md'), 'utf8'), /\| Architecture \| .* \| complete \|/);
  assert.deepEqual(result.execution.application_mutations, []);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('PASS — selective architecture planning, structured orchestration, evidence, ledger, and report-only boundaries validated.');
