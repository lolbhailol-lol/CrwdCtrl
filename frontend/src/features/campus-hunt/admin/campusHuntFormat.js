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
export const TARGET_TEAMS_PER_STATION = 4; // baseline 40 teams ÷ 10 stations
export const TEAMS_PER_WAIT = 10; // baseline 40 ÷ 4 starts
export const WAIT_COUNT = WAIT_POINTS.length; // 4

function clampCount(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Suggested layout for a team field size (editable overrides win). */
export function suggestHuntLayout(teamCapacity = 40) {
  const capacity = clampCount(teamCapacity, 2, 200, 40);
  let startCount = 4;
  if (capacity <= 10) startCount = 1;
  else if (capacity <= 20) startCount = 2;
  else if (capacity <= 30) startCount = 3;
  const stationCount = Math.max(1, Math.min(STATION_TARGET_COUNT, Math.round(capacity / 4) || 1));
  return { startCount, stationCount };
}

/**
 * Clue / schedule geometry from overall team count + active starts/places.
 * Baseline 40 → 4 starts · 10 places · 10 per start · ~4 per station.
 */
export function deriveClueGeometry(teamCapacity = 40, teamSize = 4, layout = {}) {
  const capacity = Math.max(2, Math.min(200, Math.round(Number(teamCapacity) || 40)));
  const size = Math.max(2, Math.min(8, Math.round(Number(teamSize) || 4)));
  const suggested = suggestHuntLayout(capacity);
  const startCount = clampCount(
    layout.startCount != null ? layout.startCount : suggested.startCount,
    1,
    WAIT_COUNT,
    WAIT_COUNT,
  );
  const stationCount = clampCount(
    layout.stationCount != null ? layout.stationCount : suggested.stationCount,
    1,
    STATION_TARGET_COUNT,
    STATION_TARGET_COUNT,
  );
  const teamsPerWait = Math.max(1, Math.ceil(capacity / startCount));
  const teamsPerStation = Math.max(1, Math.round(capacity / stationCount));
  return {
    teamCapacity: capacity,
    teamSize: size,
    waitCount: startCount,
    startCount,
    stationCount,
    teamsPerWait,
    teamsPerStation,
    totalPlayers: capacity * size,
  };
}

export function buildTeamSlots(teamsPerWait = TEAMS_PER_WAIT) {
  const n = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  return Array.from({ length: n }, (_, i) => ({
    id: `T${i + 1}`,
    label: `Team ${i + 1}`,
    short: `T${i + 1}`,
    index: i,
    localTeamNumber: i + 1,
    station: stationForLocalTeam(i + 1, 0),
  }));
}


/**
 * Merge event overrides onto the default S01–S10 catalog; optionally slice to active count.
 * If `stations` is already a shorter active subset (e.g. S01–S03), keep that subset —
 * do not expand back to all 10 unless stationCount asks for more.
 */
export function resolveStations(stations, stationCount = null) {
  if (!Array.isArray(stations) || !stations.length) {
    const full = CAMPUS_STATIONS.map((s) => ({ ...s }));
    if (stationCount == null) return full;
    return full.slice(0, clampCount(stationCount, 1, STATION_TARGET_COUNT, STATION_TARGET_COUNT));
  }
  const byCode = new Map(
    stations.map((row) => [
      String(row.code || '').toUpperCase().trim(),
      String(row.name || '').trim(),
    ]),
  );
  const providedCodes = stations
    .map((row) => String(row.code || '').toUpperCase().trim())
    .filter((code) => CAMPUS_STATIONS.some((s) => s.code === code));
  const looksLikeFullCatalog = providedCodes.length >= STATION_TARGET_COUNT
    || CAMPUS_STATIONS.every((s) => byCode.has(s.code));

  if (looksLikeFullCatalog || stationCount != null) {
    const full = CAMPUS_STATIONS.map((station) => ({
      code: station.code,
      name: byCode.get(station.code) || station.name,
    }));
    if (stationCount == null) return full;
    return full.slice(0, clampCount(stationCount, 1, STATION_TARGET_COUNT, STATION_TARGET_COUNT));
  }

  // Active subset from parent (already sliced) — catalog order among provided codes.
  return CAMPUS_STATIONS
    .filter((station) => byCode.has(station.code))
    .map((station) => ({
      code: station.code,
      name: byCode.get(station.code) || station.name,
    }));
}

/**
 * Merge event overrides onto A–D starts; optionally slice to active count.
 * Short subsets (e.g. only start A) stay short unless startCount expands them.
 */
export function resolveStarts(starts, startCount = null) {
  const input = Array.isArray(starts) ? starts : [];
  const byCode = new Map(
    input.map((row) => [
      String(row.code || '').toUpperCase().trim().charAt(0),
      String(row.name || '').trim(),
    ]),
  );
  const providedCodes = [...byCode.keys()].filter((code) => (
    WAIT_POINTS.some((wait) => wait.code === code)
  ));
  const looksLikeFull = providedCodes.length >= WAIT_COUNT
    || WAIT_POINTS.every((wait) => byCode.has(wait.code));

  if (!input.length) {
    const full = WAIT_POINTS.map((wait) => ({
      code: wait.code,
      name: wait.name,
      description: wait.description,
    }));
    if (startCount == null) return full;
    return full.slice(0, clampCount(startCount, 1, WAIT_COUNT, WAIT_COUNT));
  }

  if (looksLikeFull || startCount != null) {
    const full = WAIT_POINTS.map((wait) => ({
      code: wait.code,
      name: byCode.get(wait.code) || wait.name,
      description: wait.description,
    }));
    if (startCount == null) return full;
    return full.slice(0, clampCount(startCount, 1, WAIT_COUNT, WAIT_COUNT));
  }

  return WAIT_POINTS
    .filter((wait) => byCode.has(wait.code))
    .map((wait) => ({
      code: wait.code,
      name: byCode.get(wait.code) || wait.name,
      description: wait.description,
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

/** Stable unique 3-digit code for global team (matches backend bootstrap). */
export function threeDigitCodeForTeam(waitIndex, localTeamNumber, teamsPerWait = TEAMS_PER_WAIT) {
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const teamNumber = (Math.max(0, Number(waitIndex) || 0) * perWait)
    + Math.max(1, Number(localTeamNumber) || 1);
  return String(100 + ((teamNumber * 73 + 19) % 900)).padStart(3, '0');
}

/** Global team number by wait + local slot. */
export function globalTeamNumber(waitIndex, localTeamNumber, teamsPerWait = TEAMS_PER_WAIT) {
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const wait = Math.max(0, Number(waitIndex) || 0) % WAIT_POINTS.length;
  const local = Math.max(1, Number(localTeamNumber) || 1);
  return wait * perWait + local;
}

/**
 * Arrival plan for a hunt stop index (0 = first / Clue 1, 1 = second / Clue 2…).
 */
export function stationArrivalPlan(
  stopOffset = 0,
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  const list = Array.isArray(stations) && stations.length
    ? stations
    : resolveStations(stations);
  const waitList = Array.isArray(starts) && starts.length
    ? starts
    : resolveStarts(starts);
  const step = Math.max(0, Number(stopOffset) || 0);
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  return list.map((station) => {
    const arrivals = [];
    waitList.forEach((start, waitIndex) => {
      for (let local = 1; local <= perWait; local += 1) {
        const dest = stationForLocalTeam(local, waitIndex, list, step);
        if (dest.code !== station.code) continue;
        const teamNumber = globalTeamNumber(waitIndex, local, perWait);
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
 * First Scan plan for active places.
 * Each place lists how many teams arrive and which starting point they left.
 */
export function firstStopArrivalPlan(
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  return stationArrivalPlan(0, stations, teamsPerWait, starts);
}

/** Clue 2 second-stop plan: same fan-out, one station after first stop. */
export function secondStopArrivalPlan(
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  return stationArrivalPlan(1, stations, teamsPerWait, starts);
}

/** Clue 3 third-stop plan: same fan-out, two stations after first stop. */
export function thirdStopArrivalPlan(
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  return stationArrivalPlan(2, stations, teamsPerWait, starts);
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

export function buildCampusStarts(
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  const list = resolveStations(stations);
  const waitList = resolveStarts(starts);
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  return waitList.map((wait, routeIndex) => ({
    ...wait,
    firstStops: Array.from(
      { length: perWait },
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
export const TEAM_SLOTS = buildTeamSlots(TEAMS_PER_WAIT);

/** Generic Clue 1 riddle for any campus station name. */
export function clue1ForPlace(place, teamSize = 4) {
  const station = CAMPUS_STATIONS.find(
    (s) => s.name.toLowerCase() === String(place || '').toLowerCase(),
  );
  const name = station?.name || place || 'the station';
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));
  return {
    prompt:
      `Your first scan is waiting on campus. Read the marks, follow the crowd of clues, `
      + `and name the place: ${name}.`,
    answer: name,
    destinationInstruction:
      `Go to ${name}. All ${people} members scan the shared QR, then enter your team code.`,
    hintText: `Ask staff for the way to ${name}.`,
  };
}

/** Clue 2 / 3 / Final defaults for a destination stop. */
export function routeClueDefaults(challengeNumber, destination, teamSize = 4) {
  const place = destination || 'the next station';
  const n = Number(challengeNumber) || 2;
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));

  if (n === 2) {
    return {
      prompt:
        'A staff mark hides in plain sight nearby. '
        + 'Scan the area at eye level — the code is a 3-digit number.',
      answer: '',
      hintText: 'Check posts, pillars, and notice boards at eye level.',
      destinationInstruction:
        'Go to your next location now. Find the shared green SECOND SCAN QR — '
        + `all ${people} members scan, then enter your team code to unlock Clue 3.`,
      memberPrompts: Array.from({ length: people }, () => ''),
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
        + `All ${people} members scan, then enter your team code to unlock Final.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  const raw = String(place).replace(/\s+/g, '').toUpperCase();
  const len = Math.max(people, raw.length);
  const padded = raw.padEnd(len, 'X');
  const size = Math.ceil(padded.length / people);
  const chunks = Array.from({ length: people }, (_, i) => (
    padded.slice(i * size, (i + 1) * size) || String(i + 1)
  ));
  return {
    prompt:
      'Each teammate has a code fragment on their phone. '
      + `Speak them in order 1→${people} and rebuild the one word. Leader submits it.`,
    answer: raw || 'QUEST',
    hintText: 'Say every code out loud in member order — no spaces in the final word.',
    destinationInstruction:
      'Word solved — report to your start location. Ask the organizer to mark your team reached.',
    memberPrompts: chunks,
  };
}

/** Where challenge 1–4 sends a team that waited at this start. */
export function destinationForClue(
  startCodeOrName,
  challengeNumber,
  localTeamNumber = 1,
  stations = CAMPUS_STATIONS,
  starts = WAIT_POINTS,
) {
  const waitList = resolveStarts(starts);
  const raw = String(startCodeOrName || '').toUpperCase().trim();
  const code = raw.match(/^([A-D])$/)?.[1]
    || raw.replace(/^START[-_\s]?/, '').match(/^([A-D])/)?.[1]
    || raw.charAt(0);
  const start = waitList.find((item) => item.code === code)
    || waitList.find((item) => item.name === startCodeOrName)
    || CAMPUS_STARTS.find((item) => item.code === code)
    || waitList[0]
    || CAMPUS_STARTS[0];
  const waitIndex = WAIT_POINTS.findIndex((item) => item.code === start.code);
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

/** Short path summary for a clue number across all waits. */
export function destinationsSummary(
  challengeNumber,
  stations = CAMPUS_STATIONS,
  teamsPerStation = TARGET_TEAMS_PER_STATION,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  const clue = Math.max(1, Math.min(4, Number(challengeNumber) || 1));
  const waitList = Array.isArray(starts) && starts.length ? starts : resolveStarts(starts);
  if (clue === 1 || clue === 2 || clue === 3) {
    const list = Array.isArray(stations) && stations.length
      ? stations
      : resolveStations(stations);
    return `${list.length} places · ~${teamsPerStation} teams each`;
  }
  return waitList.map((start) => (
    `${start.code} ${start.name} ← ${clue4WordForStart(start.code)} · ${teamsPerWait} teams`
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
