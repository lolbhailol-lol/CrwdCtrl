const SESSION_KEY = 'fest_scanner_session';

export function getFestScannerSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.token) return null;
    if (data.eventType === 'trek') {
      if (!data.trekId) return null;
    } else if (data.eventType === 'sport') {
      if (!data.sportEventId) return null;
    } else if (!data.festId) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function isTrekScannerSession(session) {
  return session?.eventType === 'trek' || !!session?.trekId;
}

export function isSportScannerSession(session) {
  return session?.eventType === 'sport' || !!session?.sportEventId;
}

export function setFestScannerSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearFestScannerSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getFestScannerToken() {
  return getFestScannerSession()?.token || null;
}
