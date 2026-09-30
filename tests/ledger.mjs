import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeFinding, mergeLedger, parseJsonLines, writeLedgerAtomic } from '../shared/ledger/merge.mjs';

const base = JSON.parse(readFileSync('tests/fixtures/schemas/finding/valid.json', 'utf8'));
const another = structuredClone(base);
another.id = 'F-SECOND-001';
another.title = 'Second unresolved finding';
another.statement = 'A separate unresolved issue remains present.';
another.evidence_refs = ['EV-SECOND-001'];

const carried = mergeLedger([base], [another]);
assert.equal(carried.length, 2, 'later run erased a prior finding');
assert.ok(carried.some(item => item.id === base.id && item.status === 'open'), 'unresolved finding was not carried forward');

const accepted = structuredClone(base);
accepted.run_id = 'RUN-2026-09-04-002';
accepted.status = 'accepted';
accepted.evidence_refs = ['EV-NEW-001'];
const merged = mergeFinding(base, accepted, { at: '2026-09-04T12:00:00Z' });
assert.deepEqual(merged.evidence_refs.sort(), ['EV-014', 'EV-NEW-001']);
assert.equal(merged.status_history.at(-1).status, 'accepted');

const verified = structuredClone(merged);
verified.status = 'verified';
verified.status_history = [...merged.status_history, { status: 'verified', at: '2026-09-04T13:00:00Z', reason: 'Acceptance criteria passed', run_id: 'RUN-2026-09-04-002' }];
const illegal = structuredClone(verified);
illegal.status = 'open';
illegal.status_history = [...verified.status_history, { status: 'open', at: '2026-09-04T14:00:00Z', reason: 'Incorrect implicit reset', run_id: 'RUN-2026-09-04-002' }];
assert.throws(() => mergeFinding(verified, illegal), /INVALID_STATUS_TRANSITION/);

const temp = mkdtempSync(join(tmpdir(), 'aud-ledger-'));
try {
  const path = join(temp, 'findings-ledger.jsonl');
  writeFileSync(path, `${JSON.stringify(base)}\n`);
  writeLedgerAtomic(path, carried);
  const reloaded = parseJsonLines(readFileSync(path, 'utf8'), path);
  assert.equal(reloaded.length, 2);
  assert.deepEqual(reloaded.map(item => item.id), [...reloaded.map(item => item.id)].sort());
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('PASS — ledger merge preserves unresolved findings, validates transitions, unions evidence, and writes atomically.');
