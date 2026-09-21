/**
 * Refresh player-facing copy on an already-installed pack.
 * Always force Clue 2 / 3 / 5 prompts + answer shapes so offline play stays current.
 * Never overwrite a valid admin-saved answer with a different plant/default.
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

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function lettersOnly(value) {
  return String(value || '').replace(/[^A-Za-z]/g, '').toUpperCase();
}

/** Prefer challenge answer (admin save). Plant is fallback only when answer is not digits. */
function digitAnswerFromPack(bundle, clue) {
  const fromClue = digitsOnly(clue?.answer);
  if (fromClue.length >= 3) return fromClue.slice(0, 3);

  for (const row of clue?.acceptedAnswers || []) {
    const d = digitsOnly(row);
    if (d.length >= 3) return d.slice(0, 3);
  }

  const fromRoute = digitsOnly(bundle?.route?.green?.joinedWord);
  if (fromRoute.length >= 3) return fromRoute.slice(0, 3);

  const fromPlant = Array.isArray(bundle?.route?.green?.plantFragments)
    ? bundle.route.green.plantFragments.map((f) => digitsOnly(f)).join('')
    : '';
  if (fromPlant.length >= 3) return fromPlant.slice(0, 3);

  return '';
}

function clue5WordFromPack(bundle, clue) {
  const existing = lettersOnly(clue?.answer);
  if (existing.length >= 3) return existing;
  const fromAccepted = (Array.isArray(clue?.acceptedAnswers) ? clue.acceptedAnswers : [])
    .map((a) => lettersOnly(a))
    .find((w) => w.length >= 3);
  if (fromAccepted) return fromAccepted;
  const start = startCodeFromPack(bundle);
  if (CLUE5_WORDS[start]) return CLUE5_WORDS[start];
  return 'QUEST';
}

function lockboxAnswerFromPack(clue) {
  const raw = String(clue?.answer || '').trim();
  const digits = digitsOnly(raw);
  if (digits.length >= 3) return digits;
  if (raw.length >= 3) return raw.toUpperCase();
  for (const row of clue?.acceptedAnswers || []) {
    const d = digitsOnly(row);
    if (d.length >= 3) return d;
    const s = String(row || '').trim();
    if (s.length >= 3) return s.toUpperCase();
  }
  return raw;
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

  // Clue 2 — 3-digit plant answer. Never keep letter-word leftovers in acceptedAnswers.
  if (n === 2) {
    const digits = digitAnswerFromPack(bundle, clue);
    if (digits) {
      next.answer = digits;
      next.acceptedAnswers = [digits];
    } else {
      // Strip letter leftovers so old words never validate.
      next.acceptedAnswers = (Array.isArray(clue.acceptedAnswers) ? clue.acceptedAnswers : [])
        .map((a) => digitsOnly(a).slice(0, 3))
        .filter((d) => d.length >= 3);
      if (next.acceptedAnswers[0]) next.answer = next.acceptedAnswers[0];
    }
    next.memberPrompts = [];
    next.type = 'decode';
    next.hintText = next.hintText
      || 'Numbered slips only — join digit 1, then 2, then 3… Eye level on posts.';
  }

  // Clue 3 — keep unique lockbox code from pack; strip collaborative leftovers.
  if (n === 3) {
    const code = lockboxAnswerFromPack(clue);
    if (code) {
      next.answer = code;
      next.acceptedAnswers = [code, String(code).toLowerCase()];
    }
    next.memberPrompts = [];
    next.type = 'decode';
    next.hintText = 'Look around the blue stop for the lockbox. Type exactly what’s printed on it.';
  }

  // Clue 5 — letter slips → one word; never digit leftovers / piece lists.
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
  if (n === 5) return looksStaleClue5(clue) || digitsOnly(clue.answer).length >= 3;
  if (n === 3) {
    return (Array.isArray(clue.memberPrompts) && clue.memberPrompts.some((p) => String(p || '').trim()))
      || /digital|piece|collaborative/i.test(String(clue.prompt || ''));
  }
  if (n === 2) {
    const ans = String(clue.answer || '');
    return /[A-Za-z]/.test(ans) || digitsOnly(ans).length < 3 || String(clue.prompt || '').length < 10;
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

  // Keep green plant digits aligned with Clue 2 answer (never the reverse overwrite).
  let route = bundle.route;
  const clue2 = clues.clue2 || challenges.clue2;
  const digitAns = digitsOnly(clue2?.answer);
  if (digitAns.length >= 3 && route?.green) {
    const greenDigits = digitsOnly(route.green.joinedWord);
    if (greenDigits !== digitAns.slice(0, 3)) {
      route = {
        ...route,
        green: {
          ...route.green,
          joinedWord: digitAns.slice(0, 3),
          plantFragments: digitAns.slice(0, 3).split(''),
        },
      };
      contentChanged = true;
    }
  }

  const checkpoints = Array.isArray(bundle.checkpoints)
    ? bundle.checkpoints.map((cp) => {
      if (!cp || typeof cp !== 'object') return cp;
      const publicInstruction = sanitizePlayerCopy(cp.publicInstruction || '');
      const next = {
        ...cp,
        publicInstruction: publicInstruction || cp.publicInstruction || '',
      };
      if (String(cp.progressionKey || cp.checkpointKey || '') === '2' && digitAns.length >= 3) {
        next.joinedWord = digitAns.slice(0, 3);
        next.plantFragments = digitAns.slice(0, 3).split('');
      }
      return next;
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
      route,
      checkpoints,
      playerCopyRevision: OFFLINE_PLAYER_COPY_REVISION,
    },
    changed: true,
  };
}
