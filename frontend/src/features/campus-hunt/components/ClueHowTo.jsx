import { useState } from 'react';

/**
 * Collapsible How-to + scoring legend for each clue.
 */
export default function ClueHowTo({ challenge }) {
  const [open, setOpen] = useState(true);
  if (!challenge) return null;

  const howTo = challenge.howTo;
  const n = challenge.challengeNumber;
  const attemptBands = challenge.attemptBands || [];
  const scoringBands = challenge.scoringBands || [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">
          {howTo?.title || `How to — Clue ${n}`}
        </span>
        <span className="text-xs text-white/40">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-3 py-3 text-xs text-white/75">
          {howTo?.steps?.length > 0 && (
            <ol className="list-decimal space-y-1 pl-4">
              {howTo.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}

          {n === 1 && attemptBands.length > 0 && (
            <div className="rounded-lg bg-black/30 px-3 py-2">
              <p className="mb-1 font-semibold text-white/90">Points by attempt</p>
              <ul className="space-y-0.5">
                {attemptBands.map((b) => (
                  <li key={b.attempt}>
                    Attempt {b.attempt} correct → <span className="text-[#0ECCEE]">{b.points} pts</span>
                  </li>
                ))}
                <li>After 3 wrong → location revealed, <span className="text-amber-200">0 pts</span></li>
              </ul>
              {challenge.state === 'ACTIVE' && (
                <p className="mt-2 text-white/60">
                  Attempts left: {challenge.attemptsLeft ?? '—'}
                  {challenge.nextAttemptPoints != null && (
                    <> · Next correct = <span className="text-[#0ECCEE]">{challenge.nextAttemptPoints} pts</span></>
                  )}
                </p>
              )}
            </div>
          )}

          {n === 2 && scoringBands.length > 0 && (
            <div className="rounded-lg bg-black/30 px-3 py-2">
              <p className="mb-1 font-semibold text-white/90">Points by time</p>
              <ul className="space-y-0.5">
                <li>≤ 1:00 → 50 pts</li>
                <li>≤ 2:00 → 30 pts</li>
                <li>≤ 5:00 → 10 pts</li>
                <li>After 5:00 → answer accepted, 0 pts</li>
              </ul>
            </div>
          )}

          {n === 3 && (
            <div className="rounded-lg bg-black/30 px-3 py-2">
              <p className="font-semibold text-white/90">Scoring</p>
              <p className="mt-1">Correct solve awards base points. Hints cost points.</p>
            </div>
          )}

          {n === 4 && (
            <div className="rounded-lg bg-black/30 px-3 py-2">
              <p className="font-semibold text-white/90">Scoring</p>
              <p className="mt-1">Base points + speed bonus if you finish before the timer bands end.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
