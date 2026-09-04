import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = join(here, '..', 'schemas');

export const schemaFiles = Object.freeze({
  'project-context': 'project-context.schema.json',
  'task-model': 'task-model.schema.json',
  'run-manifest': 'run-manifest.schema.json',
  evidence: 'evidence.schema.json',
  finding: 'finding.schema.json',
  'content-contract': 'content-contract.schema.json',
  'flow-contract': 'flow-contract.schema.json',
  'remediation-plan': 'remediation-plan.schema.json',
  'verification-result': 'verification-result.schema.json',
});

export const schemaVersions = Object.freeze({
  'project-context': 'aud-project-context-v1',
  'task-model': 'aud-task-model-v1',
  'run-manifest': 'aud-run-manifest-v1',
  evidence: 'aud-evidence-v1',
  finding: 'aud-finding-v1',
  'content-contract': 'aud-content-contract-v1',
  'flow-contract': 'aud-flow-contract-v1',
  'remediation-plan': 'aud-remediation-plan-v1',
  'verification-result': 'aud-verification-result-v1',
});

const nameByVersion = new Map(Object.entries(schemaVersions).map(([name, version]) => [version, name]));

function readSchema(filename) {
  return JSON.parse(readFileSync(join(schemaDirectory, filename), 'utf8'));
}

const common = readSchema('common.schema.json');
const schemas = Object.fromEntries(Object.entries(schemaFiles).map(([name, filename]) => [name, readSchema(filename)]));

export function createRegistry() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(common);
  for (const schema of Object.values(schemas)) ajv.addSchema(schema);
  return ajv;
}

const registry = createRegistry();

function issue(code, path, message, details = {}) {
  return { code, path, message, ...details };
}

function duplicateIdIssues(records, path, field = 'id') {
  const seen = new Set();
  const issues = [];
  for (const [index, record] of records.entries()) {
    const id = record?.[field];
    if (id && seen.has(id)) issues.push(issue('DUPLICATE_ID', `${path}/${index}/${field}`, `Duplicate ${field} ${id}`));
    if (id) seen.add(id);
  }
  return issues;
}

function missingReferenceIssues(values, known, path, kind) {
  return values
    .map((value, index) => known.has(value) ? null : issue('UNKNOWN_REFERENCE', `${path}/${index}`, `Unknown ${kind} reference ${value}`))
    .filter(Boolean);
}

function semanticIssues(name, record) {
  const issues = [];
  if (name === 'project-context') {
    for (const key of ['personas', 'roles', 'journey_stages', 'routes', 'surfaces', 'fixture_variants']) {
      issues.push(...duplicateIdIssues(record[key], `/${key}`));
    }
  }
  if (name === 'task-model') issues.push(...duplicateIdIssues(record.tasks, '/tasks'));
  if (name === 'run-manifest' && record.finished_at && Date.parse(record.finished_at) < Date.parse(record.started_at)) {
    issues.push(issue('INVALID_TIME_RANGE', '/finished_at', 'finished_at must not precede started_at'));
  }
  if (name === 'finding') {
    for (const [relation, refs] of Object.entries(record.relationships)) {
      if (refs.includes(record.id)) issues.push(issue('SELF_REFERENCE', `/relationships/${relation}`, `Finding cannot reference itself as ${relation}`));
    }
    const history = record.status_history ?? [];
    if (history.length && history.at(-1).status !== record.status) {
      issues.push(issue('STATUS_HISTORY_MISMATCH', '/status_history', 'Last status-history entry must match current status'));
    }
  }
  if (name === 'content-contract') {
    issues.push(...duplicateIdIssues(record.content_items, '/content_items'));
    issues.push(...duplicateIdIssues(record.view_contracts, '/view_contracts'));
    const contentIds = new Set(record.content_items.map(item => item.id));
    for (const [index, item] of record.content_items.entries()) {
      if (item.merged_into) issues.push(...missingReferenceIssues([item.merged_into], contentIds, `/content_items/${index}/merged_into`, 'content'));
      if (item.merged_into === item.id) issues.push(issue('SELF_REFERENCE', `/content_items/${index}/merged_into`, 'Content item cannot merge into itself'));
    }
    for (const [index, view] of record.view_contracts.entries()) {
      for (const field of ['content_refs', 'minimum_first_read', 'progressive_disclosure']) {
        issues.push(...missingReferenceIssues(view[field], contentIds, `/view_contracts/${index}/${field}`, 'content'));
      }
    }
  }
  if (name === 'flow-contract') {
    issues.push(...duplicateIdIssues(record.recommendations, '/recommendations'));
    for (const [index, recommendation] of record.recommendations.entries()) {
      if (recommendation.status === 'accepted' && (!recommendation.acceptance_criteria.length || !recommendation.verification_methods.length)) {
        issues.push(issue('UNVERIFIABLE_ACCEPTED_RECOMMENDATION', `/recommendations/${index}`, 'Accepted flow recommendations require acceptance criteria and verification methods'));
      }
    }
  }
  if (name === 'remediation-plan') {
    issues.push(...duplicateIdIssues(record.items, '/items', 'remediation_id'));
    const remediationIds = new Set(record.items.map(item => item.remediation_id));
    for (const [index, item] of record.items.entries()) {
      issues.push(...missingReferenceIssues(item.dependencies, remediationIds, `/items/${index}/dependencies`, 'remediation'));
      if (item.dependencies.includes(item.remediation_id)) issues.push(issue('SELF_REFERENCE', `/items/${index}/dependencies`, 'Remediation item cannot depend on itself'));
    }
    for (const [index, wave] of record.waves.entries()) {
      issues.push(...missingReferenceIssues(wave.remediation_refs, remediationIds, `/waves/${index}/remediation_refs`, 'remediation'));
    }
  }
  return issues;
}

export function formatAjvErrors(errors = []) {
  return errors.map(error => issue(
    error.keyword === 'const' && error.instancePath === '/schema_version' ? 'INCOMPATIBLE_SCHEMA_VERSION' : 'SCHEMA_VALIDATION_ERROR',
    error.instancePath || '/',
    error.message ?? 'Schema validation failed',
    { keyword: error.keyword, params: error.params },
  ));
}

export function validateRecord(record, expectedName = null) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, schema: expectedName, version: null, errors: [issue('INVALID_DOCUMENT', '/', 'Document must be a JSON object')] };
  }
  const version = record.schema_version;
  if (typeof version !== 'string') {
    return { valid: false, schema: expectedName, version: null, errors: [issue('MISSING_SCHEMA_VERSION', '/schema_version', 'schema_version is required')] };
  }
  const name = nameByVersion.get(version);
  if (!name) {
    return { valid: false, schema: expectedName, version, errors: [issue('INCOMPATIBLE_SCHEMA_VERSION', '/schema_version', `Unsupported schema_version ${version}`, { supported_versions: [...nameByVersion.keys()] })] };
  }
  if (expectedName && name !== expectedName) {
    return { valid: false, schema: expectedName, version, errors: [issue('SCHEMA_TYPE_MISMATCH', '/schema_version', `Expected ${schemaVersions[expectedName]} but received ${version}`)] };
  }
  const validate = registry.getSchema(schemas[name].$id);
  const structurallyValid = validate(record);
  const errors = structurallyValid ? [] : formatAjvErrors(validate.errors);
  if (structurallyValid) errors.push(...semanticIssues(name, record));
  return { valid: errors.length === 0, schema: name, version, errors };
}

export function assertValidRecord(record, expectedName = null) {
  const result = validateRecord(record, expectedName);
  if (!result.valid) {
    const error = new Error(result.errors.map(item => `${item.code} ${item.path}: ${item.message}`).join('\n'));
    error.validation = result;
    throw error;
  }
  return record;
}
