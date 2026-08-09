import { motion } from 'framer-motion';
import { huntProgressFromStage } from '../types/stages';

/**
 * Visual hunt pipeline: Start → Clue 1 → Clue 2 → Clue 3 → Final → Finish
 */
export default function HuntProgressTrack({ stage }) {
  const { steps, index, currentLabel } = huntProgressFromStage(stage);
  const filledRatio = steps.every((s) => s.status === 'done')
    ? 1
    : index / Math.max(1, steps.length - 1);

  return (
    <div className="rounded-2xl bg-white/5 px-3 py-4 sm:px-4">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-white/50">Hunt progress</p>
        <p className="truncate text-right text-xs text-[#0ECCEE]">{currentLabel}</p>
      </div>

      <div className="relative px-1">
        <div className="absolute left-4 right-4 top-4 h-0.5 -translate-y-1/2 bg-white/15" />
        <div
          className="absolute left-4 top-4 h-0.5 -translate-y-1/2 bg-[#0ECCEE] transition-all duration-500"
          style={{ width: `calc((100% - 2rem) * ${filledRatio})` }}
        />

        <ol className="relative z-10 flex justify-between">
          {steps.map((step) => {
            const done = step.status === 'done';
            const active = step.status === 'active';
            const waiting = step.status === 'waiting';
            const locked = step.status === 'locked';

            return (
              <li key={step.id} className="flex w-12 flex-col items-center sm:w-14">
                <motion.div
                  layout
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? 'bg-[#0ECCEE] text-black'
                      : active
                        ? 'bg-[#0b0c0d] text-[#0ECCEE] ring-2 ring-[#0ECCEE]'
                        : waiting
                          ? 'bg-[#0b0c0d] text-white/70 ring-1 ring-white/30'
                          : 'bg-[#0b0c0d] text-white/30 ring-1 ring-white/10'
                  }`}
                  animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={active ? { repeat: Infinity, duration: 1.6 } : undefined}
                >
                  {done ? '✓' : step.short}
                </motion.div>

                <p
                  className={`mt-2 text-center text-[10px] font-medium leading-tight sm:text-xs ${
                    done || active
                      ? 'text-white'
                      : locked
                        ? 'text-white/30'
                        : 'text-white/60'
                  }`}
                >
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
