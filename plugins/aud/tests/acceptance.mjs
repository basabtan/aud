#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = 'plugins/aud';
const skill = `${root}/skills/aud`;
for (const path of [
  `${root}/.claude-plugin/plugin.json`,
  `${skill}/SKILL.md`,
  `${skill}/references/selection.md`,
  `${skill}/references/evidence.md`,
  `${skill}/references/synthesis.md`,
  `${skill}/references/verification.md`,
  `${skill}/references/calibration.md`,
  `${skill}/scripts/aud.mjs`,
  `${skill}/scripts/calibrate.mjs`,
]) assert.ok(existsSync(path), `missing ${path}`);

assert.equal(JSON.parse(readFileSync(`${root}/.claude-plugin/plugin.json`, 'utf8')).name, 'aud');
const instructions = readFileSync(`${skill}/SKILL.md`, 'utf8');
for (const phrase of ['diagnose', 'redesign', 'verify', 'specialist', 'Place and flow', 'report-only', 'synthesis.json', 'remediation-plan.json', 'verification-plan.json', 'regression-results.json', 'Phase 6', 'calibration-results.json']) {
  assert.ok(instructions.includes(phrase), `orchestrator rule missing ${phrase}`);
}
const syntax = spawnSync(process.execPath, ['--check', `${skill}/scripts/aud.mjs`], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
const calibrationSyntax = spawnSync(process.execPath, ['--check', `${skill}/scripts/calibrate.mjs`], { encoding: 'utf8' });
assert.equal(calibrationSyntax.status, 0, calibrationSyntax.stderr || calibrationSyntax.stdout);

console.log('PASS — aud is the primary four-mode, report-only orchestration entry point.');
