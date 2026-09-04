#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runAud } from '../../../../../shared/orchestration/orchestrator.mjs';

function args(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] === undefined) throw new Error(`Invalid argument ${argv[index] ?? ''}`);
    values[argv[index].slice(2)] = argv[index + 1];
  }
  if (!values.request || !values['project-context']) throw new Error('Usage requires --request and --project-context');
  return values;
}

try {
  const options = args(process.argv.slice(2));
  const requestPath = resolve(options.request);
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  const result = runAud({
    request,
    projectContextPath: resolve(options['project-context']),
    taskModelPath: options['task-model'] ? resolve(options['task-model']) : null,
    contentContractPath: options['content-contract'] ? resolve(options['content-contract']) : null,
    previousCapturePath: options['capture-manifest'] ? resolve(options['capture-manifest']) : null,
    ledgerPath: options.ledger ? resolve(options.ledger) : null,
    requestBase: dirname(requestPath),
  });
  process.stdout.write(`${JSON.stringify({ run_id: result.manifest.run_id, run_directory: result.runDirectory, plan: result.plan.plan_id, degraded: result.manifest.degraded })}\n`);
} catch (error) {
  process.stderr.write(`AUD_ORCHESTRATION_ERROR: ${error.message}\n`);
  process.exitCode = 1;
}
