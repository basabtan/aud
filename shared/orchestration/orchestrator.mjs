import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { assertValidRecord, validateRecord } from '../validators/schema-registry.mjs';
import { canonicalJson, stableId } from '../validators/stable-ids.mjs';
import { parseJsonLines } from '../ledger/merge.mjs';
import { runSpecialist } from '../specialists/artifacts.mjs';
import { buildCaptureManifest, captureEvidenceRecords } from './evidence.mjs';
import { buildAuditPlan } from './planner.mjs';
import { assertAuditArtifactPath, canonicalRunDirectory } from './paths.mjs';
import { mergeLedgerAtomic, readLedger, updateLatestAtomic, writeJsonAtomic, writeJsonlAtomic } from './persistence.mjs';

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function safeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'initial';
}

function defaultCapture(projectContext, request) {
  const capture = structuredClone(request.capture ?? {});
  capture.routes ??= request.scope?.routes?.length ? request.scope.routes : projectContext.routes.map(route => route.path);
  capture.states ??= request.scope?.states?.length ? request.scope.states : ['initial'];
  capture.fixtures ??= projectContext.fixture_variants.map(item => item.id);
  capture.viewports ??= ['1280x800'];
  capture.environment ??= { source: 'not-captured' };
  capture.artifacts ??= [];
  if (!capture.required_artifact_keys) {
    const fixture = capture.fixtures[0] ?? 'default';
    const viewport = capture.viewports[0] ?? '1280x800';
    capture.required_artifact_keys = capture.routes.flatMap(route => capture.states.map(state => safeKey(`${route}-${state}-${fixture}-${viewport}`)));
  }
  return capture;
}

export function inspectContentContract(path, projectRevision, request) {
  if (!path) return { state: 'missing', reason: 'No content contract was supplied.', artifact_ref: null, record: null };
  const artifactRef = resolve(path);
  let record;
  try {
    record = readJson(artifactRef);
  } catch (error) {
    return { state: 'incompatible', reason: `Content contract cannot be read: ${error.message}`, artifact_ref: artifactRef, record: null };
  }
  const validation = validateRecord(record, 'content-contract');
  if (!validation.valid) return { state: 'incompatible', reason: validation.errors.map(item => `${item.code}: ${item.message}`).join('; '), artifact_ref: artifactRef, record: null };
  const reasons = [];
  if (record.project_revision !== projectRevision) reasons.push(`revision ${record.project_revision} does not match ${projectRevision}`);
  if (record.status !== 'accepted') reasons.push(`contract status is ${record.status}, not accepted`);
  const age = Date.parse(request.generated_at) - Date.parse(record.generated_at);
  if (age > (request.max_contract_age_days ?? 30) * 86_400_000) reasons.push(`contract exceeds ${request.max_contract_age_days ?? 30} days`);
  const coveredStages = new Set(record.content_items.flatMap(item => item.journey_stage_refs));
  for (const stage of request.scope?.stage_refs ?? []) if (!coveredStages.has(stage)) reasons.push(`journey stage ${stage} is not covered`);
  return reasons.length
    ? { state: 'stale', reason: `Content contract is stale: ${reasons.join('; ')}.`, artifact_ref: artifactRef, record }
    : { state: 'current', reason: 'Content contract schema, revision, status, age, and requested stage coverage are current.', artifact_ref: artifactRef, record };
}

function readPreviousCapture(path, projectRevision) {
  if (!path) return { record: null, note: 'No prior capture manifest was supplied.' };
  const artifactRef = resolve(path);
  try {
    const record = readJson(artifactRef);
    const validation = validateRecord(record, 'capture-manifest');
    if (!validation.valid) return { record: null, note: `Prior capture manifest is incompatible: ${validation.errors[0].code}.` };
    if (record.project_revision !== projectRevision) return { record: null, note: `Prior capture revision ${record.project_revision} was rejected for ${projectRevision}.` };
    return { record, note: 'Prior capture manifest is schema-valid and revision-compatible.' };
  } catch (error) {
    return { record: null, note: `Prior capture manifest cannot be read: ${error.message}` };
  }
}

function contractEntry(kind, record, artifactRef, status = 'current') {
  return {
    kind,
    schema_version: record.schema_version,
    artifact_ref: artifactRef,
    hash: sha256(record),
    status,
  };
}

function makeRunManifest({ runId, request, projectContext, taskModel, plan, captureManifest, runDirectory, contentAssessment }) {
  const contracts = [
    contractEntry('project-context', projectContext, request.project_context_ref),
    contractEntry('capture-manifest', captureManifest, join(runDirectory, 'capture-manifest.json')),
  ];
  if (taskModel) contracts.push(contractEntry('task-model', taskModel, request.task_model_ref, taskModel.project_revision === request.current_revision ? 'current' : 'stale'));
  if (contentAssessment.record) contracts.push(contractEntry('content-contract', contentAssessment.record, contentAssessment.artifact_ref, contentAssessment.state));
  const selected = plan.decisions.filter(item => item.disposition === 'selected').map(item => item.audit);
  return {
    schema_version: 'aud-run-manifest-v1',
    run_id: runId,
    mode: request.mode,
    selected_audits: selected.length ? selected : ['aud'],
    application: {
      root: projectContext.project.application_root,
      repository: projectContext.project.repository,
      revision: request.current_revision,
    },
    started_at: request.generated_at,
    finished_at: null,
    depth: request.depth ?? 'standard',
    scope: {
      routes: request.scope?.routes ?? [],
      surfaces: request.scope?.surfaces ?? [],
      states: request.scope?.states ?? [],
    },
    environment: captureManifest.environment,
    contracts,
    evidence_manifest: join(runDirectory, 'evidence.jsonl'),
    skipped_inputs: plan.context_status.filter(item => !['current', 'not-applicable'].includes(item.state)).map(item => `${item.kind}: ${item.state}`),
    degraded: plan.degraded || captureManifest.status !== 'complete',
    status: 'running',
  };
}

function specialistArguments({ manifestPath, projectPath, taskPath, capturePath, inputPath, outputDirectory, contentPath, flowPath, remediationPath }) {
  const args = ['--manifest', manifestPath, '--project-context', projectPath];
  if (taskPath) args.push('--task-model', taskPath);
  if (capturePath) args.push('--capture-manifest', capturePath);
  if (contentPath) args.push('--content-contract', contentPath);
  if (flowPath) args.push('--flow-contract', flowPath);
  if (remediationPath) args.push('--remediation-plan', remediationPath);
  args.push('--input', inputPath, '--out', outputDirectory);
  return args;
}

function readFindings(path) {
  return existsSync(path) ? parseJsonLines(readFileSync(path, 'utf8'), path) : [];
}

export function runAud({ request, projectContextPath, taskModelPath = null, contentContractPath = null, previousCapturePath = null, ledgerPath = null, requestBase = process.cwd() }) {
  const projectPath = resolve(projectContextPath);
  const projectContext = readJson(projectPath);
  assertValidRecord(projectContext, 'project-context');
  const taskPath = taskModelPath ? resolve(taskModelPath) : null;
  const taskModel = taskPath ? readJson(taskPath) : null;
  if (taskModel) assertValidRecord(taskModel, 'task-model');
  request = structuredClone(request);
  request.generated_at ??= new Date().toISOString();
  request.project_context_ref = projectPath;
  request.task_model_ref = taskPath;
  if (!request.current_revision) throw new Error('CURRENT_REVISION_REQUIRED: request.current_revision is required');
  if (projectContext.project.revision !== request.current_revision) {
    throw new Error(`REVISION_MISMATCH: project context ${projectContext.project.revision} does not match ${request.current_revision}`);
  }
  if (request.mode === 'diagnose' && (request.application_changes?.length ?? 0)) throw new Error('MUTATION_PROHIBITED: diagnose mode is strictly report-only');
  const applicationRoot = resolve(dirname(projectPath), projectContext.project.application_root);
  const auditRoot = resolve(applicationRoot, 'audits');
  mkdirSync(auditRoot, { recursive: true });
  const date = request.generated_at.slice(0, 10);
  const runDirectory = assertAuditArtifactPath(applicationRoot, canonicalRunDirectory(applicationRoot, date, 'aud'));
  mkdirSync(runDirectory, { recursive: false });
  const runId = stableId('RUN', request.current_revision, { generated_at: request.generated_at, mode: request.mode, scope: request.scope ?? {} });
  const resolvedLedger = ledgerPath ? resolve(ledgerPath) : join(auditRoot, 'findings-ledger.jsonl');
  assertAuditArtifactPath(applicationRoot, resolvedLedger);
  const priorLedger = readLedger(resolvedLedger);
  for (const finding of priorLedger) assertValidRecord(finding, 'finding');

  const contentAssessment = inspectContentContract(contentContractPath, request.current_revision, request);
  const previousCapture = readPreviousCapture(previousCapturePath, request.current_revision);
  const capture = defaultCapture(projectContext, request);
  const captureManifest = buildCaptureManifest({
    runId,
    projectRevision: request.current_revision,
    createdAt: request.generated_at,
    capture,
    previous: previousCapture.record,
  });
  const capturePath = join(runDirectory, 'capture-manifest.json');
  const captureAssessment = {
    state: captureManifest.status === 'complete' ? (captureManifest.reused_evidence_refs.length ? 'current' : 'current') : 'stale',
    reason: `${previousCapture.note} ${captureManifest.reused_evidence_refs.length} artifacts reused; ${captureManifest.capture_needed.length} captures remain.`,
    artifact_ref: capturePath,
    baseline_signature: captureManifest.baseline_signature,
    plan_state: captureManifest.status === 'complete' ? (captureManifest.reused_evidence_refs.length ? 'reused' : 'current') : 'degraded',
  };
  request.ledger_ref = resolvedLedger;
  const plan = buildAuditPlan({
    runId,
    request,
    projectContext,
    taskModel,
    priorLedger,
    contentContractAssessment: contentAssessment,
    captureAssessment,
    captureManifestRef: capturePath,
  });
  const manifest = makeRunManifest({ runId, request, projectContext, taskModel, plan, captureManifest, runDirectory, contentAssessment });
  const manifestPath = join(runDirectory, 'run-manifest.json');
  writeJsonAtomic(join(runDirectory, 'audit-plan.json'), plan);
  writeJsonAtomic(capturePath, captureManifest);
  writeJsonlAtomic(join(runDirectory, 'evidence.jsonl'), captureEvidenceRecords(captureManifest));
  writeJsonlAtomic(join(runDirectory, 'prior-open-findings.jsonl'), priorLedger.filter(item => !['verified', 'waived'].includes(item.status)));
  writeJsonAtomic(manifestPath, manifest);

  const executionResults = [];
  let activeContentPath = contentAssessment.state === 'current' ? contentAssessment.artifact_ref : null;
  let activeFlowPath = request.flow_contract ? resolve(requestBase, request.flow_contract) : null;
  const remediationPath = request.remediation_plan ? resolve(requestBase, request.remediation_plan) : null;
  const inputs = request.specialist_inputs ?? {};
  for (const wave of plan.execution_waves) {
    for (const audit of wave.audits) {
      const input = inputs[audit];
      if (!input) {
        executionResults.push({ audit, wave: wave.wave, status: 'planned', reason: 'No observation packet supplied; skill execution remains planned.' });
        continue;
      }
      const decision = plan.decisions.find(item => item.audit === audit);
      if (['place-audit', 'flow-audit'].includes(audit) && !activeContentPath && !decision.degraded) {
        executionResults.push({ audit, wave: wave.wave, status: 'deferred', reason: 'Content dependency did not produce a valid contract.' });
        continue;
      }
      const outputDirectory = assertAuditArtifactPath(applicationRoot, canonicalRunDirectory(applicationRoot, date, audit.replace('-audit', '')));
      mkdirSync(outputDirectory, { recursive: false });
      runSpecialist(audit, specialistArguments({
        manifestPath,
        projectPath,
        taskPath,
        capturePath,
        inputPath: resolve(requestBase, input),
        outputDirectory,
        contentPath: activeContentPath,
        flowPath: activeFlowPath,
        remediationPath,
      }));
      executionResults.push({ audit, wave: wave.wave, status: decision.degraded ? 'degraded' : 'complete', directory: outputDirectory });
      if (audit === 'content-audit') activeContentPath = join(outputDirectory, 'content-contract.json');
      if (audit === 'flow-audit') activeFlowPath = join(outputDirectory, 'flow-contract.json');
    }
  }

  const incoming = executionResults.flatMap(result => result.directory ? readFindings(join(result.directory, 'findings.jsonl')) : []);
  const mergedLedger = mergeLedgerAtomic(applicationRoot, resolvedLedger, priorLedger, incoming, request.generated_at);
  const latestPath = updateLatestAtomic({
    applicationRoot,
    latestPath: join(auditRoot, 'latest.md'),
    timestamp: request.generated_at,
    revision: request.current_revision,
    executionResults,
    ledger: mergedLedger,
  });
  manifest.finished_at = request.generated_at;
  manifest.status = 'completed';
  manifest.degraded ||= executionResults.some(item => ['degraded', 'deferred'].includes(item.status));
  if (activeContentPath && !manifest.contracts.some(item => item.kind === 'content-contract' && item.artifact_ref === activeContentPath)) {
    manifest.contracts.push(contractEntry('content-contract', readJson(activeContentPath), activeContentPath));
  }
  if (activeFlowPath && existsSync(activeFlowPath)) manifest.contracts.push(contractEntry('flow-contract', readJson(activeFlowPath), activeFlowPath));
  assertValidRecord(manifest, 'run-manifest');
  writeJsonAtomic(manifestPath, manifest);
  const execution = {
    schema_version: 'aud-execution-summary-v1',
    run_id: runId,
    report_only: true,
    application_mutations: [],
    results: executionResults,
    ledger_ref: resolvedLedger,
    latest_ref: latestPath,
    phase_boundaries: { synthesis: 'deferred-phase-4', verification: 'planned-only-phase-5' },
  };
  writeJsonAtomic(join(runDirectory, 'execution.json'), execution);
  return { runDirectory, plan, captureManifest, manifest, execution, ledger: mergedLedger };
}
