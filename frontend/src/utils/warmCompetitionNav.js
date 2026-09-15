const WARM_KEY = 'crwdctrl_warm_comp_nav';
const WARM_MAX_MS = 20000;

/** Call right before navigate() from similar / explore competition cards. */
export function markWarmCompetitionNav() {
  try {
    sessionStorage.setItem(WARM_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

export function peekWarmCompetitionNav(maxAgeMs = WARM_MAX_MS) {
  try {
    const raw = sessionStorage.getItem(WARM_KEY);
    if (!raw) return false;
    const t = Number(raw);
    return Number.isFinite(t) && Date.now() - t < maxAgeMs;
  } catch {
    return false;
  }
}

export function clearWarmCompetitionNav() {
  try {
    sessionStorage.removeItem(WARM_KEY);
  } catch {
    /* ignore */
  }
}

export function isWarmCompetitionLocationState(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.skipDemoLoad) return true;
  const from = String(state.from || '');
  if (
    from === 'explore-other-fest-comp'
    || from === 'explore-other-fest'
    || from === 'similar-competitions'
    || from === 'also-register-success'
    || from.startsWith('similar')
    || from.startsWith('explore')
    || from.startsWith('also-register')
  ) {
    return true;
  }
  return Boolean(state.competition && state.backTo);
}
