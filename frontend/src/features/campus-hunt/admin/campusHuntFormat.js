/**
 * Campus Hunt Round 1 — simple layout
 *
 *   20 teams · 20 campus locations · 5 clues · 6th clue → destination
 *
 * Each team walks a unique 5-stop path (one location per clue 1–5).
 * Clue 6 sends every team to the shared destination.
 *
 * One phone per team (leader only): solve clues, scan posters, enter codes.
 * Teammates walk along — no member phones required.
 *
 * Optional starting points (default: 1 gather point) are hold-only.
 */

/** Shared finale after Clue 6 (Neurosprint 25 final lobby). */
export const DESTINATION_PLACE = {
  code: 'DEST',
  name: 'Mindspark Lobby',
  description: 'All teams check in here after Clue 6 — above the auditorium.',
};

/** How many campus stops before the destination clue. */
export const PATH_STOP_COUNT = 5;

/** Default event size for the simple layout. */
export const DEFAULT_TEAM_CAPACITY = 20;

/**
 * 20 COEP hunt places from Neurosprint 25 (last year sheet).
 * `riddle` → Clue 1 prompt; answer is the station `name`.
 * `zone` → north / south / common for path balance notes.
 */
export const CAMPUS_STATIONS = [
  {
    code: 'S01',
    name: 'Jet Engine',
    zone: 'north',
    riddle:
      'I roar without a voice, I fly without wings,\n'
      + 'Fuel and thrust are my favorite things.\n'
      + 'I don’t move now, but once I could soar,\n'
      + 'Find me to start your hunt and explore.',
  },
  {
    code: 'S05',
    name: 'Mathematics Department',
    zone: 'south',
    riddle:
      'Where numbers speak and symbols play,\n'
      + 'Equations guide the learning way.\n'
      + 'A place of logic, sharp and bright,\n'
      + 'Your clue is waiting within your sight.',
  },
  {
    code: 'S02',
    name: 'ENTC Building',
    zone: 'north',
    riddle:
      'Where signals travel and circuits hum,\n'
      + 'Behind where the parked cars come,\n'
      + 'Look not at the front, but behind the scene,\n'
      + 'Your next clue rests where machines convene.',
  },
  {
    code: 'S06',
    name: 'Metallurgy Garden',
    zone: 'south',
    riddle:
      'Where iron rests and steel is strong,\n'
      + 'This garden has seen metals all along.\n'
      + 'Search near the bench where shade is cast,\n'
      + 'Your next clue waits — don’t walk past.',
  },
  {
    code: 'S03',
    name: 'Boat Club Canteen',
    zone: 'north',
    riddle:
      'Hungry minds and hungry friends meet,\n'
      + 'By the waters, where you find a seat.\n'
      + 'Between snacks and sips so sweet,\n'
      + 'Search beneath the bench where two paths meet.',
  },
  {
    code: 'S07',
    name: 'Geology Museum',
    zone: 'south',
    riddle:
      'Stones tell stories from ages ago,\n'
      + 'Fossils and crystals in quiet rows.\n'
      + 'Look near the corner where the old rocks stay,\n'
      + 'Your next clue will guide you on the way.',
  },
  {
    code: 'S04',
    name: 'Chemistry Labs',
    zone: 'north',
    riddle:
      'Here flames can burn but not to cook,\n'
      + 'Colored solutions fill every nook.\n'
      + 'Where reactions bubble, fizz, and play,\n'
      + 'Find this place of science today.',
  },
  {
    code: 'S09',
    name: 'Visvesvaraya Statue',
    zone: 'south',
    riddle:
      'A mind of steel, a vision so wide,\n'
      + 'An engineer’s pride, standing outside.\n'
      + 'On this very campus, once he did stay,\n'
      + 'Find the statue that honors his day.',
  },
  {
    code: 'S10',
    name: 'Bhau Institute',
    zone: 'north',
    riddle:
      'Dreams take flight and ideas ignite,\n'
      + 'Here, startups are given the light.\n'
      + 'Built by alumni with vision so true,\n'
      + 'Find the hub where businesses grew.',
  },
  {
    code: 'S11',
    name: 'Fountain',
    zone: 'south',
    riddle:
      'I never rest, I never sleep,\n'
      + 'I bubble and rise, though I am deep.\n'
      + 'Find me where water likes to play,\n'
      + 'Your next clue splashes the way.',
  },
  {
    code: 'S14',
    name: 'ENTC Extension Garden',
    zone: 'north',
    riddle:
      'Where three buildings form a gentle square,\n'
      + 'A gazebo waits in the open air.\n'
      + 'A quiet spot where people rest,\n'
      + 'Your clue is waiting — go find the best.',
  },
  {
    code: 'S12',
    name: 'Library Pillar',
    zone: 'south',
    riddle:
      'Where knowledge is kept in a silent hall,\n'
      + 'And students gather to answer learning’s call.\n'
      + 'Find the first column near the main grand door,\n'
      + 'A sturdy support that stands before.',
  },
  {
    code: 'S18',
    name: 'Old CS Building',
    zone: 'north',
    riddle:
      'Where binary language was first understood,\n'
      + 'The place where the digital foundation stood.\n'
      + 'A classic old building, its age you can see,\n'
      + 'Go there to find your next mystery.',
  },
  {
    code: 'S13',
    name: 'Fab Lab',
    zone: 'south',
    riddle:
      'A workshop of wonders, tools abound,\n'
      + 'Where dreams take shape and parts are found.\n'
      + 'If you seek where makers play,\n'
      + 'Find the lab that builds today.',
  },
  {
    code: 'S15',
    name: 'Alumni Association',
    zone: 'south',
    riddle:
      'They studied here, they built their way,\n'
      + 'Their footprints guide us still today.\n'
      + 'In this place their stories stay,\n'
      + 'Find the clue where alumni lay.',
  },
  {
    code: 'S19',
    name: 'NCC',
    zone: 'north',
    riddle:
      'With discipline sharp and uniforms neat,\n'
      + 'Cadets march proudly with steady feet.\n'
      + 'If you can match their steps in line,\n'
      + 'The next clue you’ll surely find.',
  },
  {
    code: 'S16',
    name: 'Gate No. 2',
    zone: 'south',
    riddle:
      'Not the front, but still a way,\n'
      + 'Where shortcuts lead you out each day.\n'
      + 'Look for the clue where exits are few,\n'
      + 'And find what’s waiting just for you.',
  },
  {
    code: 'S08',
    name: 'Subway',
    zone: 'common',
    riddle:
      'I run below the ground, yet I’m no train,\n'
      + 'A secret path through sun or rain.\n'
      + 'North and South I softly bind,\n'
      + 'Step inside and see what you find.',
  },
  {
    code: 'S17',
    name: 'Xerox Center',
    zone: 'south',
    riddle:
      'Pages appear though none are written,\n'
      + 'A magic box where copies are given.\n'
      + 'Black and white or colored too,\n'
      + 'Find this place — it waits for you.',
  },
  {
    code: 'S20',
    name: 'Civil Department',
    zone: 'south',
    riddle:
      'Strong as stone, and built to last,\n'
      + 'The oldest branch, a link to the past.\n'
      + 'From bridges to roads, its wisdom flows,\n'
      + 'Find where the first foundation grows.',
  },
];

export const STATION_TARGET_COUNT = CAMPUS_STATIONS.length; // 20

/** Clue 2 — always 2 numbered digit slips (join → type the number). */
export const CLUE2_DIGIT_SLIPS = 2;

/** Shared 2-digit answers per place for Clue 2 digit slips. */
export const DEFAULT_STATION_DIGIT_ANSWERS = Object.fromEntries(
  CAMPUS_STATIONS.map((s, i) => [
    s.code,
    String(10 + ((i * 17 + 3) % 90)).padStart(2, '0'),
  ]),
);

/** Split a digit answer into exactly `slipCount` numbered slips (default 2). */
export function splitDigitSlips(answer, slipCount = CLUE2_DIGIT_SLIPS) {
  const n = Math.max(2, Math.min(4, Number(slipCount) || CLUE2_DIGIT_SLIPS));
  const digits = String(answer || '').replace(/\D/g, '') || '47';
  const padded = digits.length >= n ? digits : digits.padStart(n, '0');
  if (padded.length === n) return padded.split('');
  const size = Math.ceil(padded.length / n);
  return Array.from({ length: n }, (_, i) => (
    padded.slice(i * size, (i + 1) * size) || '0'
  ));
}

/**
 * Shared join-word per place — used for letter plants / legacy.
 * Clue 2 digit answers use DEFAULT_STATION_DIGIT_ANSWERS instead.
 */
export const DEFAULT_STATION_JOINED_WORDS = {
  S01: 'THRUSTJET',
  S05: 'CALCULUS',
  S02: 'SIGNALHUB',
  S06: 'FORGESTEEL',
  S03: 'ANCHORBOAT',
  S07: 'FOSSILROCK',
  S04: 'REACTANTS',
  S09: 'ENGINEER',
  S10: 'STARTUPHUB',
  S11: 'WATERSPRAY',
  S14: 'GAZEBOPARK',
  S12: 'BOOKSTACKS',
  S18: 'BINARYCODE',
  S13: 'MAKERSPACE',
  S15: 'ALUMNIBOND',
  S19: 'MARCHDRILL',
  S16: 'SIDEENTRY',
  S08: 'UNDERPASS',
  S17: 'COPYPRINTS',
  S20: 'FOUNDATION',
};

export function splitPlantFragments(joinedWord, teamSize = 4) {
  const people = Math.max(2, Math.min(12, Number(teamSize) || 4));
  const raw = String(joinedWord || 'QUEST').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'QUEST';
  const len = Math.max(people, raw.length);
  const padded = raw.padEnd(len, 'X');
  const size = Math.ceil(padded.length / people);
  return Array.from({ length: people }, (_, i) => (
    padded.slice(i * size, (i + 1) * size) || 'X'
  ));
}

export function withStationPlantDefaults(stations, teamSize = 4) {
  const people = Math.max(2, Math.min(12, Number(teamSize) || 4));
  return (Array.isArray(stations) ? stations : []).map((row) => {
    const code = String(row?.code || '').toUpperCase().trim();
    const joinedWord = String(row?.joinedWord || DEFAULT_STATION_JOINED_WORDS[code] || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    const existing = Array.isArray(row?.plantFragments)
      ? row.plantFragments.map((f) => String(f || '').trim()).filter(Boolean)
      : [];
    const plantFragments = existing.length >= people
      ? existing.slice(0, people)
      : (joinedWord ? splitPlantFragments(joinedWord, people) : existing);
    return {
      ...row,
      code,
      ...(joinedWord ? { joinedWord } : {}),
      ...(plantFragments.length ? { plantFragments } : {}),
    };
  });
}
/** Ideal: 1 team per location when capacity === station count. */
export const TARGET_TEAMS_PER_STATION = 1;
export const TEAMS_PER_WAIT = DEFAULT_TEAM_CAPACITY; // one gather point by default
export const WAIT_COUNT = 4; // max configurable starts

/** Starting / gather points (hold only). Default event uses the first one. */
export const WAIT_POINTS = [
  {
    code: 'A',
    name: 'Library',
    description: 'Gather point — teams wait here for the start code.',
  },
  {
    code: 'B',
    name: 'Chanakya Porch',
    description: 'Optional second gather point.',
  },
  {
    code: 'C',
    name: 'Design',
    description: 'Optional third gather point.',
  },
  {
    code: 'D',
    name: 'Vyas Parking',
    description: 'Optional fourth gather point.',
  },
];

/** @deprecated alias */
export const CAMPUS_BUILDINGS = WAIT_POINTS.map((w) => w.name);

function clampCount(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Suggested layout: prefer 1 team per place, one gather point for ≤20 teams. */
export function suggestHuntLayout(teamCapacity = DEFAULT_TEAM_CAPACITY) {
  const capacity = clampCount(teamCapacity, 2, 200, DEFAULT_TEAM_CAPACITY);
  const stationCount = Math.max(1, Math.min(STATION_TARGET_COUNT, capacity));
  let startCount = 1;
  if (capacity > 20) startCount = 2;
  if (capacity > 30) startCount = 3;
  if (capacity > 40) startCount = 4;
  return { startCount, stationCount };
}

/**
 * Clue / schedule geometry from overall team count + active starts/places.
 * Baseline 20 → 1 gather · 20 places · 1 team per place · 5 path stops + destination.
 */
export function deriveClueGeometry(teamCapacity = DEFAULT_TEAM_CAPACITY, teamSize = 10, layout = {}) {
  const capacity = Math.max(2, Math.min(200, Math.round(Number(teamCapacity) || DEFAULT_TEAM_CAPACITY)));
  const size = Math.max(2, Math.min(12, Math.round(Number(teamSize) || 10)));
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
    pathStopCount: PATH_STOP_COUNT,
    destinationName: DESTINATION_PLACE.name,
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
 * If `stations` is already a shorter active subset (e.g. S01–S05), keep that subset —
 * do not expand back to all 20 unless stationCount asks for more.
 */
export function resolveStations(stations, stationCount = null, teamSize = 4) {
  if (!Array.isArray(stations) || !stations.length) {
    const full = withStationPlantDefaults(
      CAMPUS_STATIONS.map((s) => ({ ...s })),
      teamSize,
    );
    if (stationCount == null) return full;
    return full.slice(0, clampCount(stationCount, 1, STATION_TARGET_COUNT, STATION_TARGET_COUNT));
  }
  const byCode = new Map(
    stations.map((row) => [
      String(row.code || '').toUpperCase().trim(),
      {
        name: String(row.name || '').trim(),
        zone: String(row.zone || '').trim() || undefined,
        riddle: String(row.riddle || '').trim() || undefined,
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
    const full = withStationPlantDefaults(
      CAMPUS_STATIONS.map((station) => {
        const extra = byCode.get(station.code) || {};
        return {
          code: station.code,
          name: extra.name || station.name,
          zone: extra.zone || station.zone,
          riddle: extra.riddle || station.riddle,
          ...(extra.plantFragments?.length ? { plantFragments: extra.plantFragments } : {}),
          ...(extra.joinedWord ? { joinedWord: extra.joinedWord } : {}),
        };
      }),
      teamSize,
    );
    if (stationCount == null) return full;
    return full.slice(0, clampCount(stationCount, 1, STATION_TARGET_COUNT, STATION_TARGET_COUNT));
  }

  // Active subset from parent (already sliced) — catalog order among provided codes.
  return withStationPlantDefaults(
    CAMPUS_STATIONS
      .filter((station) => byCode.has(station.code))
      .map((station) => {
        const extra = byCode.get(station.code) || {};
        return {
          code: station.code,
          name: extra.name || station.name,
          zone: extra.zone || station.zone,
          riddle: extra.riddle || station.riddle,
          ...(extra.plantFragments?.length ? { plantFragments: extra.plantFragments } : {}),
          ...(extra.joinedWord ? { joinedWord: extra.joinedWord } : {}),
        };
      }),
    teamSize,
  );
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
 * Distinct place indices for one global team (default 5 path stops).
 * Layer 0 (first N teams): walk +1. Layer 1: next coprime stride.
 * When `zones` is provided, paths are repaired inside each N-team layer
 * so north/south alternate when possible — without stacking teams on the
 * same place at the same stop (swaps only).
 */
export function teamPathIndices(
  globalTeamIndex,
  stationCount,
  stopCount = PATH_STOP_COUNT,
  zones = null,
) {
  const N = Math.max(1, Number(stationCount) || 1);
  const stops = Math.max(1, Math.min(N, Number(stopCount) || PATH_STOP_COUNT));
  const index = Math.max(0, Number(globalTeamIndex) || 0);
  if (!Array.isArray(zones) || zones.length !== N) {
    return baseTeamPathIndices(index, N, stops);
  }
  const layer = Math.floor(index / N);
  const table = zoneBalancedLayerPaths(N, stops, zones, layer);
  return table[index % N].slice();
}

function baseTeamPathIndices(index, N, stops) {
  const strides = coprimeStrides(N);
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

const zonePathLayerCache = new Map();

function zoneBalancedLayerPaths(N, stops, zones, layer) {
  const key = `${N}|${stops}|${layer}|${zones.join(',')}`;
  if (zonePathLayerCache.has(key)) return zonePathLayerCache.get(key);

  const paths = [];
  for (let local = 0; local < N; local += 1) {
    paths.push(baseTeamPathIndices(layer * N + local, N, stops));
  }

  const zoneAt = (i) => String(zones[i] || '').toLowerCase();
  const conflict = (path, s) => {
    if (s <= 0) return false;
    const prev = zoneAt(path[s - 1]);
    const cur = zoneAt(path[s]);
    if (!prev || !cur || prev === 'common' || cur === 'common') return false;
    return prev === cur;
  };
  const wouldDup = (path, s, nextIdx) => path.some((idx, i) => i !== s && idx === nextIdx);

  for (let s = 1; s < stops; s += 1) {
    let improved = true;
    let guard = 0;
    while (improved && guard < N * 3) {
      improved = false;
      guard += 1;
      for (let t = 0; t < N; t += 1) {
        if (!conflict(paths[t], s)) continue;
        let bestU = -1;
        let bestScore = 0;
        for (let u = 0; u < N; u += 1) {
          if (u === t) continue;
          const tNew = paths[u][s];
          const uNew = paths[t][s];
          if (wouldDup(paths[t], s, tNew) || wouldDup(paths[u], s, uNew)) continue;
          const tBefore = conflict(paths[t], s);
          const uBefore = conflict(paths[u], s);
          const tAfterPrev = zoneAt(paths[t][s - 1]);
          const uAfterPrev = zoneAt(paths[u][s - 1]);
          const tZ = zoneAt(tNew);
          const uZ = zoneAt(uNew);
          const tAfter = Boolean(
            tAfterPrev
            && tZ
            && tAfterPrev !== 'common'
            && tZ !== 'common'
            && tAfterPrev === tZ,
          );
          const uAfter = Boolean(
            uAfterPrev
            && uZ
            && uAfterPrev !== 'common'
            && uZ !== 'common'
            && uAfterPrev === uZ,
          );
          // Prefer swaps that clear t's streak and do not create one for u.
          let score = 0;
          if (tBefore && !tAfter) score += 2;
          if (uBefore && !uAfter) score += 2;
          if (!uBefore && uAfter) score -= 3;
          if (score > bestScore) {
            bestScore = score;
            bestU = u;
          }
        }
        if (bestU >= 0) {
          const tmp = paths[t][s];
          paths[t][s] = paths[bestU][s];
          paths[bestU][s] = tmp;
          improved = true;
        }
      }
    }
  }

  zonePathLayerCache.set(key, paths);
  return paths;
}

export function globalTeamIndex(waitIndex, localTeamNumber, teamsPerWait = TEAMS_PER_WAIT) {
  const perWait = Math.max(1, Number(teamsPerWait) || TEAMS_PER_WAIT);
  const wait = Math.max(0, Number(waitIndex) || 0);
  const local = Math.max(1, Number(localTeamNumber) || 1);
  return wait * perWait + (local - 1);
}

/**
 * Local team → station for stopOffset (0=Clue1 … 4=Clue5).
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
    PATH_STOP_COUNT,
    list.map((s) => s.zone),
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

export function fifthStopForLocalTeam(
  localTeamNumber,
  waitIndex = 0,
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
) {
  return stationForLocalTeam(localTeamNumber, waitIndex, stations, 4, teamsPerWait)?.name || '';
}

/** Full Clue1→…→Clue5 path for one local slot at a start. */
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
    PATH_STOP_COUNT,
    list.map((s) => s.zone),
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
  const load = Array.from({ length: PATH_STOP_COUNT }, () => (
    Object.fromEntries(list.map((s) => [s.code, 0]))
  ));

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

  let maxZoneStreak = 0;
  let zoneStreak3 = 0;
  rows.forEach((row) => {
    const zones = row.path.map((s) => String(s.zone || '').toLowerCase());
    let cur = 1;
    let best = 1;
    for (let i = 1; i < zones.length; i += 1) {
      if (
        zones[i]
        && zones[i] === zones[i - 1]
        && zones[i] !== 'common'
      ) {
        cur += 1;
      } else {
        cur = 1;
      }
      best = Math.max(best, cur);
    }
    maxZoneStreak = Math.max(maxZoneStreak, best);
    if (best >= 3) zoneStreak3 += 1;
  });

  const loadMaxPerStop = load.map((stopLoad) => Math.max(0, ...Object.values(stopLoad)));
  const maxTeamsAtOnePlace = Math.max(0, ...loadMaxPerStop);
  const teamsPerPlaceIdeal = waitList.length; // one team per start per place per stop
  const loadOk = loadMaxPerStop.every((m) => m <= teamsPerPlaceIdeal);
  const ok = clashGroups.length === 0 && loopTeams.length === 0 && loadOk;

  return {
    ok,
    teamCount: rows.length,
    uniquePaths,
    clashGroups,
    loopTeams,
    load,
    loadMaxPerStop,
    maxTeamsAtOnePlace,
    maxZoneStreak,
    zoneStreak3,
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
      joinedWord: station.joinedWord || DEFAULT_STATION_JOINED_WORDS[station.code] || '',
      plantFragments: Array.isArray(station.plantFragments) ? station.plantFragments : [],
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

/** Clue 5 fifth-stop plan: four stations after first stop. */
export function fifthStopArrivalPlan(
  stations = CAMPUS_STATIONS,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  return stationArrivalPlan(4, stations, teamsPerWait, starts);
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
 * Clues 2–5 path per wait (offset so routes fan out across the 20 stations).
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

const LOCKBOX_CODES = [
  '9407', '3815', '7264', '1598', '6032', '8471', '2956', '4713',
  '5180', '0629', '7346', '1864', '2538', '6901', '8142', '3075',
];

/** Default Lockbox digit code — matches backend bootstrap rotation. */
export function lockboxCodeForTeam(stationIndex, localTeamNumber) {
  const i = (Number(stationIndex) || 0) * 11 + (Number(localTeamNumber) || 1);
  return LOCKBOX_CODES[Math.abs(i) % LOCKBOX_CODES.length];
}

const GRID_CODES = [
  'GRID-A7K2', 'GRID-B3M9', 'GRID-C4P1', 'GRID-D8Q5',
  'GRID-E2R6', 'GRID-F9S3', 'GRID-G1T8', 'GRID-H5U4',
  'GRID-J6V7', 'GRID-K3W2', 'GRID-L8X9', 'GRID-M4Y1',
  'GRID-N7Z5', 'GRID-P2A6', 'GRID-Q9B3', 'GRID-R5C8',
];

/** Default Field Terminal GRID code — matches backend bootstrap rotation. */
export function propCodeForTeam(stationIndex, localTeamNumber) {
  const i = (Number(stationIndex) || 0) * 11 + (Number(localTeamNumber) || 1);
  return GRID_CODES[Math.abs(i) % GRID_CODES.length];
}

export function gridCodeForTeam(stationIndex, localTeamNumber) {
  return propCodeForTeam(stationIndex, localTeamNumber);
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

/** Generic Clue 1 riddle for any campus station name (Neurosprint riddle when known). */
export function clue1ForPlace(placeOrStation, teamSize = 4) {
  const code = typeof placeOrStation === 'object'
    ? String(placeOrStation?.code || '').toUpperCase().trim()
    : '';
  const nameHint = typeof placeOrStation === 'object'
    ? String(placeOrStation?.name || '').trim()
    : String(placeOrStation || '').trim();
  const catalog = CAMPUS_STATIONS.find((s) => (
    (code && s.code === code)
    || s.name.toLowerCase() === nameHint.toLowerCase()
    || s.code.toLowerCase() === nameHint.toLowerCase()
  ));
  const name = nameHint || catalog?.name || 'the station';
  const people = Math.max(2, Math.min(12, Number(teamSize) || 4));
  const riddle = String(
    (typeof placeOrStation === 'object' && placeOrStation?.riddle)
    || catalog?.riddle
    || '',
  ).trim();
  return {
    prompt: riddle
      || (
        `Your first scan is waiting on campus. Read the marks, follow the crowd of clues, `
        + `and name the place: ${name}.`
      ),
    answer: name,
    acceptedAnswers: [name, catalog?.name].filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i),
    destinationInstruction:
      `Go to ${name} together. Leader scans the orange FIRST SCAN QR once to unlock Clue 2.`,
    hintText: riddle
      ? `Think of a landmark that matches the poem — then go to ${name}.`
      : `Ask staff for the way to ${name}.`,
  };
}

/** Clue 2–6 defaults for a destination stop / finish word / lockbox code. */
export function routeClueDefaults(
  challengeNumber,
  destination,
  teamSize = 4,
  fifthStopName = null,
  lockboxCode = null,
) {
  const place = destination || 'the next station';
  const n = Number(challengeNumber) || 2;
  const people = Math.max(2, Math.min(12, Number(teamSize) || 4));

  if (n === 2) {
    return {
      prompt:
        'At the green stop: find 2 numbered digit slips (1 and 2) planted nearby. '
        + 'Join them in order into one number and type it (leader), then scan green.',
      answer: '',
      hintText: 'Two slips only — digit 1 then digit 2. Eye level on posts.',
      destinationInstruction:
        'Answer typed — stay at green. Leader scans the green QR once to unlock Clue 3.',
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  if (n === 3) {
    const code = String(lockboxCode || '').replace(/\D/g, '') || '9407';
    const pieces = Array.from({ length: people }, (_, i) => (
      i === 0
        ? 'Lead the search for the single LOCKBOX plaque nearby (full code on one card).'
        : 'Help search — look under ledges / behind boards. Do not invent digits.'
    ));
    return {
      prompt:
        `THE LOCKBOX · hard find (not digit slips)\n`
        + `One LOCKBOX plaque is hidden near this blue stop — full ${code.length}-digit code on a single card.\n`
        + `It is NOT the numbered green slips. Search quietly (ledges, behind boards, under benches).\n`
        + `Leader types digits only (2 tries · hints cost more).`,
      answer: code,
      hintText:
        'Not numbered slips. One plaque · full code. Check ledges and the back of notice boards. −25 pts.',
      destinationInstruction:
        `Lockbox open — go to ${place}. Find the shared blue THIRD SCAN QR. `
        + `Leader scans once to unlock Field Terminal.`,
      memberPrompts: pieces,
    };
  }

  if (n === 4) {
    return {
      prompt:
        `FIELD TERMINAL at ${place}.\n`
        + 'Borrow any laptop with internet. Open Zip Grid, type your device key from this phone, '
        + 'clear the levels, then type the GRID-XXXX code the laptop shows (leader submits).',
      answer: '',
      hintText:
        'Borrow a laptop → device key on this phone → Zip Grid → GRID-XXXX back here.',
      destinationInstruction:
        `GRID accepted — stay at ${place}. Leader scans the purple QR once to unlock Clue 5.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  if (n === 6) {
    return {
      prompt:
        `Your path is done. Go to ${place} as a full team.\n`
        + 'Ask the organizer for the finish code, then type it here to lock your score.',
      answer: '',
      hintText: `Meet at ${place}. The organizer will tell you the finish code.`,
      destinationInstruction:
        `At ${place}: ask the organizer for the finish code and type it on this phone.`,
      memberPrompts: Array.from({ length: people }, () => ''),
    };
  }

  // Clue 5 — letter slips → one WORD (not digits).
  const raw = String(place).replace(/\s+/g, '').toUpperCase();
  const fifthStop = String(fifthStopName || '').trim() || 'your 5th campus stop';
  const findTasks = Array.from({ length: people }, (_, i) => (
    `Find letter slip #${i + 1} nearby — letters only, piece ${i + 1} of ${people}.`
  ));
  return {
    prompt:
      `At the red stop: find ${people} letter slips planted nearby `
      + `(not digits — letters that make one word).\n`
      + `Join them in order into one word. Leader submits (2 tries · hints cost more).\n`
      + `Letters are NOT on this phone.`,
    answer: raw || 'QUEST',
    hintText:
      'Letters only · eye-level boards. Build one word, no spaces. Hints cost 30 pts.',
    destinationInstruction:
      `Word solved — go to ${fifthStop}. Find the shared red FIFTH SCAN QR. `
      + `Leader scans once to unlock Clue 6.`,
    memberPrompts: findTasks,
  };
}

/** Where challenge 1–6 sends a team that waited at this start. */
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
  const clue = Math.max(1, Math.min(6, Number(challengeNumber) || 1));
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
  if (clue === 5) {
    return fifthStopForLocalTeam(localTeamNumber, wait, stations, perWait);
  }
  // Clue 6 — shared destination for every team.
  return DESTINATION_PLACE.name;
}

/** Short path summary for a clue number across all waits. */
export function destinationsSummary(
  challengeNumber,
  stations = CAMPUS_STATIONS,
  teamsPerStation = TARGET_TEAMS_PER_STATION,
  teamsPerWait = TEAMS_PER_WAIT,
  starts = WAIT_POINTS,
) {
  const clue = Math.max(1, Math.min(6, Number(challengeNumber) || 1));
  const waitList = Array.isArray(starts) && starts.length ? starts : resolveStarts(starts);
  if (clue === 6) {
    return `Everyone → ${DESTINATION_PLACE.name}`;
  }
  if (clue >= 1 && clue <= 5) {
    const list = Array.isArray(stations) && stations.length
      ? stations
      : resolveStations(stations);
    const audit = analyzeHuntPaths(list, teamsPerWait, waitList);
    const clashNote = audit.ok
      ? `${audit.uniquePaths} unique team paths · no clashes`
      : `${audit.clashGroups.length} path clash(es) — rebuild clues`;
    return (
      `${list.length} places · stop ${clue}/5 · `
      + `${teamsPerStation === 1 ? '1 team each' : `~${teamsPerStation} teams each`} · ${clashNote}`
    );
  }
  return waitList.map((start) => (
    `${start.code} ${start.name} · ${teamsPerWait} teams`
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
