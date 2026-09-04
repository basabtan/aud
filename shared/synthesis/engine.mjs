import { assertValidRecord } from '../validators/schema-registry.mjs';
import { stableId } from '../validators/stable-ids.mjs';

const relationshipTypes = new Set(['duplicate_of', 'reinforces', 'contradicts', 'symptom_of', 'caused_by', 'blocks', 'depends_on', 'supersedes', 'related_to']);
const scopeRank = Object.freeze({ element: 0, component: 1, surface: 2, route: 3, journey: 4, system: 5 });
const urgencyRank = Object.freeze({ low: 0, medium: 1, high: 2, immediate: 3 });
const frequencyRank = Object.freeze({ rare: 0, occasional: 1, unknown: 2, common: 3, continuous: 4 });

function sorted(values = []) {
  return [...new Set(values)].sort();
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function intersection(left = [], right = []) {
  const rightSet = new Set(right);
  return sorted(left.filter(value => rightSet.has(value)));
}

function locationKeys(finding) {
  return finding.locations.map(location => ['route', 'surface', 'component', 'state', 'viewport']
    .map(key => `${key}:${location[key] ?? ''}`).join('|'));
}

function contentRefs(finding) {
  return sorted(finding.affected_areas.filter(value => /^CONTENT-/.test(value)));
}

function pairSignals(left, right) {
  const signals = [];
  if (intersection(locationKeys(left), locationKeys(right)).length) signals.push('shared affected location');
  if (intersection(left.task_refs, right.task_refs).length) signals.push('shared task');
  if (intersection(left.affected_areas, right.affected_areas).length) signals.push('shared affected area/component/content');
  if (intersection(left.evidence_refs, right.evidence_refs).length) signals.push('shared evidence');
  if (left.root_cause_hypothesis && normalize(left.root_cause_hypothesis) === normalize(right.root_cause_hypothesis)) signals.push('common suspected root cause');
  if (normalize(left.statement) === normalize(right.statement) || normalize(left.title) === normalize(right.title)) signals.push('equivalent problem semantics');
  return signals;
}

function explicitDuplicate(left, right) {
  return left.relationships.duplicates.includes(right.id) || right.relationships.duplicates.includes(left.id);
}

function shouldMerge(left, right) {
  if (explicitDuplicate(left, right)) return { merge: true, signals: ['explicit duplicate relationship'] };
  const signals = pairSignals(left, right);
  return { merge: signals.includes('equivalent problem semantics') && signals.length >= 2, signals };
}

function representative(findings) {
  return [...findings].sort((left, right) =>
    right.severity.level - left.severity.level ||
    right.confidence.score - left.confidence.score ||
    right.evidence_refs.length - left.evidence_refs.length ||
    left.id.localeCompare(right.id))[0];
}

function combinedConfidence(findings) {
  const bySpecialist = new Map();
  for (const finding of findings) {
    const existing = bySpecialist.get(finding.source_audit);
    if (!existing || existing.confidence.score < finding.confidence.score) bySpecialist.set(finding.source_audit, finding);
  }
  const contributors = [...bySpecialist.values()];
  const independent = contributors.length > 1 && new Set(contributors.flatMap(finding => finding.evidence_refs)).size > 1;
  const score = independent
    ? Math.min(0.99, 1 - contributors.reduce((remaining, finding) => remaining * (1 - finding.confidence.score), 1))
    : Math.max(...findings.map(finding => finding.confidence.score));
  const strongest = [...findings].sort((left, right) => right.confidence.score - left.confidence.score || left.id.localeCompare(right.id))[0];
  return {
    score: Number(score.toFixed(4)),
    basis: independent
      ? `Independent specialist confidence was combined across ${contributors.length} attributable sources with distinct evidence; source confidence values remain unchanged.`
      : `Inherited analytically from ${strongest.id}; the source confidence remains unchanged.`,
  };
}

class DisjointSet {
  constructor(ids) { this.parent = new Map(ids.map(id => [id, id])); }
  find(id) {
    const parent = this.parent.get(id);
    if (parent !== id) this.parent.set(id, this.find(parent));
    return this.parent.get(id);
  }
  union(left, right) {
    const a = this.find(left); const b = this.find(right);
    if (a !== b) this.parent.set(a < b ? b : a, a < b ? a : b);
  }
}

function relationship(runNamespace, source, target, type, rationale, evidenceRefs, score, basis) {
  if (!relationshipTypes.has(type)) throw new Error(`INVALID_RELATIONSHIP_TYPE: ${type}`);
  return {
    relationship_id: stableId('REL', runNamespace, { source, target, type }),
    source_finding_id: source,
    target_id: target,
    type,
    rationale,
    evidence_refs: sorted(evidenceRefs),
    confidence: { score, basis },
  };
}

function deduplicate(findings, namespace) {
  const byId = new Map(findings.map(finding => [finding.id, finding]));
  const set = new DisjointSet(findings.map(finding => finding.id));
  const ambiguous = [];
  for (let leftIndex = 0; leftIndex < findings.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < findings.length; rightIndex += 1) {
      const left = findings[leftIndex]; const right = findings[rightIndex];
      const match = shouldMerge(left, right);
      if (match.merge) set.union(left.id, right.id);
      else if (match.signals.length >= 2) ambiguous.push({ left, right, signals: match.signals });
    }
  }
  const groups = new Map();
  for (const finding of findings) {
    const root = set.find(finding.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(finding);
  }
  const canonical = [...groups.values()].map(group => {
    const members = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const lead = representative(members);
    const signals = sorted(members.flatMap((finding, index) => members.slice(index + 1).flatMap(other => shouldMerge(finding, other).signals)));
    return {
      canonical_id: stableId('CANON', namespace, { finding_refs: members.map(item => item.id) }),
      representative_finding_id: lead.id,
      source_finding_refs: members.map(item => item.id),
      source_audits: sorted(members.map(item => item.source_audit)),
      evidence_refs: sorted(members.flatMap(item => item.evidence_refs)),
      deduplication_rationale: members.length > 1
        ? `Grouped by explainable signals: ${signals.join(', ')}. Every source finding remains preserved.`
        : 'No deterministic duplicate match was established; the source finding remains independent.',
      combined_confidence: combinedConfidence(members),
    };
  }).sort((a, b) => a.representative_finding_id.localeCompare(b.representative_finding_id));
  const duplicateRelationships = canonical.flatMap(item => item.source_finding_refs
    .filter(id => id !== item.representative_finding_id)
    .map(id => relationship(namespace, id, item.representative_finding_id, 'duplicate_of', item.deduplication_rationale,
      [...byId.get(id).evidence_refs, ...byId.get(item.representative_finding_id).evidence_refs], 1, 'Deterministic duplicate rule matched.')));
  const ambiguousRelationships = ambiguous.map(({ left, right, signals }) => relationship(
    namespace, left.id, right.id, 'related_to',
    `Possible relationship retained without deduplication because signals were suggestive but semantics were not equivalent: ${signals.join(', ')}.`,
    [...left.evidence_refs, ...right.evidence_refs], 0.5, 'Ambiguous candidates are not merged.',
  ));
  return { canonical, duplicateRelationships, ambiguousRelationships };
}

function buildClusters(findings, canonical, runId, namespace) {
  const byId = new Map(findings.map(item => [item.id, item]));
  const canonicalByFinding = new Map(canonical.flatMap(item => item.source_finding_refs.map(id => [id, item])));
  const buckets = new Map();
  for (const canonicalFinding of canonical) {
    const members = canonicalFinding.source_finding_refs.map(id => byId.get(id));
    const hypotheses = sorted(members.map(item => item.root_cause_hypothesis).filter(Boolean));
    const key = hypotheses.length ? `cause:${normalize(hypotheses[0])}` : `canonical:${canonicalFinding.canonical_id}`;
    if (!buckets.has(key)) buckets.set(key, new Set());
    for (const id of canonicalFinding.source_finding_refs) buckets.get(key).add(id);
  }
  return [...buckets.entries()].map(([key, ids]) => {
    const members = [...ids].sort().map(id => byId.get(id));
    const lead = representative(members);
    const hypotheses = sorted(members.map(item => item.root_cause_hypothesis).filter(Boolean));
    const evidenceRefs = sorted(members.flatMap(item => item.evidence_refs));
    const rootScore = hypotheses.length ? combinedConfidence(members).score : 0.3;
    const signals = key.startsWith('cause:')
      ? ['common suspected root cause', ...(members.length > 1 ? ['multiple observed symptoms'] : [])]
      : ['independent canonical issue'];
    return {
      schema_version: 'aud-issue-cluster-v1',
      cluster_id: stableId('CLUSTER', namespace, { key, finding_refs: members.map(item => item.id) }),
      run_id: runId,
      representative_finding_id: lead.id,
      finding_refs: members.map(item => item.id),
      duplicate_finding_refs: members.filter(item => item.id !== canonicalByFinding.get(item.id).representative_finding_id).map(item => item.id),
      grouping: {
        rationale: hypotheses.length
          ? `Symptoms share the stated root-cause hypothesis “${hypotheses[0]}”; this remains an inference.`
          : 'No supported shared root cause was inferred; the canonical issue remains its own cluster.',
        signals,
      },
      observed_symptoms: members.map(item => ({ finding_id: item.id, claim: item.statement, evidence_refs: sorted(item.evidence_refs) })),
      inferred_root_cause: hypotheses.length ? { statement: hypotheses[0], inference: true, provisional: rootScore < 0.7 } : null,
      supporting_evidence_refs: evidenceRefs,
      conflicting_evidence_refs: [],
      affected: {
        tasks: sorted(members.flatMap(item => item.task_refs)),
        routes: sorted(members.flatMap(item => item.locations.map(location => location.route).filter(Boolean))),
        components: sorted(members.flatMap(item => item.locations.map(location => location.component).filter(Boolean))),
        content: sorted(members.flatMap(contentRefs)),
      },
      specialist_coverage: sorted(members.map(item => item.source_audit)),
      root_cause_confidence: {
        score: rootScore,
        basis: hypotheses.length ? 'Derived from attributable source hypotheses and their unchanged confidence values.' : 'No root cause was inferred; confidence is intentionally provisional.',
      },
      unresolved_assumptions: hypotheses.length && rootScore < 0.7 ? ['The suspected root cause requires targeted evidence before implementation.'] : [],
    };
  }).sort((a, b) => a.cluster_id.localeCompare(b.cluster_id));
}

function explicitRelationships(findings, clusters, namespace, hints = []) {
  const known = new Set(findings.map(item => item.id));
  const clusterByFinding = new Map(clusters.flatMap(cluster => cluster.finding_refs.map(id => [id, cluster.cluster_id])));
  const mapping = { duplicates: 'duplicate_of', reinforces: 'reinforces', contradicts: 'contradicts', depends_on: 'depends_on', blocks: 'blocks' };
  const records = [];
  for (const finding of findings) {
    for (const [field, type] of Object.entries(mapping)) {
      for (const target of finding.relationships[field]) if (known.has(target)) {
        records.push(relationship(namespace, finding.id, target, type, `Explicit ${field} relationship supplied by ${finding.source_audit}.`,
          [...finding.evidence_refs, ...findings.find(item => item.id === target).evidence_refs], Math.min(finding.confidence.score, findings.find(item => item.id === target).confidence.score), 'Bounded by both source confidence values.'));
      }
    }
    if (finding.root_cause_hypothesis) records.push(relationship(namespace, finding.id, clusterByFinding.get(finding.id), 'symptom_of',
      'The source finding supplied a root-cause hypothesis; synthesis records it as an inference.', finding.evidence_refs,
      clusters.find(cluster => cluster.cluster_id === clusterByFinding.get(finding.id)).root_cause_confidence.score, 'Uses the provisional cluster root-cause confidence.'));
  }
  for (const hint of hints) {
    if (!relationshipTypes.has(hint.type) || !known.has(hint.source_finding_id) || !(known.has(hint.target_id) || clusters.some(cluster => cluster.cluster_id === hint.target_id))) {
      throw new Error(`INVALID_RELATIONSHIP_HINT: ${JSON.stringify(hint)}`);
    }
    records.push(relationship(namespace, hint.source_finding_id, hint.target_id, hint.type, hint.rationale,
      hint.evidence_refs?.length ? hint.evidence_refs : findings.find(item => item.id === hint.source_finding_id).evidence_refs,
      hint.confidence?.score ?? 0.5, hint.confidence?.basis ?? 'Explicit synthesis hint.'));
  }
  return records;
}

function inferredReinforcement(findings, clusters, namespace) {
  const records = [];
  for (let i = 0; i < findings.length; i += 1) for (let j = i + 1; j < findings.length; j += 1) {
    const left = findings[i]; const right = findings[j];
    if (left.source_audit === right.source_audit || explicitDuplicate(left, right)) continue;
    const signals = pairSignals(left, right).filter(signal => signal !== 'equivalent problem semantics');
    if (signals.includes('shared evidence') || signals.includes('common suspected root cause')) records.push(relationship(
      namespace, left.id, right.id, 'reinforces', `Cross-specialist findings reinforce one another through ${signals.join(', ')}.`,
      [...left.evidence_refs, ...right.evidence_refs], Math.min(left.confidence.score, right.confidence.score), 'Corroboration is attributable to both specialists.',
    ));
  }
  return records;
}

function uniqueRelationships(records) {
  const byKey = new Map();
  for (const item of records) {
    const key = `${item.source_finding_id}|${item.target_id}|${item.type}`;
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => a.relationship_id.localeCompare(b.relationship_id));
}

function contradictionRecords(findings, relationships, runId, revision, namespace, resolutions = {}) {
  const byId = new Map(findings.map(item => [item.id, item]));
  const pairs = new Map();
  for (const item of relationships.filter(item => item.type === 'contradicts')) {
    const ids = sorted([item.source_finding_id, item.target_id]);
    if (ids.every(id => byId.has(id))) pairs.set(ids.join('|'), ids);
  }
  return [...pairs.values()].map(ids => {
    const involved = ids.map(id => byId.get(id));
    const contradictionId = stableId('CONTRA', namespace, { finding_refs: ids });
    const supplied = resolutions[contradictionId] ?? resolutions[ids.join('|')] ?? null;
    const resolved = supplied?.status === 'resolved';
    return {
      schema_version: 'aud-contradiction-v1',
      contradiction_id: contradictionId,
      run_id: runId,
      project_revision: revision,
      finding_refs: ids,
      claims: involved.map(item => ({ finding_id: item.id, claim: item.recommendation.action })),
      evidence_refs: sorted(involved.flatMap(item => item.evidence_refs)),
      conflict_type: supplied?.conflict_type ?? 'remedial',
      resolution: {
        status: supplied?.status ?? 'unresolved',
        rationale: supplied?.rationale ?? null,
        selected_finding_id: resolved ? supplied.selected_finding_id : null,
      },
      additional_evidence_required: supplied?.additional_evidence_required ?? (resolved ? [] : ['Collect evidence that compares both claims under the same route, state, fixture, and revision.']),
      confidence: {
        score: Number(Math.min(...involved.map(item => item.confidence.score)).toFixed(4)),
        basis: 'Conflict confidence is bounded by the least-certain involved source claim.',
      },
    };
  }).sort((a, b) => a.contradiction_id.localeCompare(b.contradiction_id));
}

function chooseByRank(findings, field, ranks) {
  return [...findings].sort((a, b) => ranks[b[field]] - ranks[a[field]] || a.id.localeCompare(b.id))[0][field];
}

function taskCriticality(findings, taskModel) {
  const tasks = new Map((taskModel?.tasks ?? []).map(task => [task.id, task.criticality]));
  return Math.max(0, ...findings.flatMap(finding => finding.task_refs.map(id => tasks.get(id) ?? 0)));
}

function classifyPriority(factors) {
  let level; let band;
  if (factors.consequence_severity >= 4 && (factors.urgency === 'immediate' || factors.blocking_relationships > 0 || factors.task_criticality >= 0.9)) [level, band] = ['critical', 'P0'];
  else if (factors.consequence_severity >= 3) [level, band] = ['high', 'P1'];
  else if (factors.consequence_severity === 2 || ['journey', 'system'].includes(factors.affected_scope)) [level, band] = ['medium', 'P2'];
  else if (factors.consequence_severity === 1) [level, band] = ['low', 'P3'];
  else [level, band] = ['deferred', 'P4'];
  return {
    level, band,
    rationale: `${band}/${level}: consequence severity ${factors.consequence_severity}, ${factors.affected_scope} scope, task criticality ${factors.task_criticality}, urgency ${factors.urgency}, recurrence ${factors.recurrence}, ${factors.blocking_relationships} blocking relationships, implementation risk ${factors.implementation_risk}, effort ${factors.estimated_effort}. Confidence ${factors.confidence} affects disposition, not severity.`,
    factors,
  };
}

function ownerFor(findings) {
  const audits = sorted(findings.map(item => item.source_audit));
  return audits.length === 1 ? audits[0] : `cross-functional: ${audits.join(', ')}`;
}

function buildRemediationItems(clusters, findings, relationships, taskModel, contradictions, namespace) {
  const byId = new Map(findings.map(item => [item.id, item]));
  const clusterByFinding = new Map(clusters.flatMap(cluster => cluster.finding_refs.map(id => [id, cluster])));
  const items = clusters.map(cluster => {
    const members = cluster.finding_refs.map(id => byId.get(id));
    const lead = byId.get(cluster.representative_finding_id);
    const severity = Math.max(...members.map(item => item.severity.level));
    const confidence = combinedConfidence(members);
    const scope = chooseByRank(members, 'reach', scopeRank);
    const urgency = chooseByRank(members, 'urgency', urgencyRank);
    const recurrence = chooseByRank(members, 'frequency', frequencyRank);
    const blocking = relationships.filter(item => item.type === 'blocks' && cluster.finding_refs.includes(item.source_finding_id)).length;
    const riskLevel = ['low', 'medium', 'high', 'unknown'].includes(lead.recommendation.change_risk) ? lead.recommendation.change_risk : 'unknown';
    const effort = lead.recommendation.estimated_effort;
    const factors = {
      consequence_severity: severity,
      affected_scope: scope,
      task_criticality: taskCriticality(members, taskModel),
      urgency,
      confidence: confidence.score,
      recurrence,
      blocking_relationships: blocking,
      remediation_dependencies: 0,
      implementation_risk: riskLevel,
      estimated_effort: effort,
    };
    const contradiction = contradictions.find(item => item.finding_refs.some(id => cluster.finding_refs.includes(id)) && item.resolution.status !== 'resolved');
    const allKeep = members.every(item => item.type === 'keep');
    const actionType = allKeep ? 'accept_risk' : contradiction ? 'decide' : severity >= 3 && confidence.score < 0.55 ? 'investigate' : 'implement';
    const remediationId = stableId('R', namespace, { cluster_id: cluster.cluster_id, action_type: actionType });
    const criteria = members.flatMap(item => item.acceptance_criteria);
    const methods = members.flatMap(item => item.verification_method);
    return {
      schema_version: 'aud-remediation-item-v1',
      remediation_id: remediationId,
      title: actionType === 'investigate' ? `Investigate: ${lead.title}` : actionType === 'decide' ? `Decide: ${lead.title}` : lead.title,
      problem_statement: cluster.inferred_root_cause?.statement ?? lead.statement,
      finding_refs: cluster.finding_refs,
      cluster_refs: [cluster.cluster_id],
      affected_areas: sorted(members.flatMap(item => item.affected_areas)),
      action_type: actionType,
      recommended_action: actionType === 'investigate'
        ? `Collect the missing evidence before deciding whether to ${lead.recommendation.action}`
        : actionType === 'decide'
          ? 'Resolve the recorded contradiction before authorizing implementation.'
          : lead.recommendation.action,
      expected_outcome: `Address ${cluster.finding_refs.length} attributable finding(s) without treating source findings as verified.`,
      acceptance_criteria: criteria.length ? criteria : [{ id: stableId('AC', namespace, { remediation_id: remediationId }), statement: `The observable condition in ${lead.id} no longer reproduces under its recorded scope.` }],
      verification_method: methods.length ? methods : [{ instrument: lead.source_audit, procedure: `Replay the recorded scope for ${lead.id} and compare fresh evidence.` }],
      priority: classifyPriority(factors),
      dependencies: [],
      blockers: [],
      implementation_risk: { level: riskLevel, rationale: `Preserved from the representative specialist change-risk estimate (${riskLevel}); implementation has not been authorized.` },
      estimated_effort: effort,
      confidence,
      owner_capability: ownerFor(members),
      status: actionType === 'decide' ? 'needs_decision' : actionType === 'accept_risk' ? 'deferred' : 'proposed',
      parallel_ready: false,
      wave: null,
    };
  });
  const itemByCluster = new Map(items.flatMap(item => item.cluster_refs.map(id => [id, item])));
  for (const relation of relationships) {
    const sourceCluster = clusterByFinding.get(relation.source_finding_id);
    const targetCluster = relation.target_id.startsWith('CLUSTER-') ? clusters.find(item => item.cluster_id === relation.target_id) : clusterByFinding.get(relation.target_id);
    if (!sourceCluster || !targetCluster || sourceCluster.cluster_id === targetCluster.cluster_id) continue;
    const sourceItem = itemByCluster.get(sourceCluster.cluster_id); const targetItem = itemByCluster.get(targetCluster.cluster_id);
    if (['depends_on', 'symptom_of', 'caused_by'].includes(relation.type)) sourceItem.dependencies.push(targetItem.remediation_id);
    if (relation.type === 'blocks') targetItem.dependencies.push(sourceItem.remediation_id);
  }
  for (const item of items) item.dependencies = sorted(item.dependencies);
  const byRemediation = new Map(items.map(item => [item.remediation_id, item]));
  for (const item of items) for (const dependency of item.dependencies) byRemediation.get(dependency).blockers.push(item.remediation_id);
  for (const item of items) {
    item.blockers = sorted(item.blockers);
    item.priority.factors.remediation_dependencies = item.dependencies.length;
    item.priority = classifyPriority(item.priority.factors);
  }
  return items.sort((a, b) => a.remediation_id.localeCompare(b.remediation_id));
}

function dependencyWaves(items) {
  const remaining = new Map(items.map(item => [item.remediation_id, new Set(item.dependencies)]));
  const waves = [];
  while (remaining.size) {
    const ready = [...remaining.entries()].filter(([, dependencies]) => dependencies.size === 0).map(([id]) => id).sort();
    if (!ready.length) break;
    const wave = waves.length + 1;
    waves.push({ wave, remediation_refs: ready, parallel_ready: ready.length > 1 });
    for (const id of ready) remaining.delete(id);
    for (const dependencies of remaining.values()) for (const id of ready) dependencies.delete(id);
  }
  const cycles = remaining.size ? [[...remaining.keys()].sort()] : [];
  const waveById = new Map(waves.flatMap(wave => wave.remediation_refs.map(id => [id, wave])));
  for (const item of items) {
    const wave = waveById.get(item.remediation_id);
    item.wave = wave?.wave ?? null;
    item.parallel_ready = wave?.parallel_ready ?? false;
  }
  return { waves, cycle_detection: { detected: cycles.length > 0, cycles } };
}

function humanDecisions(contradictions, cycleDetection, namespace, items) {
  const decisions = contradictions.filter(item => item.resolution.status !== 'resolved').map(item => ({
    decision_id: stableId('DECISION', namespace, { contradiction_id: item.contradiction_id }),
    question: `Resolve ${item.contradiction_id} without silently selecting a specialist claim.`,
    finding_refs: item.finding_refs,
    blocking_remediation_refs: items.filter(remediation => remediation.finding_refs.some(id => item.finding_refs.includes(id))).map(item => item.remediation_id).sort(),
  }));
  if (cycleDetection.detected) decisions.push({
    decision_id: stableId('DECISION', namespace, { cycles: cycleDetection.cycles }),
    question: 'Break the remediation dependency cycle before implementation sequencing.',
    finding_refs: sorted(items.filter(item => item.wave === null).flatMap(item => item.finding_refs)),
    blocking_remediation_refs: sorted(cycleDetection.cycles.flat()),
  });
  return decisions.sort((a, b) => a.decision_id.localeCompare(b.decision_id));
}

function assertRevision(record, expected, label) {
  const revision = record?.project_revision ?? record?.source_revision ?? record?.application?.revision ?? record?.project?.revision;
  if (revision && revision !== expected) throw new Error(`REVISION_MISMATCH: ${label} ${revision} does not match ${expected}`);
}

export function synthesize(input) {
  const { runId, generatedAt, projectRevision, auditPlan, runManifest, projectContext, taskModel = null, contentContract = null, flowContract = null, captureManifest, ledger = [] } = input;
  assertValidRecord(auditPlan, 'audit-plan'); assertValidRecord(runManifest, 'run-manifest'); assertValidRecord(projectContext, 'project-context'); assertValidRecord(captureManifest, 'capture-manifest');
  for (const [label, record] of Object.entries({ auditPlan, runManifest, captureManifest })) {
    if (record.run_id !== runId) throw new Error(`RUN_MISMATCH: ${label} ${record.run_id} does not match ${runId}`);
  }
  if (taskModel) assertValidRecord(taskModel, 'task-model');
  if (contentContract) assertValidRecord(contentContract, 'content-contract');
  if (flowContract) assertValidRecord(flowContract, 'flow-contract');
  for (const [label, record] of Object.entries({ auditPlan, runManifest, projectContext, taskModel, contentContract, flowContract, captureManifest })) if (record) assertRevision(record, projectRevision, label);
  const current = input.findings ?? [];
  for (const finding of [...current, ...ledger]) assertValidRecord(finding, 'finding');
  for (const finding of current) if (finding.run_id !== runId) throw new Error(`RUN_MISMATCH: current finding ${finding.id} belongs to ${finding.run_id}, not ${runId}`);
  const byFinding = new Map(ledger.filter(item => !['verified', 'waived'].includes(item.status)).map(item => [item.id, item]));
  for (const finding of current) byFinding.set(finding.id, finding);
  const findings = [...byFinding.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (!findings.length) throw new Error('INSUFFICIENT_SYNTHESIS_INPUTS: no specialist or unresolved ledger findings');
  const evidence = input.evidence ?? [];
  for (const record of evidence) { assertValidRecord(record, 'evidence'); assertRevision(record.provenance, projectRevision, `evidence ${record.id}`); }
  const evidenceIds = new Set(evidence.map(item => item.id));
  const missingEvidence = sorted(findings.flatMap(item => item.evidence_refs).filter(id => !evidenceIds.has(id)));
  const namespace = projectRevision;
  const dedup = deduplicate(findings, namespace);
  const clusters = buildClusters(findings, dedup.canonical, runId, namespace);
  let relationships = uniqueRelationships([
    ...dedup.duplicateRelationships,
    ...dedup.ambiguousRelationships,
    ...explicitRelationships(findings, clusters, namespace, input.relationshipHints),
    ...inferredReinforcement(findings, clusters, namespace),
  ]);
  const contradictions = contradictionRecords(findings, relationships, runId, projectRevision, namespace, input.contradictionResolutions);
  const conflicting = new Set(contradictions.flatMap(item => item.evidence_refs));
  for (const cluster of clusters) cluster.conflicting_evidence_refs = cluster.supporting_evidence_refs.filter(id => conflicting.has(id));
  const synthesisId = stableId('SYN', namespace, { findings: findings.map(item => item.id), evidence: sorted(evidenceIds), relationships: relationships.map(item => item.relationship_id) });
  const sourceAudits = new Set(current.map(item => item.source_audit));
  const selectedAudits = auditPlan.decisions.filter(item => item.disposition === 'selected').map(item => item.audit);
  const coverageLimitations = [
    ...auditPlan.decisions.filter(item => item.disposition !== 'selected').map(item => `${item.audit}: ${item.disposition} — ${item.reason}`),
    ...selectedAudits.filter(audit => !sourceAudits.has(audit)).map(audit => `${audit}: selected but no current-run findings were available.`),
    ...(!contentContract && selectedAudits.some(audit => ['place-audit', 'flow-audit'].includes(audit)) ? ['A content contract applicable to place/flow synthesis was not supplied.'] : []),
    ...(!flowContract && selectedAudits.includes('functional-audit') ? ['A flow contract applicable to functional synthesis was not supplied.'] : []),
    ...(!taskModel && findings.some(item => item.task_refs.length) ? ['Task references exist but no task model was supplied.'] : []),
  ];
  const evidenceLimitations = [
    ...missingEvidence.map(id => `Referenced evidence ${id} was not supplied; no replacement was fabricated.`),
    ...(captureManifest.status === 'complete' ? [] : [`Shared capture is ${captureManifest.status}; ${captureManifest.capture_needed.length} artifacts remain.`]),
  ];
  const degradedReasons = sorted([...coverageLimitations, ...evidenceLimitations]);
  const synthesis = {
    schema_version: 'aud-synthesis-result-v1', synthesis_id: synthesisId, run_id: runId, generated_at: generatedAt, project_revision: projectRevision,
    input_refs: input.inputRefs,
    source_finding_refs: findings.map(item => item.id),
    canonical_findings: dedup.canonical,
    relationships,
    clusters,
    contradictions,
    coverage_limitations: sorted(coverageLimitations),
    evidence_limitations: sorted(evidenceLimitations),
    deferred_finding_refs: sorted(findings.filter(item => item.type === 'keep' || item.status === 'waived' || item.evidence_refs.some(id => !evidenceIds.has(id))).map(item => item.id)),
    degraded: degradedReasons.length > 0,
    degraded_reasons: degradedReasons,
  };
  assertValidRecord(synthesis, 'synthesis-result');
  for (const cluster of clusters) assertValidRecord(cluster, 'issue-cluster');
  for (const contradiction of contradictions) assertValidRecord(contradiction, 'contradiction');
  const items = buildRemediationItems(clusters, findings, relationships, taskModel, contradictions, namespace);
  const order = dependencyWaves(items);
  const remediationPlan = {
    schema_version: 'aud-remediation-plan-v2',
    plan_id: stableId('RP', namespace, { synthesis_id: synthesisId, remediation_ids: items.map(item => item.remediation_id) }),
    run_id: runId,
    synthesis_id: synthesisId,
    generated_at: generatedAt,
    project_revision: projectRevision,
    items,
    waves: order.waves,
    cycle_detection: order.cycle_detection,
    human_decisions: humanDecisions(contradictions, order.cycle_detection, namespace, items),
    authority: { analysis_only: true, application_mutations: [], verification_deferred: true },
  };
  for (const item of items) assertValidRecord(item, 'remediation-item');
  assertValidRecord(remediationPlan, 'remediation-plan');
  return { synthesis, remediationPlan, sourceFindings: findings };
}

export function annotateLedger(findings, synthesis, remediationPlan) {
  const clusterRefs = new Map(synthesis.clusters.flatMap(cluster => cluster.finding_refs.map(id => [id, cluster.cluster_id])));
  const relationshipRefs = new Map();
  for (const item of synthesis.relationships) {
    if (!relationshipRefs.has(item.source_finding_id)) relationshipRefs.set(item.source_finding_id, []);
    relationshipRefs.get(item.source_finding_id).push(item.relationship_id);
    if (item.target_id.startsWith('F-')) {
      if (!relationshipRefs.has(item.target_id)) relationshipRefs.set(item.target_id, []);
      relationshipRefs.get(item.target_id).push(item.relationship_id);
    }
  }
  const remediationRefs = new Map(remediationPlan.items.flatMap(item => item.finding_refs.map(id => [id, item.remediation_id])));
  return findings.map(finding => {
    const previous = finding.synthesis ?? { cluster_refs: [], relationship_refs: [], remediation_refs: [], history: [] };
    const event = { synthesis_id: synthesis.synthesis_id, run_id: synthesis.run_id, at: synthesis.generated_at };
    const history = previous.history.some(item => item.synthesis_id === event.synthesis_id) ? previous.history : [...previous.history, event];
    const annotated = {
      ...finding,
      synthesis: {
        cluster_refs: sorted([...previous.cluster_refs, clusterRefs.get(finding.id)].filter(Boolean)),
        relationship_refs: sorted([...previous.relationship_refs, ...(relationshipRefs.get(finding.id) ?? [])]),
        remediation_refs: sorted([...previous.remediation_refs, remediationRefs.get(finding.id)].filter(Boolean)),
        history,
      },
    };
    assertValidRecord(annotated, 'finding');
    return annotated;
  });
}
