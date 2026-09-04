#!/usr/bin/env node

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidRecord } from '../validators/schema-registry.mjs';

export const allowedTransitions = Object.freeze({
  open: new Set(['open', 'needs_evidence', 'accepted', 'waived']),
  needs_evidence: new Set(['needs_evidence', 'open', 'accepted', 'waived']),
  accepted: new Set(['accepted', 'planned', 'waived']),
  planned: new Set(['planned', 'implemented', 'waived']),
  implemented: new Set(['implemented', 'verified', 'partial', 'failed', 'waived']),
  verified: new Set(['verified', 'reopened']),
  partial: new Set(['partial', 'implemented', 'verified', 'failed', 'reopened', 'waived']),
  failed: new Set(['failed', 'reopened']),
  waived: new Set(['waived', 'reopened']),
  reopened: new Set(['reopened', 'needs_evidence', 'accepted', 'planned', 'implemented', 'waived']),
});

function union(left = [], right = []) {
  return [...new Set([...left, ...right])];
}

function mergeRelationships(left, right) {
  return Object.fromEntries(Object.keys(left).map(key => [key, union(left[key], right[key])]));
}

function transitionHistory(existing, incoming, at) {
  const history = [...(existing.status_history ?? [])];
  const supplied = incoming.status_history ?? [];
  if (supplied.length) {
    for (const event of supplied) {
      if (!history.some(item => item.status === event.status && item.at === event.at && item.run_id === event.run_id)) history.push(event);
    }
  } else if (incoming.status !== existing.status) {
    history.push({ status: incoming.status, at, reason: `Merged from ${incoming.run_id}`, run_id: incoming.run_id });
  }
  return history;
}

function assertTransition(from, to, id) {
  if (!allowedTransitions[from]?.has(to)) throw new Error(`INVALID_STATUS_TRANSITION ${id}: ${from} -> ${to}`);
}

export function mergeFinding(existing, incoming, options = {}) {
  assertValidRecord(existing, 'finding');
  assertValidRecord(incoming, 'finding');
  if (existing.id !== incoming.id) throw new Error(`FINDING_ID_MISMATCH: ${existing.id} != ${incoming.id}`);
  assertTransition(existing.status, incoming.status, existing.id);
  const at = options.at ?? new Date().toISOString();
  const merged = {
    ...existing,
    ...incoming,
    evidence_refs: union(existing.evidence_refs, incoming.evidence_refs),
    task_refs: union(existing.task_refs, incoming.task_refs),
    affected_personas: union(existing.affected_personas, incoming.affected_personas),
    affected_areas: union(existing.affected_areas, incoming.affected_areas),
    relationships: mergeRelationships(existing.relationships, incoming.relationships),
    status_history: transitionHistory(existing, incoming, at),
  };
  if (merged.status_history.length === 0) delete merged.status_history;
  assertValidRecord(merged, 'finding');
  return merged;
}

export function mergeLedger(existing, incoming, options = {}) {
  const byId = new Map();
  for (const finding of existing) {
    assertValidRecord(finding, 'finding');
    if (byId.has(finding.id)) throw new Error(`DUPLICATE_LEDGER_ID: ${finding.id}`);
    byId.set(finding.id, finding);
  }
  const incomingIds = new Set();
  for (const finding of incoming) {
    assertValidRecord(finding, 'finding');
    if (incomingIds.has(finding.id)) throw new Error(`DUPLICATE_INCOMING_ID: ${finding.id}`);
    incomingIds.add(finding.id);
    byId.set(finding.id, byId.has(finding.id) ? mergeFinding(byId.get(finding.id), finding, options) : finding);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function parseJsonLines(text, label) {
  return text.split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line.trim() })).filter(item => item.text).map(item => {
    try {
      return JSON.parse(item.text);
    } catch (error) {
      throw new Error(`INVALID_JSONL ${label}:${item.line}: ${error.message}`);
    }
  });
}

export function writeLedgerAtomic(path, records) {
  const target = resolve(path);
  const temporary = `${target}.tmp-${process.pid}`;
  const content = records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
  writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
  try {
    renameSync(temporary, target);
  } catch (error) {
    try { rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}

function main() {
  const [ledgerPath, incomingPath] = process.argv.slice(2);
  if (!ledgerPath || !incomingPath) {
    console.error(`Usage: node ${fileURLToPath(import.meta.url)} <findings-ledger.jsonl> <new-findings.jsonl>`);
    process.exit(2);
  }
  try {
    const existing = existsSync(ledgerPath) ? parseJsonLines(readFileSync(ledgerPath, 'utf8'), ledgerPath) : [];
    const incoming = parseJsonLines(readFileSync(incomingPath, 'utf8'), incomingPath);
    const merged = mergeLedger(existing, incoming);
    writeLedgerAtomic(ledgerPath, merged);
    console.log(`Merged ${incoming.length} findings into ${ledgerPath}; ${merged.length} ledger records retained.`);
  } catch (error) {
    console.error(`LEDGER_MERGE_ERROR: ${error.message}`);
    process.exit(1);
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
