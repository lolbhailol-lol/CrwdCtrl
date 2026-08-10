const KEY = 'campus_hunt_last_session';

/** Remember which team URL this device used (stay logged in / recover after expiry). */
export function rememberHuntSession({ slug, teamCode, playPath, teamLoginPath }) {
  if (typeof window === 'undefined' || !slug || !teamCode) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      slug: String(slug),
      teamCode: String(teamCode).toUpperCase(),
      playPath: playPath || `/campus-hunt/${slug}/play`,
      teamLoginPath: teamLoginPath || `/campus-hunt/${slug}/team/${String(teamCode).toUpperCase()}`,
      savedAt: Date.now(),
    }));
  } catch {
    /* ignore quota */
  }
}

export function readHuntSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.slug || !parsed?.teamCode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearHuntSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** On auth loss inside /campus-hunt/*, send players back to event (not CrwdCtrl /login). */
export function redirectCampusHuntAuthLoss() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  if (!path.startsWith('/campus-hunt')) return false;
  const session = readHuntSession();
  if (session?.teamLoginPath) {
    window.location.assign(session.teamLoginPath);
    return true;
  }
  const parts = path.split('/').filter(Boolean);
  // campus-hunt / :slug / ...
  if (parts[0] === 'campus-hunt' && parts[1]) {
    window.location.assign(`/campus-hunt/${parts[1]}`);
    return true;
  }
  window.location.assign('/');
  return true;
}
