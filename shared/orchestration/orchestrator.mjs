import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { assertValidRecord, validateRecord } from '../validators/schema-registry.mjs';
import { canonicalJson, stableId } from '../validators/stable-ids.mjs';
import { parseJsonLines } from '../ledger/merge.mjs';
import { runSpecialist } from '../specialists/artifacts.mjs';
import { writeSynthesisArtifacts } from '../synthesis/runner.mjs';
import { buildVerificationPlan } from '../verification/engine.mjs';
import { writeVerificationArtifacts } from '../verification/runner.mjs';
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

function requestValue(value, requestBase, jsonl = false) {
  if (!value) return jsonl ? [] : null;
  if (typeof value !== 'string') return value;
  const path = resolve(requestBase, value);
  return jsonl ? readFindings(path) : readJson(path);
}

function alignVerifySpecialists(plan, verificationPlan) {
  const decisions = new Map(verificationPlan.specialist_decisions.map(item => [item.specialist, item]));
  for (const decision of plan.decisions) {
    const target = decisions.get(decision.audit);
    if (target.disposition === 'selected') {
      if (decision.disposition === 'deferred') decision.reason = `${target.reason} Re-audit remains deferred by shared context readiness.`;
      else { decision.disposition = 'selected'; decision.reason = target.reason; }
    } else {
      decision.disposition = 'skipped'; decision.reason = target.reason;
    }
  }
  const selected = plan.decisions.filter(item => item.disposition === 'selected').map(item => item.audit);
  const content = selected.filter(item => item === 'content-audit');
  const dependent = selected.filter(item => ['place-audit', 'flow-audit'].includes(item));
  const independent = selected.filter(item => !['content-audit', 'place-audit', 'flow-audit'].includes(item));
  plan.execution_waves = [];
  if (content.length || independent.length) plan.execution_waves.push({ wave: 1, audits: [...content, ...independent], readiness_condition: 'Shared candidate revision and evidence baseline are validated.' });
  if (dependent.length) plan.execution_waves.push({ wave: plan.execution_waves.length ? 2 : 1, audits: dependent, readiness_condition: 'A compatible content contract is available, or explicit degraded constraints are recorded.' });
  for (const target of verificationPlan.specialist_decisions) {
    const auditDecision = plan.decisions.find(item => item.audit === target.specialist);
    if (target.disposition === 'selected' && auditDecision.disposition === 'deferred') {
      target.disposition = 'deferred'; target.reason = auditDecision.reason;
    }
  }
  assertValidRecord(plan, 'audit-plan');
  assertValidRecord(verificationPlan, 'verification-plan');
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
  if (request.application_changes?.length ?? 0) throw new Error(`MUTATION_PROHIBITED: ${request.mode} orchestration is analysis/planning-only through Phase 7`);
  const applicationRoot = resolve(dirname(projectPath), projectContext.project.application_root);
  const auditRoot = resolve(applicationRoot, 'audits');
  const date = request.generated_at.slice(0, 10);
  const runDirectory = assertAuditArtifactPath(applicationRoot, canonicalRunDirectory(applicationRoot, date, 'aud'));
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

  const executionResults = [];
  let activeContentPath = contentAssessment.state === 'current' ? contentAssessment.artifact_ref : null;
  let activeFlowPath = request.flow_contract ? resolve(requestBase, request.flow_contract) : null;
  const remediationPath = request.remediation_plan ? resolve(requestBase, request.remediation_plan) : null;
  let verificationPlan = null;
  let verificationInputs = null;
  if (request.mode === 'verify') {
    if (!remediationPath) throw new Error('REMEDIATION_PLAN_REQUIRED: verify mode requires an accepted remediation plan');
    const baselineCapturePath = request.baseline_capture_manifest ? resolve(requestBase, request.baseline_capture_manifest) : null;
    const originalEvidencePath = request.original_evidence ? resolve(requestBase, request.original_evidence) : null;
    const synthesisPath = request.synthesis_result ? resolve(requestBase, request.synthesis_result) : null;
    verificationInputs = {
      runId, generatedAt: request.generated_at, baselineRevision: request.baseline_revision ?? readJson(remediationPath).project_revision,
      candidateRevision: request.current_revision, remediationPlan: readJson(remediationPath), findings: priorLedger,
      originalEvidence: request.original_evidence_records ? requestValue(request.original_evidence_records, requestBase, true) : (originalEvidencePath ? readFindings(originalEvidencePath) : []),
      synthesis: synthesisPath ? readJson(synthesisPath) : request.synthesis_record ?? null,
      implementationStatus: request.implementation_status ?? {}, selectedRemediationIds: request.selected_remediation_ids,
      baselineCapture: baselineCapturePath ? readJson(baselineCapturePath) : request.baseline_capture ?? null,
      candidateEnvironment: request.verification_environment ?? captureManifest.environment,
      availableFixtures: request.available_fixtures ?? captureManifest.fixtures,
      requiredEnvironment: request.required_verification_environment ?? null,
      fixtureRequirements: request.fixture_requirements ?? {}, degradedReasons: request.verification_degraded_reasons ?? [],
      persistentDataMode: request.persistent_data_mode ?? 'isolated', fullRegression: request.full_regression === true,
      inputRefs: { run_manifest: manifestPath, project_context: projectPath, remediation_plan: remediationPath, synthesis: synthesisPath, capture_manifest: baselineCapturePath ?? 'inline:baseline-capture', ledger: resolvedLedger },
      adapterResults: requestValue(request.verification_adapter_results, requestBase) ?? {},
      candidateEvidence: [...captureEvidenceRecords(captureManifest), ...requestValue(request.candidate_evidence, requestBase, true)],
    };
    verificationPlan = buildVerificationPlan(verificationInputs);
    verificationInputs.plan = verificationPlan;
    alignVerifySpecialists(plan, verificationPlan);
    manifest.selected_audits = plan.decisions.filter(item => item.disposition === 'selected').map(item => item.audit);
    if (!manifest.selected_audits.length) manifest.selected_audits = ['aud'];
    const remediationRecord = verificationInputs.remediationPlan;
    manifest.contracts.push(contractEntry('remediation-plan', remediationRecord, remediationPath));
  }
  mkdirSync(auditRoot, { recursive: true });
  mkdirSync(runDirectory, { recursive: false });
  writeJsonAtomic(join(runDirectory, 'audit-plan.json'), plan);
  writeJsonAtomic(capturePath, captureManifest);
  writeJsonlAtomic(join(runDirectory, 'evidence.jsonl'), captureEvidenceRecords(captureManifest));
  writeJsonlAtomic(join(runDirectory, 'prior-open-findings.jsonl'), priorLedger.filter(item => !['verified', 'waived'].includes(item.status)));
  writeJsonAtomic(manifestPath, manifest);
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
  let mergedLedger = mergeLedgerAtomic(applicationRoot, resolvedLedger, priorLedger, incoming, request.generated_at);
  let synthesisExecution = { disposition: plan.synthesis_stage.disposition, status: 'skipped', reason: plan.synthesis_stage.reason };
  if (plan.synthesis_stage.disposition === 'selected') {
    const completed = executionResults.filter(result => result.directory && ['complete', 'degraded'].includes(result.status));
    if (new Set(completed.map(item => item.audit)).size < 2) {
      synthesisExecution = { disposition: 'selected', status: 'skipped', reason: 'Insufficient compatible specialist outputs: synthesis requires findings from at least two completed specialists.' };
    } else {
      const findingPaths = completed.map(result => join(result.directory, 'findings.jsonl'));
      const evidencePaths = completed.map(result => join(result.directory, 'evidence.jsonl'));
      const synthesisResult = writeSynthesisArtifacts({
        applicationRoot,
        runDirectory,
        ledgerPath: resolvedLedger,
        inputs: {
          runId,
          generatedAt: request.generated_at,
          projectRevision: request.current_revision,
          auditPlan: plan,
          runManifest: manifest,
          projectContext,
          taskModel,
          contentContract: activeContentPath && existsSync(activeContentPath) ? readJson(activeContentPath) : null,
          flowContract: activeFlowPath && existsSync(activeFlowPath) ? readJson(activeFlowPath) : null,
          captureManifest,
          findings: incoming,
          evidence: [...readFindings(join(runDirectory, 'evidence.jsonl')), ...evidencePaths.flatMap(readFindings)],
          ledger: mergedLedger,
          relationshipHints: request.synthesis_relationships ?? [],
          contradictionResolutions: request.contradiction_resolutions ?? {},
          inputRefs: {
            audit_plan: join(runDirectory, 'audit-plan.json'),
            run_manifest: manifestPath,
            project_context: projectPath,
            task_model: taskPath,
            content_contract: activeContentPath,
            flow_contract: activeFlowPath,
            capture_manifest: capturePath,
            ledger: resolvedLedger,
            specialist_findings: findingPaths,
            specialist_evidence: evidencePaths,
          },
        },
      });
      mergedLedger = synthesisResult.ledger;
      synthesisExecution = {
        disposition: 'selected', status: 'complete', reason: 'Compatible multi-specialist findings were synthesized.',
        synthesis_ref: join(runDirectory, 'synthesis.json'), remediation_plan_ref: join(runDirectory, 'remediation-plan.json'),
      };
      manifest.contracts.push(contractEntry('synthesis-result', synthesisResult.synthesis, synthesisExecution.synthesis_ref));
      manifest.contracts.push(contractEntry('remediation-plan', synthesisResult.remediationPlan, synthesisExecution.remediation_plan_ref));
    }
  }
  let verificationExecution = { disposition: plan.verification_stage.disposition, status: 'skipped', reason: plan.verification_stage.reason };
  if (request.mode === 'verify') {
    verificationInputs.findings = mergedLedger;
    const verification = writeVerificationArtifacts({ applicationRoot, runDirectory, ledgerPath: resolvedLedger, inputs: verificationInputs });
    mergedLedger = verification.ledger;
    verificationExecution = { disposition: 'selected', status: 'complete', reason: 'Verification and targeted regression artifacts were generated without application mutation.', verification_plan_ref: join(runDirectory, 'verification-plan.json'), verification_results_ref: join(runDirectory, 'verification-results.json'), regression_results_ref: join(runDirectory, 'regression-results.json'), verification_summary_ref: join(runDirectory, 'verification-summary.json') };
    manifest.contracts.push(contractEntry('verification-plan', verification.plan, verificationExecution.verification_plan_ref));
    manifest.contracts.push(contractEntry('verification-result', verification.verificationResults, verificationExecution.verification_results_ref));
    manifest.contracts.push(contractEntry('regression-result', verification.regressionResults, verificationExecution.regression_results_ref));
    manifest.contracts.push(contractEntry('verification-summary', verification.summary, verificationExecution.verification_summary_ref));
  }
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
    synthesis: synthesisExecution,
    verification: verificationExecution,
    ledger_ref: resolvedLedger,
    latest_ref: latestPath,
    phase_boundaries: { synthesis: 'phase-4-analysis-only', verification: 'phase-5-inspection-only', calibration: 'separate-phase-6-command', specialist_expansion: 'phase-7-selective' },
  };
  writeJsonAtomic(join(runDirectory, 'execution.json'), execution);
  return { runDirectory, plan, captureManifest, manifest, execution, ledger: mergedLedger };
}
