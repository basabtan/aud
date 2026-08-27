import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policies = [
  ['content-audit', 'content'],
  ['place-audit', 'place'],
  ['flow-audit', 'flow'],
  ['visual-audit', 'visual'],
  ['audit', 'functional'],
];

for (const [plugin, runType] of policies) {
  const path = `plugins/${plugin}/skills/${plugin}/SKILL.md`;
  const text = readFileSync(path, 'utf8');
  assert.match(
    text,
    new RegExp(`<application-root>/audits/YYYY-MM-DD-${runType}/`),
    `${plugin} must write runs into the audited application repository`,
  );
  assert.match(text, /audits\/latest\.md/, `${plugin} must update the latest index`);
  assert.match(
    text,
    /Never store product-specific audit results in the\s+repository that distributes this skill\./,
    `${plugin} must keep reusable tools separate from product results`,
  );
}

const allRelevantText = [
  'plugins/audit/skills/audit/SKILL.md',
  'plugins/audit/skills/audit/references/drivers.md',
].map(path => readFileSync(path, 'utf8')).join('\n');

assert.doesNotMatch(allRelevantText, /zeal\/audit\//, 'obsolete zeal/audit path remains');
console.log('PASS — every audit skill stores timestamped runs with the audited application');
