import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { mergeLedger, parseJsonLines } from '../ledger/merge.mjs';
import { assertAuditArtifactPath } from './paths.mjs';

export function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function writeJsonAtomic(path, value) {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeJsonlAtomic(path, records) {
  writeAtomic(path, records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''));
}

export function readLedger(path) {
  return existsSync(path) ? parseJsonLines(readFileSync(path, 'utf8'), path) : [];
}

export function mergeLedgerAtomic(applicationRoot, ledgerPath, existing, incoming, at) {
  const target = assertAuditArtifactPath(applicationRoot, ledgerPath);
  const merged = mergeLedger(existing, incoming, { at });
  writeJsonlAtomic(target, merged);
  return merged;
}

const rowLabels = Object.freeze({
  'content-audit': 'Content',
  'place-audit': 'Place',
  'flow-audit': 'Flow',
  'visual-audit': 'Visual',
  'functional-audit': 'Functional',
});

function priorRows(text = '') {
  const rows = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\| (Content|Place|Flow|Visual|Functional) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/);
    if (match) rows.set(match[1], { link: match[2].trim(), revision: match[3].trim(), status: match[4].trim() });
  }
  return rows;
}

export function updateLatestAtomic({ applicationRoot, latestPath, timestamp, revision, executionResults, ledger }) {
  const target = assertAuditArtifactPath(applicationRoot, latestPath);
  const prior = priorRows(existsSync(target) ? readFileSync(target, 'utf8') : '');
  for (const result of executionResults) {
    const label = rowLabels[result.audit];
    if (!label || !result.directory) continue;
    prior.set(label, {
      link: `[${result.directory.split(/[\\/]/).at(-1)}](${relative(dirname(target), result.directory).replaceAll('\\', '/')})`,
      revision,
      status: result.status,
    });
  }
  const rows = Object.values(rowLabels).map(label => {
    const value = prior.get(label) ?? { link: '—', revision: '—', status: 'not-run' };
    return `| ${label} | ${value.link} | ${value.revision} | ${value.status} |`;
  });
  const open = ledger.filter(finding => !['verified', 'waived'].includes(finding.status));
  const findingRows = open.length
    ? open.map(finding => `| \`${finding.id}\` | ${finding.status} | ${finding.title.replaceAll('|', '\\|')} | ${finding.evidence_refs.at(-1) ?? '—'} | ${finding.recommendation.action.replaceAll('|', '\\|')} |`)
    : ['| — | — | No unresolved findings | — | — |'];
  const text = `# AUD latest\n\nUpdated: ${timestamp}  \nApplication revision: ${revision}\n\n| Specialist | Latest run | Revision | Status |\n|---|---|---|---|\n${rows.join('\n')}\n\n## Open findings\n\nSource of truth: [\`findings-ledger.jsonl\`](findings-ledger.jsonl), validated as\n\`aud-finding-v1\` records.\n\n| ID | Status | Title | Latest evidence | Next action |\n|---|---|---|---|---|\n${findingRows.join('\n')}\n\n## Carry-forward\n\n- Unresolved finding IDs: ${open.length ? open.map(finding => finding.id).join(', ') : 'none'}\n- Synthesis, clustering, and priority: deferred to Phase 4\n- Full verification execution: deferred to Phase 5\n`;
  writeAtomic(target, text);
  return target;
}
