import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Collapsible How-to — quiet secondary help under the clue.
 */
export default function ClueHowTo({ challenge }) {
  const [open, setOpen] = useState(false);
  if (!challenge) return null;

  const howTo = challenge.howTo;
  const n = challenge.challengeNumber;
  const scoringBands = challenge.scoringBands || [];

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[11px] font-medium text-white/45">
          {howTo?.title || `How to · Clue ${n}`}
        </span>
        <span className="text-[11px] text-white/30">{open ? 'Hide' : 'Show'}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 border-t border-white/[0.06] px-3 py-3 text-xs text-white/60">
              {howTo?.steps?.length > 0 && (
                <ol className="list-decimal space-y-1 pl-4">
                  {howTo.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}

              {n === 1 && (
                <p>
                  Correct = <span className="text-[#0ECCEE]">50 pts</span>.
                  After 3 wrong tries, location revealed for 0 pts.
                  {challenge.state === 'ACTIVE' && (
                    <> Attempts left: {challenge.attemptsLeft ?? '—'}.</>
                  )}
                </p>
              )}

              {n === 2 && scoringBands.length > 0 && (
                <p>≤1:00 → 50 · ≤2:00 → 30 · ≤3:00 → 10 · later → 0</p>
              )}

              {n === 3 && <p>Correct decode = 50 pts. Hints cost points.</p>}
              {n === 4 && <p>Base points + speed bonus in the timer bands.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
