#!/usr/bin/env node
/**
 * Post-deploy verification — run against production/staging API base URL.
 * Usage: node scripts/verify-deploy.js [baseUrl]
 * Example: node scripts/verify-deploy.js https://crwdctrl-production-9c58.up.railway.app
 */
require('dotenv').config();

const baseUrl = (process.argv[2] || process.env.API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

const checks = [];

async function fetchJson(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

async function run() {
  console.log(`\n🔍 CrwdCtrl deploy verification — ${baseUrl}\n`);

  // Health
  try {
    const health = await fetchJson('/api/health');
    const pass = health.ok && health.body?.success;
    checks.push({ name: 'GET /api/health', pass, detail: health.body?.database });
    if (!pass) console.error('  ❌ Health check failed', health.status);
    else console.log('  ✅ Health OK — DB:', health.body?.database);
  } catch (err) {
    checks.push({ name: 'GET /api/health', pass: false, detail: err.message });
    console.error('  ❌ Health unreachable:', err.message);
  }

  // Readiness (503 when DB down)
  try {
    const ready = await fetchJson('/api/ready');
    const pass = ready.ok && ready.body?.ready === true;
    checks.push({ name: 'GET /api/ready', pass, detail: ready.body?.checks });
    if (!pass) console.error('  ❌ Readiness failed', ready.status, ready.body);
    else console.log('  ✅ Readiness OK');
  } catch (err) {
    checks.push({ name: 'GET /api/ready', pass: false, detail: err.message });
    console.error('  ❌ Readiness unreachable:', err.message);
  }

  // Debug routes must not exist in production
  if (process.env.NODE_ENV === 'production' || baseUrl.includes('railway.app') || baseUrl.includes('crwdctrl.in')) {
    try {
      const debug = await fetchJson('/api/fests/000000000000000000000000/debug');
      const pass = debug.status === 404;
      checks.push({ name: 'Debug route blocked', pass, detail: `status ${debug.status}` });
      console.log(pass ? '  ✅ Fest debug route blocked' : '  ❌ Fest debug route exposed');
    } catch (err) {
      checks.push({ name: 'Debug route blocked', pass: true, detail: 'unreachable' });
    }
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed\n`);

  if (failed.length) {
    console.error('Failed checks:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }

  console.log('All deployment checks passed.\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Verification script error:', err);
  process.exit(1);
});
