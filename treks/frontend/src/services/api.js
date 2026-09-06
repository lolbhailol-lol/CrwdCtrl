import { getDeviceId } from '../utils/deviceId'

function normalizeApiBase(raw) {
  return String(raw || 'http://localhost:5055')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\/$/, '')
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_TREKS_API_URL)

export function getApiBase() {
  return API_BASE
}

async function parseJson(res, path) {
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const err = new Error(body?.message || `API ${res.status}: ${path}`)
    err.status = res.status
    err.body = body
    throw err
  }

  if (body == null || typeof body !== 'object') {
    throw new Error(`API returned empty response: ${path}`)
  }

  return body
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  return parseJson(res, path)
}

export async function apiPost(path, data) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Device-Id': getDeviceId(),
    },
    body: JSON.stringify(data ?? {}),
  })
  return parseJson(res, path)
}

export async function apiPatch(path, data, { token } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data ?? {}),
  })
  return parseJson(res, path)
}
