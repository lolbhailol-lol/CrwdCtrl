const KEY = 'treks_device_id'

let memoryId = ''

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Anonymous, per-browser id. Only used so re-submitting a mark-in updates it
 * instead of doubling the count — never sent anywhere else and not a login.
 */
export function getDeviceId() {
  if (memoryId) return memoryId
  try {
    const stored = window.localStorage.getItem(KEY)
    if (stored) {
      memoryId = stored
      return memoryId
    }
    memoryId = randomId()
    window.localStorage.setItem(KEY, memoryId)
  } catch {
    // Private mode / storage disabled: keep it for this tab only
    memoryId = memoryId || randomId()
  }
  return memoryId
}
