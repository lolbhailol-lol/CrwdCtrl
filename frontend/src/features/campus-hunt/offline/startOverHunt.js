/**
 * Start over: clear local progress, reset live ranking + Zip Grid,
 * pull latest pack (if install token known), refresh Hunt app shell when online.
 * Also: when admin Start over stamped the team, phone applies that reset on Wi‑Fi.
 */

import {
  loadOfflineBundle,
  loadOfflineTeamState,
  resetOfflineHuntLocal,
  saveOfflineBundle,
  saveOfflineTeamState,
} from './offlineDb';
import { createInitialTeamState } from './offlineEngine';
import { refreshHuntAppShell, applyWaitingHuntUpdate } from './refreshHuntAppShell';
import { warmupOfflineHunt } from './warmupOfflineHunt';
import { fetchOfflineInstallPack, ackOfflineInstallPack } from '../services/campusHunt.api';
import {
  clearOfflineProgressQueue,
  enqueueOfflineProgress,
  ensureOfflineGridKey,
  pauseOfflineBoardSync,
  resumeOfflineBoardSync,
  pullOfflineBoardState,
} from './offlineBoardSync';

const INSTALL_TOKEN_KEY = 'ch_offline_install_token';

function appliedResetKey(teamCode) {
  return `ch_offline_applied_reset_${String(teamCode || '').toUpperCase()}`;
}

export function readAppliedResetAt(teamCode) {
  try {
    return String(localStorage.getItem(appliedResetKey(teamCode)) || '');
  } catch {
    return '';
  }
}

export function writeAppliedResetAt(teamCode, iso) {
  try {
    if (iso) localStorage.setItem(appliedResetKey(teamCode), String(iso));
  } catch { /* ignore */ }
}

export function rememberInstallToken(token) {
  const t = String(token || '').trim();
  if (!t || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(INSTALL_TOKEN_KEY, t);
  } catch { /* ignore */ }
}

export function readRememberedInstallToken(bundle) {
  const fromBundle = String(bundle?.installToken || '').trim();
  if (fromBundle) return fromBundle;
  try {
    return String(localStorage.getItem(INSTALL_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
}

async function refreshPackIfPossible(pack, token) {
  if (!token) return { pack, packUpdated: false };
  try {
    const res = await fetchOfflineInstallPack(token);
    const fresh = res.data?.bundle || res.bundle;
    if (fresh?.team?.teamCode) {
      const next = { ...fresh, installToken: token };
      await saveOfflineBundle(next);
      rememberInstallToken(token);
      try {
        await ackOfflineInstallPack(token, navigator.userAgent || '');
      } catch { /* best-effort */ }
      return { pack: next, packUpdated: true };
    }
  } catch { /* keep existing */ }
  return { pack, packUpdated: false };
}

/**
 * Soft-update from live board when online (Start over stamp only).
 * Offline Start uses the shared start code — not schedule / RELEASED.
 */
export async function applyServerStartOverIfNeeded(bundle) {
  const pack = bundle || await loadOfflineBundle().catch(() => null);
  if (!pack?.event?.id || !pack?.team?.teamCode) {
    return { applied: false, bundle: pack };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { applied: false, bundle: pack };
  }

  const remote = await pullOfflineBoardState(pack);
  if (!remote?.offlineResetAt) {
    return { applied: false, bundle: pack };
  }

  const remoteAt = new Date(remote.offlineResetAt).getTime();
  if (!Number.isFinite(remoteAt)) {
    return { applied: false, bundle: pack };
  }

  const localAt = new Date(readAppliedResetAt(pack.team.teamCode) || 0).getTime();
  if (remoteAt <= localAt) {
    return { applied: false, bundle: pack };
  }

  pauseOfflineBoardSync();
  try {
    const code = pack.team.teamCode;
    await resetOfflineHuntLocal(code, { clearSession: false });
    clearOfflineProgressQueue(code);

    const token = readRememberedInstallToken(pack);
    const refreshed = await refreshPackIfPossible(pack, token);
    const nextPack = refreshed.pack;

    const freshState = createInitialTeamState(nextPack);
    freshState.seq = Math.max(Number(remote.seq) || 0, 1);
    freshState.score = Number(remote.startingScore || remote.score || freshState.score)
      || freshState.score;
    freshState.currentStage = 'WAITING';
    await saveOfflineTeamState(code, freshState);
    writeAppliedResetAt(code, remote.offlineResetAt);

    await warmupOfflineHunt().catch(() => {});

    return {
      applied: true,
      packUpdated: refreshed.packUpdated,
      bundle: nextPack,
      message: refreshed.packUpdated
        ? 'Admin Start over applied — pack + progress reset.'
        : 'Admin Start over applied — progress reset.',
    };
  } finally {
    resumeOfflineBoardSync();
  }
}

/**
 * @returns {{ ok: boolean, packUpdated: boolean, boardReset: boolean, gridReset: boolean, updateWaiting: boolean, message: string, bundle?: object }}
 */
export async function startOverHunt({
  teamCode,
  installToken,
  reloadAppIfWaiting = false,
  clearSession = false,
} = {}) {
  let pack = await loadOfflineBundle();
  const code = String(teamCode || pack?.team?.teamCode || '').trim();
  if (!code) {
    return {
      ok: false,
      packUpdated: false,
      boardReset: false,
      gridReset: false,
      updateWaiting: false,
      message: 'No team pack on this phone.',
    };
  }

  pauseOfflineBoardSync();
  try {
    const prevState = await loadOfflineTeamState(code).catch(() => null);
    const prevSeq = Math.max(0, Number(prevState?.seq) || 0);

    await resetOfflineHuntLocal(code, { clearSession });
    clearOfflineProgressQueue(code);

    const token = String(installToken || readRememberedInstallToken(pack) || '').trim();
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;

    let packUpdated = false;
    let updateWaiting = false;

    if (online && token) {
      const refreshed = await refreshPackIfPossible(pack, token);
      pack = refreshed.pack;
      packUpdated = refreshed.packUpdated;
    }

    const freshState = createInitialTeamState(pack || { team: { teamCode: code } });
    freshState.seq = Math.max(prevSeq + 1, 1);
    freshState.currentStage = 'WAITING';
    freshState.huntStartedAt = null;
    await saveOfflineTeamState(code, freshState);

    let boardReset = false;
    let gridReset = false;

    if (online && pack?.event?.id) {
      const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
      updateWaiting = Boolean(shell?.waiting);

      try {
        let result = await enqueueOfflineProgress(pack, freshState, { startOver: true });
        if (!result?.syncedOk) {
          result = await enqueueOfflineProgress(pack, freshState, { startOver: true });
        }
        boardReset = Boolean(result?.syncedOk);
        if (boardReset) {
          if (Number(result?.seq) > 0) {
            freshState.seq = Number(result.seq);
            await saveOfflineTeamState(code, freshState);
          }
          writeAppliedResetAt(
            code,
            result?.offlineResetAt || new Date().toISOString(),
          );
        } else {
          // Still stamp locally so admin pull does not instantly re-apply an old lock.
          writeAppliedResetAt(code, new Date().toISOString());
        }
      } catch { /* best-effort */ }

      try {
        const grid = await ensureOfflineGridKey(pack, { forceReset: true });
        if (grid?.gridAccessCode) {
          gridReset = true;
          const nextPack = {
            ...pack,
            clues: {
              ...pack.clues,
              clue4: {
                ...(pack.clues?.clue4 || {}),
                gridAccessCode: grid.gridAccessCode,
                gridGameUrl: grid.gridGameUrl || '/campus-hunt/grid',
              },
            },
            team: {
              ...pack.team,
              gridAccessCode: grid.gridAccessCode,
            },
            installToken: token || pack.installToken,
          };
          await saveOfflineBundle(nextPack);
          pack = nextPack;
        }
      } catch { /* best-effort */ }

      await warmupOfflineHunt().catch(() => {});
    } else {
      writeAppliedResetAt(code, new Date().toISOString());
    }

    if (reloadAppIfWaiting && updateWaiting) {
      await applyWaitingHuntUpdate();
    }

    const bits = ['Progress cleared — back to start screen.'];
    if (boardReset) bits.push('Live ranking reset.');
    else if (online) bits.push('Live ranking may still show old score until Wi‑Fi sync works.');
    else bits.push('Offline — live ranking updates when you get Wi‑Fi.');
    if (gridReset) bits.push('Zip Grid reset.');
    if (packUpdated) bits.push('Latest pack downloaded.');

    return {
      ok: true,
      packUpdated,
      boardReset,
      gridReset,
      updateWaiting,
      message: bits.join(' '),
      bundle: pack,
      state: freshState,
    };
  } finally {
    resumeOfflineBoardSync();
  }
}
