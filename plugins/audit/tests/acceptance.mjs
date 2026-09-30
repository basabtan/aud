#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('plugins/audit/.claude-plugin/plugin.json', 'utf8'));
const alias = readFileSync('plugins/audit/skills/audit/SKILL.md', 'utf8');

assert.equal(manifest.name, 'audit');
assert.match(alias, /compatibility alias/i);
assert.match(alias, /functional-audit/);
assert.match(alias, /Pipeline mode is report-only/);
assert.match(alias, /findings\.jsonl/);

console.log('PASS — legacy audit command remains a narrow compatibility alias for functional-audit.');
