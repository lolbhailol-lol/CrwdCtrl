import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RESOLVED = new Set(['COMPLETED', 'FAILED', 'TIMEOUT']);

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
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="mb-2 text-xs uppercase tracking-widest text-white/45">Passed clues</p>
      <p className="mb-3 text-xs text-white/40">
        Tap to re-read. This does not change your progress.
      </p>

      <ul className="space-y-2">
        {passed.map((ch) => {
          const open = openNum === ch.challengeNumber;
          const title =
            ch.challengeNumber === 4 ? 'Final clue' : `Clue ${ch.challengeNumber}`;
          const statusLabel =
            ch.state === 'COMPLETED'
              ? 'Done'
              : ch.state === 'TIMEOUT'
                ? 'Timed out'
                : 'Failed';

          return (
            <li key={ch.challengeNumber}>
              <button
                type="button"
                onClick={() => setOpenNum(open ? null : ch.challengeNumber)}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10"
              >
                <span className="text-sm font-medium text-white">{title}</span>
                <span className="flex items-center gap-2 text-xs text-white/50">
                  {ch.awardedPoints != null && (
                    <span className="text-[#0ECCEE]">+{ch.awardedPoints} pts</span>
                  )}
                  <span
                    className={
                      ch.state === 'COMPLETED' ? 'text-emerald-300/90' : 'text-amber-200/80'
                    }
                  >
                    {statusLabel}
                  </span>
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
