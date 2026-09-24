const { LEVEL_TEMPLATES } = require('./levelTemplates');

function cellKey(r, c) {
  return `${r},${c}`;
}

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function isAdjacent(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr + dc) === 1;
}

/** Row-by-row serpentine — always covers every cell. */
function serpentinePath(rows, cols) {
  const path = [];
  for (let r = 0; r < rows; r += 1) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c += 1) path.push({ r, c });
    } else {
      for (let c = cols - 1; c >= 0; c -= 1) path.push({ r, c });
    }
  }
  return path;
}

/** Column-by-column serpentine. */
function serpentineCols(rows, cols) {
  const path = [];
  for (let c = 0; c < cols; c += 1) {
    if (c % 2 === 0) {
      for (let r = 0; r < rows; r += 1) path.push({ r, c });
    } else {
      for (let r = rows - 1; r >= 0; r -= 1) path.push({ r, c });
    }
  }
  return path;
}

/**
 * Fast covering path: serpentine variants (no slow Hamiltonian DFS).
 * Optional walls punch holes; path is regenerated on the remaining rectangle
 * by treating walls as skipped — we only place walls that leave a single
 * serpentine corridor (wallCount used as difficulty flavor via blocked corners).
 */
function buildCoveringPath(rows, cols, walls, rng) {
  const wallSet = new Set(walls.map((w) => cellKey(w.r, w.c)));
  const variants = [
    serpentinePath(rows, cols),
    serpentineCols(rows, cols),
    [...serpentinePath(rows, cols)].reverse(),
    [...serpentineCols(rows, cols)].reverse(),
  ];

  for (const full of shuffle(variants, rng)) {
    const path = full.filter((p) => !wallSet.has(cellKey(p.r, p.c)));
    const freeCount = rows * cols - wallSet.size;
    if (path.length !== freeCount) continue;
    // Verify adjacency after wall filtering
    let ok = true;
    for (let i = 1; i < path.length; i += 1) {
      if (!isAdjacent(path[i - 1], path[i])) {
        ok = false;
        break;
      }
    }
    if (ok) return path;
  }

  // Guaranteed: no walls
  return serpentinePath(rows, cols);
}

function neighborCells(r, c, rows, cols, blocked) {
  const out = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < dirs.length; i += 1) {
    const nr = r + dirs[i][0];
    const nc = c + dirs[i][1];
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    if (blocked.has(cellKey(nr, nc))) continue;
    out.push({ r: nr, c: nc });
  }
  return out;
}

/**
 * Last two rounds: a winding fill instead of a straight row-snake,
 * so the numbered path is harder to see. Falls back to null if the
 * search budget runs out.
 */
function windingCover(rows, cols, walls, rng) {
  const blocked = new Set((walls || []).map((w) => cellKey(w.r, w.c)));
  const total = rows * cols - blocked.size;
  if (total < 2) return null;
  const seen = new Set();
  const path = [];
  let steps = 0;
  const budget = 14000;

  function openCount(r, c) {
    let n = 0;
    const cells = neighborCells(r, c, rows, cols, blocked);
    for (let i = 0; i < cells.length; i += 1) {
      if (!seen.has(cellKey(cells[i].r, cells[i].c))) n += 1;
    }
    return n;
  }

  function dfs(r, c) {
    steps += 1;
    if (steps > budget) return false;
    seen.add(cellKey(r, c));
    path.push({ r, c });
    if (path.length === total) return true;
    const next = neighborCells(r, c, rows, cols, blocked)
      .filter((cell) => !seen.has(cellKey(cell.r, cell.c)))
      .sort((a, b) => openCount(a.r, a.c) - openCount(b.r, b.c) || (rng() - 0.5));
    for (let i = 0; i < next.length; i += 1) {
      if (dfs(next[i].r, next[i].c)) return true;
      if (steps > budget) break;
    }
    path.pop();
    seen.delete(cellKey(r, c));
    return false;
  }

  const starts = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!blocked.has(cellKey(r, c))) starts.push({ r, c });
    }
  }
  const tries = shuffle(starts, rng).slice(0, 3);
  for (let i = 0; i < tries.length; i += 1) {
    steps = 0;
    seen.clear();
    path.length = 0;
    if (dfs(tries[i].r, tries[i].c)) return path.slice();
  }
  return null;
}

function pickEdgeWalls(rows, cols, wallCount, rng) {
  if (wallCount <= 0) return [];
  // Punch a few edge cells that row/column serpentines can still skip.
  // Prefer far edges so the fill path stays a single corridor.
  const candidates = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const edge = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
      const corner = (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
      if (edge && !corner) candidates.push({ r, c });
    }
  }
  return shuffle(candidates, rng).slice(0, Math.min(wallCount, candidates.length));
}

function placeWalls(rows, cols, wallCount, rng) {
  const picked = pickEdgeWalls(rows, cols, wallCount, rng);
  if (!picked.length) return [];
  // Only keep walls if at least one serpentine variant still covers the rest.
  const wallSet = picked;
  const probe = buildCoveringPath(rows, cols, wallSet, rng);
  const freeCount = rows * cols - wallSet.length;
  if (probe.length === freeCount) return wallSet;
  return [];
}

/**
 * Jitter number indices so two plays at different times land markers differently
 * on the same covering path (not always even spacing).
 */
function pickNumberCells(solutionPath, numberCount, rng = Math.random) {
  const n = Math.max(2, Math.min(numberCount, solutionPath.length));
  const indices = new Set([0, solutionPath.length - 1]);
  const midSlots = Math.max(0, n - 2);
  if (midSlots > 0 && solutionPath.length > 2) {
    const span = solutionPath.length - 2;
    for (let i = 1; i <= midSlots; i += 1) {
      const base = Math.round((i * span) / (midSlots + 1));
      const jitter = Math.floor((rng() - 0.5) * Math.max(2, span / (midSlots + 2)));
      let idx = Math.min(solutionPath.length - 2, Math.max(1, base + jitter));
      let guard = 0;
      while (indices.has(idx) && guard < 12) {
        idx = Math.min(solutionPath.length - 2, Math.max(1, idx + 1));
        guard += 1;
      }
      indices.add(idx);
    }
  }
  const ordered = [...indices].sort((a, b) => a - b).slice(0, n);
  if (ordered[0] !== 0) ordered.unshift(0);
  if (ordered[ordered.length - 1] !== solutionPath.length - 1) {
    ordered.push(solutionPath.length - 1);
  }
  const unique = [...new Set(ordered)].sort((a, b) => a - b);

  return unique.map((idx, i) => ({
    r: solutionPath[idx].r,
    c: solutionPath[idx].c,
    n: i + 1,
  }));
}

/** Time-bucketed seed so replays at different minutes get different boards. */
function timeSeed(base = Date.now()) {
  const d = new Date(base);
  return (
    Number(base)
    + d.getUTCHours() * 3600_000
    + d.getUTCMinutes() * 60_000
    + Math.floor(Math.random() * 1e9)
  );
}

function generatePuzzle(levelIndex, seed = Date.now()) {
  const template = LEVEL_TEMPLATES[levelIndex];
  if (!template) throw new Error('Invalid level');

  const rng = mulberry32(Number(seed) + (levelIndex + 1) * 9973);
  const { rows, cols, wallCount, numberCount, timeSeconds, points, label } = template;

  // Timer drift per generation — keep within a tight band so difficulty stays fair.
  const timeJitter = Math.floor((rng() - 0.5) * 12); // ±6s
  const timed = Math.max(50, Number(timeSeconds) + timeJitter);

  let walls = placeWalls(rows, cols, wallCount, rng);
  let solutionPath = buildCoveringPath(rows, cols, walls, rng);
  // Rounds 3 and 4: bend the fill and keep walls when a path still exists.
  if (levelIndex >= 2) {
    const hardWalls = pickEdgeWalls(rows, cols, wallCount, rng);
    const wound = windingCover(rows, cols, hardWalls, rng)
      || windingCover(rows, cols, [], rng);
    if (wound) {
      solutionPath = wound;
      walls = wound.length === rows * cols ? [] : hardWalls;
    }
  }
  const numbers = pickNumberCells(solutionPath, numberCount, rng);
  const start = { r: numbers[0].r, c: numbers[0].c };
  const end = { r: numbers[numbers.length - 1].r, c: numbers[numbers.length - 1].c };

  return {
    puzzleId: `zip-${levelIndex}-${seed}-${Math.floor(rng() * 9000 + 1000)}`,
    level: levelIndex + 1,
    label,
    rows,
    cols,
    start,
    end,
    numbers,
    required: numbers.map(({ r, c }) => ({ r, c })),
    walls,
    timeSeconds: timed,
    points,
    maxMoves: solutionPath.length,
    fillAll: true,
    solutionPath,
  };
}

function generateAllLevels(seedBase = timeSeed()) {
  return LEVEL_TEMPLATES.map((_, i) => generatePuzzle(i, seedBase + i * 7919));
}

function numberMap(puzzle) {
  const map = new Map();
  for (const cell of puzzle.numbers || []) {
    map.set(cellKey(cell.r, cell.c), cell.n);
  }
  return map;
}

/** Validate a Zip path: fill every free cell, numbers in order 1→N. */
function validatePath(puzzle, path) {
  if (!Array.isArray(path) || path.length < 2) {
    return { ok: false, message: 'Draw a path connecting every number in order.' };
  }

  const {
    rows, cols, start, end, walls = [], numbers = [], fillAll = true,
  } = puzzle;
  const wallSet = new Set(walls.map((w) => cellKey(w.r, w.c)));
  const freeCount = rows * cols - wallSet.size;
  const visited = new Set();
  const numAt = numberMap(puzzle);
  const ordered = [...numbers].sort((a, b) => a.n - b.n);
  let nextExpected = 1;

  const first = path[0];
  const last = path[path.length - 1];

  if (first.r !== start.r || first.c !== start.c) {
    return { ok: false, message: 'Path must begin at number 1.' };
  }
  if (last.r !== end.r || last.c !== end.c) {
    return { ok: false, message: `Path must end at number ${ordered[ordered.length - 1]?.n || 'last'}.` };
  }

  if (fillAll && path.length !== freeCount) {
    return {
      ok: false,
      message: `Fill every open cell (${path.length}/${freeCount}).`,
    };
  }

  for (let i = 0; i < path.length; i += 1) {
    const cell = path[i];
    if (cell.r < 0 || cell.r >= rows || cell.c < 0 || cell.c >= cols) {
      return { ok: false, message: 'Path goes outside the grid.' };
    }
    const key = cellKey(cell.r, cell.c);
    if (wallSet.has(key)) {
      return { ok: false, message: 'Path cannot cross blocked cells.' };
    }
    if (visited.has(key)) {
      return { ok: false, message: 'Path cannot reuse a cell.' };
    }
    visited.add(key);
    if (i > 0 && !isAdjacent(path[i - 1], cell)) {
      return { ok: false, message: 'Only horizontal and vertical steps allowed.' };
    }

    const num = numAt.get(key);
    if (num != null) {
      if (num !== nextExpected) {
        return { ok: false, message: `Visit numbers in order — next is ${nextExpected}.` };
      }
      nextExpected += 1;
    }
  }

  if (nextExpected <= ordered.length) {
    return { ok: false, message: 'Path must pass through every number in order.' };
  }

  return { ok: true, moves: path.length, points: Number(puzzle.points) || 0 };
}

function publicPuzzleView(puzzle) {
  return {
    puzzleId: puzzle.puzzleId,
    level: puzzle.level,
    label: puzzle.label,
    rows: puzzle.rows,
    cols: puzzle.cols,
    start: puzzle.start,
    end: puzzle.end,
    numbers: puzzle.numbers || [],
    required: puzzle.required || [],
    walls: puzzle.walls,
    timeSeconds: puzzle.timeSeconds,
    points: puzzle.points,
    maxMoves: puzzle.maxMoves,
    fillAll: Boolean(puzzle.fillAll),
  };
}

module.exports = {
  buildCoveringPath,
  generatePuzzle,
  generateAllLevels,
  validatePath,
  publicPuzzleView,
  cellKey,
  isAdjacent,
  serpentinePath,
};
