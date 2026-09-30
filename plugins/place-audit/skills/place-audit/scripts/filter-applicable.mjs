#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertValidRecord } from '../../../../../shared/validators/schema-registry.mjs';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required --${name}`);
  return resolve(process.argv[index + 1]);
}

try {
  const contractPath = option('content-contract');
  const inputPath = option('input');
  const outputPath = option('out');
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const packet = JSON.parse(readFileSync(inputPath, 'utf8'));
  assertValidRecord(contract, 'content-contract');
  if (!Array.isArray(packet.records)) throw new Error('Input must contain a records array');
  const known = new Set(contract.content_items.map(item => item.id));
  const surviving = new Set(contract.content_items
    .filter(item => ['keep', 'disclose', 'human_decision'].includes(item.decision))
    .map(item => item.id));
  const included = [];
  const skipped = [];
  for (const record of packet.records) {
    if (!Array.isArray(record.content_refs) || !record.content_refs.length) {
      skipped.push({ record_id: record.record_id, reason: 'missing_content_reference' });
      continue;
    }
    for (const id of record.content_refs) if (!known.has(id)) throw new Error(`UNKNOWN_CONTENT_REFERENCE: ${id}`);
    if (record.content_refs.some(id => surviving.has(id))) included.push(record);
    else skipped.push({ record_id: record.record_id, reason: 'content_removed_or_merged_upstream', content_refs: record.content_refs });
  }
  writeFileSync(outputPath, `${JSON.stringify({
    schema_version: 'place-applicable-content-v1',
    content_contract_id: contract.contract_id,
    run_id: contract.run_id,
    included,
    skipped,
  }, null, 2)}\n`, 'utf8');
} catch (error) {
  process.stderr.write(`PLACE_FILTER_ERROR: ${error.message}\n`);
  process.exitCode = 1;
}
