/**
 * Refresh player-facing copy on an already-installed pack.
 * Soft-updates prompts / HOW_TO / Clue 2 digit answer from green stop plant.
 */

import { sanitizePlayerCopy } from '../player/sanitizePlayerCopy';
import {
  OFFLINE_CLUE_HOW_TO,
  OFFLINE_CLUE_PROMPTS,
  OFFLINE_PLAYER_COPY_REVISION,
} from './offlineHowTo';

function digitAnswerFromPack(bundle, clue) {
  const fromRoute = String(bundle?.route?.green?.joinedWord || '').replace(/\D/g, '');
  const fromPlant = Array.isArray(bundle?.route?.green?.plantFragments)
    ? bundle.route.green.plantFragments.map((f) => String(f || '').replace(/\D/g, '')).join('')
    : '';
  const fromClue = String(clue?.answer || '').replace(/\D/g, '');
  const digits = (fromRoute.length >= 3 ? fromRoute : '')
    || (fromPlant.length >= 3 ? fromPlant : '')
    || (fromClue.length >= 3 ? fromClue : '');
  return digits ? digits.slice(0, 3).padStart(3, '0') : '';
}

function patchChallenge(clue, n, bundle) {
  if (!clue || typeof clue !== 'object') return clue;
  const howTo = OFFLINE_CLUE_HOW_TO[n] || clue.howTo || null;
  const destinationInstruction = sanitizePlayerCopy(clue.destinationInstruction || '');
  const hintText = sanitizePlayerCopy(clue.hintText || '');
  const forcedPrompt = OFFLINE_CLUE_PROMPTS[n];
  let next = {
    ...clue,
    howTo,
    destinationInstruction: destinationInstruction || clue.destinationInstruction || '',
    hintText: hintText || clue.hintText || '',
  };

  if (forcedPrompt) {
    next.prompt = forcedPrompt;
  }

  // Clue 2 — always 3-digit plant answer (never leftover letter words).
  if (n === 2) {
    const digits = digitAnswerFromPack(bundle, clue);
    if (digits) {
      next.answer = digits;
      next.acceptedAnswers = [digits];
    }
    next.memberPrompts = [];
    next.type = 'decode';
  }

  // Clue 3 — physical lockbox only; strip digital/collaborative leftovers.
  if (n === 3) {
    next.memberPrompts = [];
    next.type = 'decode';
    next.hintText = next.hintText
      || 'Look around the blue stop for the lockbox. Type exactly what’s printed on it.';
  }

  // Clue 5 — letter slips; no piece list on phone.
  if (n === 5) {
    next.memberPrompts = [];
  }

  return next;
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
  // Packs use clues.clueN — also patch challenges if present.
  const clues = bundle.clues ? { ...bundle.clues } : {};
  for (const key of ['clue1', 'clue2', 'clue3', 'clue4', 'clue5', 'clue6']) {
    const n = Number(String(key).replace('clue', ''));
    if (challenges[key]) challenges[key] = patchChallenge(challenges[key], n, bundle);
    if (clues[key]) clues[key] = patchChallenge(clues[key], n, bundle);
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
      clues,
      checkpoints,
      playerCopyRevision: OFFLINE_PLAYER_COPY_REVISION,
    },
    changed: true,
  };
}
