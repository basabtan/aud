import { assertValidRecord } from '../validators/schema-registry.mjs';
import { stableId } from '../validators/stable-ids.mjs';

export const specialistOrder = Object.freeze([
  'content-audit',
  'place-audit',
  'flow-audit',
  'visual-audit',
  'functional-audit',
]);

const aspectMap = Object.freeze({
  content: ['content-audit'], information: ['content-audit'], duplication: ['content-audit'],
  placement: ['place-audit'], prominence: ['place-audit'], place: ['place-audit'],
  flow: ['flow-audit'], journey: ['flow-audit'], navigation: ['flow-audit'],
  visual: ['visual-audit'], styling: ['visual-audit'], hierarchy: ['visual-audit'],
  functional: ['functional-audit'], behavior: ['functional-audit'], runtime: ['functional-audit'],
  accessibility: ['functional-audit', 'visual-audit'], performance: ['functional-audit'],
});

const broadAspects = new Set(['all', 'audit', 'broad', 'product', 'ux', 'experience']);
const taskDependent = new Set(['content-audit', 'place-audit', 'flow-audit', 'functional-audit']);

function unique(values) {
  return [...new Set(values)];
}

function status(kind, state, reason, artifactRef) {
  return { kind, state, reason, ...(artifactRef ? { artifact_ref: artifactRef } : {}) };
}

export function unresolvedFindings(records = []) {
  return records.filter(finding => !['verified', 'waived'].includes(finding.status));
}

export function assessContexts({ projectContext, taskModel, request, priorLedger = [], contentContractAssessment, captureAssessment }) {
  assertValidRecord(projectContext, 'project-context');
  const revision = request.current_revision;
  if (!revision) throw new Error('CURRENT_REVISION_REQUIRED: request.current_revision is required');
  if (projectContext.project.revision !== revision) {
    throw new Error(`REVISION_MISMATCH: project context ${projectContext.project.revision} does not match ${revision}`);
  }
  const knownRoutes = new Set(projectContext.routes.flatMap(route => [route.id, route.path]));
  const knownPersonas = new Set(projectContext.personas.map(persona => persona.id));
  const unknownRoutes = (request.scope?.routes ?? []).filter(route => !knownRoutes.has(route));
  const unknownPersonas = (request.scope?.persona_refs ?? []).filter(id => !knownPersonas.has(id));
  const projectState = unknownRoutes.length || unknownPersonas.length ? 'stale' : 'current';
  const projectReason = projectState === 'current'
    ? 'Project revision and requested routes/personas match.'
    : `Requested scope is absent from project context: ${[...unknownRoutes, ...unknownPersonas].join(', ')}`;

  let taskState = 'missing';
  let taskReason = 'No task model was supplied; task-dependent conclusions require degraded handling.';
  if (taskModel) {
    assertValidRecord(taskModel, 'task-model');
    if (taskModel.project_revision !== revision) {
      taskState = 'stale';
      taskReason = `Task model revision ${taskModel.project_revision} does not match ${revision}.`;
    } else {
      const now = Date.parse(request.generated_at);
      const maxAge = (request.max_context_age_days ?? 180) * 86_400_000;
      const staleTasks = taskModel.tasks.filter(task => now - Date.parse(task.last_confirmed) > maxAge).map(task => task.id);
      taskState = staleTasks.length ? 'stale' : 'current';
      taskReason = staleTasks.length
        ? `Task confirmations exceed ${request.max_context_age_days ?? 180} days: ${staleTasks.join(', ')}.`
        : 'Task model revision and confirmation age are current.';
    }
  }
  return {
    entries: [
      status('project-context', projectState, projectReason, request.project_context_ref),
      status('task-model', taskState, taskReason, request.task_model_ref),
      status('prior-ledger', priorLedger.length ? 'current' : 'missing', priorLedger.length ? `${priorLedger.length} prior ledger records loaded.` : 'No prior ledger exists; this is an initial ledger baseline.', request.ledger_ref),
      status('content-contract', contentContractAssessment.state, contentContractAssessment.reason, contentContractAssessment.artifact_ref),
      status('capture-manifest', captureAssessment.state, captureAssessment.reason, captureAssessment.artifact_ref),
    ],
    projectState,
    taskState,
  };
}

function requestedAudits(request, priorOpen) {
  const aspects = (request.scope?.aspects ?? []).map(value => value.toLowerCase());
  if (request.mode === 'specialist') {
    if (!specialistOrder.includes(request.requested_specialist)) throw new Error(`INVALID_SPECIALIST: ${request.requested_specialist ?? 'missing'}`);
    return new Set([request.requested_specialist]);
  }
  if (request.mode === 'redesign') return new Set(['content-audit', 'place-audit', 'flow-audit', 'visual-audit']);
  if (request.mode === 'verify') {
    const implemented = priorOpen.filter(finding => ['implemented', 'partial', 'failed', 'reopened'].includes(finding.status));
    return new Set(['functional-audit', ...implemented.map(finding => finding.source_audit).filter(audit => specialistOrder.includes(audit))]);
  }
  const broad = !aspects.length || aspects.some(value => broadAspects.has(value));
  const selected = new Set(broad ? specialistOrder : aspects.flatMap(aspect => aspectMap[aspect] ?? []));
  const risk = JSON.stringify(request.risk_profile ?? {}).toLowerCase();
  if (/(data[_ -]?loss|security|privacy|correctness)[^}]{0,40}(high|critical)/.test(risk)) selected.add('functional-audit');
  if (/(information[_ -]?density|content[_ -]?complexity)[^}]{0,40}(high|critical)/.test(risk)) {
    selected.add('content-audit'); selected.add('place-audit'); selected.add('flow-audit');
  }
  if (/(visual|design)[^}]{0,40}(high|critical)/.test(risk)) selected.add('visual-audit');
  return selected;
}

function selectionReason(audit, request) {
  if (request.mode === 'specialist') return `Explicit isolated ${audit} request.`;
  if (request.mode === 'redesign') return audit === 'content-audit'
    ? 'Redesign requires content responsibility before dependent design work.'
    : 'Selected by the redesign planning sequence.';
  if (request.mode === 'verify') return audit === 'functional-audit'
    ? 'Verify mode plans accepted-criteria verification through the functional instrument.'
    : 'Producing specialist selected for a ledger finding awaiting verification.';
  return 'Selected deterministically from requested scope and declared risk profile.';
}

export function buildAuditPlan({ runId, request, projectContext, taskModel = null, priorLedger = [], contentContractAssessment, captureAssessment, captureManifestRef }) {
  if (!['diagnose', 'redesign', 'verify', 'specialist'].includes(request.mode)) throw new Error(`INVALID_MODE: ${request.mode}`);
  if (request.mode === 'diagnose' && (request.application_changes?.length ?? 0)) {
    throw new Error('MUTATION_PROHIBITED: diagnose mode cannot request application changes');
  }
  const priorOpen = unresolvedFindings(priorLedger);
  const contexts = assessContexts({ projectContext, taskModel, request, priorLedger, contentContractAssessment, captureAssessment });
  const selected = requestedAudits(request, priorOpen);
  const currentContent = contentContractAssessment.state === 'current';
  if (request.mode !== 'specialist' && (selected.has('place-audit') || selected.has('flow-audit')) && !currentContent) selected.add('content-audit');
  const allowDegraded = request.allow_degraded === true;
  const decisions = specialistOrder.map(audit => {
    let disposition = selected.has(audit) ? 'selected' : 'skipped';
    let reason = disposition === 'selected' ? selectionReason(audit, request) : 'Not selected by requested scope, mode, or risk profile.';
    const dependencies = [];
    const consequences = [];
    let degraded = false;
    if (audit === 'place-audit' || audit === 'flow-audit') {
      dependencies.push(currentContent ? 'content-contract' : 'content-audit');
      if (request.mode === 'specialist' && !currentContent && disposition === 'selected') {
        if (allowDegraded) {
          degraded = true;
          consequences.push('Content survival and responsibility are unconfirmed; findings cannot make content decisions.');
          reason += ' Missing content contract explicitly accepted as degraded.';
        } else {
          disposition = 'deferred';
          reason = 'A current content contract is required; rerun with allow_degraded to accept constrained standalone behavior.';
        }
      }
    }
    if (request.mode === 'redesign' && audit === 'functional-audit') {
      disposition = 'deferred';
      reason = 'Functional verification is deferred until implementation exists; Phase 3 does not implement it.';
    }
    if (request.mode === 'verify' && audit === 'functional-audit' && !priorOpen.some(finding => ['implemented', 'partial', 'failed', 'reopened'].includes(finding.status))) {
      disposition = 'deferred';
      reason = 'No implemented or reopened ledger findings are eligible; full verification remains Phase 5.';
    }
    if (disposition === 'selected' && taskDependent.has(audit) && contexts.taskState !== 'current') {
      if (allowDegraded) {
        degraded = true;
        consequences.push('Task-dependent severity, reach, or relevance may be incomplete because task context is missing or stale.');
      } else {
        disposition = 'deferred';
        reason = 'Task context is missing or stale and degraded execution was not allowed.';
      }
    }
    if (disposition === 'selected' && contexts.projectState !== 'current') {
      if (allowDegraded) {
        degraded = true;
        consequences.push('Requested routes or personas are not confirmed by project context.');
      } else {
        disposition = 'deferred';
        reason = 'Requested scope is stale against project context and degraded execution was not allowed.';
      }
    }
    if (disposition === 'selected' && captureAssessment.state !== 'current' && captureAssessment.state !== 'reused') {
      degraded = true;
      consequences.push('Shared capture coverage is incomplete; specialists must record uncaptured states.');
    }
    return { audit, disposition, reason, dependencies, degraded, consequences: unique(consequences) };
  });

  const selectedDecisions = decisions.filter(item => item.disposition === 'selected');
  const contentSelected = selectedDecisions.some(item => item.audit === 'content-audit');
  const dependent = selectedDecisions.filter(item => ['place-audit', 'flow-audit'].includes(item.audit));
  const independent = selectedDecisions.filter(item => !['place-audit', 'flow-audit'].includes(item.audit));
  const executionWaves = [];
  if (independent.length) executionWaves.push({
    wave: 1,
    audits: independent.map(item => item.audit),
    readiness_condition: 'Shared project revision and evidence baseline are validated.',
  });
  if (dependent.length) executionWaves.push({
    wave: executionWaves.length ? 2 : 1,
    audits: dependent.map(item => item.audit),
    readiness_condition: contentSelected
      ? 'The selected content-audit has emitted a schema-valid current content contract.'
      : currentContent
        ? 'The supplied content contract is schema-valid and current.'
        : 'Explicit degraded mode records the missing content-contract consequences.',
  });
  const degradedConsequences = unique(decisions.flatMap(item => item.consequences));
  const selectedAuditNames = selectedDecisions.map(item => item.audit);
  const synthesisRequested = request.synthesis !== false && request.mode !== 'specialist' && selectedAuditNames.length > 1;
  const synthesisStage = request.mode === 'specialist'
    ? { disposition: 'skipped', reason: 'Specialist-only runs remain independent and do not invoke cross-audit synthesis.', dependencies: [] }
    : synthesisRequested
      ? {
          disposition: 'selected',
          reason: 'Cross-audit synthesis is enabled for this multi-specialist run and will execute when compatible specialist outputs exist.',
          dependencies: [...selectedAuditNames, 'shared-evidence', 'persistent-ledger'],
        }
      : {
          disposition: 'skipped',
          reason: request.synthesis === false ? 'Synthesis was explicitly disabled.' : 'Fewer than two specialists were selected; cross-audit evidence is insufficient.',
          dependencies: [],
        };
  const plan = {
    schema_version: 'aud-audit-plan-v1',
    plan_id: stableId('AP', runId, { mode: request.mode, scope: request.scope ?? {}, decisions: decisions.map(item => [item.audit, item.disposition]) }),
    run_id: runId,
    mode: request.mode,
    generated_at: request.generated_at,
    project_revision: request.current_revision,
    requested_scope: {
      aspects: unique(request.scope?.aspects ?? []),
      routes: unique(request.scope?.routes ?? []),
      states: unique(request.scope?.states ?? []),
      persona_refs: unique(request.scope?.persona_refs ?? []),
      requested_specialist: request.requested_specialist ?? null,
    },
    context_status: contexts.entries,
    prior_open_finding_refs: priorOpen.map(finding => finding.id),
    decisions,
    execution_waves: executionWaves,
    synthesis_stage: synthesisStage,
    evidence_baseline: {
      capture_manifest_ref: captureManifestRef,
      project_revision: request.current_revision,
      baseline_signature: captureAssessment.baseline_signature,
      state: captureAssessment.plan_state,
    },
    degraded: degradedConsequences.length > 0,
    degraded_consequences: degradedConsequences,
    report_only: true,
    application_mutation_allowed: false,
    deferred_capabilities: ['remediation execution', 'full verification execution'],
  };
  assertValidRecord(plan, 'audit-plan');
  return plan;
}
