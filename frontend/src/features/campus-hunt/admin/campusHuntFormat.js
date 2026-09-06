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
    station: stationForLocalTeam(i + 1, 0, CAMPUS_STATIONS, 0, n),
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
      {
        name: String(row.name || '').trim(),
        plantFragments: Array.isArray(row.plantFragments) ? row.plantFragments : undefined,
        joinedWord: String(row.joinedWord || '').trim() || undefined,
      },
    ]),
  );
  const providedCodes = stations
    .map((row) => String(row.code || '').toUpperCase().trim())
    .filter((code) => CAMPUS_STATIONS.some((s) => s.code === code));
  const looksLikeFullCatalog = providedCodes.length >= STATION_TARGET_COUNT
    || CAMPUS_STATIONS.every((s) => byCode.has(s.code));

  if (looksLikeFullCatalog || stationCount != null) {
    const full = CAMPUS_STATIONS.map((station) => {
      const extra = byCode.get(station.code) || {};
      return {
        code: station.code,
        name: extra.name || station.name,
        ...(extra.plantFragments?.length ? { plantFragments: extra.plantFragments } : {}),
        ...(extra.joinedWord ? { joinedWord: extra.joinedWord } : {}),
      };
    });
    if (stationCount == null) return full;
    return full.slice(0, clampCount(stationCount, 1, STATION_TARGET_COUNT, STATION_TARGET_COUNT));
  }

  // Active subset from parent (already sliced) — catalog order among provided codes.
  return CAMPUS_STATIONS
    .filter((station) => byCode.has(station.code))
    .map((station) => {
      const extra = byCode.get(station.code) || {};
      return {
        code: station.code,
        name: extra.name || station.name,
        ...(extra.plantFragments?.length ? { plantFragments: extra.plantFragments } : {}),
        ...(extra.joinedWord ? { joinedWord: extra.joinedWord } : {}),
      };
    });
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

function gcd(a, b) {
  let x = Math.abs(Number(a) || 0);
  let y = Math.abs(Number(b) || 0);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Strides coprime to N → full unique orbits (no early loop). */
export function coprimeStrides(stationCount) {
  const n = Math.max(1, Number(stationCount) || 1);
  const out = [];
  for (let s = 1; s < n; s += 1) {
    if (gcd(s, n) === 1) out.push(s);
  }
  return out.length ? out : [1];
}

/**
 * 4 distinct place indices for one global team.
 * Layer 0 (first N teams): walk +1. Layer 1: walk next coprime stride (+3 on 10 places).
 * Stops Wait A·T2 and Wait B·T1 sharing the same 0→1→2→3 path.
 */
export function teamPathIndices(globalTeamIndex, stationCount, stopCount = 4) {
  const N = Math.max(1, Number(stationCount) || 1);
  const stops = Math.max(1, Math.min(N, Number(stopCount) || 4));
  const strides = coprimeStrides(N);
  const index = Math.max(0, Number(globalTeamIndex) || 0);
  const layer = Math.floor(index / N);
  const base = index % N;
  const stride = strides[layer % strides.length];
  const baseShift = Math.floor(layer / strides.length);
  const start = (base + baseShift) % N;
  const used = new Set();
  const path = [];
  for (let s = 0; s < stops; s += 1) {
    let idx = (start + s * stride) % N;
    let guard = 0;
    while (used.has(idx) && guard < N) {
      idx = (idx + 1) % N;
      guard += 1;
    }
    used.add(idx);
    path.push(idx);
  }
  return path;
}

export function globalTeamIndex(waitIndex, localTeamNumber, teamsPerWait = TEAMS_PER_WAIT) {
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const wait = Math.max(0, Number(waitIndex) || 0);
  const local = Math.max(1, Number(localTeamNumber) || 1);
  return wait * perWait + (local - 1);
}

/**
 * Local team → station for stopOffset (0=Clue1 … 3=Clue4).
 * Paths are unique across starts when teams ≤ places × coprime strides.
 */
export function stationForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  stopOffset = 0,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  const list = resolveStations(stations);
  if (!list.length) return null;
  const path = teamPathIndices(
    globalTeamIndex(waitIndex, localTeamNumber, teamsPerWait),
    list.length,
    4,
  );
  const step = Math.max(0, Math.min(path.length - 1, Number(stopOffset) || 0));
  return list[path[step]];
}

export function firstStopForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 0, teamsPerWait)?.name || '';
}

export function secondStopForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 1, teamsPerWait)?.name || '';
}

export function thirdStopForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 2, teamsPerWait)?.name || '';
}

export function fourthStopForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 3, teamsPerWait)?.name || '';
}

/** Full Orange→Green→Blue→Purple path for one local slot at a start. */
export function teamHuntPath(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  const list = resolveStations(stations);
  const indices = teamPathIndices(
    globalTeamIndex(waitIndex, localTeamNumber, teamsPerWait),
    list.length,
    4,
  );
  return indices.map((idx) => list[idx]).filter(Boolean);
}

/**
 * Audit every team path: unique routes, no self-loops, balanced place load.
 */
export function analyzeHuntPaths(
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  const list = resolveStations(stations);
  const waitList = resolveStarts(starts);
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const rows = [];
  const pathOwners = new Map();
  const load = [0, 1, 2, 3].map(() => Object.fromEntries(list.map((s) => [s.code, 0])));

  waitList.forEach((start, waitIndex) => {
    for (let local = 1; local <= perWait; local += 1) {
      const path = teamHuntPath(local, waitIndex, list, perWait);
      const codes = path.map((s) => s.code);
      const key = codes.join('→');
      const teamNumber = globalTeamNumber(waitIndex, local, perWait);
      const loop = new Set(codes).size < codes.length;
      path.forEach((station, stop) => {
        if (load[stop][station.code] != null) load[stop][station.code] += 1;
      });
      if (!pathOwners.has(key)) pathOwners.set(key, []);
      pathOwners.get(key).push(teamNumber);
      rows.push({
        teamNumber,
        startCode: start.code,
        startName: start.name,
        localTeamNumber: local,
        waveId: `T${local}`,
        path,
        pathKey: key,
        pathLabels: path.map((s) => s.name),
        loop,
      });
    }
  });

  const clashGroups = [...pathOwners.entries()]
    .filter(([, teams]) => teams.length > 1)
    .map(([pathKey, teams]) => ({ pathKey, teams }));
  const loopTeams = rows.filter((r) => r.loop).map((r) => r.teamNumber);
  const uniquePaths = pathOwners.size;
  const ok = clashGroups.length === 0 && loopTeams.length === 0;

  return {
    ok,
    teamCount: rows.length,
    uniquePaths,
    clashGroups,
    loopTeams,
    load,
    rows,
    stationCount: list.length,
    startCount: waitList.length,
  };
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
        const dest = stationForLocalTeam(local, waitIndex, list, step, perWait);
        if (!dest || dest.code !== station.code) continue;
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

/** Clue 4 fourth-stop plan: same fan-out, three stations after first stop. */
export function fourthStopArrivalPlan(
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  return stationArrivalPlan(3, stations, teamsPerWait, starts);
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
      (_, i) => firstStopForLocalTeam(i + 1, routeIndex, list, perWait),
    ),
    routeStops: routeStopsForWait(routeIndex, list),
  }));
}

export const CAMPUS_STARTS = buildCampusStarts();

/** Final one-word answers per start path (A–D) — Clue 5. */
export const CLUE5_WORDS = {
  A: 'QUEST',
  B: 'BLAZE',
  C: 'SPARK',
  D: 'PRIDE',
};

/** @deprecated use CLUE5_WORDS */
export const CLUE4_WORDS = CLUE5_WORDS;

const PROP_CODES = [
  'BANANA', 'WOOF', 'NEON', 'QUACK', 'SOCK', 'EGG', 'YEET', 'ZOOM',
  'BLOOP', 'ZAP', 'GOOF', 'BONK', 'YIKES', 'NOPE', 'YAY', 'BOOP',
];

/** Default planted prop sticker code — matches backend bootstrap rotation. */
export function propCodeForTeam(stationIndex, localTeamNumber) {
  const i = (Number(stationIndex) || 0) * 11 + (Number(localTeamNumber) || 1);
  return PROP_CODES[Math.abs(i) % PROP_CODES.length];
}

export function clue5WordForStart(startCode) {
  const code = String(startCode || 'A').toUpperCase().charAt(0);
  return CLUE5_WORDS[code] || 'QUEST';
}

/** @deprecated use clue5WordForStart */
export function clue4WordForStart(startCode) {
  return clue5WordForStart(startCode);
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
      `Go to ${name} together. Find ${people} written clues nearby, join them into one word, `
      + 'type it on the leader phone, then scan the orange QR once and enter your team code.',
    hintText: `Ask staff for the way to ${name}.`,
  };
}

/** Clue 2 / 3 / 4 / Final defaults for a destination stop. */
export function routeClueDefaults(challengeNumber, destination, teamSize = 4) {
  const place = destination || 'the next station';
  const n = Number(challengeNumber) || 2;
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));

  if (n === 2) {
    return {
      prompt:
        `At the green stop: find ${people} short clues written nearby. `
        + 'Join them into one word and type it (leader).',
      answer: '',
      hintText: 'Look at eye level on posts, pillars, and notice boards — then join the pieces.',
      destinationInstruction:
        `Word typed — stay at green. Leader scans the green QR once, then enter your team code to unlock Clue 3.`,
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
        `Go to that place together. Find ${people} written clues, join the word, type it, then leader scans the blue QR once and enters your team code.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  if (n === 4) {
    return {
      prompt:
        `At ${place}: find ${people} written clues (or prop tags) nearby. `
        + 'Join them into one word and type it (leader).',
      answer: '',
      hintText: 'Look near the purple QR zone — eye / knee level.',
      destinationInstruction:
        `Word typed — stay at ${place}. Leader scans the purple QR once, then team code for Final.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  // Clue 5 / Final — collaborative one-word; `place` is the finish word.
  const raw = String(place).replace(/\s+/g, '').toUpperCase();
  const len = Math.max(people, raw.length);
  const padded = raw.padEnd(len, 'X');
  const size = Math.ceil(padded.length / people);
  const chunks = Array.from({ length: people }, (_, i) => (
    padded.slice(i * size, (i + 1) * size) || String(i + 1)
  ));
  return {
    prompt:
      `Fragments are on the leader phone — read them aloud in order 1→${people} and rebuild the one word. Leader submits it.`,
    answer: raw || 'QUEST',
    hintText: 'Say every fragment out loud in order — no spaces in the final word.',
    destinationInstruction:
      'Word solved — report to your start location. Ask the organizer to mark your team reached.',
    memberPrompts: chunks,
  };
}

/** Where challenge 1–5 sends a team that waited at this start. */
export function destinationForClue(
  startCodeOrName,
  challengeNumber,
  localTeamNumber = 1,
  stations = CAMPUS_STATIONS,
  starts = WAIT_POINTS,
  teamsPerWait = TEAMS_PER_WAIT,
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
  const waitIndex = waitList.findIndex((item) => item.code === start.code);
  const wait = waitIndex >= 0 ? waitIndex : 0;
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const clue = Math.max(1, Math.min(5, Number(challengeNumber) || 1));
  if (clue === 1) {
    return firstStopForLocalTeam(localTeamNumber, wait, stations, perWait);
  }
  if (clue === 2) {
    return secondStopForLocalTeam(localTeamNumber, wait, stations, perWait);
  }
  if (clue === 3) {
    return thirdStopForLocalTeam(localTeamNumber, wait, stations, perWait);
  }
  if (clue === 4) {
    return fourthStopForLocalTeam(localTeamNumber, wait, stations, perWait);
  }
  // Clue 5 / Final: teams return to their own start (not another campus station).
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
  const clue = Math.max(1, Math.min(5, Number(challengeNumber) || 1));
  const waitList = Array.isArray(starts) && starts.length ? starts : resolveStarts(starts);
  if (clue === 1 || clue === 2 || clue === 3 || clue === 4) {
    const list = Array.isArray(stations) && stations.length
      ? stations
      : resolveStations(stations);
    const audit = analyzeHuntPaths(list, teamsPerWait, waitList);
    const clashNote = audit.ok
      ? `${audit.uniquePaths} unique team paths · no clashes`
      : `${audit.clashGroups.length} path clash(es) — rebuild clues`;
    return `${list.length} places · ~${teamsPerStation} teams each · ${clashNote}`;
  }
  return waitList.map((start) => (
    `${start.code} ${start.name} ← ${clue5WordForStart(start.code)} · ${teamsPerWait} teams`
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
