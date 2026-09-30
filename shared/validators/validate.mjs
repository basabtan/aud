#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaFiles, validateRecord } from './schema-registry.mjs';

export function readRecords(path) {
  const text = readFileSync(path, 'utf8');
  if (extname(path).toLowerCase() !== '.jsonl') return [{ line: 1, record: JSON.parse(text) }];
  return text.split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(item => item.text)
    .map(item => ({ line: item.line, record: JSON.parse(item.text) }));
}

export function validateFile(expectedName, path) {
  if (!(expectedName in schemaFiles)) throw new Error(`Unknown schema ${expectedName}. Expected one of: ${Object.keys(schemaFiles).join(', ')}`);
  const results = readRecords(path).map(({ line, record }) => ({ line, ...validateRecord(record, expectedName) }));
  return { valid: results.every(result => result.valid), path, schema: expectedName, results };
}

function main() {
  const [expectedName, path] = process.argv.slice(2);
  if (!expectedName || !path) {
    console.error(`Usage: node ${fileURLToPath(import.meta.url)} <schema-name> <file.json|file.jsonl>`);
    console.error(`Schema names: ${Object.keys(schemaFiles).join(', ')}`);
    process.exit(2);
  }
  try {
    const result = validateFile(expectedName, path);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.valid) process.exit(1);
  } catch (error) {
    console.error(`VALIDATION_TOOL_ERROR: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
