import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const thisFile = resolve(fileURLToPath(import.meta.url));

function status() {
  const result = spawnSync('git', ['status', '--short', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || 'Unable to read git status');
  return result.stdout.replaceAll('\\', '/');
}

function testsUnder(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.mjs'))
    .map(entry => resolve(entry.parentPath ?? entry.path, entry.name))
    .filter(path => path !== thisFile);
}

const before = status();
const tests = [
  ...testsUnder(join(root, 'tests')),
  ...readdirSync(join(root, 'plugins'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const directory = join(root, 'plugins', entry.name, 'tests');
      try {
        return testsUnder(directory);
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    }),
].sort();

assert.ok(tests.length > 0, 'No repository tests discovered');

for (const test of tests) {
  const label = relative(root, test).replaceAll('\\', '/');
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [test], { cwd: root, stdio: 'inherit' });
  assert.equal(result.status, 0, `${label} exited with status ${result.status}`);
}

const after = status();
assert.equal(after, before, `Tests changed the worktree:\n${after}`);
console.log(`\nPASS — ${tests.length} test files passed and git status was unchanged.`);
