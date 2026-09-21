/**
 * Start over: clear local progress, reset live ranking + Zip Grid,
 * pull latest pack (if install token known), refresh Hunt app shell when online.
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
} from './offlineBoardSync';

const INSTALL_TOKEN_KEY = 'ch_offline_install_token';

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

/**
 * @returns {{ ok: boolean, packUpdated: boolean, boardReset: boolean, gridReset: boolean, updateWaiting: boolean, message: string, bundle?: object }}
 */
export async function startOverHunt({
  teamCode,
  installToken,
  reloadAppIfWaiting = false,
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
    // Capture old seq before wipe so the reset sync beats any stale SCORE_LOCKED push.
    const prevState = await loadOfflineTeamState(code).catch(() => null);
    const prevSeq = Math.max(0, Number(prevState?.seq) || 0);

    // 1) Wipe local hunt progress + session
    await resetOfflineHuntLocal(code);
    clearOfflineProgressQueue(code);

    const token = String(installToken || readRememberedInstallToken(pack) || '').trim();
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;

    let packUpdated = false;
    let updateWaiting = false;

    // 2) Pull latest pack while online
    if (online && token) {
      try {
        const res = await fetchOfflineInstallPack(token);
        const fresh = res.data?.bundle || res.bundle;
        if (fresh?.team?.teamCode) {
          pack = {
            ...fresh,
            installToken: token,
          };
          await saveOfflineBundle(pack);
          rememberInstallToken(token);
          packUpdated = true;
          try {
            await ackOfflineInstallPack(token, navigator.userAgent || '');
          } catch { /* best-effort */ }
        }
      } catch { /* keep existing pack */ }
    }

    // Fresh local state (WAITING + starting score). Seq must outrank the old locked sync.
    const freshState = createInitialTeamState(pack || { team: { teamCode: code } });
    freshState.seq = prevSeq + 1;
    await saveOfflineTeamState(code, freshState);

    let boardReset = false;
    let gridReset = false;

    if (online && pack?.event?.id) {
      const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
      updateWaiting = Boolean(shell?.waiting);

      // 3) Reset live ranking on server (retry once — must actually sync)
      try {
        let result = await enqueueOfflineProgress(pack, freshState, { startOver: true });
        if (!result?.syncedOk) {
          result = await enqueueOfflineProgress(pack, freshState, { startOver: true });
        }
        boardReset = Boolean(result?.syncedOk);
        if (boardReset && Number(result?.seq) > 0) {
          freshState.seq = Number(result.seq);
          await saveOfflineTeamState(code, freshState);
        }
      } catch { /* best-effort */ }

      // 4) Reset Zip Grid (same device key, new puzzles)
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
    }

    if (reloadAppIfWaiting && updateWaiting) {
      await applyWaitingHuntUpdate();
    }

    const bits = ['Progress cleared.'];
    if (boardReset) bits.push('Live ranking reset.');
    else if (online) bits.push('Live ranking sync failed — stay on Wi‑Fi and Start over again.');
    else bits.push('Go online briefly so live ranking can reset.');
    if (gridReset) bits.push('Zip Grid reset — same device key.');
    if (packUpdated) bits.push('Latest pack downloaded.');
    else if (!online) bits.push('Offline — pack on phone kept.');
    if (updateWaiting && !reloadAppIfWaiting) bits.push('App update ready — reload when asked.');

    return {
      ok: true,
      packUpdated,
      boardReset,
      gridReset,
      updateWaiting,
      message: bits.join(' '),
      bundle: pack,
    };
  } finally {
    resumeOfflineBoardSync();
  }
}
