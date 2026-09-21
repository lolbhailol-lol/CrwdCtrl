/**
 * App-owned HOW_TO for offline play.
 * Always preferred over pack-frozen howTo so UX copy updates with the Hunt app —
 * no re-export / reinstall required for instruction text.
 */

export const OFFLINE_CLUE_HOW_TO = {
  1: {
    title: 'How to play — Clue 1',
    steps: [
      'All teammates walk together. One phone (leader).',
      'Read the sentence and type the campus location (3 attempts).',
      'After 3 wrong tries the answer is shown (0 pts) — type it to continue.',
      'Go there. Leader scans the orange FIRST SCAN QR once → Clue 2.',
    ],
  },
  2: {
    title: 'How to play — Clue 2',
    steps: [
      'Go to the green stop. Find the plant slips, join into one word.',
      'Type that word on this phone (3 attempts). Faster = more points.',
      'If time runs out or 3 wrong tries, the word is shown (0 pts) — type it.',
      'Leader scans the green SECOND SCAN QR once → Clue 3.',
    ],
  },
  3: {
    title: 'How to play — Lockbox',
    steps: [
      'Lockbox pieces are on the leader phone — read aloud and rebuild the digit code.',
      'Submit the code (3 attempts). After 3 wrong tries it is shown (0 pts) — type it.',
      'Go to that place, scan the blue THIRD SCAN QR once.',
    ],
  },
  4: {
    title: 'How to play — Field Terminal',
    steps: [
      'Borrow any laptop that has internet (friend / café / lab).',
      'Open Zip Grid, type your device key from this phone.',
      'Clear the levels → you get a GRID-XXXX code.',
      'Type that GRID code here → then scan purple.',
    ],
  },
  5: {
    title: 'How to play — Clue 5',
    steps: [
      'Fragments are on this phone — read them aloud in order and rebuild the word.',
      'Leader types the word (3 attempts). Faster = bonus points.',
      'If time runs out or 3 wrong tries, the word is shown (0 pts) — type it.',
      'Then scan the red FIFTH SCAN QR once → Clue 6 (Mindspark Lobby).',
    ],
  },
  6: {
    title: 'How to play — Mindspark Lobby',
    steps: [
      'Go to Mindspark Lobby as a full team.',
      'Ask the organizer for the finish code.',
      'Leader types it to lock your score.',
    ],
  },
};

/** Bump when HOW_TO or destination sanitize rules change — triggers one pack rewrite on phone. */
export const OFFLINE_PLAYER_COPY_REVISION = 3;
