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
      'Walk there · scan orange once.',
    ],
  },
  2: {
    title: 'Clue 2 · digits',
    steps: [
      'At green: find numbered digit slips (1, 2, 3…).',
      'Join digits in order · type the number.',
      'Scan green once.',
    ],
  },
  3: {
    title: 'Clue 3 · lockbox',
    steps: [
      'Find the physical lockbox nearby.',
      'Type the code written on it.',
      'Scan blue once.',
    ],
  },
  4: {
    title: 'Clue 4 · Zip Grid',
    steps: [
      'Borrow a laptop with internet.',
      'Open Zip Grid · type the device key from this phone.',
      'Clear 4 rounds · type GRID-XXXX here · scan purple once.',
    ],
  },
  5: {
    title: 'Clue 5 · word',
    steps: [
      'At red: find numbered letter slips (letters — not digits).',
      'Join in order into one word.',
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

/** Short prompts forced onto installed packs (overrides old digital-lockbox / letter copy). */
export const OFFLINE_CLUE_PROMPTS = {
  2:
    'At the green stop: find the numbered digit slips nearby.\n'
    + 'Join them in order into one number. Leader types it.',
  3:
    'Find the physical lockbox nearby.\n'
    + 'Type the code written on it.',
  5:
    'At the red stop: find the letter slips planted nearby (letters only — not digits).\n'
    + 'Join them in order into one word. Leader submits.',
};

/** Bump when HOW_TO / player UI copy changes — soft-rewrites already-downloaded packs. */
export const OFFLINE_PLAYER_COPY_REVISION = 16;
