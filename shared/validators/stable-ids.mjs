#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const prefixes = new Set(['RUN', 'TASK', 'EV', 'F', 'CONTENT', 'FLOW', 'R', 'V', 'CC', 'FC', 'AC', 'AP', 'CAP', 'TM', 'RP', 'CLUSTER', 'REL', 'CONTRA', 'SYN', 'CANON', 'DECISION']);

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function stableId(prefix, namespace, identity) {
  if (!prefixes.has(prefix)) throw new Error(`Unsupported ID prefix ${prefix}`);
  if (!namespace) throw new Error('ID namespace is required');
  const digest = createHash('sha256').update(`${namespace}\0${canonicalJson(identity)}`).digest('hex').slice(0, 20).toUpperCase();
  return `${prefix}-${digest}`;
}

export function findingId(finding) {
  return stableId('F', finding.run_id, {
    source_audit: finding.source_audit,
    category: finding.category,
    statement: finding.statement,
    locations: finding.locations,
    task_refs: finding.task_refs,
  });
}

export function evidenceId(evidence) {
  return stableId('EV', evidence.run_id, {
    type: evidence.type,
    artifact_ref: evidence.artifact_ref,
    exact_observation: evidence.exact_observation,
  });
}

function main() {
  const [prefix, namespace, json] = process.argv.slice(2);
  if (!prefix || !namespace || !json) {
    console.error(`Usage: node ${fileURLToPath(import.meta.url)} <prefix> <namespace> <identity-json>`);
    process.exit(2);
  }
  try {
    process.stdout.write(`${stableId(prefix, namespace, JSON.parse(json))}\n`);
  } catch (error) {
    console.error(`ID_GENERATION_ERROR: ${error.message}`);
    process.exit(2);
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
