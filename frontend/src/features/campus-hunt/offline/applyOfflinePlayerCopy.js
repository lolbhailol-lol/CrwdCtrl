/**
 * Refresh player-facing copy on an already-installed pack.
 * Answers / routes / QR payloads stay from the pack; HOW_TO + scan wording come from the app.
 */

import { sanitizePlayerCopy } from '../player/sanitizePlayerCopy';
import {
  OFFLINE_CLUE_HOW_TO,
  OFFLINE_PLAYER_COPY_REVISION,
} from './offlineHowTo';

function patchChallenge(clue, n) {
  if (!clue || typeof clue !== 'object') return clue;
  const howTo = OFFLINE_CLUE_HOW_TO[n] || clue.howTo || null;
  const destinationInstruction = sanitizePlayerCopy(clue.destinationInstruction || '');
  const hintText = sanitizePlayerCopy(clue.hintText || '');
  return {
    ...clue,
    howTo,
    destinationInstruction: destinationInstruction || clue.destinationInstruction || '',
    hintText: hintText || clue.hintText || '',
  };
}

/**
 * @returns {{ bundle: object, changed: boolean }}
 */
export function applyOfflinePlayerCopy(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    return { bundle, changed: false };
  }
  if (Number(bundle.playerCopyRevision) === OFFLINE_PLAYER_COPY_REVISION) {
    return { bundle, changed: false };
  }

  const challenges = bundle.challenges ? { ...bundle.challenges } : {};
  for (const key of ['clue1', 'clue2', 'clue3', 'clue4', 'clue5', 'clue6']) {
    const n = Number(String(key).replace('clue', ''));
    if (challenges[key]) challenges[key] = patchChallenge(challenges[key], n);
  }

  const checkpoints = Array.isArray(bundle.checkpoints)
    ? bundle.checkpoints.map((cp) => {
      if (!cp || typeof cp !== 'object') return cp;
      const publicInstruction = sanitizePlayerCopy(cp.publicInstruction || '');
      return {
        ...cp,
        publicInstruction: publicInstruction || cp.publicInstruction || '',
      };
    })
    : bundle.checkpoints;

  return {
    bundle: {
      ...bundle,
      challenges,
      checkpoints,
      playerCopyRevision: OFFLINE_PLAYER_COPY_REVISION,
    },
    changed: true,
  };
}
