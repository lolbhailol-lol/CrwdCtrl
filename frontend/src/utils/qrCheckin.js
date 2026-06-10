export function parseQrPayload(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return { hash: normalizeHash(parsed) };
    }
    return {
      hash: normalizeHash(parsed.hash || parsed.qrHash),
      registrationId: parsed.registrationId ? String(parsed.registrationId) : null,
      bookingId: parsed.bookingId ? String(parsed.bookingId) : null,
    };
  } catch {
    return { hash: normalizeHash(trimmed) };
  }
}

export function normalizeHash(hash) {
  const value = String(hash || '').trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(value) ? value : null;
}

export function extractCheckinHash(raw) {
  return parseQrPayload(raw)?.hash || null;
}
