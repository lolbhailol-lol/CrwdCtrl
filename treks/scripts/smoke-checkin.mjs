/** Quick manual check: mark in twice from the same device, expect an update not a second row. */

const base = process.env.TREKS_API || 'http://localhost:5055'
const slug = process.argv[2] || 'naneghat'
const date = process.argv[3] || new Date().toISOString().slice(0, 10)
const device = process.argv[4] || 'smoke-device-001'

async function markIn(groupSize) {
  const res = await fetch(`${base}/api/treks/${slug}/check-ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': device },
    body: JSON.stringify({ date, displayName: 'Smoke Test', groupSize, source: 'friend' }),
  })
  const json = await res.json()
  return {
    http: res.status,
    created: json.created,
    people: json.data?.trek?.status?.peopleCount,
    groups: json.data?.trek?.status?.checkInGroups,
    message: json.message,
  }
}

console.log('first :', await markIn(3))
console.log('second:', await markIn(5))
