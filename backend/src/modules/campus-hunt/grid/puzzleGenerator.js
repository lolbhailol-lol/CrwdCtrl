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

function placeWalls(rows, cols, wallCount, rng) {
  if (wallCount <= 0) return [];
  // Only punch corner/edge pairs that serpentine can skip while staying connected —
  // safest: place walls at opposite corners so row-serpentine still works? It doesn't.
  // Keep walls empty for reliable fill-all Zip; difficulty comes from size + numbers.
  void rows;
  void cols;
  void rng;
  void wallCount;
  return [];
}

function pickNumberCells(solutionPath, numberCount) {
  const n = Math.max(2, Math.min(numberCount, solutionPath.length));
  const indices = [];
  for (let i = 0; i < n; i += 1) {
    const idx = Math.round((i * (solutionPath.length - 1)) / (n - 1));
    indices.push(idx);
  }
  const unique = [];
  for (const idx of indices) {
    if (!unique.includes(idx)) unique.push(idx);
  }
  if (unique[0] !== 0) unique.unshift(0);
  if (unique[unique.length - 1] !== solutionPath.length - 1) {
    unique.push(solutionPath.length - 1);
  }

  return unique.map((idx, i) => ({
    r: solutionPath[idx].r,
    c: solutionPath[idx].c,
    n: i + 1,
  }));
}

function generatePuzzle(levelIndex, seed = Date.now()) {
  const template = LEVEL_TEMPLATES[levelIndex];
  if (!template) throw new Error('Invalid level');

  const rng = mulberry32(Number(seed) + (levelIndex + 1) * 9973);
  const { rows, cols, wallCount, numberCount, timeSeconds, points, label } = template;

  const walls = placeWalls(rows, cols, wallCount, rng);
  const solutionPath = buildCoveringPath(rows, cols, walls, rng);
  const numbers = pickNumberCells(solutionPath, numberCount);
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
    timeSeconds,
    points,
    maxMoves: solutionPath.length,
    fillAll: true,
    solutionPath,
  };
}

function generateAllLevels(seedBase = Date.now() + Math.floor(Math.random() * 1e9)) {
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
