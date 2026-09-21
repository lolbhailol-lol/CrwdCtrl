/**
 * App-owned HOW_TO for offline play.
 * Always preferred over pack-frozen howTo so UX copy updates with the Hunt app —
 * no re-export / reinstall required for instruction text.
 */

export const OFFLINE_CLUE_HOW_TO = {
  1: {
    title: 'Clue 1 · place',
    steps: [
      'Type the campus place (3 tries).',
      'Miss all 3 → answer shown (0 pts) — type it.',
      'Walk there · scan orange once.',
    ],
  },
  2: {
    title: 'Clue 2 · plant word',
    steps: [
      'At green: join plant slips into one word.',
      'Type it (3 tries · faster = more pts).',
      'Time up or 3 misses → word shown (0 pts).',
      'Scan green once.',
    ],
  },
  3: {
    title: 'Clue 3 · lockbox',
    steps: [
      'Rebuild the digit code on this phone.',
      'Submit (3 tries). Miss all → code shown (0 pts).',
      'Go there · scan blue once.',
    ],
  },
  4: {
    title: 'Clue 4 · Zip Grid',
    steps: [
      'Borrow a laptop with internet.',
      'Open Zip Grid · type the device key from this phone.',
      'Type GRID-XXXX here · scan purple once.',
    ],
  },
  5: {
    title: 'Clue 5 · word',
    steps: [
      'Rebuild the word from fragments (3 tries).',
      'Time up or 3 misses → word shown (0 pts).',
      'Scan red once · then Mindspark Lobby.',
    ],
  },
  6: {
    title: 'Finish · lobby',
    steps: [
      'Go to Mindspark Lobby together.',
      'Ask organizer for the finish code.',
      'Type it to lock your score.',
    ],
  },
};

/** Bump when HOW_TO / player UI copy changes — soft-rewrites already-downloaded packs. */
export const OFFLINE_PLAYER_COPY_REVISION = 4;
