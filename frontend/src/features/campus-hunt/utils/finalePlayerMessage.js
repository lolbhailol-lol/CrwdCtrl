/** Player-facing copy for Finale API failures — never dump stack traces. */
export function finalePlayerMessage(err) {
  if (!err) return '';
  const code = err.code || err.data?.code;
  const status = Number(err.status || err.data?.status || 0);
  const raw = String(err.message || err.data?.message || '');

  if (status === 429 || code === 'RATE_LIMIT' || /too many/i.test(raw)) {
    return 'Too many taps — wait a second and try again.';
  }
  if (code === 'LEADER_ONLY' || code === 'LEADER_REQUIRED') {
    return 'Only the Team Leader can do this.';
  }
  if (code === 'NOT_RELEASED') {
    return 'Not released yet — wait at your meet point, or ask an organizer to Release your team.';
  }
  if (code === 'MISSION_COMPLETED') {
    return 'This mission is already cleared.';
  }
  if (code === 'MISSION_ACTIVE') {
    return 'Finish or abandon your current mission first.';
  }
  if (code === 'FINALE_NOT_LIVE') {
    return 'Finals are not live yet — wait for the organizer to Start Finals.';
  }
  if (code === 'ENTRY_STOPPED') {
    return 'Your team is stopped or locked. Ask an organizer to resume you.';
  }
  if (code === 'ROUND_LOCKED') {
    return raw || 'This round is locked.';
  }
  if (code === 'NOT_FINALE_PARTICIPANT') {
    return 'Finals are not open for your team yet.';
  }
  if (code === 'MISSION_COMING_SOON') {
    return 'That mission is not open yet.';
  }
  if (code === 'WRONG_MISSION' || code === 'NO_ACTIVE_RUN') {
    return 'Open the live mission on this screen and try again.';
  }
  if (code === 'VERSION_CONFLICT' || status >= 500) {
    return 'Server hiccup — keep this screen open and try once more.';
  }
  if (!status && /fetch|network|offline|failed to fetch|load finale/i.test(raw)) {
    return 'Connection dropped — check Wi‑Fi and try again.';
  }
  if (code === 'AUTH_401' || status === 401) {
    return 'Session expired — open your team link again.';
  }
  return raw || 'That didn’t go through. Try again.';
}

export function isTransientFinaleError(err) {
  if (!err) return false;
  const code = err.code || err.data?.code;
  const status = Number(err.status || err.data?.status || 0);
  if (status === 429 || status >= 500 || code === 'VERSION_CONFLICT') return true;
  if (!status) return true;
  return false;
}
