/**
 * Plain-language “what to do now” copy for the player dashboard.
 * Keep body short — no numbered steps (action UI is below).
 */

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
      body: 'Clue 1 unlocks at the scheduled time. Leader phone only.',
      steps: [],
    };
  }

  if (atStartReport) {
    return {
      tone: 'final',
      eyebrow: 'MindSpark Lobby',
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
    const awaitingClaim = Boolean(checkpointStatus?.awaitingTeamCodeConfirm)
      || (
        Number(checkpointStatus?.verifiedCount || 0)
        >= required
        && checkpointStatus?.status !== 'complete'
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

    if (awaitingClaim || scanned) {
      return {
        tone: 'scan',
        eyebrow: `${color} · team code`,
        title: 'Enter team code',
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
        || `Leader scans the ${color} poster once — next clue unlocks.`,
      steps: [],
    };
  }

  if (activeNum === 1) {
    return {
      tone: 'clue',
      eyebrow: 'Clue 1',
      title: 'Name the place',
      body: isLeader
        ? 'Type the campus place, submit, then scan Orange.'
        : 'Only the leader phone answers Clue 1.',
      steps: [],
    };
  }

  if (activeNum === 2) {
    if (activeChallenge?.instructionPhase) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 2',
        title: 'Read first',
        body: 'Hunt timer starts when the countdown hits zero.',
        steps: [],
      };
    }
    if (activeChallenge?.revealedAnswer || activeChallenge?.timeExpired) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 2',
        title: 'Type the revealed answer',
        body: '0 pts — type it, then scan green.',
        steps: [],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 2',
      title: 'Find the number',
      body: 'Faster = more points. At 0:00 the answer is shown for 0 pts.',
      steps: [],
    };
  }

  if (activeNum === 3) {
    return {
      tone: 'clue',
      eyebrow: 'Clue 3 · Lockbox',
      title: 'Open the lockbox',
      body: 'Rebuild the digits in order, then submit.',
      steps: [],
    };
  }

  if (activeNum === 4) {
    return {
      tone: 'clue',
      eyebrow: 'Clue 4 · Field Terminal',
      title: 'Clear Zip Grid',
      body: 'No hunt timer — play Zip Grid on a laptop, then type GRID-XXXX here (50 pts).',
      steps: [],
    };
  }

  if (activeNum === 5) {
    if (activeChallenge?.revealedAnswer || activeChallenge?.timeExpired) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 5',
        title: 'Type the revealed word',
        body: '0 pts — type it, then scan red.',
        steps: [],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 5',
      title: 'Submit the word',
      body: 'Rebuild from fragments, submit, then scan red.',
      steps: [],
    };
  }

  if (activeNum === 6) {
    return {
      tone: 'final',
      eyebrow: 'MindSpark Lobby',
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
    title: 'Getting ready',
    body: 'Your next instruction will show here.',
    steps: [],
  };
}
