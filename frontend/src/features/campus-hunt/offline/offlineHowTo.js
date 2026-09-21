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
    title: 'Clue 2 · digits',
    steps: [
      'At green: find numbered digit slips (1, 2, 3…).',
      'Join digits in order · type the number (3 tries).',
      'Miss all 3 → answer shown (0 pts).',
      'Scan green once.',
    ],
  },
  3: {
    title: 'Clue 3 · lockbox',
    steps: [
      'At blue: find ONE lockbox plaque (full code on one card).',
      'Not the green digit slips — search ledges / behind boards.',
      'Type the code (2 tries · hints cost more).',
      'Scan blue once.',
    ],
  },
  4: {
    title: 'Clue 4 · Zip Grid',
    steps: [
      'Borrow a laptop with internet.',
      'Open Zip Grid · type the device key from this phone.',
      'Clear 3 rounds · type GRID-XXXX here · scan purple once.',
    ],
  },
  5: {
    title: 'Clue 5 · word',
    steps: [
      'At red: find letter slips (letters — not digits).',
      'Join in order into one word (2 tries · hints cost more).',
      'Time up or 2 misses → word shown (0 pts).',
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
export const OFFLINE_PLAYER_COPY_REVISION = 9;
