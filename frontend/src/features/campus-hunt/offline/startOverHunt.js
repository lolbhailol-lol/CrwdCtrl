/**
 * Start over: clear local progress, reset live ranking + Zip Grid,
 * pull latest pack (if install token known), refresh Hunt app shell when online.
 */

import {
  loadOfflineBundle,
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

  // Fresh local state (WAITING + starting score)
  const freshState = createInitialTeamState(pack || { team: { teamCode: code } });
  await saveOfflineTeamState(code, freshState);

  let boardReset = false;
  let gridReset = false;

  if (online && pack?.event?.id) {
    const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
    updateWaiting = Boolean(shell?.waiting);

    // 3) Reset live ranking on server
    try {
      const result = await enqueueOfflineProgress(pack, freshState, { startOver: true });
      boardReset = Boolean(result?.syncedOk || result?.queued);
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
  else if (online) bits.push('Live ranking will sync when online.');
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
}
