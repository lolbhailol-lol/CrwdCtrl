/**
 * Plain-language “what to do now” copy for the player dashboard.
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
      title: 'Your score is locked',
      body: `Final score: ${team?.finalScore ?? team?.currentScore ?? 0} points.`,
      steps: ['Check the public leaderboard if it is live.'],
    };
  }

  if (waitingForRelease) {
    return {
      tone: 'wait',
      eyebrow: 'Before start',
      title: `Meet at ${startName}`,
      body: isLeader
        ? 'Clue 1 stays locked until your unlock time. Keep everyone together.'
        : 'Your leader gets Clue 1 at unlock time. Stay together.',
      steps: [
        `Stay at ${startName}`,
        'Wait for the countdown below',
        isLeader ? 'Then solve Clue 1 here' : 'Help after your leader solves Clue 1',
      ],
    };
  }

  if (atStartReport) {
    return {
      tone: 'final',
      eyebrow: 'Final step',
      title: 'Report to your start',
      body: `Go to ${startName} and tell the organizer your team number.`,
      steps: [
        `Walk to ${startName}`,
        `Say team number ${team?.teamCode || '—'}`,
        'Ask them to mark you reached',
      ],
    };
  }

  if (atCheckpoint) {
    const place = checkpointStatus?.locationName || 'the campus spot';
    const color = checkpointStatus?.checkpointKey?.startsWith('2')
      ? 'Green'
      : checkpointStatus?.checkpointKey?.startsWith('3')
        ? 'Blue'
        : 'Orange';
    const required = Number(checkpointStatus?.requiredCount || team?.teamSize || 4);
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
        eyebrow: `${color} scan complete`,
        title: 'Station cleared',
        body: 'Your allotted clue is unlocked — keep going.',
        steps: ['Continue to the next clue'],
      };
    }

    if (awaitingClaim) {
      return {
        tone: 'scan',
        eyebrow: `${color} · team code`,
        title: 'Enter your team code',
        body: `All ${required} scanned at ${place}. Confirm ${team?.teamCode || 'your code'} to unlock your allotted clue.`,
        steps: [
          'Type your team code',
          'Tap Confirm',
          'Read the clue you were allotted',
        ],
      };
    }

    if (scanned) {
      return {
        tone: 'scan',
        eyebrow: `${color} scan`,
        title: 'Waiting for teammates',
        body: `${checkpointStatus.verifiedCount}/${checkpointStatus.requiredCount} scanned at ${place}.`,
        steps: [
          'You already scanned',
          `Need ${checkpointStatus.membersNeeded} more`,
          'Then enter your team code',
        ],
      };
    }

    return {
      tone: 'scan',
      eyebrow: `${color} shared QR`,
      title: `Scan at ${place}`,
      body: `Find the shared ${color} QR at this place. All teams use the same poster.`,
      steps: [
        `Go to ${place}`,
        `Scan the shared ${color} QR`,
        `All ${required} must scan`,
        'Enter your team code for your clue',
      ],
    };
  }

  if (activeNum === 1) {
    if (!isLeader) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 1',
        title: 'Stay with your leader',
        body: 'They solve Clue 1 on their phone. You scan Orange together next — keep this screen open.',
        steps: [
          'Stay together',
          'Leader submits the place name',
          'Then everyone scans the shared Orange QR',
        ],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 1',
      title: 'Name the place',
      body: 'Read the clue below, type the campus place, then submit.',
      steps: ['Read the clue', 'Type the place name', 'Submit, then scan the shared Orange QR'],
    };
  }

  if (activeNum === 2) {
    if (activeChallenge?.instructionPhase) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 2',
        title: 'Read the instructions',
        body: 'The 3-minute timer starts when the countdown hits zero.',
        steps: ['Read now', 'Wait for the timer', 'Then find and submit the number'],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 2',
      title: isLeader ? 'Find the number' : 'Help find the number',
      body: isLeader
        ? 'Faster answers score more. Only you can submit.'
        : 'Help search — only the leader submits.',
      steps: isLeader
        ? ['Find the 3-digit number', 'Type it below', 'Submit, then scan green']
        : ['Help search', 'Stay for the green scan next'],
    };
  }

  if (activeNum === 3) {
    return {
      tone: 'clue',
      eyebrow: 'Clue 3',
      title: isLeader ? 'Decode the riddle' : 'Help decode',
      body: isLeader
        ? 'Solve together, then submit the word.'
        : 'Only the Team Leader can submit.',
      steps: isLeader
        ? ['Read the riddle', 'Type the word', 'Submit']
        : ['Help decode', 'Leader submits'],
    };
  }

  if (activeNum === 4) {
    return {
      tone: 'final',
      eyebrow: 'Final clue',
      title: isLeader ? 'Submit the one word' : 'Share your code',
      body: isLeader
        ? 'Collect all 4 fragments, submit, then report to start.'
        : 'Show your fragment — leader submits.',
      steps: isLeader
        ? ['Collect 4 codes', 'Type the word', 'Submit, then report to start']
        : ['Show your fragment', 'Go with the team to the start desk'],
    };
  }

  if (released) {
    return {
      tone: 'wait',
      eyebrow: 'Hold on',
      title: 'Loading the next step',
      body: 'If this stays blank, tap Refresh below.',
      steps: ['Stay with your team', 'Tap Refresh status'],
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
