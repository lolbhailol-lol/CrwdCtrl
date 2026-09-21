/**
 * Start over: clear local progress, pull latest pack (if install token known),
 * refresh Hunt app shell when online.
 */

import {
  loadOfflineBundle,
  resetOfflineHuntLocal,
  saveOfflineBundle,
} from './offlineDb';
import { refreshHuntAppShell, applyWaitingHuntUpdate } from './refreshHuntAppShell';
import { warmupOfflineHunt } from './warmupOfflineHunt';
import { fetchOfflineInstallPack, ackOfflineInstallPack } from '../services/campusHunt.api';

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
 * @returns {{ ok: boolean, packUpdated: boolean, updateWaiting: boolean, message: string, bundle?: object }}
 */
export async function startOverHunt({
  teamCode,
  installToken,
  reloadAppIfWaiting = false,
} = {}) {
  const pack = await loadOfflineBundle();
  const code = String(teamCode || pack?.team?.teamCode || '').trim();
  if (code) await resetOfflineHuntLocal(code);

  let nextBundle = pack;
  let packUpdated = false;
  const token = String(installToken || readRememberedInstallToken(pack) || '').trim();
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;

  let updateWaiting = false;
  if (online) {
    const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
    updateWaiting = Boolean(shell?.waiting);

    if (token) {
      try {
        const res = await fetchOfflineInstallPack(token);
        const fresh = res.data?.bundle || res.bundle;
        if (fresh?.team?.teamCode) {
          const stamped = {
            ...fresh,
            installToken: token,
          };
          await saveOfflineBundle(stamped);
          rememberInstallToken(token);
          nextBundle = stamped;
          packUpdated = true;
          try {
            await ackOfflineInstallPack(token, navigator.userAgent || '');
          } catch { /* best-effort */ }
        }
      } catch { /* keep existing pack */ }
    }

    await warmupOfflineHunt().catch(() => {});
  }

  if (reloadAppIfWaiting && updateWaiting) {
    await applyWaitingHuntUpdate();
  }

  const bits = ['Progress cleared.'];
  if (packUpdated) bits.push('Latest pack downloaded.');
  else if (online && token) bits.push('Pack already current.');
  else if (!online) bits.push('Offline — pack on phone kept.');
  if (updateWaiting && !reloadAppIfWaiting) bits.push('App update ready — reload when asked.');

  return {
    ok: true,
    packUpdated,
    updateWaiting,
    message: bits.join(' '),
    bundle: nextBundle,
  };
}
