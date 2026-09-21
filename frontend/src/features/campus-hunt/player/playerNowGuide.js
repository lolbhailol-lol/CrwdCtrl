/**
 * Plain-language “what to do now” copy for the player dashboard.
 * Keep body short — no numbered steps (action UI is below).
 */

import { sanitizePlayerCopy } from './sanitizePlayerCopy';

export function buildPlayerNowGuide({
  waitingForRelease,
  released,
  locked,
  atCheckpoint,
  atStartReport,
  activeNum,
  isLeader,
  team,
  checkpointStatus,
  activeChallenge,
}) {
  const startName = team?.startingPoint?.name || team?.startingPoint?.code || 'your starting point';
  const onePhone = Boolean(checkpointStatus?.onePhoneMode ?? true);

  if (locked) {
    return {
      tone: 'done',
      eyebrow: 'Finished',
      title: 'Score locked',
      body: `Final: ${team?.finalScore ?? team?.currentScore ?? 0} pts.`,
      steps: [],
    };
  }

  if (waitingForRelease) {
    return {
      tone: 'wait',
      eyebrow: 'Before start',
      title: `Meet at ${startName}`,
      body: 'Clue 1 unlocks when the hunt starts. Leader phone only.',
      steps: [],
    };
  }

  if (atStartReport) {
    return {
      tone: 'final',
      eyebrow: 'Mindspark Lobby',
      title: 'Enter the finish code',
      body: 'Ask the organizer for the finish code to lock your score.',
      steps: [],
    };
  }

  if (atCheckpoint) {
    const place = checkpointStatus?.locationName || 'the campus spot';
    const key = String(checkpointStatus?.checkpointKey || '');
    const color = key.startsWith('5')
      ? 'Red'
      : key.startsWith('4')
        ? 'Purple'
        : key.startsWith('3')
          ? 'Blue'
          : key.startsWith('2')
            ? 'Green'
            : 'Orange';
    const required = Number(checkpointStatus?.requiredCount || 1);
    const scanned = Boolean(checkpointStatus?.youScanned);
    const awaitingClaim = !onePhone && (
      Boolean(checkpointStatus?.awaitingTeamCodeConfirm)
      || (
        Number(checkpointStatus?.verifiedCount || 0)
        >= required
        && checkpointStatus?.status !== 'complete'
      )
    );
    const done = checkpointStatus?.status === 'complete';

    if (done) {
      return {
        tone: 'scan',
        eyebrow: `${color} scan`,
        title: 'Station cleared',
        body: 'Next clue is unlocked.',
        steps: [],
      };
    }

    if (awaitingClaim || (!onePhone && scanned)) {
      return {
        tone: 'scan',
        eyebrow: `${color} · confirm`,
        title: 'Confirm team code',
        body: `Confirm ${team?.teamCode || 'your code'} to unlock the next clue.`,
        steps: [],
      };
    }

    return {
      tone: 'scan',
      eyebrow: `${color} QR`,
      title: place && place !== 'the campus spot'
        ? `Scan at ${place}`
        : `Scan ${color}`,
      body: checkpointStatus?.publicInstruction
        ? sanitizePlayerCopy(checkpointStatus.publicInstruction)
        : (onePhone
          ? `Leader scans the ${color} poster once — next clue unlocks.`
          : `Leader scans the ${color} poster once.`),
      steps: [],
    };
  }

  if (activeNum === 1) {
    if (activeChallenge?.revealedAnswer || activeChallenge?.failureReason === 'REVEALED_ZERO_POINTS') {
      return {
        tone: 'clue',
        eyebrow: 'Clue 1',
        title: 'Type the revealed place',
        body: '0 pts — type the answer shown, then scan Orange.',
        steps: [],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 1',
      title: 'Name the place',
      body: isLeader
        ? '3 attempts. Type the campus place, submit, then scan Orange.'
        : 'Only the leader phone answers Clue 1.',
      steps: [],
    };
  }

  if (activeNum === 2) {
    if (activeChallenge?.revealedAnswer) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 2',
        title: 'Type the digit number',
        body: '0 pts — type the revealed number, then scan green.',
        steps: [],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 2 · Digits',
      title: 'Join numbered digit slips',
      body: '3 tries. Find slips 1→N at green, join digits into one number, type it.',
      steps: [],
    };
  }

  if (activeNum === 3) {
    if (activeChallenge?.revealedAnswer || activeChallenge?.failureReason === 'REVEALED_ZERO_POINTS') {
      return {
        tone: 'clue',
        eyebrow: 'Clue 3 · Lockbox',
        title: 'Type the revealed code',
        body: '0 pts — type the code shown, then scan blue.',
        steps: [],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 3 · Lockbox',
      title: 'Find the lockbox',
      body: 'Find the physical lockbox nearby. Type the code written on it.',
      steps: [],
    };
  }

  if (activeNum === 4) {
    return {
      tone: 'clue',
      eyebrow: 'Clue 4 · Field Terminal',
      title: 'Borrow a laptop · play Zip Grid',
      body: 'Device key on this phone → laptop · Zip Grid 4 rounds (Easy→Hard) → type GRID-XXXX here.',
      steps: [],
    };
  }

  if (activeNum === 5) {
    if (activeChallenge?.revealedAnswer || activeChallenge?.timeExpired) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 5 · Word',
        title: 'Type the revealed word',
        body: '0 pts — type it, then scan red.',
        steps: [],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 5 · Word',
      title: 'Join letter slips into a word',
      body: '2 tries. Letter slips at red (not digits) — build one word. Hints cost more.',
      steps: [],
    };
  }

  if (activeNum === 6) {
    return {
      tone: 'final',
      eyebrow: 'Mindspark Lobby',
      title: 'Type the finish code',
      body: 'Organizer gives the code — type it to lock your score.',
      steps: [],
    };
  }

  if (released) {
    return {
      tone: 'wait',
      eyebrow: 'Hold on',
      title: 'Next step unlocking',
      body: 'Stay with your team.',
      steps: [],
    };
  }

  return {
    tone: 'wait',
    eyebrow: 'Campus Hunt',
    title: 'Stay with your team',
    body: 'Follow the leader phone.',
    steps: [],
  };
}
