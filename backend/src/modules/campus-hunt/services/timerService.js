/**
 * Server-authoritative timers.
 */

function nowDate(now = new Date()) {
  return now instanceof Date ? now : new Date(now);
}

function buildChallengeWindow(timerSeconds, now = new Date()) {
  const seconds = Number(timerSeconds) || 0;
  const startedAt = nowDate(now);
  if (seconds <= 0) {
    return { startedAt, expiresAt: null };
  }
  const expiresAt = new Date(startedAt.getTime() + seconds * 1000);
  return { startedAt, expiresAt };
}

function isExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  return nowDate(now).getTime() >= new Date(expiresAt).getTime();
}

function isRoundClosed(round, now = new Date()) {
  if (!round) return true;
  if (round.status === 'locked' || round.status === 'finalized') return true;
  if (round.endsAt && nowDate(now).getTime() >= new Date(round.endsAt).getTime()) return true;
  return false;
}

function remainingMs(expiresAt, now = new Date()) {
  if (!expiresAt) return null;
  return Math.max(0, new Date(expiresAt).getTime() - nowDate(now).getTime());
}

function completionMs(roundStartsAt, finishedAt) {
  if (!roundStartsAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(roundStartsAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

module.exports = {
  nowDate,
  buildChallengeWindow,
  isExpired,
  isRoundClosed,
  remainingMs,
  completionMs,
};
