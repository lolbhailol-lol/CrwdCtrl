/**
 * Refresh player-facing copy on an already-installed pack.
 * Always force Clue 2 / 3 / 5 prompts + answers so offline play stays current
 * without requiring a full re-export.
 */

import { sanitizePlayerCopy } from '../player/sanitizePlayerCopy';
import {
  OFFLINE_CLUE_HOW_TO,
  OFFLINE_CLUE_PROMPTS,
  OFFLINE_PLAYER_COPY_REVISION,
} from './offlineHowTo';

const CLUE5_WORDS = {
  A: 'QUEST',
  B: 'BLAZE',
  C: 'SPARK',
  D: 'PRIDE',
};

function startCodeFromPack(bundle) {
  const raw = String(
    bundle?.team?.startingPoint?.code
    || bundle?.team?.startCode
    || bundle?.route?.startCode
    || '',
  ).toUpperCase().trim();
  if (/^[A-D]$/.test(raw)) return raw;
  const stripped = raw.replace(/^START[-_\s]?/, '');
  if (/^[A-D]$/.test(stripped)) return stripped;
  return stripped.charAt(0);
}

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

function clue5WordFromPack(bundle, clue) {
  // Prefer admin-saved / pack answer when it is already a letter word.
  const existing = String(clue?.answer || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (existing.length >= 3) return existing;
  const fromAccepted = (Array.isArray(clue?.acceptedAnswers) ? clue.acceptedAnswers : [])
    .map((a) => String(a || '').replace(/[^A-Za-z]/g, '').toUpperCase())
    .find((w) => w.length >= 3);
  if (fromAccepted) return fromAccepted;
  const start = startCodeFromPack(bundle);
  if (CLUE5_WORDS[start]) return CLUE5_WORDS[start];
  return 'QUEST';
}

function looksStaleClue5(clue) {
  const prompt = String(clue?.prompt || '');
  const hasPieces = Array.isArray(clue?.memberPrompts) && clue.memberPrompts.some((p) => String(p || '').trim());
  return hasPieces
    || /digital|combine all|pieces|collaborative|each teammate|seat/i.test(prompt)
    || !/letter slip/i.test(prompt);
}

function patchChallenge(clue, n, bundle) {
  if (!clue || typeof clue !== 'object') return clue;
  const howTo = OFFLINE_CLUE_HOW_TO[n] || clue.howTo || null;
  const destinationInstruction = sanitizePlayerCopy(clue.destinationInstruction || '');
  let hintText = sanitizePlayerCopy(clue.hintText || '');
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
    next.hintText = next.hintText
      || 'Numbered slips only — join digit 1, then 2, then 3… Eye level on posts.';
  }

  // Clue 3 — physical lockbox only; strip digital/collaborative leftovers.
  if (n === 3) {
    next.memberPrompts = [];
    next.type = 'decode';
    next.hintText = 'Look around the blue stop for the lockbox. Type exactly what’s printed on it.';
  }

  // Clue 5 — letter slips → one word; never piece lists / digit leftovers.
  if (n === 5) {
    const word = clue5WordFromPack(bundle, clue);
    next.prompt = OFFLINE_CLUE_PROMPTS[5];
    next.answer = word;
    next.acceptedAnswers = [word, word.toLowerCase()];
    next.memberPrompts = [];
    next.type = 'decode';
    next.hintText = 'Letters only · eye-level boards · numbered slips. Build one word, no spaces.';
    next.destinationInstruction = sanitizePlayerCopy(
      next.destinationInstruction
      || 'Word solved — go to your 5th campus stop. Find the shared red FIFTH SCAN QR. Leader scans once to unlock Clue 6.',
    );
  }

  return next;
}

function challengeNeedsPatch(clue, n) {
  if (!clue || typeof clue !== 'object') return false;
  if (n === 5) return looksStaleClue5(clue) || String(clue.answer || '').replace(/\D/g, '').length >= 3;
  if (n === 3) {
    return (Array.isArray(clue.memberPrompts) && clue.memberPrompts.some((p) => String(p || '').trim()))
      || /digital|piece|collaborative/i.test(String(clue.prompt || ''));
  }
  if (n === 2) {
    const ans = String(clue.answer || '');
    return /[A-Za-z]/.test(ans) || String(clue.prompt || '').length < 10;
  }
  return false;
}

/**
 * @returns {{ bundle: object, changed: boolean }}
 */
export function applyOfflinePlayerCopy(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    return { bundle, changed: false };
  }

  const revisionFresh = Number(bundle.playerCopyRevision) === OFFLINE_PLAYER_COPY_REVISION;
  const challenges = bundle.challenges ? { ...bundle.challenges } : {};
  const clues = bundle.clues ? { ...bundle.clues } : {};

  let contentChanged = !revisionFresh;
  for (const key of ['clue1', 'clue2', 'clue3', 'clue4', 'clue5', 'clue6']) {
    const n = Number(String(key).replace('clue', ''));
    // Always re-patch 2 / 3 / 5 so stale packs never stick after a soft revision bump.
    const must = n === 2 || n === 3 || n === 5 || !revisionFresh;
    if (challenges[key] && (must || challengeNeedsPatch(challenges[key], n))) {
      const before = JSON.stringify(challenges[key]);
      challenges[key] = patchChallenge(challenges[key], n, bundle);
      if (JSON.stringify(challenges[key]) !== before) contentChanged = true;
    }
    if (clues[key] && (must || challengeNeedsPatch(clues[key], n))) {
      const before = JSON.stringify(clues[key]);
      clues[key] = patchChallenge(clues[key], n, bundle);
      if (JSON.stringify(clues[key]) !== before) contentChanged = true;
    }
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

  if (!contentChanged && revisionFresh) {
    return { bundle, changed: false };
  }

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
