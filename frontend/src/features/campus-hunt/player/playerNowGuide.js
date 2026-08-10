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
      ? 'green'
      : checkpointStatus?.checkpointKey?.startsWith('3')
        ? 'blue'
        : 'yellow';
    const cardName = checkpointStatus?.posterLabel?.teamName || team?.teamName || 'your team';
    const scanned = Boolean(checkpointStatus?.youScanned);
    const done = Number(checkpointStatus?.verifiedCount || 0)
      >= Number(checkpointStatus?.requiredCount || 4);

    if (done) {
      return {
        tone: 'scan',
        eyebrow: `${color} scan complete`,
        title: 'All 4 members scanned',
        body: 'Pick up your card and take it with you.',
        steps: ['Take your team card', 'Continue to the next clue'],
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
          'After 4/4, pick up the card',
        ],
      };
    }

    return {
      tone: 'scan',
      eyebrow: `${color} card`,
      title: `Scan at ${place}`,
      body: `Find the ${color} card labeled ${cardName}. Other teams’ cards will not work.`,
      steps: [
        `Go to ${place}`,
        `Find ${cardName}'s ${color} card`,
        'Tap Scan QR',
        'All 4 must scan, then take the card',
      ],
    };
  }

  if (activeNum === 1) {
    if (!isLeader) {
      return {
        tone: 'clue',
        eyebrow: 'Clue 1',
        title: 'Stay with your leader',
        body: 'They solve Clue 1 on their phone. You scan yellow together next — keep this screen open.',
        steps: [
          'Stay together',
          'Leader submits the place name',
          'Then everyone scans the yellow card',
        ],
      };
    }
    return {
      tone: 'clue',
      eyebrow: 'Clue 1',
      title: 'Name the place',
      body: 'Read the clue below, type the campus place, then submit.',
      steps: ['Read the clue', 'Type the place name', 'Submit, then scan yellow'],
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
