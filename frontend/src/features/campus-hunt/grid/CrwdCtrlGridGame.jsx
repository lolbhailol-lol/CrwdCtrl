import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GridBoard from './GridBoard';
import { formatTime, freeCellCount, isCompletePath } from './gridUtils';
import PoweredByCrwdCtrl from '../components/PoweredByCrwdCtrl';
import {
  fetchGridSession,
  submitGridLevel,
  timeoutGridLevel,
  useGridHint as requestGridHint,
  useGridUndo as requestGridUndo,
} from '../services/campusHunt.api';

function copyText(text, onDone) {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => onDone?.()).catch(() => {});
}

function ScorePills({
  breakdown = [],
  score = 0,
  maxScore = 140,
  hintsUsed = 0,
  undosUsed = 0,
  clearsUsed = 0,
  hintCost = 20,
  clearCost = 10,
  currentLevel = 1,
  totalLevels = 4,
}) {
  const tones = [
    'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
    'border-sky-400/25 bg-sky-500/10 text-sky-100',
    'border-violet-400/25 bg-violet-500/10 text-violet-100',
    'border-orange-400/25 bg-orange-500/10 text-orange-100',
  ];
  const rows = breakdown.length
    ? breakdown
    : [
      { level: 1, label: 'Easy', maxPoints: 20, pointsAwarded: 0 },
      { level: 2, label: 'Medium', maxPoints: 30, pointsAwarded: 0 },
      { level: 3, label: 'Difficult', maxPoints: 40, pointsAwarded: 0 },
      { level: 4, label: 'Hard', maxPoints: 50, pointsAwarded: 0 },
    ];
  const cleared = rows.filter((r) => r.completed || r.failed || r.timedOut).length;
  const progressPct = Math.min(100, Math.round((cleared / Math.max(1, totalLevels || rows.length)) * 100));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
          Zip progress
        </p>
        <p className="font-mono text-xl font-black text-white">
          {score}
          <span className="text-sm font-semibold text-white/40"> / {maxScore}</span>
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-white/45">
          <span>
            Round {Math.min(currentLevel, totalLevels)} of {totalLevels}
          </span>
          <span>
            {cleared}/{totalLevels} done
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-violet-400 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {rows.map((row, i) => {
          let tone = tones[i] || 'border-white/10 bg-white/5 text-white/50';
          if (row.completed) tone = 'border-emerald-400/50 bg-emerald-500/20 text-emerald-50';
          else if (row.failed || row.timedOut) tone = 'border-rose-400/40 bg-rose-500/15 text-rose-100';
          else if (Number(row.level) === Number(currentLevel)) {
            tone = `${tones[i] || tone} ring-1 ring-white/35`;
          }
          return (
            <div key={row.level} className={`rounded-xl border px-1.5 py-2 text-center ${tone}`}>
              <p className="text-[9px] font-bold uppercase tracking-wide truncate">
                {row.label || `R${row.level}`}
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                {row.completed || row.failed || row.timedOut
                  ? `+${row.pointsAwarded}`
                  : row.maxPoints}
              </p>
            </div>
          );
        })}
      </div>
      {(hintsUsed > 0 || undosUsed > 0 || clearsUsed > 0) && (
        <p className="text-center text-[11px] text-amber-200/80">
          {[
            hintsUsed > 0 ? `Hints ${hintsUsed} × −${hintCost}` : '',
            undosUsed > 0 ? `Undos ${undosUsed} × −${hintCost}` : '',
            clearsUsed > 0 ? `Clear ${clearsUsed} × −${clearCost}` : '',
          ].filter(Boolean).join(' · ')}
          {` = −${(hintsUsed + undosUsed) * hintCost + clearsUsed * clearCost} pts`}
        </p>
      )}
    </div>
  );
}

export default function CrwdCtrlGridGame({ sessionToken, initialData, onComplete, onSwitchTeam }) {
  const [data, setData] = useState(initialData);
  const [path, setPath] = useState([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hintCell, setHintCell] = useState(null);
  const [timeLeft, setTimeLeft] = useState(initialData?.puzzle?.timeSeconds || 300);
  const [levelFlash, setLevelFlash] = useState(null);
  const timeoutSent = useRef(false);
  const clockPuzzleRef = useRef(null);
  const clockRemainingRef = useRef(null);

  const puzzle = data?.puzzle;
  const canSubmit = useMemo(() => isCompletePath(path, puzzle), [path, puzzle]);
  const filled = path.length;
  const need = freeCellCount(puzzle);

  // Never carry a drawn trail into the next level / fresh puzzle.
  useEffect(() => {
    setPath([]);
    setHintCell(null);
    timeoutSent.current = false;
  }, [puzzle?.puzzleId]);

  useEffect(() => {
    if (!puzzle?.timeSeconds || data?.completed) return undefined;
    timeoutSent.current = false;
    const startedMs = data?.levelStartedAt
      ? new Date(data.levelStartedAt).getTime()
      : Date.now();
    const limit = data?.levelTimeSeconds ?? puzzle.timeSeconds;
    const compute = () => Math.max(0, limit - Math.floor((Date.now() - startedMs) / 1000));
    const remaining = Number.isFinite(Number(data?.levelTimeRemaining))
      ? Math.max(0, Number(data.levelTimeRemaining))
      : compute();
    // Publish the new round's clock before any timeout check. A leftover 0
    // from the previous round must not mark this round timed out.
    clockPuzzleRef.current = puzzle.puzzleId;
    clockRemainingRef.current = remaining;
    setTimeLeft(remaining);
    const id = setInterval(() => {
      const left = compute();
      clockRemainingRef.current = left;
      setTimeLeft(left);
    }, 250);
    return () => clearInterval(id);
  }, [
    puzzle?.puzzleId,
    puzzle?.timeSeconds,
    data?.levelStartedAt,
    data?.levelTimeRemaining,
    data?.levelTimeSeconds,
    data?.completed,
    data?.currentLevel,
  ]);

  const refresh = useCallback(async () => {
    const res = await fetchGridSession(sessionToken);
    setData(res.data);
    setPath([]);
    setHintCell(null);
    if (res.data?.levelTimeRemaining != null) {
      setTimeLeft(res.data.levelTimeRemaining);
    }
    return res.data;
  }, [sessionToken]);

  // Auto-advance when timer hits 0 (0 pts for level, continue / finish)
  useEffect(() => {
    if (clockPuzzleRef.current !== puzzle?.puzzleId) return undefined;
    if (clockRemainingRef.current !== 0) return undefined;
    if (data?.completed || timeLeft !== 0 || busy || timeoutSent.current) return undefined;
    timeoutSent.current = true;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await timeoutGridLevel(sessionToken);
        if (cancelled) return;
        const payload = res.data;
        const view = payload.view || null;
        if (view) setData(view);
        else await refresh();
        setPath([]);
        setHintCell(null);
        if (payload.allLevelsComplete || view?.completed) {
          setLevelFlash({ kind: 'fail', text: 'Time up · Zip done' });
          setFeedback(payload.message || 'Time up — your GRID code is ready.');
          onComplete?.(payload.completionCode || view?.completionCode, payload.score ?? view?.score);
        } else {
          setLevelFlash({ kind: 'fail', text: 'Time up · next round' });
          setFeedback(payload.message || 'Time up — next round unlocked.');
        }
      } catch (err) {
        if (!cancelled) {
          setFeedback(err.message || 'Could not advance level');
          if (err.data?.view) setData(err.data.view);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [timeLeft, data?.completed, busy, sessionToken, refresh, onComplete, puzzle?.puzzleId]);

  useEffect(() => {
    if (!levelFlash) return undefined;
    const id = setTimeout(() => setLevelFlash(null), 1600);
    return () => clearTimeout(id);
  }, [levelFlash]);

  const chargeUndo = async (steps, { clear = false } = {}) => {
    const res = await requestGridUndo(sessionToken, steps, { clear });
    const payload = res.data;
    if (payload?.view) setData(payload.view);
    setFeedback(
      payload?.message
      || (clear
        ? `Clear −${payload?.clearCost || 10}`
        : `Undo −${payload?.undoCost || 20}`),
    );
    return payload;
  };

  const handleUndo = async () => {
    if (busy || timeLeft === 0 || path.length === 0) return;
    setBusy(true);
    try {
      await chargeUndo(1);
      setPath(path.length <= 1 ? [] : path.slice(0, -1));
      setHintCell(null);
    } catch (err) {
      setFeedback(err.message || 'Undo failed');
      if (err.data?.view) setData(err.data.view);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (busy) return;
    if (path.length === 0) {
      setHintCell(null);
      setFeedback('');
      return;
    }
    if (timeLeft === 0) return;
    setBusy(true);
    try {
      await chargeUndo(1, { clear: true });
      setPath([]);
      setHintCell(null);
    } catch (err) {
      setFeedback(err.message || 'Clear failed');
      if (err.data?.view) setData(err.data.view);
    } finally {
      setBusy(false);
    }
  };

  const handleHint = async () => {
    if (busy || timeLeft === 0) return;
    setBusy(true);
    setFeedback('');
    try {
      const res = await requestGridHint(sessionToken, path);
      const payload = res.data;
      if (payload.view) setData(payload.view);
      setHintCell(payload.nextCell || null);
      setFeedback(payload.message || 'Hint used (−20 pts)');
    } catch (err) {
      setFeedback(err.message || 'Hint failed');
      if (err.data?.view) setData(err.data.view);
      else if (err.data) setData(err.data);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      const res = await submitGridLevel(sessionToken, path);
      const payload = res.data;
      if (payload.view) setData(payload.view);
      if (payload.allLevelsComplete) {
        setLevelFlash({ kind: 'win', text: `+${payload.pointsAwarded || 0} · Done!` });
        setFeedback(`All levels finished! Score ${payload.score}`);
        onComplete?.(payload.completionCode, payload.score);
        if (!payload.view) void refresh();
      } else if (payload.levelComplete) {
        setLevelFlash({ kind: 'win', text: `Level clear · +${payload.pointsAwarded || 0}` });
        setFeedback(`Level cleared! +${payload.pointsAwarded || 0} pts · Total ${payload.score}`);
        setPath([]);
        setHintCell(null);
        if (!payload.view) void refresh();
      } else {
        setFeedback(res.message || 'Try again.');
      }
    } catch (err) {
      setFeedback(err.message || 'Submit failed');
      if (err.data?.view) setData(err.data.view);
      else if (err.data) setData(err.data);
      if (err.data?.timedOut || err.data?.advanced) {
        setPath([]);
        setHintCell(null);
        if (!err.data?.view) void refresh().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  if (data?.completed && data?.completionCode) {
    const breakdown = data.levelBreakdown || [];
    const solvedCount = breakdown.filter((row) => row.completed).length;
    const timedCount = breakdown.filter((row) => row.timedOut || (row.failed && !row.completed)).length;
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div
          className="overflow-hidden rounded-3xl border border-emerald-400/30 p-6 text-center"
          style={{
            background: 'radial-gradient(circle at top, rgba(16,185,129,0.25), rgba(11,12,13,0.95) 55%)',
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Zip complete</p>
          <h2 className="mt-2 text-3xl font-black text-white">Game finished</h2>
          <p className="mt-2 text-sm text-white/65">
            {solvedCount} of {breakdown.length || data.totalLevels || 4} rounds solved
            {timedCount > 0 ? ` · ${timedCount} timed out` : ''}
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
            <p className="text-[10px] uppercase tracking-wide text-white/45">Your grid score</p>
            <p className="font-mono text-5xl font-black text-[#0ECCEE]">{data.score ?? 0}</p>
            <p className="mt-1 text-xs text-white/45">max {data.maxScore ?? 140}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
            {breakdown.map((row) => (
              <div
                key={row.level}
                className={`rounded-xl border px-2 py-2 ${
                  row.completed
                    ? 'border-emerald-400/40 bg-emerald-500/15'
                    : 'border-rose-400/30 bg-rose-500/10'
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-white/60">
                  {row.label || `Round ${row.level}`}
                </p>
                <p className="font-mono text-lg font-bold text-white">
                  {row.pointsAwarded}
                  <span className="text-xs text-white/40">/{row.maxPoints}</span>
                </p>
                <p className="text-[10px] text-white/45">
                  {row.completed ? 'Solved' : (row.timedOut || row.failed ? 'Time up' : '0')}
                </p>
              </div>
            ))}
          </div>

          {((data.hintsUsed > 0) || (data.undosUsed > 0) || (data.clearsUsed > 0)) && (
            <div className="mt-3 space-y-1 text-xs text-amber-200">
              {data.hintsUsed > 0 && (
                <p>−{data.hintsUsed * (data.hintCost || 20)} from {data.hintsUsed} hint(s)</p>
              )}
              {data.undosUsed > 0 && (
                <p>−{data.undosUsed * (data.undoCost || data.hintCost || 20)} from {data.undosUsed} undo(s)</p>
              )}
              {data.clearsUsed > 0 && (
                <p>−{data.clearsUsed * (data.clearCost || 10)} from {data.clearsUsed} clear(s)</p>
              )}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/10 px-4 py-4">
            <p className="text-[10px] uppercase tracking-wide text-white/50">
              Give this code to your Team Leader
            </p>
            <p className="mt-1 font-mono text-3xl font-black tracking-[0.2em] text-[#0ECCEE]">
              {data.completionCode}
            </p>
            <button
              type="button"
              onClick={() => copyText(data.completionCode, () => setFeedback('Code copied'))}
              className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Copy code
            </button>
          </div>
          {feedback && <p className="mt-3 text-xs text-emerald-200">{feedback}</p>}
        </div>
        {onSwitchTeam && (
          <button
            type="button"
            onClick={onSwitchTeam}
            className="w-full text-center text-xs text-white/45 underline hover:text-white/70"
          >
            Use different team code
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex w-full max-w-lg flex-col gap-4">
      {levelFlash && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-8 z-20 mx-auto w-fit rounded-full px-5 py-2 text-sm font-black shadow-lg ${
            levelFlash.kind === 'win'
              ? 'bg-emerald-400 text-black'
              : 'bg-rose-500 text-white'
          }`}
          style={{ animation: 'zipToast 1.5s ease forwards' }}
        >
          {levelFlash.text}
        </div>
      )}

      <header
        className="rounded-3xl border border-violet-400/25 px-4 py-3"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(14,204,238,0.12), rgba(6,4,15,0.95))',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">{data?.teamLabel || data?.teamCode || 'Team'}</p>
            <p className="mt-0.5 text-[11px] text-white/50">
              Round {data?.currentLevel || 1} of {data?.totalLevels || 4}
            </p>
          </div>
          <div className="text-right">
            <p className={`font-mono text-3xl font-black tabular-nums ${
              timeLeft <= 15 ? 'text-rose-400 animate-pulse' : 'text-white'
            }`}
            >
              {formatTime(timeLeft)}
            </p>
            <p className="text-[11px] text-white/50">
              Fill {filled}/{need || '—'}
            </p>
          </div>
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">
          <ScorePills
            breakdown={data?.levelBreakdown}
            score={data?.score || 0}
            maxScore={data?.maxScore || 140}
            hintsUsed={data?.hintsUsed || 0}
            undosUsed={data?.undosUsed || 0}
            clearsUsed={data?.clearsUsed || 0}
            hintCost={data?.hintCost || data?.undoCost || 20}
            clearCost={data?.clearCost || 10}
            currentLevel={data?.currentLevel || 1}
            totalLevels={data?.totalLevels || 4}
          />
        </div>
      </header>

      <GridBoard
        puzzle={puzzle}
        path={path}
        onPathChange={(next) => {
          setPath(next);
          setHintCell(null);
        }}
        disabled={busy || timeLeft === 0}
        hintCell={hintCell}
      />

      {feedback && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-white/85">
          {feedback}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={handleReset}
          disabled={busy || path.length === 0 || timeLeft === 0}
          className="rounded-xl border border-rose-400/25 py-3 text-xs font-bold uppercase tracking-wide text-rose-100/80 disabled:opacity-40"
        >
          Clear −{data?.clearCost || 10}
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={busy || path.length === 0 || timeLeft === 0}
          className="rounded-xl border border-rose-400/35 bg-rose-500/10 py-3 text-xs font-bold uppercase tracking-wide text-rose-100 disabled:opacity-40"
        >
          Undo −{data?.undoCost || data?.hintCost || 20}
        </button>
        <button
          type="button"
          onClick={handleHint}
          disabled={busy || timeLeft === 0}
          className="rounded-xl border border-amber-400/40 bg-amber-500/15 py-3 text-xs font-bold uppercase tracking-wide text-amber-100 disabled:opacity-40"
        >
          Hint −{data?.hintCost || 20}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || busy || timeLeft === 0}
          className="rounded-xl bg-gradient-to-r from-[#0ECCEE] to-violet-400 py-3 text-xs font-black uppercase tracking-wide text-black disabled:opacity-40"
        >
          {busy ? '…' : 'Submit'}
        </button>
      </div>

      <PoweredByCrwdCtrl />

      {onSwitchTeam && (
        <button
          type="button"
          onClick={onSwitchTeam}
          className="text-center text-xs text-white/40 underline hover:text-white/65"
        >
          Use different team code
        </button>
      )}

      <style>{`
        @keyframes zipToast {
          0% { opacity: 0; transform: translateY(-8px) scale(0.96); }
          15% { opacity: 1; transform: translateY(0) scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
