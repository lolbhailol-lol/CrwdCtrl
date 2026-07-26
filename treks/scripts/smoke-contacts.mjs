/** Temporary smoke test for the emergency contacts endpoint. Delete after use. */
const BASE = process.env.SMOKE_BASE || 'http://localhost:5057'
const SLUG = 'kalu-waterfall'

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body
      ? { 'Content-Type': 'application/json', 'X-Device-Id': 'smoke-device-1' }
      : { 'X-Device-Id': 'smoke-device-1' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = JSON.parse(await res.text())
  } catch {
    json = null
  }
  return { status: res.status, json }
}

const results = []
const check = (name, pass, detail) => results.push({ name, pass, detail })

const before = await call('GET', `/api/treks/${SLUG}`)
check(
  'detail payload carries reportedContacts array',
  Array.isArray(before.json?.data?.reportedContacts),
  `status ${before.status}, contacts ${JSON.stringify(before.json?.data?.reportedContacts)}`,
)

const created = await call('POST', `/api/treks/${SLUG}/contacts`, {
  label: 'Smoke forest office',
  phone: '+91 98765 43210',
  addedBy: 'Smoke Test',
})
check(
  'valid contact returns 201 with normalised phone',
  created.status === 201 && created.json?.data?.contact?.phone === '+919876543210',
  `status ${created.status}, phone ${created.json?.data?.contact?.phone}`,
)

const dupe = await call('POST', `/api/treks/${SLUG}/contacts`, {
  label: 'Same number typed differently',
  phone: '+91-98765-43210',
  addedBy: 'Smoke Test',
})
check(
  'same number in another format is refused with 409',
  dupe.status === 409,
  `status ${dupe.status}, message ${dupe.json?.message}`,
)

const badPhone = await call('POST', `/api/treks/${SLUG}/contacts`, {
  label: 'Too short',
  phone: '12',
})
check('short phone rejected with 400', badPhone.status === 400, `status ${badPhone.status}, message ${badPhone.json?.message}`)

const noLabel = await call('POST', `/api/treks/${SLUG}/contacts`, {
  label: '   ',
  phone: '9876543211',
})
check('blank label rejected with 400', noLabel.status === 400, `status ${noLabel.status}, message ${noLabel.json?.message}`)

const unknownField = await call('POST', `/api/treks/${SLUG}/contacts`, {
  label: 'Odd',
  phone: '9876543212',
  isAdmin: true,
})
check(
  'unknown field rejected with 400',
  unknownField.status === 400,
  `status ${unknownField.status}, message ${unknownField.json?.message}`,
)

const after = await call('GET', `/api/treks/${SLUG}`)
const list = after.json?.data?.reportedContacts || []
check(
  'contact is listed on the trail after adding',
  list.length === 1 && list[0].label === 'Smoke forest office' && list[0].addedBy === 'Smoke Test',
  JSON.stringify(list),
)

const otherTrail = await call('GET', '/api/treks/devkund')
check(
  'contact does not leak to another trail',
  (otherTrail.json?.data?.reportedContacts || []).length === 0,
  JSON.stringify(otherTrail.json?.data?.reportedContacts),
)

for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} — ${r.name}\n      ${r.detail}`)
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`)
process.exit(results.every((r) => r.pass) ? 0 : 1)
