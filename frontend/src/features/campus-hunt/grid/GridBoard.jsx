import { useCallback, useEffect, useRef } from 'react';
import { cellKey, isValidNext, pathHue } from './gridUtils';

export default function GridBoard({
  puzzle,
  path,
  onPathChange,
  disabled = false,
  hintCell = null,
}) {
  const drawing = useRef(false);
  // Keep path in a ref so fast pointer moves never apply an older trail
  // (stale React closures were snapping the draw back to a previous entry).
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    drawing.current = false;
    pathRef.current = [];
  }, [puzzle?.puzzleId]);

  const tryAddCell = useCallback((r, c) => {
    if (disabled || !puzzle) return;
    const cell = { r, c };
    const current = pathRef.current || [];
    if (!isValidNext(current, cell, puzzle)) return;
    const next = [...current, cell];
    pathRef.current = next;
    onPathChange(next);
  }, [disabled, onPathChange, puzzle]);

  const handlePointerDown = (r, c) => {
    if (disabled || !puzzle) return;
    drawing.current = true;
    const current = pathRef.current || [];
    if (current.length === 0) {
      if (r === puzzle.start.r && c === puzzle.start.c) {
        const next = [{ r, c }];
        pathRef.current = next;
        onPathChange(next);
      }
      return;
    }
    // Allow restart from start if tapping 1 again
    if (r === puzzle.start.r && c === puzzle.start.c && current.length > 1) {
      const next = [{ r, c }];
      pathRef.current = next;
      onPathChange(next);
      return;
    }
    tryAddCell(r, c);
  };

  const handlePointerEnter = (r, c) => {
    if (!drawing.current || disabled) return;
    tryAddCell(r, c);
  };

  const handlePointerUp = () => {
    drawing.current = false;
  };

  if (!puzzle) return null;

  const pathIndex = new Map(path.map((p, i) => [cellKey(p.r, p.c), i]));
  const wallSet = new Set((puzzle.walls || []).map((w) => cellKey(w.r, w.c)));
  const numAt = new Map((puzzle.numbers || []).map((n) => [cellKey(n.r, n.c), n.n]));
  const hintKey = hintCell ? cellKey(hintCell.r, hintCell.c) : null;

  const cells = [];
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const key = cellKey(r, c);
      const isWall = wallSet.has(key);
      const onPath = pathIndex.has(key);
      const idx = pathIndex.get(key);
      const num = numAt.get(key);
      const isHint = hintKey === key && !onPath;

      let style = {};
      let tone = 'border-white/10 bg-[#141820]';
      if (isWall) {
        tone = 'cursor-not-allowed border-transparent bg-[#050608]';
      } else if (onPath) {
        const hue = pathHue(idx, Math.max(path.length, 2));
        style = {
          background: `linear-gradient(145deg, hsl(${hue} 85% 48%), hsl(${hue + 20} 90% 38%))`,
          borderColor: `hsl(${hue} 90% 70%)`,
          boxShadow: `0 0 18px hsl(${hue} 90% 50% / 0.45)`,
          animation: 'zipPulse 1.2s ease-in-out infinite',
          animationDelay: `${(idx % 8) * 0.05}s`,
        };
        tone = 'border-transparent text-white';
      } else if (isHint) {
        tone = 'border-amber-300/80 bg-amber-400/25 zip-hint-glow';
      } else if (num != null) {
        tone = 'border-white/25 bg-gradient-to-br from-[#1e2430] to-[#12151c]';
      }

      cells.push(
        <button
          key={`${puzzle.puzzleId}-${key}`}
          type="button"
          disabled={disabled || isWall}
          onPointerDown={(e) => { e.preventDefault(); handlePointerDown(r, c); }}
          onPointerEnter={() => handlePointerEnter(r, c)}
          onPointerUp={handlePointerUp}
          style={style}
          className={`relative aspect-square rounded-xl border-2 transition-transform duration-150 ${tone} ${
            disabled ? 'opacity-55' : 'active:scale-95 hover:scale-[1.03]'
          }`}
        >
          {isWall && (
            <span className="absolute inset-0 flex items-center justify-center text-lg text-white/15">▣</span>
          )}
          {num != null && (
            <span
              className={`absolute inset-0 flex items-center justify-center ${
                onPath ? 'text-white drop-shadow' : 'text-white'
              }`}
            >
              <span
                className={`flex h-[62%] w-[62%] items-center justify-center rounded-full text-[clamp(0.7rem,2.8vw,1.05rem)] font-black ${
                  onPath
                    ? 'bg-black/25'
                    : 'bg-white text-[#0b1020] shadow-[0_4px_14px_rgba(0,0,0,0.35)]'
                }`}
              >
                {num}
              </span>
            </span>
          )}
          {isHint && num == null && (
            <span className="absolute inset-0 flex items-center justify-center text-amber-200">✦</span>
          )}
        </button>,
      );
    }
  }

  return (
    <div
      className="zip-board mx-auto w-full max-w-md select-none touch-none rounded-2xl p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`,
        gap: '7px',
        background: 'linear-gradient(160deg, rgba(139,92,246,0.2), rgba(14,204,238,0.12), rgba(251,146,60,0.1))',
      }}
      onPointerLeave={handlePointerUp}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {cells}
      <style>{`
        @keyframes zipPulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.12); }
        }
        .zip-hint-glow {
          animation: zipHint 0.9s ease-in-out infinite;
        }
        @keyframes zipHint {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.45); }
          50% { box-shadow: 0 0 18px 4px rgba(251, 191, 36, 0.55); }
        }
      `}</style>
    </div>
  );
}
