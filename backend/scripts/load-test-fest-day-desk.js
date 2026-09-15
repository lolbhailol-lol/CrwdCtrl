const base = String(process.env.DESK_API_URL || '').replace(/\/$/, '');
const token = String(process.env.DESK_ORGANIZER_TOKEN || '');
const requests = Math.max(1, Number(process.env.DESK_LOAD_REQUESTS) || 300);
const concurrency = Math.max(1, Number(process.env.DESK_LOAD_CONCURRENCY) || 30);

if (!base || !token) {
  console.error('Set DESK_API_URL to the fest-day-desk endpoint and DESK_ORGANIZER_TOKEN.');
  process.exit(1);
}

async function one() {
  const started = Date.now();
  const response = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
  await response.arrayBuffer();
  return { status: response.status, ms: Date.now() - started };
}

(async () => {
  const results = [];
  for (let offset = 0; offset < requests; offset += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, requests - offset) }, one);
    results.push(...await Promise.all(batch));
  }
  const failures = results.filter((result) => result.status !== 200);
  const rateLimited = results.filter((result) => result.status === 429);
  const times = results.map((result) => result.ms).sort((a, b) => a - b);
  console.log(JSON.stringify({
    requests,
    concurrency,
    failures: failures.length,
    rateLimited: rateLimited.length,
    p95Ms: times[Math.floor(times.length * 0.95)] || 0,
    maxMs: times.at(-1) || 0,
  }, null, 2));
  if (failures.length) process.exit(1);
})();
