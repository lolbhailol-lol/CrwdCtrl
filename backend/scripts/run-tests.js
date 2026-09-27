'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function collectTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTests(fullPath);
      return entry.isFile() && entry.name.endsWith('.test.js') ? [fullPath] : [];
    });
}

const files = collectTests(path.resolve(__dirname, '..', 'tests')).sort();
if (!files.length) {
  console.error('No backend test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
