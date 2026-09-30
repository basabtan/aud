import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseJsonLines } from '../ledger/merge.mjs';
import { mergeLedgerAtomic, readLedger, writeAtomic, writeJsonAtomic } from '../orchestration/persistence.mjs';
import { assertAuditArtifactPath, canonicalRunDirectory } from '../orchestration/paths.mjs';
import { annotateLedger, synthesize } from './engine.mjs';
import { renderRemediationReport, renderSynthesisReport } from './reports.mjs';

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function readJsonl(path) { return existsSync(path) ? parseJsonLines(readFileSync(path, 'utf8'), path) : []; }

export function writeSynthesisArtifacts({ applicationRoot, runDirectory, inputs, ledgerPath }) {
  const target = assertAuditArtifactPath(applicationRoot, runDirectory);
  const result = synthesize(inputs);
  writeJsonAtomic(join(target, 'synthesis.json'), result.synthesis);
  writeJsonAtomic(join(target, 'remediation-plan.json'), result.remediationPlan);
  writeAtomic(join(target, 'synthesis-report.md'), renderSynthesisReport(result.synthesis));
  writeAtomic(join(target, 'remediation-plan.md'), renderRemediationReport(result.remediationPlan));
  const annotated = annotateLedger(result.sourceFindings, result.synthesis, result.remediationPlan);
  const previous = readLedger(ledgerPath);
  const ledger = mergeLedgerAtomic(applicationRoot, ledgerPath, previous, annotated, inputs.generatedAt);
  return { ...result, ledger };
}

export function loadSynthesisInputsFromRun({ runDirectory, projectContextPath, taskModelPath = null, ledgerPath = null, relationshipHints = [], contradictionResolutions = {} }) {
  const directory = resolve(runDirectory);
  const execution = readJson(join(directory, 'execution.json'));
  const auditPlan = readJson(join(directory, 'audit-plan.json'));
  const runManifest = readJson(join(directory, 'run-manifest.json'));
  const captureManifest = readJson(join(directory, 'capture-manifest.json'));
  const findingsPaths = execution.results.filter(item => item.directory && existsSync(join(item.directory, 'findings.jsonl'))).map(item => join(item.directory, 'findings.jsonl'));
  const evidencePaths = execution.results.filter(item => item.directory && existsSync(join(item.directory, 'evidence.jsonl'))).map(item => join(item.directory, 'evidence.jsonl'));
  const contractPath = kind => runManifest.contracts.find(item => item.kind === kind)?.artifact_ref ?? null;
  const resolvedLedger = ledgerPath ? resolve(ledgerPath) : resolve(dirname(directory), 'findings-ledger.jsonl');
  return {
    runId: runManifest.run_id,
    generatedAt: runManifest.finished_at ?? runManifest.started_at,
    projectRevision: runManifest.application.revision,
    auditPlan,
    runManifest,
    projectContext: readJson(resolve(projectContextPath)),
    taskModel: taskModelPath ? readJson(resolve(taskModelPath)) : null,
    contentContract: contractPath('content-contract') && existsSync(contractPath('content-contract')) ? readJson(contractPath('content-contract')) : null,
    flowContract: contractPath('flow-contract') && existsSync(contractPath('flow-contract')) ? readJson(contractPath('flow-contract')) : null,
    captureManifest,
    findings: findingsPaths.flatMap(readJsonl),
    evidence: [...readJsonl(join(directory, 'evidence.jsonl')), ...evidencePaths.flatMap(readJsonl)],
    ledger: readLedger(resolvedLedger),
    relationshipHints,
    contradictionResolutions,
    inputRefs: {
      audit_plan: join(directory, 'audit-plan.json'), run_manifest: join(directory, 'run-manifest.json'), project_context: resolve(projectContextPath),
      task_model: taskModelPath ? resolve(taskModelPath) : null, content_contract: contractPath('content-contract'), flow_contract: contractPath('flow-contract'),
      capture_manifest: join(directory, 'capture-manifest.json'), ledger: resolvedLedger,
      specialist_findings: findingsPaths, specialist_evidence: evidencePaths,
    },
  };
}

export function regenerateSynthesis(options) {
  const inputs = loadSynthesisInputsFromRun(options);
  const applicationRoot = resolve(dirname(resolve(options.projectContextPath)), inputs.projectContext.project.application_root);
  const ledgerPath = options.ledgerPath ? resolve(options.ledgerPath) : join(applicationRoot, 'audits', 'findings-ledger.jsonl');
  const outputDirectory = canonicalRunDirectory(applicationRoot, inputs.generatedAt.slice(0, 10), 'synthesis');
  mkdirSync(outputDirectory, { recursive: false });
  const result = writeSynthesisArtifacts({ applicationRoot, runDirectory: outputDirectory, inputs, ledgerPath });
  return { ...result, outputDirectory };
}
