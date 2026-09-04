import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const version = '0.2.0';
const packageRecord = json('package.json');
const lock = json('package-lock.json');
const audManifest = json('plugins/aud/.claude-plugin/plugin.json');

assert.equal(packageRecord.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.deepEqual(packageRecord.engines, { node: '>=22 <25' });
assert.deepEqual(lock.packages[''].engines, packageRecord.engines);
assert.equal(audManifest.version, version);

const changelog = readFileSync('CHANGELOG.md', 'utf8');
const notes = readFileSync('docs/releases/v0.2.0.md', 'utf8');
const compatibility = readFileSync('docs/compatibility.md', 'utf8');
const migration = readFileSync('docs/phase-2-migration.md', 'utf8');
for (const document of [changelog, notes, compatibility, migration]) assert.match(document, /0\.2\.0/);
for (const limitation of ['Security/privacy', 'language-specific', 'synthetic']) assert.match(`${changelog}\n${notes}`, new RegExp(limitation, 'i'));
assert.match(compatibility, /ubuntu-latest/);
assert.match(compatibility, /windows-latest/);
assert.match(compatibility, /five.*six|five legacy or six current/is);
assert.match(migration, /temporary compatibility alias/i);

console.log('PASS — framework version, lockfile, release notes, compatibility, and migration metadata are aligned at 0.2.0.');
