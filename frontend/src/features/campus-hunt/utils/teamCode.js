/**
 * Normalize team codes so CC01 / CC1 / 1 all resolve to CC001.
 */
export function normalizeTeamCode(raw) {
  let s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  s = s.replace(/[^A-Z0-9]/g, '');
  if (!s) return '';

  if (['LOGIN', 'PLAY', 'TEAM', 'ADMIN', 'LEADERBOARD'].includes(s)) {
    return '';
  }

  if (/^\d+$/.test(s)) {
    return `CC${s.padStart(3, '0')}`;
  }

  const match = s.match(/^CC(\d+)$/);
  if (match) {
    return `CC${match[1].padStart(3, '0')}`;
  }

  return s;
}
