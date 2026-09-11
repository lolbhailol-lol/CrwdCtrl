/** Client-side Zip path helpers (mirrors server rules for UX). */

export function cellKey(r, c) {
  return `${r},${c}`;
}

export function isAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function isValidNext(path, cell, puzzle) {
  if (!puzzle) return false;
  const { rows, cols, walls = [], numbers = [] } = puzzle;
  if (cell.r < 0 || cell.r >= rows || cell.c < 0 || cell.c >= cols) return false;

  const wallSet = new Set(walls.map((w) => cellKey(w.r, w.c)));
  if (wallSet.has(cellKey(cell.r, cell.c))) return false;

  if (!path.length) {
    return cell.r === puzzle.start.r && cell.c === puzzle.start.c;
  }

  const last = path[path.length - 1];
  if (!isAdjacent(last, cell)) return false;
  if (path.some((p) => p.r === cell.r && p.c === cell.c)) return false;

  // Soft-check number order while drawing
  const numAt = new Map((numbers || []).map((n) => [cellKey(n.r, n.c), n.n]));
  const cellNum = numAt.get(cellKey(cell.r, cell.c));
  if (cellNum != null) {
    let nextExpected = 1;
    for (const p of path) {
      const n = numAt.get(cellKey(p.r, p.c));
      if (n != null) nextExpected = n + 1;
    }
    if (cellNum !== nextExpected) return false;
  }

  return true;
}

export function freeCellCount(puzzle) {
  if (!puzzle) return 0;
  const walls = puzzle.walls?.length || 0;
  return puzzle.rows * puzzle.cols - walls;
}

export function isCompletePath(path, puzzle) {
  if (!puzzle || path.length < 2) return false;
  const last = path[path.length - 1];
  const atEnd = last.r === puzzle.end.r && last.c === puzzle.end.c;
  const atStart = path[0].r === puzzle.start.r && path[0].c === puzzle.start.c;
  if (!atStart || !atEnd) return false;

  if (puzzle.fillAll !== false) {
    if (path.length !== freeCellCount(puzzle)) return false;
  }

  const numbers = [...(puzzle.numbers || [])].sort((a, b) => a.n - b.n);
  if (!numbers.length) return true;

  let nextExpected = 1;
  const visited = new Set();
  for (const cell of path) {
    const key = cellKey(cell.r, cell.c);
    if (visited.has(key)) return false;
    visited.add(key);
    const hit = numbers.find((n) => n.r === cell.r && n.c === cell.c);
    if (hit) {
      if (hit.n !== nextExpected) return false;
      nextExpected += 1;
    }
  }
  return nextExpected > numbers.length;
}

export function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Path trail hue — LinkedIn Zip vibes */
export function pathHue(index, total) {
  const t = total <= 1 ? 0 : index / (total - 1);
  return Math.round(195 + t * 85); // cyan → violet
}
