import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const marketplace = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
assert.equal(marketplace.name, 'auditing-skills');

for (const entry of marketplace.plugins) {
  const pluginRoot = entry.source.replace(/^\.\//, '');
  const manifest = JSON.parse(readFileSync(`${pluginRoot}/.claude-plugin/plugin.json`, 'utf8'));
  assert.equal(manifest.name, entry.name, `${entry.name}: manifest and marketplace names differ`);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, `${entry.name}: invalid version`);
  const skill = readFileSync(`${pluginRoot}/skills/${entry.name}/SKILL.md`, 'utf8');
  const placeholder = new RegExp(['REPLACE', 'THIS', 'FILE'].join(' '));
  assert.doesNotMatch(skill, placeholder, `${entry.name}: placeholder remains`);
}

const allPortable = [
  'plugins/audit/skills/audit/SKILL.md',
  'plugins/audit/skills/audit/references/drivers.md',
  'plugins/audit/skills/audit/references/playwright.md',
].map(path => readFileSync(path, 'utf8')).join('\n');
assert.doesNotMatch(
  allPortable,
  /\bzeal\b|atlas|ZEAL_TABLES|pg-scratch|netlify/i,
  'portable functional core contains target-specific guidance',
);

const latest = readFileSync('shared/templates/latest.md', 'utf8');
for (const label of ['Content', 'Place', 'Flow', 'Visual', 'Functional', 'Open findings']) {
  assert.match(latest, new RegExp(label), `latest.md template missing ${label}`);
}

console.log(`PASS — ${marketplace.plugins.length} plugin manifests and Phase 0 policies validated.`);
