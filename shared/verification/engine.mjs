import { allowedTransitions } from '../ledger/merge.mjs';
import { assertValidRecord } from '../validators/schema-registry.mjs';
import { canonicalJson, evidenceId, stableId } from '../validators/stable-ids.mjs';

const specialists = ['content-audit', 'place-audit', 'flow-audit', 'visual-audit', 'functional-audit'];
const outcomes = new Set(['passed', 'partially_passed', 'failed', 'blocked', 'inconclusive', 'not_run']);
const comparisons = new Set(['fixed', 'improved_but_incomplete', 'unchanged', 'worsened', 'no_longer_reproducible', 'unable_to_compare']);

function unique(values = []) { return [...new Set(values)].sort(); }
function implementationRecord(records, id) {
  if (Array.isArray(records)) return records.find(item => item.remediation_id === id) ?? null;
  return records?.[id] ?? null;
}

export function methodCategory(method) {
  const value = `${method.instrument} ${method.procedure}`.toLowerCase();
  if (/manual|expert|reviewer/.test(value)) return 'manual_expert_review';
  if (/accessib|axe|wcag|screen reader/.test(value)) return 'accessibility_check';
  if (/performance|lighthouse|latency|timing|web vital/.test(value)) return 'performance_measurement';
  if (/visual|screenshot|pixel|viewport/.test(value)) return 'visual_comparison';
  if (/content|copy|editorial|contract/.test(value)) return 'content_inspection';
  if (/browser|playwright|interaction|route|journey|flow/.test(value)) return 'browser_interaction';
  if (/test|unit|integration|e2e|assert/.test(value)) return 'automated_test';
  if (/evidence|investigat|inspect|repository/.test(value)) return 'evidence_only_investigation';
  return null;
}

function affectedSpecialists(item, finding, full) {
  if (full) return new Set(specialists);
  const selected = new Set([finding.source_audit].filter(value => specialists.includes(value)));
  const value = `${finding.source_audit} ${finding.category} ${item.affected_areas.join(' ')}`.toLowerCase();
  if (/content|copy|editorial/.test(value)) ['content-audit', 'place-audit', 'flow-audit'].forEach(audit => selected.add(audit));
  if (/place|prominen|layout|location/.test(value)) ['place-audit', 'flow-audit'].forEach(audit => selected.add(audit));
  if (/flow|journey|navigation/.test(value)) ['flow-audit', 'functional-audit'].forEach(audit => selected.add(audit));
  if (/visual|hierarchy|style/.test(value)) selected.add('visual-audit');
  if (/accessib/.test(value)) ['visual-audit', 'functional-audit'].forEach(audit => selected.add(audit));
  if (/functional|behavior|runtime|performance/.test(value)) ['functional-audit', 'flow-audit'].forEach(audit => selected.add(audit));
  return selected;
}

function targetSet(finding) {
  return {
    routes: unique(finding.locations.map(item => item.route).filter(Boolean)),
    states: unique(finding.locations.map(item => item.state).filter(Boolean)),
    tasks: unique(finding.task_refs),
    components: unique(finding.locations.map(item => item.component).filter(Boolean)),
    content: unique(finding.affected_areas.filter(item => /^CONTENT-/.test(item))),
  };
}

export function buildVerificationPlan(input) {
  const {
    runId, generatedAt, baselineRevision, candidateRevision, remediationPlan, findings,
    originalEvidence = [], synthesis = null, implementationStatus = {}, selectedRemediationIds,
    baselineCapture, candidateEnvironment = {}, availableFixtures = [], requiredEnvironment = null,
    inputRefs, persistentDataMode = 'isolated', fullRegression = false,
  } = input;
  assertValidRecord(remediationPlan, 'remediation-plan');
  if (remediationPlan.schema_version !== 'aud-remediation-plan-v2') throw new Error('INCOMPATIBLE_REMEDIATION_PLAN: verification requires aud-remediation-plan-v2');
  if (remediationPlan.project_revision !== baselineRevision) throw new Error(`BASELINE_REVISION_MISMATCH: remediation ${remediationPlan.project_revision} != ${baselineRevision}`);
  if (synthesis) {
    assertValidRecord(synthesis, 'synthesis-result');
    if (synthesis.project_revision !== baselineRevision) throw new Error(`SYNTHESIS_REVISION_MISMATCH: ${synthesis.project_revision} != ${baselineRevision}`);
    if (synthesis.synthesis_id !== remediationPlan.synthesis_id) throw new Error(`SYNTHESIS_PLAN_MISMATCH: ${synthesis.synthesis_id} != ${remediationPlan.synthesis_id}`);
  }
  if (!candidateRevision) throw new Error('CANDIDATE_REVISION_REQUIRED');
  if (candidateRevision === baselineRevision) throw new Error('UNCHANGED_CANDIDATE_REVISION: verification requires a distinct candidate revision');
  if (!baselineCapture) throw new Error('BASELINE_EVIDENCE_REQUIRED: a compatible original capture manifest is required');
  assertValidRecord(baselineCapture, 'capture-manifest');
  if (baselineCapture.project_revision !== baselineRevision) throw new Error(`BASELINE_EVIDENCE_REVISION_MISMATCH: ${baselineCapture.project_revision} != ${baselineRevision}`);
  const findingById = new Map(findings.map(finding => { assertValidRecord(finding, 'finding'); return [finding.id, finding]; }));
  const evidenceById = new Map(originalEvidence.map(record => { assertValidRecord(record, 'evidence'); return [record.id, record]; }));
  const selectedIds = unique(selectedRemediationIds?.length ? selectedRemediationIds : remediationPlan.items.filter(item => item.status === 'accepted').map(item => item.remediation_id));
  if (!selectedIds.length) throw new Error('SELECTED_REMEDIATION_REQUIRED');
  const itemById = new Map(remediationPlan.items.map(item => [item.remediation_id, item]));
  for (const id of selectedIds) if (!itemById.has(id)) throw new Error(`UNKNOWN_REMEDIATION_ID: ${id}`);
  const clusterByFinding = new Map((synthesis?.clusters ?? []).flatMap(cluster => cluster.finding_refs.map(id => [id, cluster.cluster_id])));
  const selectedBySpecialist = new Map(specialists.map(name => [name, new Set()]));
  const cases = [];
  for (const remediationId of selectedIds) {
    const item = itemById.get(remediationId);
    for (const findingId of [...item.finding_refs].sort()) {
      const finding = findingById.get(findingId);
      if (!finding) throw new Error(`ORIGINAL_FINDING_REQUIRED: ${findingId}`);
      const hardReasons = []; const deferredReasons = [];
      const implementation = implementationRecord(implementationStatus, remediationId);
      if (item.status !== 'accepted') hardReasons.push(`Remediation status is ${item.status}, not accepted.`);
      if (!implementation || implementation.status !== 'complete') deferredReasons.push('Implementation is not reported complete.');
      if (implementation?.status === 'complete' && !implementation.candidate_revision) hardReasons.push('Implementation completion is not tied to a candidate revision.');
      if (implementation?.candidate_revision && implementation.candidate_revision !== candidateRevision) hardReasons.push(`Implementation revision ${implementation.candidate_revision} does not match candidate ${candidateRevision}.`);
      for (const dependency of item.dependencies) {
        const dependencyStatus = implementationRecord(implementationStatus, dependency);
        if (!dependencyStatus || dependencyStatus.status !== 'complete') deferredReasons.push(`Dependency ${dependency} is not reported complete.`);
      }
      const criteria = finding.acceptance_criteria ?? [];
      const methods = finding.verification_method?.length ? item.verification_method : [];
      if (!criteria.length) hardReasons.push('Original finding has no acceptance criteria; verification cannot infer them.');
      const approvedCriterionIds = new Set(item.acceptance_criteria.map(criterion => criterion.id));
      for (const criterion of criteria) if (!approvedCriterionIds.has(criterion.id)) hardReasons.push(`Acceptance criterion ${criterion.id} is not present in the accepted remediation.`);
      if (!methods.length) hardReasons.push('Original finding has no verification methods; verification cannot infer them from implementation details.');
      const categories = unique(methods.map(methodCategory).filter(Boolean));
      if (methods.some(method => methodCategory(method) === null)) hardReasons.push('At least one declared verification method has no supported adapter category.');
      const originalRefs = unique(finding.evidence_refs);
      for (const ref of originalRefs) {
        const record = evidenceById.get(ref);
        if (!record) hardReasons.push(`Original evidence ${ref} is unavailable.`);
        else if (record.provenance.source_revision && record.provenance.source_revision !== baselineRevision) hardReasons.push(`Original evidence ${ref} belongs to revision ${record.provenance.source_revision}.`);
      }
      const fixtures = unique(input.fixtureRequirements?.[remediationId] ?? baselineCapture.fixtures ?? []);
      for (const fixture of fixtures) if (!availableFixtures.includes(fixture)) hardReasons.push(`Required fixture ${fixture} is unavailable.`);
      const environment = requiredEnvironment ?? (Object.keys(baselineCapture.environment ?? {}).length ? baselineCapture.environment : { source: 'unspecified-baseline' });
      for (const [key, value] of Object.entries(environment)) if (canonicalJson(candidateEnvironment[key]) !== canonicalJson(value)) hardReasons.push(`Required environment ${key}=${JSON.stringify(value)} is unavailable.`);
      const unresolvedContradiction = (synthesis?.contradictions ?? []).find(record => record.finding_refs.includes(findingId) && record.resolution.status !== 'resolved');
      if (unresolvedContradiction) hardReasons.push(`Blocking contradiction ${unresolvedContradiction.contradiction_id} remains unresolved.`);
      const readiness = hardReasons.length ? 'blocked' : deferredReasons.length ? 'deferred' : (input.degradedReasons?.length ? 'degraded' : 'ready');
      const reasons = [...hardReasons, ...deferredReasons];
      const caseId = stableId('VC', `${baselineRevision}:${candidateRevision}`, { remediation_id: remediationId, finding_id: findingId, criteria: criteria.map(item => item.id), methods });
      const caseRecord = {
        schema_version: 'aud-verification-case-v1', case_id: caseId, remediation_id: remediationId, finding_id: findingId,
        cluster_refs: unique([clusterByFinding.get(findingId), ...item.cluster_refs].filter(Boolean)), original_evidence_refs: originalRefs,
        acceptance_criteria: criteria, verification_methods: methods, method_categories: categories, targets: targetSet(finding),
        required_fixtures: fixtures, required_environment: environment, prerequisites: unique(item.dependencies), expected_result: item.expected_outcome,
        regression_scope: unique([...item.affected_areas, ...targetSet(finding).routes, ...targetSet(finding).components, ...finding.relationships.depends_on]),
        readiness: { state: readiness, reasons: unique([...reasons, ...(input.degradedReasons ?? [])]) },
        execution_status: readiness === 'blocked' ? 'blocked' : readiness === 'deferred' ? 'deferred' : categories.includes('manual_expert_review') ? 'pending_manual' : 'ready',
      };
      assertValidRecord(caseRecord, 'verification-case');
      cases.push(caseRecord);
      for (const audit of affectedSpecialists(item, finding, fullRegression)) selectedBySpecialist.get(audit).add(findingId);
    }
  }
  cases.sort((a, b) => (itemById.get(a.remediation_id).wave ?? Number.MAX_SAFE_INTEGER) - (itemById.get(b.remediation_id).wave ?? Number.MAX_SAFE_INTEGER) || a.remediation_id.localeCompare(b.remediation_id) || a.finding_id.localeCompare(b.finding_id));
  const specialistDecisions = specialists.map(specialist => {
    const refs = [...selectedBySpecialist.get(specialist)].sort();
    return { specialist, disposition: refs.length ? 'selected' : 'skipped', reason: refs.length ? `Targeted re-audit covers affected findings: ${refs.join(', ')}.` : 'No selected remediation affects this specialist area.', affected_refs: refs };
  });
  const plan = {
    schema_version: 'aud-verification-plan-v1',
    plan_id: stableId('VP', `${baselineRevision}:${candidateRevision}`, { remediation_refs: selectedIds, cases: cases.map(item => item.case_id) }),
    run_id: runId, generated_at: generatedAt, baseline_revision: baselineRevision, candidate_revision: candidateRevision,
    source_refs: inputRefs, selected_remediation_refs: selectedIds, cases, specialist_decisions: specialistDecisions,
    evidence_baseline: { capture_id: baselineCapture.capture_id, baseline_signature: baselineCapture.baseline_signature, project_revision: baselineCapture.project_revision },
    degraded: cases.some(item => item.readiness.state === 'degraded'),
    degraded_reasons: unique(input.degradedReasons ?? []),
    authority: { inspection_only: true, application_mutations: [], persistent_data_mode: persistentDataMode },
  };
  assertValidRecord(plan, 'verification-plan');
  return plan;
}

function blankAcceptance(caseRecord) {
  return caseRecord.acceptance_criteria.map(criterion => ({ criterion_id: criterion.id, status: 'not_run', evidence_refs: [], notes: 'Not executed.' }));
}

function executor(category, adapter, manual, provenance) { return { category, adapter, manual, provenance }; }

function normalizeEvidence(records, runId, revision, at, environment) {
  return (records ?? []).map(raw => {
    const record = { ...raw, schema_version: 'aud-evidence-v1', run_id: raw.run_id ?? runId, timestamp: raw.timestamp ?? at, environment: raw.environment ?? environment };
    record.provenance = { ...raw.provenance, source_revision: raw.provenance?.source_revision ?? revision };
    record.id = raw.id ?? evidenceId(record);
    assertValidRecord(record, 'evidence');
    if (record.provenance.source_revision !== revision) throw new Error(`STALE_CANDIDATE_EVIDENCE: ${record.id} belongs to ${record.provenance.source_revision}`);
    return record;
  });
}

function regressionFinding(raw, context) {
  const finding = {
    schema_version: 'aud-finding-v1', id: '', run_id: context.runId, source_audit: raw.source_audit ?? 'aud', category: raw.category ?? 'regression',
    type: raw.type ?? 'risk', title: raw.title, statement: raw.statement, locations: raw.locations, task_refs: raw.task_refs ?? [],
    affected_personas: raw.affected_personas ?? [], affected_areas: raw.affected_areas, evidence_refs: context.evidenceRefs,
    severity: raw.severity, confidence: raw.confidence, reach: raw.reach ?? 'component', frequency: raw.frequency ?? 'unknown', urgency: raw.urgency ?? 'high',
    native_metrics: raw.native_metrics ?? {}, root_cause_hypothesis: raw.root_cause_hypothesis ?? null,
    recommendation: raw.recommendation, acceptance_criteria: raw.acceptance_criteria ?? [], verification_method: raw.verification_method ?? [],
    relationships: raw.relationships ?? { duplicates: [], reinforces: [], contradicts: [], depends_on: [], blocks: [], caused_by: [] }, status: 'open',
    regression_origin: { verification_id: context.verificationId, case_id: context.caseId, remediation_id: context.remediationId, baseline_revision: context.baselineRevision, candidate_revision: context.candidateRevision },
  };
  if (!finding.acceptance_criteria.length || !finding.verification_method.length) finding.verification_absence_reason = raw.verification_absence_reason ?? 'Regression requires triage before acceptance criteria and a verification method can be approved.';
  finding.id = stableId('F', context.candidateRevision, { statement: finding.statement, locations: finding.locations, remediation_id: context.remediationId, baseline_revision: context.baselineRevision });
  assertValidRecord(finding, 'finding');
  return finding;
}

export function executeVerification({ plan, findings, adapterResults = {}, candidateEvidence = [], generatedAt, environment = { source: 'unspecified-candidate' }, synthesis = null }) {
  assertValidRecord(plan, 'verification-plan');
  const findingById = new Map(findings.map(item => [item.id, item]));
  const suppliedEvidence = normalizeEvidence(candidateEvidence, plan.run_id, plan.candidate_revision, generatedAt, environment);
  const reusableById = new Map();
  for (const record of suppliedEvidence) {
    if (reusableById.has(record.id) && canonicalJson(reusableById.get(record.id)) !== canonicalJson(record)) throw new Error(`CONFLICTING_CANDIDATE_EVIDENCE: ${record.id}`);
    reusableById.set(record.id, record);
  }
  const evidenceRecords = [...reusableById.values()];
  const results = [];
  const regressions = [];
  const newFindings = [];
  for (const caseRecord of plan.cases) {
    const original = findingById.get(caseRecord.finding_id);
    const supplied = adapterResults[caseRecord.case_id] ?? adapterResults[`${caseRecord.remediation_id}:${caseRecord.finding_id}`] ?? null;
    let outcome; let comparison; let currentObservation; let rationale; let acceptanceResults; let evidenceRefs; let executorRecord;
    if (caseRecord.readiness.state === 'blocked') {
      outcome = 'blocked'; comparison = 'unable_to_compare'; currentObservation = null; rationale = caseRecord.readiness.reasons.join(' ');
      acceptanceResults = blankAcceptance(caseRecord); evidenceRefs = []; executorRecord = executor('readiness_gate', null, false, 'AUD verification planner');
    } else if (caseRecord.readiness.state === 'deferred') {
      outcome = 'not_run'; comparison = 'unable_to_compare'; currentObservation = null; rationale = `Deferred by readiness gate: ${caseRecord.readiness.reasons.join(' ')}`;
      acceptanceResults = blankAcceptance(caseRecord); evidenceRefs = []; executorRecord = executor('readiness_gate', null, false, 'AUD verification planner');
    } else if (!supplied) {
      const manual = caseRecord.method_categories.includes('manual_expert_review');
      outcome = 'not_run'; comparison = 'unable_to_compare'; currentObservation = null;
      rationale = manual ? 'Manual expert review remains pending; no reviewer result and evidence were supplied.' : 'No executable adapter result was supplied; no outcome was fabricated.';
      acceptanceResults = blankAcceptance(caseRecord); evidenceRefs = []; executorRecord = executor(manual ? 'manual_expert_review' : caseRecord.method_categories[0], null, manual, manual ? 'Pending named reviewer' : 'Unavailable adapter');
    } else {
      if (!outcomes.has(supplied.outcome)) throw new Error(`INVALID_VERIFICATION_OUTCOME: ${supplied.outcome}`);
      if (!comparisons.has(supplied.comparison)) throw new Error(`INVALID_BASELINE_COMPARISON: ${supplied.comparison}`);
      const fresh = normalizeEvidence(supplied.evidence ?? [], plan.run_id, plan.candidate_revision, generatedAt, supplied.environment ?? environment);
      for (const record of fresh) {
        if (reusableById.has(record.id) && canonicalJson(reusableById.get(record.id)) !== canonicalJson(record)) throw new Error(`CONFLICTING_CANDIDATE_EVIDENCE: ${record.id}`);
        if (!reusableById.has(record.id)) { reusableById.set(record.id, record); evidenceRecords.push(record); }
      }
      evidenceRefs = unique([...(supplied.evidence_refs ?? []), ...fresh.map(item => item.id)]);
      for (const ref of evidenceRefs) if (!reusableById.has(ref)) throw new Error(`CANDIDATE_EVIDENCE_NOT_FOUND: ${ref}`);
      outcome = supplied.outcome; comparison = supplied.comparison; currentObservation = supplied.current_observation ?? null; rationale = supplied.rationale;
      acceptanceResults = supplied.acceptance_results ?? blankAcceptance(caseRecord);
      const expectedCriteria = new Set(caseRecord.acceptance_criteria.map(item => item.id));
      if (acceptanceResults.length !== expectedCriteria.size || acceptanceResults.some(item => !expectedCriteria.has(item.criterion_id))) throw new Error(`ACCEPTANCE_RESULT_MISMATCH: ${caseRecord.case_id}`);
      for (const acceptance of acceptanceResults) for (const ref of acceptance.evidence_refs) if (!reusableById.has(ref)) throw new Error(`ACCEPTANCE_EVIDENCE_NOT_FOUND: ${ref}`);
      executorRecord = executor(supplied.category ?? caseRecord.method_categories[0], supplied.adapter ?? null, supplied.manual === true, supplied.provenance);
      if (caseRecord.method_categories.includes('manual_expert_review') && supplied.manual !== true) {
        outcome = 'not_run'; comparison = 'unable_to_compare'; rationale += ' Manual verification remains pending because no reviewer-authored result was supplied.';
        acceptanceResults = blankAcceptance(caseRecord); evidenceRefs = [];
      }
      if (outcome === 'passed' && (!evidenceRefs.length || acceptanceResults.some(item => item.status !== 'pass' || !item.evidence_refs.length))) { outcome = 'inconclusive'; rationale += ' Claimed pass was downgraded because candidate evidence or criterion passes were incomplete.'; }
      if (outcome === 'passed' && ['no_longer_reproducible', 'unable_to_compare'].includes(comparison)) { outcome = 'inconclusive'; rationale += ' No-longer-reproducible or unable-to-compare is not proof of resolution.'; }
    }
    const verificationId = stableId('V', `${plan.baseline_revision}:${plan.candidate_revision}`, { case_id: caseRecord.case_id, evidence_refs: evidenceRefs, outcome, comparison });
    const regressionRefs = [];
    for (const [index, raw] of (supplied?.regressions ?? []).entries()) {
      const regressionId = stableId('REG', verificationId, { index, classification: raw.classification, scope: raw.scope, observation: raw.current_observation });
      const regressionEvidenceRefs = unique(raw.evidence_refs ?? evidenceRefs);
      for (const ref of regressionEvidenceRefs) if (!reusableById.has(ref)) throw new Error(`REGRESSION_EVIDENCE_NOT_FOUND: ${ref}`);
      let newFindingId = null;
      if (raw.classification === 'newly_introduced_regression') {
        const created = regressionFinding(raw.finding, { runId: plan.run_id, verificationId, caseId: caseRecord.case_id, remediationId: caseRecord.remediation_id, baselineRevision: plan.baseline_revision, candidateRevision: plan.candidate_revision, evidenceRefs: regressionEvidenceRefs });
        newFindingId = created.id; if (!newFindings.some(item => item.id === created.id)) newFindings.push(created);
      }
      regressions.push({ regression_id: regressionId, case_id: caseRecord.case_id, classification: raw.classification, scope: unique(raw.scope), comparison: raw.comparison, outcome: raw.outcome, baseline_observation: raw.baseline_observation ?? null, current_observation: raw.current_observation ?? null, evidence_refs: regressionEvidenceRefs, rationale: raw.rationale, executor: executorRecord, new_finding_id: newFindingId });
      regressionRefs.push(regressionId);
    }
    const blockingRegression = regressions.some(item => item.case_id === caseRecord.case_id && ['targeted_regression', 'newly_introduced_regression'].includes(item.classification) && item.outcome !== 'passed');
    const dependenciesPassed = caseRecord.prerequisites.every(dependency => {
      const dependencyResults = results.filter(item => item.remediation_id === dependency);
      return dependencyResults.length > 0 && dependencyResults.every(item => item.outcome === 'passed');
    });
    const contradiction = (synthesis?.contradictions ?? []).some(item => item.finding_refs.includes(caseRecord.finding_id) && item.resolution.status !== 'resolved');
    let requestedStatus = outcome === 'passed' && dependenciesPassed && !blockingRegression && !contradiction ? 'verified' : outcome === 'partially_passed' ? 'partial' : outcome === 'failed' ? (original.status === 'verified' ? 'reopened' : 'failed') : null;
    const legal = requestedStatus !== null && allowedTransitions[original.status]?.has(requestedStatus);
    const closureBlocks = [!dependenciesPassed && 'required verification dependencies did not pass', blockingRegression && 'a targeted regression did not pass', contradiction && 'a blocking contradiction remains unresolved'].filter(Boolean);
    const transitionReason = requestedStatus === null
      ? outcome === 'passed' && closureBlocks.length ? `Pass is not eligible for closure because ${closureBlocks.join('; ')}.` : `Outcome ${outcome} does not authorize a resolution transition.`
      : legal ? `Evidence-backed ${outcome} outcome satisfies the legal ${original.status} -> ${requestedStatus} transition.` : `Rejected illegal lifecycle transition ${original.status} -> ${requestedStatus}.`;
    const result = {
      verification_id: verificationId, case_id: caseRecord.case_id, remediation_id: caseRecord.remediation_id, finding_id: caseRecord.finding_id, cluster_refs: caseRecord.cluster_refs,
      outcome, comparison, original_observation: original.statement, expected_condition: caseRecord.expected_result, current_observation: currentObservation,
      original_evidence_refs: caseRecord.original_evidence_refs, evidence_refs: evidenceRefs, acceptance_results: acceptanceResults, rationale, executor: executorRecord,
      candidate_revision: plan.candidate_revision, executed_at: generatedAt, environment: supplied?.environment ?? environment,
      specialist_rechecks: plan.specialist_decisions.filter(item => item.disposition === 'selected' && item.affected_refs.includes(caseRecord.finding_id)).map(item => item.specialist),
      regression_refs: regressionRefs, lifecycle_transition: { requested_status: requestedStatus, applied: legal, reason: transitionReason },
    };
    results.push(result);
  }
  const verificationResults = { schema_version: 'aud-verification-result-v2', result_set_id: stableId('VRSET', plan.plan_id, { results: results.map(item => item.verification_id) }), verification_plan_id: plan.plan_id, run_id: plan.run_id, baseline_revision: plan.baseline_revision, candidate_revision: plan.candidate_revision, generated_at: generatedAt, results };
  const regressionResults = { schema_version: 'aud-regression-result-v1', regression_set_id: stableId('REGSET', plan.plan_id, { results: regressions.map(item => item.regression_id) }), verification_plan_id: plan.plan_id, run_id: plan.run_id, baseline_revision: plan.baseline_revision, candidate_revision: plan.candidate_revision, generated_at: generatedAt, results: regressions.sort((a, b) => a.regression_id.localeCompare(b.regression_id)), new_finding_refs: unique(newFindings.map(item => item.id)) };
  assertValidRecord(verificationResults, 'verification-result'); assertValidRecord(regressionResults, 'regression-result');
  return { verificationResults, regressionResults, evidence: evidenceRecords.sort((a, b) => a.id.localeCompare(b.id)), newFindings: newFindings.sort((a, b) => a.id.localeCompare(b.id)) };
}

export function applyVerificationToFindings(findings, resultSet) {
  const resultByFinding = new Map(resultSet.results.map(item => [item.finding_id, item]));
  return findings.filter(item => resultByFinding.has(item.id)).map(finding => {
    const result = resultByFinding.get(finding.id); const next = structuredClone(finding);
    next.verification_history ??= [];
    if (!next.verification_history.some(item => item.verification_id === result.verification_id)) next.verification_history.push({ verification_id: result.verification_id, case_id: result.case_id, run_id: resultSet.run_id, baseline_revision: resultSet.baseline_revision, candidate_revision: resultSet.candidate_revision, outcome: result.outcome, comparison: result.comparison, evidence_refs: result.evidence_refs, at: result.executed_at });
    if (result.lifecycle_transition.applied) {
      next.status = result.lifecycle_transition.requested_status;
      next.status_history ??= [];
      if (!next.status_history.some(item => item.status === next.status && item.run_id === resultSet.run_id)) next.status_history.push({ status: next.status, at: result.executed_at, reason: result.lifecycle_transition.reason, run_id: resultSet.run_id });
    }
    assertValidRecord(next, 'finding'); return next;
  });
}

export function summarizeVerification(plan, resultSet, regressionSet, findings) {
  const counts = Object.fromEntries([...outcomes].map(outcome => [outcome, resultSet.results.filter(item => item.outcome === outcome).length]));
  const transitions = resultSet.results.map(result => { const finding = findings.find(item => item.id === result.finding_id); return { finding_id: result.finding_id, from: finding.status, requested: result.lifecycle_transition.requested_status, applied: result.lifecycle_transition.applied, reason: result.lifecycle_transition.reason }; });
  const summary = {
    schema_version: 'aud-verification-summary-v1', summary_id: stableId('VSUM', plan.plan_id, { result_set: resultSet.result_set_id, regression_set: regressionSet.regression_set_id }), verification_plan_id: plan.plan_id,
    verification_result_set_id: resultSet.result_set_id, regression_set_id: regressionSet.regression_set_id, run_id: plan.run_id, generated_at: resultSet.generated_at, counts,
    verified_finding_refs: unique(resultSet.results.filter(item => item.lifecycle_transition.applied && item.lifecycle_transition.requested_status === 'verified').map(item => item.finding_id)),
    partial_finding_refs: unique(resultSet.results.filter(item => item.outcome === 'partially_passed').map(item => item.finding_id)),
    failed_finding_refs: unique(resultSet.results.filter(item => item.outcome === 'failed').map(item => item.finding_id)),
    blocked_case_refs: unique(resultSet.results.filter(item => item.outcome === 'blocked').map(item => item.case_id)),
    inconclusive_case_refs: unique(resultSet.results.filter(item => item.outcome === 'inconclusive').map(item => item.case_id)),
    new_regression_finding_refs: regressionSet.new_finding_refs,
    remaining_risk: unique(resultSet.results.filter(item => item.outcome !== 'passed').map(item => `${item.finding_id}: ${item.outcome}`)),
    required_follow_up: unique(resultSet.results.filter(item => ['blocked', 'inconclusive', 'not_run', 'failed', 'partially_passed'].includes(item.outcome)).map(item => `${item.case_id}: ${item.rationale}`)),
    transitions, degraded: plan.degraded || resultSet.results.some(item => ['blocked', 'inconclusive', 'not_run'].includes(item.outcome)),
  };
  assertValidRecord(summary, 'verification-summary'); return summary;
}
