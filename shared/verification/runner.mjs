import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { mergeLedgerAtomic, readLedger, writeAtomic, writeJsonAtomic, writeJsonlAtomic } from '../orchestration/persistence.mjs';
import { assertAuditArtifactPath } from '../orchestration/paths.mjs';
import { applyVerificationToFindings, buildVerificationPlan, executeVerification, summarizeVerification } from './engine.mjs';
import { renderRegressionReport, renderVerificationReport } from './reports.mjs';

export function writeVerificationArtifacts({ applicationRoot, runDirectory, ledgerPath, inputs }) {
  const target = assertAuditArtifactPath(applicationRoot, runDirectory);
  if (existsSync(join(target, 'verification-plan.json'))) throw new Error(`IMMUTABLE_VERIFICATION_ARTIFACTS: ${target} already contains a verification run`);
  const plan = inputs.plan ?? buildVerificationPlan(inputs);
  const executed = executeVerification({ plan, findings: inputs.findings, adapterResults: inputs.adapterResults, candidateEvidence: inputs.candidateEvidence, generatedAt: inputs.generatedAt, environment: inputs.candidateEnvironment, synthesis: inputs.synthesis });
  const summary = summarizeVerification(plan, executed.verificationResults, executed.regressionResults, inputs.findings);
  writeJsonAtomic(join(target, 'verification-plan.json'), plan);
  writeJsonAtomic(join(target, 'verification-results.json'), executed.verificationResults);
  writeJsonAtomic(join(target, 'regression-results.json'), executed.regressionResults);
  writeJsonAtomic(join(target, 'verification-summary.json'), summary);
  writeJsonlAtomic(join(target, 'verification-evidence.jsonl'), executed.evidence);
  writeAtomic(join(target, 'verification-report.md'), renderVerificationReport(summary, executed.verificationResults));
  writeAtomic(join(target, 'regression-report.md'), renderRegressionReport(summary, executed.regressionResults));
  const annotated = applyVerificationToFindings(inputs.findings, executed.verificationResults);
  const previous = readLedger(ledgerPath);
  const ledger = mergeLedgerAtomic(applicationRoot, ledgerPath, previous, [...annotated, ...executed.newFindings], inputs.generatedAt);
  return { plan, ...executed, summary, ledger };
}
