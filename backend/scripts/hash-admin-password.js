#!/usr/bin/env node
/**
 * Generate bcrypt hash for ADMIN_PASSWORD_HASH env var.
 * Usage: node scripts/hash-admin-password.js "your-password"
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');

const password = process.argv[2] || process.env.ADMIN_PASSWORD;

if (!password) {
  console.error('Usage: node scripts/hash-admin-password.js <password>');
  console.error('   or: ADMIN_PASSWORD=secret node scripts/hash-admin-password.js');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nAdd to your .env / Railway:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log('\nRemove ADMIN_PASSWORD from production after setting the hash.\n');
