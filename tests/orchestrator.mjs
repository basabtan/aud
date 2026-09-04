import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildCaptureManifest } from '../shared/orchestration/evidence.mjs';
import { inspectContentContract, runAud } from '../shared/orchestration/orchestrator.mjs';
import { buildAuditPlan } from '../shared/orchestration/planner.mjs';
import { isWithinPortable, normalizePortablePath, portableRelative } from '../shared/orchestration/paths.mjs';
import { validateRecord } from '../shared/validators/schema-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const integration = join(root, 'tests', 'fixtures', 'integration');
const orchestration = join(root, 'tests', 'fixtures', 'orchestration');
const temp = mkdtempSync(join(tmpdir(), 'aud-orchestrator-'));
const application = join(temp, 'application');
mkdirSync(join(application, 'audits'), { recursive: true });

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function hashDirectory(path) {
  const hash = createHash('sha256');
  for (const name of readdirSync(path, { recursive: true }).map(String).sort()) {
    const candidate = join(path, name);
    try { hash.update(name).update(readFileSync(candidate)); } catch {}
  }
  return hash.digest('hex');
}

function cloneFixture(source, target, change = record => record) {
  const record = change(json(source));
  writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return target;
}

const projectPath = cloneFixture(join(integration, 'project-context.json'), join(application, 'project-context.json'), record => {
  record.project.application_root = '.';
  return record;
});
const taskPath = cloneFixture(join(integration, 'task-model.json'), join(application, 'task-model.json'));
const priorFinding = json(join(root, 'tests', 'fixtures', 'schemas', 'finding', 'valid.json'));
const ledgerPath = join(application, 'audits', 'findings-ledger.jsonl');
writeFileSync(ledgerPath, `${JSON.stringify(priorFinding)}\n`, 'utf8');

const request = json(join(orchestration, 'request.json'));

try {
  const first = runAud({
    request,
    projectContextPath: projectPath,
    taskModelPath: taskPath,
    ledgerPath,
    requestBase: orchestration,
  });

  assert.equal(validateRecord(first.plan, 'audit-plan').valid, true, 'audit plan is not schema-valid');
  assert.equal(validateRecord(first.captureManifest, 'capture-manifest').valid, true, 'capture manifest is not schema-valid');
  assert.deepEqual(
    first.plan.decisions.filter(item => item.disposition === 'selected').map(item => item.audit),
    ['content-audit', 'place-audit', 'flow-audit'],
    'audit selection is not deterministic for content/placement/flow scope',
  );
  assert.deepEqual(first.plan.execution_waves[0].audits, ['content-audit']);
  assert.deepEqual(first.plan.execution_waves[1].audits, ['place-audit', 'flow-audit'], 'place and flow are not parallel-ready');
  assert.match(first.plan.execution_waves[1].readiness_condition, /content contract/i);
  assert.equal(first.plan.report_only, true);
  assert.equal(first.plan.application_mutation_allowed, false);
  assert.deepEqual(first.execution.application_mutations, []);

  const results = new Map(first.execution.results.map(item => [item.audit, item]));
  assert.equal(results.get('content-audit').status, 'complete');
  assert.equal(results.get('place-audit').wave, 2);
  assert.equal(results.get('flow-audit').wave, 2);
  const placeFindings = readFileSync(join(results.get('place-audit').directory, 'findings.jsonl'), 'utf8').trim().split('\n');
  assert.equal(placeFindings.length, 1, 'place did not filter upstream-removed content');

  const baselines = ['content-audit', 'place-audit', 'flow-audit'].map(audit => json(join(results.get(audit).directory, 'input-status.json')).evidence_baseline);
  assert.ok(baselines.every(item => item.baseline_signature === first.captureManifest.baseline_signature));
  assert.ok(baselines.every(item => item.project_revision === request.current_revision));

  assert.ok(first.ledger.some(item => item.id === priorFinding.id), 'prior unresolved finding was erased');
  assert.ok(first.ledger.length > 1, 'new specialist findings were not merged');
  assert.ok(existsSync(join(application, 'audits', 'latest.md')));
  assert.ok(first.runDirectory.startsWith(join(application, 'audits')));

  const contentPath = join(results.get('content-audit').directory, 'content-contract.json');
  const currentAssessment = inspectContentContract(contentPath, request.current_revision, request);
  assert.equal(currentAssessment.state, 'current');
  const stalePath = cloneFixture(contentPath, join(temp, 'stale-content.json'), record => {
    record.project_revision = 'ffffffffffffffffffffffffffffffffffffffff';
    return record;
  });
  assert.equal(inspectContentContract(stalePath, request.current_revision, request).state, 'stale');
  const incompatiblePath = cloneFixture(contentPath, join(temp, 'future-content.json'), record => {
    record.schema_version = 'aud-content-contract-v99';
    return record;
  });
  assert.equal(inspectContentContract(incompatiblePath, request.current_revision, request).state, 'incompatible');

  const captureAssessment = {
    state: 'current', reason: 'Fixture capture is current.', artifact_ref: 'capture-manifest.json',
    baseline_signature: first.captureManifest.baseline_signature, plan_state: 'current',
  };
  const missingContent = { state: 'missing', reason: 'No content contract.', artifact_ref: null, record: null };
  const specialistRequest = {
    ...request,
    mode: 'specialist',
    requested_specialist: 'place-audit',
    scope: { ...request.scope, aspects: ['placement'] },
    specialist_inputs: {},
  };
  const commonPlan = {
    runId: 'RUN-SPECIALIST-001', request: specialistRequest, projectContext: json(projectPath), taskModel: json(taskPath),
    priorLedger: first.ledger, contentContractAssessment: missingContent, captureAssessment, captureManifestRef: 'capture-manifest.json',
  };
  const blocked = buildAuditPlan(commonPlan);
  assert.equal(blocked.decisions.find(item => item.audit === 'place-audit').disposition, 'deferred');
  const degraded = buildAuditPlan({ ...commonPlan, request: { ...specialistRequest, allow_degraded: true } });
  const degradedPlace = degraded.decisions.find(item => item.audit === 'place-audit');
  assert.equal(degradedPlace.disposition, 'selected');
  assert.equal(degradedPlace.degraded, true);
  assert.ok(degraded.degraded_consequences.some(item => /Content survival/.test(item)));

  const staleTaskModel = structuredClone(json(taskPath));
  staleTaskModel.tasks[0].last_confirmed = '2020-01-01T00:00:00Z';
  const staleTaskPlan = buildAuditPlan({
    ...commonPlan,
    runId: 'RUN-STALE-TASK-001',
    request: { ...specialistRequest, requested_specialist: 'content-audit', scope: { ...request.scope, aspects: ['content'] } },
    taskModel: staleTaskModel,
  });
  assert.equal(staleTaskPlan.context_status.find(item => item.kind === 'task-model').state, 'stale');
  assert.equal(staleTaskPlan.decisions.find(item => item.audit === 'content-audit').disposition, 'deferred');
  const staleTaskDegradedPlan = buildAuditPlan({
    ...commonPlan,
    runId: 'RUN-STALE-TASK-002',
    request: {
      ...specialistRequest,
      requested_specialist: 'content-audit',
      scope: { ...request.scope, aspects: ['content'] },
      allow_degraded: true,
    },
    taskModel: staleTaskModel,
  });
  const staleTaskContent = staleTaskDegradedPlan.decisions.find(item => item.audit === 'content-audit');
  assert.equal(staleTaskContent.disposition, 'selected');
  assert.equal(staleTaskContent.degraded, true);
  assert.ok(staleTaskContent.consequences.some(item => /task context is missing or stale/i.test(item)));

  const repeatedPlan = buildAuditPlan(commonPlan);
  assert.deepEqual(repeatedPlan.decisions, blocked.decisions, 'same request produced different audit decisions');
  assert.deepEqual(repeatedPlan.execution_waves, blocked.execution_waves, 'same request produced different dependency waves');

  const directVisual = buildAuditPlan({
    ...commonPlan,
    runId: 'RUN-SPECIALIST-002',
    request: { ...specialistRequest, requested_specialist: 'visual-audit', scope: { ...request.scope, aspects: ['visual'] } },
  });
  assert.deepEqual(directVisual.decisions.filter(item => item.disposition === 'selected').map(item => item.audit), ['visual-audit']);
  for (const specialist of ['content-audit', 'place-audit', 'flow-audit', 'visual-audit', 'functional-audit']) {
    assert.ok(existsSync(join(root, 'plugins', specialist, 'skills', specialist, 'SKILL.md')), `${specialist} direct command was removed`);
  }

  assert.throws(() => runAud({
    request: { ...request, current_revision: 'ffffffffffffffffffffffffffffffffffffffff' },
    projectContextPath: projectPath, taskModelPath: taskPath, requestBase: orchestration,
  }), /REVISION_MISMATCH/);
  assert.throws(() => runAud({
    request: { ...request, application_changes: ['src/app.ts'] },
    projectContextPath: projectPath, taskModelPath: taskPath, requestBase: orchestration,
  }), /MUTATION_PROHIBITED/);

  const firstHash = hashDirectory(first.runDirectory);
  const secondRequest = { ...request, generated_at: '2026-09-04T11:30:00Z', specialist_inputs: {} };
  const second = runAud({
    request: secondRequest,
    projectContextPath: projectPath,
    taskModelPath: taskPath,
    previousCapturePath: join(first.runDirectory, 'capture-manifest.json'),
    ledgerPath,
    requestBase: orchestration,
  });
  assert.notEqual(second.runDirectory, first.runDirectory);
  assert.match(second.runDirectory, /-aud-02$/);
  assert.equal(hashDirectory(first.runDirectory), firstHash, 'later run mutated an immutable prior run');
  assert.deepEqual(second.captureManifest.reused_evidence_refs, first.captureManifest.artifacts.map(item => item.evidence_id));
  assert.equal(second.captureManifest.artifacts.length, first.captureManifest.artifacts.length, 'reused capture was duplicated');
  assert.ok(second.ledger.some(item => item.id === priorFinding.id), 'carry-forward failed on later run');

  const reused = buildCaptureManifest({
    runId: 'RUN-CAPTURE-REUSE', projectRevision: request.current_revision, createdAt: '2026-09-04T12:00:00Z',
    capture: request.capture, previous: first.captureManifest,
  });
  assert.equal(reused.artifacts[0].evidence_id, first.captureManifest.artifacts[0].evidence_id);
  assert.equal(reused.artifacts[0].reused, true);

  assert.equal(normalizePortablePath('C:\\Work\\App\\audits\\.\\run'), 'C:/Work/App/audits/run');
  assert.equal(normalizePortablePath('/srv/app/audits/../audits/run'), '/srv/app/audits/run');
  assert.equal(isWithinPortable('C:/work/app/audits', 'c:\\WORK\\app\\audits\\run'), true);
  assert.equal(isWithinPortable('/srv/app/audits', '/srv/app/audits/run'), true);
  assert.equal(portableRelative('C:\\Work\\App\\audits', 'C:\\Work\\App\\audits\\run'), 'run');
  assert.equal(portableRelative('/srv/app/audits', '/srv/app/audits/run'), 'run');

  const cliApplication = join(temp, 'cli-application');
  mkdirSync(cliApplication, { recursive: true });
  const cliProject = cloneFixture(join(integration, 'project-context.json'), join(cliApplication, 'project-context.json'), record => {
    record.project.application_root = '.';
    return record;
  });
  const cliTask = cloneFixture(join(integration, 'task-model.json'), join(cliApplication, 'task-model.json'));
  const cliRequest = {
    ...request,
    mode: 'specialist',
    requested_specialist: 'visual-audit',
    generated_at: '2026-09-04T13:00:00Z',
    scope: { ...request.scope, aspects: ['visual'] },
    specialist_inputs: { 'visual-audit': join(integration, 'visual-input.json') },
  };
  const cliRequestPath = join(temp, 'cli-request.json');
  writeFileSync(cliRequestPath, `${JSON.stringify(cliRequest, null, 2)}\n`, 'utf8');
  const cli = spawnSync(process.execPath, [
    join(root, 'plugins', 'aud', 'skills', 'aud', 'scripts', 'aud.mjs'),
    '--request', cliRequestPath,
    '--project-context', cliProject,
    '--task-model', cliTask,
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  const cliResult = JSON.parse(cli.stdout);
  assert.ok(existsSync(join(cliResult.run_directory, 'audit-plan.json')), 'one-command CLI did not create a plan');
  assert.ok(existsSync(join(cliApplication, 'audits', '2026-09-04-visual', 'findings.jsonl')), 'one-command CLI did not produce the specialist run');

  console.log('PASS — deterministic planning, dependencies, degraded mode, evidence reuse, persistence, safety, compatibility, and portable paths validated.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
