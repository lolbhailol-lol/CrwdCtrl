#!/usr/bin/env node
/**
 * Verify a bcrypt admin hash matches a password (local troubleshooting).
 * Usage: node scripts/verify-admin-hash.js "<password>" "<ADMIN_PASSWORD_HASH>"
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];
const hash = process.argv[3]?.trim();

if (!password || !hash) {
  console.error('Usage: node scripts/verify-admin-hash.js "<password>" "<ADMIN_PASSWORD_HASH>"');
  process.exit(1);
}

console.log('Hash length:', hash.length, hash.length === 60 ? '(ok)' : '(expected 60 — likely corrupted on Railway)');
console.log('Hash prefix:', hash.slice(0, 7));
console.log('Matches password:', bcrypt.compareSync(password, hash));
