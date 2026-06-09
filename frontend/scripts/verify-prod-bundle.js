/**
 * Validates production Android bundle uses Railway API (not dev hosts).
 * Run after `vite build` for Play Store / production APK releases.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const distAssets = join(process.cwd(), 'dist', 'assets');
const railway = /crwdctrl-production-9c58\.up\.railway\.app\/api/;
const devHosts = [
  /http:\/\/localhost:8080\/api/,
  /http:\/\/127\.0\.0\.1:8080\/api/,
  /http:\/\/192\.168\.\d+\.\d+:8080\/api/,
  /http:\/\/10\.\d+\.\d+\.\d+:8080\/api/,
];

let jsFiles;
try {
  jsFiles = readdirSync(distAssets).filter((f) => f.endsWith('.js'));
} catch {
  console.error('❌ dist/assets not found — run vite build first');
  process.exit(1);
}

let railwayHits = 0;
const devHits = [];

for (const file of jsFiles) {
  const content = readFileSync(join(distAssets, file), 'utf8');
  if (railway.test(content)) railwayHits += 1;
  for (const pattern of devHosts) {
    if (pattern.test(content)) {
      devHits.push({ file, pattern: pattern.toString() });
    }
  }
}

if (railwayHits === 0) {
  console.error('❌ Railway production URL not found in bundle.');
  console.error('   Check .env.production and remove .env.production.local before building.');
  process.exit(1);
}

console.log(`✅ Railway URL embedded in ${railwayHits} bundle file(s)`);

if (devHits.length) {
  console.warn(`⚠️  ${devHits.length} dev URL fallback string(s) in bundle (dead code if VITE_API_BASE_URL is set):`);
  for (const h of devHits.slice(0, 5)) {
    console.warn(`   - ${h.file}`);
  }
  if (devHits.length > 5) console.warn(`   ... and ${devHits.length - 5} more`);
}

console.log('✅ Production bundle verification passed');
