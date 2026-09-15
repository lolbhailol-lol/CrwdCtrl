import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RESOLVED = new Set(['COMPLETED', 'FAILED', 'TIMEOUT', 'TIMED_OUT']);

function revealAnswerLabel(challengeNumber) {
  if (challengeNumber === 2) return '3-digit code';
  if (challengeNumber === 4) return 'Prop code';
  if (challengeNumber === 5) return 'Final word';
  return 'Answer';
}

/**
 * Read-only review of clues the team already finished.
 * Does not undo progress — just lets players re-read passed clues.
 */
export default function PassedCluesPanel({ challenges = [], isLeader, currentActiveNum }) {
  const passed = (challenges || [])
    .filter((c) => RESOLVED.has(c.state) && c.challengeNumber !== currentActiveNum)
    .sort((a, b) => a.challengeNumber - b.challengeNumber);

  const [openNum, setOpenNum] = useState(null);

  if (!passed.length) return null;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-transparent px-1 py-2">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/30">
        Passed clues
      </p>

      <ul className="space-y-1.5">
        {passed.map((ch) => {
          const open = openNum === ch.challengeNumber;
          const title =
            ch.challengeNumber === 5 ? 'Final clue' : `Clue ${ch.challengeNumber}`;
          const statusLabel =
            ch.state === 'COMPLETED'
              ? 'Done'
              : (ch.state === 'TIMEOUT' || ch.state === 'TIMED_OUT')
                ? 'Timed out'
                : 'Failed';

          return (
            <li key={ch.challengeNumber}>
              <button
                type="button"
                onClick={() => setOpenNum(open ? null : ch.challengeNumber)}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]"
              >
                <span className="text-sm text-white/80">{title}</span>
                <span className="flex items-center gap-2 text-[11px] text-white/40">
                  {ch.awardedPoints != null && (
                    <span className="text-[#0ECCEE]/80">+{ch.awardedPoints}</span>
                  )}
                  <span>{statusLabel}</span>
                  <span aria-hidden>{open ? '▾' : '▸'}</span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 space-y-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/80">
                      {ch.prompt == null && ch.challengeNumber === 1 && !isLeader ? (
                        <p className="text-white/50">
                          Clue 1 was only shown to your Team Leader.
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {ch.prompt || '—'}
                        </p>
                      )}
                      {ch.revealedLocation && (
                        <p className="text-xs text-amber-200">
                          Revealed location: {ch.revealedLocation} (0 pts)
                        </p>
                      )}
                      {ch.revealedAnswer && (
                        <p className="text-xs text-amber-200">
                          Revealed {revealAnswerLabel(ch.challengeNumber)}: {ch.revealedAnswer} (0 pts)
                        </p>
                      )}
                      {ch.destinationInstruction && (
                        <p className="text-xs text-[#0ECCEE]/90">
                          Next after this: {ch.destinationInstruction}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
