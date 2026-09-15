import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const testsDir = join(process.cwd(), 'tests');

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return entry.isFile() && entry.name.endsWith('.test.js') ? [path] : [];
  });
}

let testFiles = [];

try {
  testFiles = findTests(testsDir);
} catch {
  // The explicit failure below gives a stable, actionable message.
}

if (testFiles.length === 0) {
  console.error('No frontend tests found. Add at least one tests/**/*.test.js file.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
