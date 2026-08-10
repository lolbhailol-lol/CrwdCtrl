/**
 * Campus Hunt Round 1 format
 *
 * STARTING POINTS (4) — teams gather here, then leave:
 *   Library · Chanakya Porch · Design · Vyas Parking
 *
 * CHECKPOINTS (10) — hunt scan places on campus (not the starting points).
 *   One shared QR per place per scan stage. About 4 teams visit each station
 *   (40 ÷ 10) across waves; all scan the same poster, then enter team code.
 *
 * Clue 1: first stops are shuffled by starting point so simultaneous releases
 * do not pile into one place (e.g. Library T1 → Food Court,
 * Chanakya T1 → Amphitheatre, Design T1 → Main Gate, …).
 */

/** 4 starting points only — never used as hunt destinations by default. */
export const WAIT_POINTS = [
  {
    code: 'A',
    name: 'Library',
    description: 'Starting point — 10 teams hold here until release.',
  },
  {
    code: 'B',
    name: 'Chanakya Porch',
    description: 'Starting point — 10 teams hold here until release.',
  },
  {
    code: 'C',
    name: 'Design',
    description: 'Starting point — 10 teams hold here until release.',
  },
  {
    code: 'D',
    name: 'Vyas Parking',
    description: 'Starting point — 10 teams hold here until release.',
  },
];

/**
 * Example campus checkpoint stations (admin can rename).
 * Kept separate from starting points so hunt stops are real campus places.
 */
export const CAMPUS_STATIONS = [
  { code: 'S01', name: 'Food Court' },
  { code: 'S02', name: 'Amphitheatre' },
  { code: 'S03', name: 'Main Gate' },
  { code: 'S04', name: 'Sports Complex' },
  { code: 'S05', name: 'Student Centre' },
  { code: 'S06', name: 'Auditorium' },
  { code: 'S07', name: 'Cafeteria Lawn' },
  { code: 'S08', name: 'Innovation Lab' },
  { code: 'S09', name: 'Quad Fountain' },
  { code: 'S10', name: 'Admin Block' },
];

export const STATION_TARGET_COUNT = CAMPUS_STATIONS.length; // 10
export const TARGET_TEAMS_PER_STATION = 4; // 40 teams ÷ 10 stations
export const TEAMS_PER_WAIT = 10;

/** @deprecated use WAIT_POINTS — kept so older imports keep compiling */
/** Merge event overrides onto the default S01–S10 catalog. */
export function resolveStations(stations) {
  if (!Array.isArray(stations) || !stations.length) return CAMPUS_STATIONS.map((s) => ({ ...s }));
  const byCode = new Map(
    stations.map((row) => [
      String(row.code || '').toUpperCase().trim(),
      String(row.name || '').trim(),
    ]),
  );
  return CAMPUS_STATIONS.map((station) => ({
    code: station.code,
    name: byCode.get(station.code) || station.name,
  }));
}

/**
 * Local team 1–10 → station, offset by wait index + stopOffset.
 * stopOffset 0 = Clue 1 first stop, 1 = Clue 2 second stop, etc.
 * waitIndex: 0=Library, 1=Chanakya, 2=Design, 3=Vyas.
 */
export function stationForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  stopOffset = 0,
) {
  const list = resolveStations(stations);
  const teamIndex = (Math.max(1, Number(localTeamNumber) || 1) - 1) % list.length;
  const offset = Math.max(0, Number(waitIndex) || 0) % list.length;
  const step = Math.max(0, Number(stopOffset) || 0) % list.length;
  return list[(teamIndex + offset + step) % list.length];
}

export function firstStopForLocalTeam(localTeamNumber, waitIndex = 0, stations = CAMPUS_STATIONS) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 0).name;
}

export function secondStopForLocalTeam(localTeamNumber, waitIndex = 0, stations = CAMPUS_STATIONS) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 1).name;
}

export function thirdStopForLocalTeam(localTeamNumber, waitIndex = 0, stations = CAMPUS_STATIONS) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 2).name;
}

/** Stable unique 3-digit code for global team 1–40 (matches backend bootstrap). */
export function threeDigitCodeForTeam(waitIndex, localTeamNumber) {
  const teamNumber = (Math.max(0, Number(waitIndex) || 0) * TEAMS_PER_WAIT)
    + Math.max(1, Number(localTeamNumber) || 1);
  return String(100 + ((teamNumber * 73 + 19) % 900)).padStart(3, '0');
}

/** Global team 1–40: Library 1–10, Chanakya 11–20, Design 21–30, Vyas 31–40. */
export function globalTeamNumber(waitIndex, localTeamNumber) {
  const wait = Math.max(0, Number(waitIndex) || 0) % WAIT_POINTS.length;
  const local = Math.max(1, Number(localTeamNumber) || 1);
  return wait * TEAMS_PER_WAIT + local;
}

/**
 * Arrival plan for a hunt stop index (0 = first / Clue 1, 1 = second / Clue 2…).
 * Each of the 10 places lists exactly 4 teams and which starting point they left.
 */
export function stationArrivalPlan(stopOffset = 0, stations = CAMPUS_STATIONS) {
  const list = resolveStations(stations);
  const step = Math.max(0, Number(stopOffset) || 0);
  return list.map((station) => {
    const arrivals = [];
    WAIT_POINTS.forEach((start, waitIndex) => {
      for (let local = 1; local <= TEAMS_PER_WAIT; local += 1) {
        const dest = stationForLocalTeam(local, waitIndex, list, step);
        if (dest.code !== station.code) continue;
        const teamNumber = globalTeamNumber(waitIndex, local);
        arrivals.push({
          startingPointCode: start.code,
          startingPointName: start.name,
          waitCode: start.code,
          waitName: start.name,
          localTeamNumber: local,
          teamNumber,
          teamLabel: `Team ${teamNumber}`,
          waveId: `T${local}`,
        });
      }
    });
    arrivals.sort((a, b) => a.teamNumber - b.teamNumber);
    return {
      code: station.code,
      name: station.name,
      teamCount: arrivals.length,
      arrivals,
    };
  });
}

/**
 * Simple First Scan plan: exactly 10 places.
 * Each place lists how many teams arrive and which starting point they left.
 */
export function firstStopArrivalPlan(stations = CAMPUS_STATIONS) {
  return stationArrivalPlan(0, stations);
}

/** Clue 2 second-stop plan: same 10×4 fan-out, one station after first stop. */
export function secondStopArrivalPlan(stations = CAMPUS_STATIONS) {
  return stationArrivalPlan(1, stations);
}

/** Clue 3 third-stop plan: same 10×4 fan-out, two stations after first stop. */
export function thirdStopArrivalPlan(stations = CAMPUS_STATIONS) {
  return stationArrivalPlan(2, stations);
}

/** Wait code A–D or 0–3 → wait index for shuffle offset. */
export function waitIndexForStart(startCodeOrIndex) {
  if (typeof startCodeOrIndex === 'number' && Number.isFinite(startCodeOrIndex)) {
    return Math.max(0, startCodeOrIndex) % WAIT_POINTS.length;
  }
  const raw = String(startCodeOrIndex || '').toUpperCase().trim();
  const code = raw.match(/^([A-D])$/)?.[1]
    || raw.replace(/^START[-_\s]?/, '').match(/^([A-D])/)?.[1]
    || raw.charAt(0);
  const index = WAIT_POINTS.findIndex((wait) => wait.code === code);
  return index >= 0 ? index : 0;
}

/**
 * Clues 2–4 path per wait (offset so routes fan out across the 10 stations).
 * Index 0 is only a path placeholder — Clue 1 uses firstStopForLocalTeam instead.
 */
export function routeStopsForWait(waitIndex, stations = CAMPUS_STATIONS) {
  const list = resolveStations(stations);
  const base = (Number(waitIndex) || 0) * 2;
  return [0, 1, 2, 3].map((offset) => {
    const station = list[(base + offset + 1) % list.length];
    return station.name;
  });
}

export function buildCampusStarts(stations = CAMPUS_STATIONS) {
  const list = resolveStations(stations);
  return WAIT_POINTS.map((wait, routeIndex) => ({
    ...wait,
    firstStops: Array.from(
      { length: TEAMS_PER_WAIT },
      (_, i) => firstStopForLocalTeam(i + 1, routeIndex, list),
    ),
    routeStops: routeStopsForWait(routeIndex, list),
  }));
}

export const CAMPUS_STARTS = buildCampusStarts();

/** Final one-word answers per start path (A–D). */
export const CLUE4_WORDS = {
  A: 'QUEST',
  B: 'BLAZE',
  C: 'SPARK',
  D: 'PRIDE',
};

export function clue4WordForStart(startCode) {
  const code = String(startCode || 'A').toUpperCase().charAt(0);
  return CLUE4_WORDS[code] || 'QUEST';
}

/** One release slot per local team (Team 1 @ t0, Team 2 @ t+5…). */
export const TEAM_SLOTS = Array.from({ length: TEAMS_PER_WAIT }, (_, i) => ({
  id: `T${i + 1}`,
  label: `Team ${i + 1}`,
  short: `T${i + 1}`,
  index: i,
  localTeamNumber: i + 1,
  /** Base station before wait offset — use stationForLocalTeam(n, waitIndex) for real first stop */
  station: stationForLocalTeam(i + 1, 0),
}));

/** Generic Clue 1 riddle for any campus station name. */
export function clue1ForPlace(place) {
  const station = CAMPUS_STATIONS.find(
    (s) => s.name.toLowerCase() === String(place || '').toLowerCase(),
  );
  const name = station?.name || place || 'the station';
  return {
    prompt:
      `Your first scan is waiting on campus. Read the marks, follow the crowd of clues, `
      + `and name the place: ${name}.`,
    answer: name,
    destinationInstruction:
      `Go to ${name}. All four members scan the shared QR, then enter your team code.`,
    hintText: `Ask staff for the way to ${name}.`,
  };
}

/** Clue 2 / 3 / Final defaults for a destination stop. */
export function routeClueDefaults(challengeNumber, destination) {
  const place = destination || 'the next station';
  const n = Number(challengeNumber) || 2;

  if (n === 2) {
    return {
      prompt:
        'A staff mark hides in plain sight nearby. '
        + 'Scan the area at eye level — the code is a 3-digit number.',
      answer: '',
      hintText: 'Check posts, pillars, and notice boards at eye level.',
      destinationInstruction:
        'Go to your next location now. Find the shared green SECOND SCAN QR — '
        + 'all 4 members scan, then enter your team code to unlock Clue 3.',
      memberPrompts: ['', '', '', ''],
    };
  }

  if (n === 3) {
    const cipher = String(place).replace(/[a-zA-Z]/g, (ch) => {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + 3) % 26) + base);
    });
    return {
      prompt:
        `Letters have marched three steps forward. Decode this Caesar (+3) message:\n${cipher}`,
      answer: place,
      hintText: 'Caesar shift of 3 — A becomes D, B becomes E… Spaces stay spaces.',
      destinationInstruction:
        'Riddle solved — go find the shared blue Checkpoint 3 QR at that place. '
        + 'All 4 members scan, then enter your team code to unlock Final.',
      memberPrompts: ['', '', '', ''],
    };
  }

  const raw = String(place).replace(/\s+/g, '').toUpperCase();
  const len = Math.max(4, raw.length);
  const padded = raw.padEnd(len, 'X');
  const size = Math.ceil(padded.length / 4);
  const chunks = [0, 1, 2, 3].map((i) => padded.slice(i * size, (i + 1) * size) || String(i + 1));
  return {
    prompt:
      'Each teammate has a code fragment on their phone. '
      + 'Speak them in order 1→4 and rebuild the one word. Leader submits it.',
    answer: raw || 'QUEST',
    hintText: 'Say every code out loud in member order — no spaces in the final word.',
    destinationInstruction:
      'Word solved — report to your start location. Ask the organizer to mark your team reached.',
    memberPrompts: chunks,
  };
}

/** Where challenge 1–4 sends a team that waited at this start. */
export function destinationForClue(startCodeOrName, challengeNumber, localTeamNumber = 1, stations = CAMPUS_STATIONS) {
  const raw = String(startCodeOrName || '').toUpperCase().trim();
  const code = raw.match(/^([A-D])$/)?.[1]
    || raw.replace(/^START[-_\s]?/, '').match(/^([A-D])/)?.[1]
    || raw.charAt(0);
  const start = CAMPUS_STARTS.find((item) => item.code === code)
    || CAMPUS_STARTS.find((item) => item.name === startCodeOrName)
    || CAMPUS_STARTS[0];
  const waitIndex = CAMPUS_STARTS.findIndex((item) => item.code === start.code);
  const wait = waitIndex >= 0 ? waitIndex : 0;
  const clue = Math.max(1, Math.min(4, Number(challengeNumber) || 1));
  if (clue === 1) {
    return firstStopForLocalTeam(localTeamNumber, wait, stations);
  }
  if (clue === 2) {
    return secondStopForLocalTeam(localTeamNumber, wait, stations);
  }
  if (clue === 3) {
    return thirdStopForLocalTeam(localTeamNumber, wait, stations);
  }
  // Clue 4 / Final: teams return to their own start (not another campus station).
  return start.name;
}

/** Short path summary for a clue number across all 4 waits. */
export function destinationsSummary(challengeNumber, stations = CAMPUS_STATIONS) {
  const clue = Math.max(1, Math.min(4, Number(challengeNumber) || 1));
  if (clue === 1 || clue === 2 || clue === 3) {
    const list = resolveStations(stations);
    return `${list.length} places · ${TARGET_TEAMS_PER_STATION} teams each`;
  }
  return CAMPUS_STARTS.map((start) => (
    `${start.code} ${start.name} ← ${clue4WordForStart(start.code)} · ${TEAMS_PER_WAIT} teams`
  )).join(' · ');
}

export function uniqueStationNames(checkpoints = []) {
  const names = new Set();
  checkpoints.forEach((cp) => {
    const name = String(cp.locationName || '').trim();
    if (name) names.add(name.toLowerCase());
  });
  return names.size;
}
