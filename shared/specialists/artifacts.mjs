import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { assertValidRecord } from '../validators/schema-registry.mjs';
import { evidenceId, findingId, stableId } from '../validators/stable-ids.mjs';

const inputRules = Object.freeze({
  'content-audit': { project: 'required', task: 'required' },
  'place-audit': { project: 'optional', task: 'required', content: 'optional' },
  'flow-audit': { project: 'required', task: 'required', content: 'optional' },
  'visual-audit': { project: 'optional', task: 'optional' },
  'functional-audit': { project: 'optional', task: 'optional', flow: 'optional', remediation: 'optional' },
});

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function atomicWrite(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, value, 'utf8');
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function writeJson(path, value) {
  atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(path, records) {
  atomicWrite(path, records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''));
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument ${key ?? ''}`);
    options[key.slice(2)] = value;
  }
  for (const required of ['manifest', 'input', 'out']) {
    if (!options[required]) throw new Error(`Missing required --${required}`);
  }
  return options;
}

function loadContract(options, key, schema, required, status) {
  const path = options[key];
  if (!path) {
    status.inputs.push({ kind: key, state: 'missing', required, reason: `${key} was not supplied; no values were inferred` });
    if (required) status.degraded = true;
    return null;
  }
  const record = readJson(resolve(path));
  assertValidRecord(record, schema);
  status.inputs.push({ kind: key, state: 'consumed', required, artifact_ref: resolve(path), schema_version: record.schema_version });
  return record;
}

function assertCompatible(record, manifest, label) {
  if (!record) return;
  if (record.run_id && record.run_id !== manifest.run_id) throw new Error(`INCOMPATIBLE_RUN: ${label} uses ${record.run_id}; expected ${manifest.run_id}`);
  const revision = record.project_revision ?? record.project?.revision;
  if (revision && revision !== manifest.application.revision) {
    throw new Error(`STALE_CONTRACT: ${label} uses revision ${revision}; expected ${manifest.application.revision}`);
  }
}

function makeEvidence(raw, finding, manifest, sourceAudit, index) {
  const evidence = {
    schema_version: 'aud-evidence-v1',
    id: '',
    run_id: manifest.run_id,
    type: raw.type ?? 'observation',
    artifact_ref: raw.artifact_ref,
    exact_observation: raw.exact_observation,
    provenance: {
      source: raw.source ?? raw.artifact_ref,
      captured_by: sourceAudit,
      source_revision: raw.source_revision ?? manifest.application.revision,
    },
    strength: raw.strength ?? 'direct',
    environment: raw.environment ?? manifest.environment,
    route: raw.route ?? finding.locations?.[0]?.route ?? null,
    state: raw.state ?? finding.locations?.[0]?.state ?? null,
    viewport: raw.viewport ?? finding.locations?.[0]?.viewport ?? null,
    data_fixture: raw.data_fixture ?? null,
    timestamp: raw.timestamp ?? raw.generated_at,
    hash: raw.hash ?? null,
  };
  if (!evidence.timestamp) throw new Error(`Finding ${index} evidence requires timestamp`);
  evidence.id = evidenceId(evidence);
  assertValidRecord(evidence, 'evidence');
  return evidence;
}

function makeFinding(raw, evidence, manifest, sourceAudit) {
  const finding = {
    schema_version: 'aud-finding-v1',
    id: '',
    run_id: manifest.run_id,
    source_audit: sourceAudit,
    category: raw.category,
    type: raw.type ?? 'risk',
    title: raw.title,
    statement: raw.statement,
    locations: raw.locations,
    task_refs: raw.task_refs ?? [],
    affected_personas: raw.affected_personas ?? [],
    affected_areas: raw.affected_areas,
    evidence_refs: evidence.map(item => item.id),
    severity: raw.severity,
    confidence: raw.confidence,
    reach: raw.reach,
    frequency: raw.frequency,
    urgency: raw.urgency,
    native_metrics: raw.native_metrics ?? {},
    root_cause_hypothesis: raw.root_cause_hypothesis ?? null,
    recommendation: raw.recommendation,
    acceptance_criteria: raw.acceptance_criteria ?? [],
    verification_method: raw.verification_method ?? [],
    relationships: raw.relationships ?? {
      duplicates: [], reinforces: [], contradicts: [], depends_on: [], blocks: [], caused_by: [],
    },
    status: raw.status ?? 'open',
  };
  if (!finding.acceptance_criteria.length || !finding.verification_method.length) {
    finding.verification_absence_reason = raw.verification_absence_reason;
  }
  finding.id = findingId(finding);
  assertValidRecord(finding, 'finding');
  return finding;
}

function taskAndPersonaChecks(raw, contexts) {
  if (!contexts.task && (raw.task_refs?.length ?? 0)) throw new Error('MISSING_TASK_MODEL: finding task_refs cannot be accepted without a task model');
  if (contexts.task) {
    const known = new Set(contexts.task.tasks.map(task => task.id));
    for (const id of raw.task_refs ?? []) if (!known.has(id)) throw new Error(`UNKNOWN_TASK_REFERENCE: ${id}`);
  }
  if (!contexts.project && (raw.affected_personas?.length ?? 0)) throw new Error('MISSING_PROJECT_CONTEXT: affected_personas cannot be accepted without project context');
  if (contexts.project) {
    const known = new Set(contexts.project.personas.map(persona => persona.id));
    for (const id of raw.affected_personas ?? []) if (!known.has(id)) throw new Error(`UNKNOWN_PERSONA_REFERENCE: ${id}`);
  }
}

function buildContentContract(input, manifest, evidence, contexts) {
  const contentByKey = new Map();
  const resolveContentKey = key => {
    const id = contentByKey.get(key);
    if (!id) throw new Error(`UNKNOWN_CONTENT_KEY: ${key}`);
    return id;
  };
  const contentItems = input.content_items.map(item => {
    if (contentByKey.has(item.block_key)) throw new Error(`DUPLICATE_CONTENT_KEY: ${item.block_key}`);
    const knownRoles = contexts.project ? new Set(contexts.project.roles.map(role => role.id)) : null;
    const knownStages = contexts.project ? new Set(contexts.project.journey_stages.map(stage => stage.id)) : null;
    if (!knownRoles && (item.role_refs?.length ?? 0)) throw new Error('MISSING_PROJECT_CONTEXT: content role_refs cannot be accepted without project context');
    if (!knownStages && (item.journey_stage_refs?.length ?? 0)) throw new Error('MISSING_PROJECT_CONTEXT: content journey_stage_refs cannot be accepted without project context');
    for (const id of item.role_refs ?? []) if (!knownRoles.has(id)) throw new Error(`UNKNOWN_ROLE_REFERENCE: ${id}`);
    for (const id of item.journey_stage_refs ?? []) if (!knownStages.has(id)) throw new Error(`UNKNOWN_JOURNEY_STAGE_REFERENCE: ${id}`);
    const id = stableId('CONTENT', manifest.application.revision, {
      block_key: item.block_key,
      statement: item.statement,
      responsibility: item.responsibility,
    });
    contentByKey.set(item.block_key, id);
    return {
      id,
      statement: item.statement,
      responsibility: item.responsibility,
      provenance_refs: item.provenance_finding_indexes?.flatMap(index => evidence[index]?.map(record => record.id) ?? []) ?? [],
      role_refs: item.role_refs ?? [],
      journey_stage_refs: item.journey_stage_refs ?? [],
      decision: item.decision,
      merged_into: null,
    };
  });
  for (const [index, item] of input.content_items.entries()) {
    if (item.merged_into_key) {
      if (!contentByKey.has(item.merged_into_key)) throw new Error(`UNKNOWN_CONTENT_KEY: ${item.merged_into_key}`);
      contentItems[index].merged_into = contentByKey.get(item.merged_into_key);
    }
  }
  const contract = {
    schema_version: 'aud-content-contract-v1',
    contract_id: stableId('CC', manifest.run_id, { source_audit: 'content-audit', content: [...contentByKey.keys()] }),
    run_id: manifest.run_id,
    project_revision: manifest.application.revision,
    generated_at: input.generated_at,
    content_items: contentItems,
    view_contracts: input.view_contracts.map(view => ({
      id: view.id,
      purpose: view.purpose,
      content_refs: view.content_keys.map(resolveContentKey),
      minimum_first_read: view.minimum_first_read_keys.map(resolveContentKey),
      progressive_disclosure: view.progressive_disclosure_keys.map(resolveContentKey),
    })),
    human_owned_decisions: input.human_owned_decisions ?? [],
    assumptions: input.assumptions ?? [],
    status: input.contract_status ?? 'draft',
  };
  assertValidRecord(contract, 'content-contract');
  return contract;
}

function survivingContentIds(contract) {
  if (!contract) return null;
  return new Set(contract.content_items.filter(item => ['keep', 'disclose', 'human_decision'].includes(item.decision)).map(item => item.id));
}

function preparePlaceFindings(input, content, status) {
  const surviving = survivingContentIds(content);
  const known = content ? new Set(content.content_items.map(item => item.id)) : null;
  return input.findings.filter((finding, index) => {
    if (known) {
      for (const id of finding.content_refs ?? []) if (!known.has(id)) throw new Error(`UNKNOWN_CONTENT_REFERENCE: ${id}`);
    }
    if (!surviving || !(finding.content_refs?.length)) return true;
    const applicable = finding.content_refs.some(id => surviving.has(id));
    if (!applicable) status.skipped_findings.push({ index, reason: 'content_removed_or_merged_upstream', content_refs: finding.content_refs });
    return applicable;
  }).map(finding => {
    if (finding.category !== 'duplicate_candidate') return finding;
    if (/\b(delete|remove)\b/i.test(finding.recommendation.action)) {
      throw new Error('BOUNDARY_VIOLATION: place-audit duplicate_candidate cannot delete or remove content');
    }
    return finding;
  });
}

function buildFlowContract(input, manifest, findings) {
  const recommendations = findings.flatMap((finding, index) => {
    const raw = input.findings[index]?.flow_recommendation;
    if (!raw) return [];
    return {
      id: stableId('FLOW', manifest.run_id, { finding_ref: finding.id, intent: raw.intent }),
      finding_ref: finding.id,
      task_refs: finding.task_refs,
      persona_refs: finding.affected_personas,
      content_refs: raw.content_refs ?? [],
      intent: raw.intent,
      required_behavior: raw.required_behavior,
      preserved_context: raw.preserved_context ?? [],
      return_path: raw.return_path ?? null,
      acceptance_criteria: finding.acceptance_criteria,
      verification_methods: finding.verification_method,
      status: raw.status ?? 'proposed',
    };
  });
  const contract = {
    schema_version: 'aud-flow-contract-v1',
    contract_id: stableId('FC', manifest.run_id, { source_audit: 'flow-audit', recommendations: recommendations.map(item => item.id) }),
    run_id: manifest.run_id,
    project_revision: manifest.application.revision,
    generated_at: input.generated_at,
    task_refs: [...new Set(recommendations.flatMap(item => item.task_refs))],
    persona_refs: [...new Set(recommendations.flatMap(item => item.persona_refs))],
    content_refs: [...new Set(recommendations.flatMap(item => item.content_refs))],
    recommendations,
    assumptions: input.assumptions ?? [],
    status: input.contract_status ?? 'draft',
  };
  assertValidRecord(contract, 'flow-contract');
  return contract;
}

function enforceFunctionalBoundary(input, contexts) {
  const acceptedFlow = contexts.flow?.recommendations.filter(item => item.status === 'accepted') ?? [];
  const remediation = contexts.remediation?.items ?? [];
  const acceptedRefs = new Set([...acceptedFlow.map(item => item.id), ...remediation.map(item => item.remediation_id)]);
  for (const finding of input.findings) {
    if (!finding.category.startsWith('functional.')) throw new Error(`BOUNDARY_VIOLATION: functional category ${finding.category} is outside functional verification`);
    if (/\b(redesign|rewrite content|restyle|reposition)\b/i.test(finding.recommendation.action)) {
      throw new Error('BOUNDARY_VIOLATION: functional-audit verifies accepted contracts and cannot redesign specialist decisions');
    }
    if (acceptedRefs.size && !(finding.contract_refs?.length)) {
      throw new Error('MISSING_CONTRACT_REFERENCE: functional findings must identify the accepted flow/remediation item being verified');
    }
    for (const ref of finding.contract_refs ?? []) {
      if (!acceptedRefs.has(ref)) throw new Error(`UNACCEPTED_CONTRACT_REFERENCE: ${ref}`);
    }
    finding.native_metrics = { ...(finding.native_metrics ?? {}), contract_refs: finding.contract_refs ?? [] };
  }
  contexts.acceptedFlow = acceptedFlow;
  contexts.acceptedRemediation = remediation;
}

export function runSpecialist(sourceAudit, argv = process.argv.slice(2)) {
  if (!inputRules[sourceAudit]) throw new Error(`Unknown specialist ${sourceAudit}`);
  const options = parseArgs(argv);
  const manifestPath = resolve(options.manifest);
  const manifest = readJson(manifestPath);
  assertValidRecord(manifest, 'run-manifest');
  if (!manifest.selected_audits.includes(sourceAudit) && !(sourceAudit === 'functional-audit' && manifest.selected_audits.includes('audit'))) {
    throw new Error(`AUDIT_NOT_SELECTED: ${sourceAudit} is not selected by ${manifest.run_id}`);
  }
  const input = readJson(resolve(options.input));
  const status = {
    schema_version: 'aud-specialist-input-status-v1',
    run_id: manifest.run_id,
    source_audit: sourceAudit,
    manifest_ref: manifestPath,
    mode: manifest.mode,
    pipeline_report_only: manifest.mode !== 'specialist' || input.mode !== 'fix',
    degraded: false,
    inputs: [{ kind: 'run-manifest', state: 'consumed', required: true, artifact_ref: manifestPath, schema_version: manifest.schema_version }],
    skipped_findings: [],
  };
  const rules = inputRules[sourceAudit];
  const definitions = {
    project: ['project-context', 'project-context'],
    task: ['task-model', 'task-model'],
    content: ['content-contract', 'content-contract'],
    flow: ['flow-contract', 'flow-contract'],
    remediation: ['remediation-plan', 'remediation-plan'],
  };
  const contexts = {};
  for (const [name, [option, schema]] of Object.entries(definitions)) {
    contexts[name] = rules[name]
      ? loadContract(options, option, schema, rules[name] === 'required', status)
      : null;
  }
  for (const [key, record] of Object.entries(contexts)) assertCompatible(record, manifest, key);
  if (sourceAudit === 'functional-audit') enforceFunctionalBoundary(input, contexts);

  let rawFindings = input.findings;
  if (sourceAudit === 'place-audit') rawFindings = preparePlaceFindings(input, contexts.content, status);
  if (sourceAudit === 'flow-audit' && contexts.content) {
    const surviving = survivingContentIds(contexts.content);
    for (const raw of rawFindings) {
      for (const id of raw.flow_recommendation?.content_refs ?? []) {
        if (!surviving.has(id)) throw new Error(`NON_SURVIVING_CONTENT_REFERENCE: ${id}`);
      }
    }
  }
  const evidenceGroups = [];
  const findings = rawFindings.map((raw, index) => {
    taskAndPersonaChecks(raw, contexts);
    const evidence = (raw.evidence ?? []).map(item => makeEvidence(item, raw, manifest, sourceAudit, index));
    if (!evidence.length) throw new Error(`Finding ${index} requires finding-level evidence`);
    evidenceGroups.push(evidence);
    return makeFinding(raw, evidence, manifest, sourceAudit);
  });
  const evidence = [...new Map(evidenceGroups.flat().map(record => [record.id, record])).values()];
  if (new Set(findings.map(record => record.id)).size !== findings.length) throw new Error('DUPLICATE_FINDING_ID: normalized findings must have distinct stable IDs');
  const contentContract = sourceAudit === 'content-audit'
    ? buildContentContract(input, manifest, evidenceGroups, contexts)
    : null;
  const flowContract = sourceAudit === 'flow-audit'
    ? buildFlowContract(input, manifest, findings)
    : null;
  const outputDirectory = resolve(options.out);
  mkdirSync(outputDirectory, { recursive: true });
  writeJsonl(join(outputDirectory, 'evidence.jsonl'), evidence);
  writeJsonl(join(outputDirectory, 'findings.jsonl'), findings);
  status.degraded ||= status.inputs.some(item => item.state === 'missing');
  status.accepted_flow_contract_items = contexts.acceptedFlow?.length ?? 0;
  status.remediation_items = contexts.acceptedRemediation?.length ?? 0;
  writeJson(join(outputDirectory, 'input-status.json'), status);

  if (contentContract) writeJson(join(outputDirectory, 'content-contract.json'), contentContract);
  if (flowContract) writeJson(join(outputDirectory, 'flow-contract.json'), flowContract);
  return { findings, evidence, status, outputDirectory, manifest };
}

export function specialistMain(sourceAudit, argv = process.argv.slice(2)) {
  try {
    const result = runSpecialist(sourceAudit, argv);
    process.stdout.write(`${sourceAudit}: wrote ${result.findings.length} findings and ${result.evidence.length} evidence records to ${result.outputDirectory}\n`);
  } catch (error) {
    process.stderr.write(`SPECIALIST_OUTPUT_ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
