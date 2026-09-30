#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { acceptBaseline, readSuite, runCalibration, writeCalibrationArtifacts } from './runner.mjs';

function options(argv) { const result = {}; for (let i = 0; i < argv.length; i += 1) { const token = argv[i]; if (!token.startsWith('--')) throw new Error(`INVALID_ARGUMENT: ${token}`); const key = token.slice(2); if (['check', 'accept-baseline', 'approve-policy-changes'].includes(key)) result[key] = true; else { if (!argv[i + 1]) throw new Error(`MISSING_ARGUMENT_VALUE: ${token}`); result[key] = argv[++i]; } } return result; }
try {
  const args = options(process.argv.slice(2)); const suite = readSuite(args.suite ?? 'calibration/corpus/suite.json'); const tier = args.tier ?? 'full'; const caseIds = args.cases ? args.cases.split(',').filter(Boolean) : [];
  const baselinePath = args.baseline ? resolve(args.baseline) : null;
  const baseline = baselinePath && existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null; const generatedAt = args.at ?? suite.created_at;
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  const sourceRevision = args.revision ?? (revision.status === 0 ? revision.stdout.trim() : null);
  if (!sourceRevision) throw new Error('EVALUATOR_REVISION_REQUIRED: pass --revision outside a Git checkout');
  const evaluator = { name: 'aud-calibration', version: '1.0.0', source_revision: sourceRevision };
  const run = runCalibration({ suite, tier, caseIds, baseline, generatedAt, evaluator }); let temporary = null;
  const output = args.out ? resolve(args.out) : (temporary = mkdtempSync(join(tmpdir(), 'aud-calibration-'))); writeCalibrationArtifacts(output, run);
  if (args['accept-baseline']) {
    if (!args.baseline) throw new Error('BASELINE_PATH_REQUIRED');
    acceptBaseline({ path: args.baseline, suite, run, rationale: args.rationale, evaluator, acceptedAt: generatedAt, approvePolicyChanges: args['approve-policy-changes'] === true });
  }
  process.stdout.write(`${JSON.stringify({ verdict: run.gates.verdict, tier: run.summary.tier, cases: run.results.length, output: args.check ? null : output })}\n`);
  if (temporary) rmSync(temporary, { recursive: true, force: true }); if (run.gates.verdict === 'fail') process.exitCode = 1;
} catch (error) { process.stderr.write(`CALIBRATION_ERROR: ${error.message}\n`); process.exitCode = 2; }
