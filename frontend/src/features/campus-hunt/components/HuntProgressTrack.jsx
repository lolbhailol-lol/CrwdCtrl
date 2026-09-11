import { motion } from 'framer-motion';
import { huntProgressFromStage } from '../types/stages';
import { themeForProgressStepId } from '../types/stageTheme';

/**
 * Compact hunt pipeline — flat, not a heavy card.
 */
export default function HuntProgressTrack({ stage }) {
  const { steps, index, currentLabel } = huntProgressFromStage(stage);
  const filledRatio = steps.every((s) => s.status === 'done')
    ? 1
    : index / Math.max(1, steps.length - 1);
  const activeTheme = themeForProgressStepId(steps[index]?.id);

  return (
    <div className="px-0.5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
          Progress
        </p>
        <p
          className="truncate text-right text-[11px] font-medium"
          style={{ color: activeTheme?.hex || '#0ECCEE' }}
        >
          {currentLabel}
        </p>
      </div>

      <div className="relative px-1 pb-1">
        <div className="absolute left-3 right-3 top-[14px] h-px -translate-y-1/2 bg-white/10" />
        <div
          className="absolute left-3 top-[14px] h-px -translate-y-1/2 transition-all duration-500"
          style={{
            width: `calc((100% - 1.5rem) * ${filledRatio})`,
            background: activeTheme?.hex || '#0ECCEE',
          }}
        />

        <ol className="relative z-10 flex justify-between">
          {steps.map((step) => {
            const done = step.status === 'done';
            const active = step.status === 'active';
            const locked = step.status === 'locked';
            const theme = themeForProgressStepId(step.id);

            return (
              <li key={step.id} className="flex w-11 flex-col items-center sm:w-12">
                <motion.div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? 'text-black'
                      : active
                        ? 'bg-[#0b0c0d] text-white'
                        : 'bg-[#0b0c0d] text-white/30 ring-1 ring-white/10'
                  }`}
                  style={
                    done
                      ? { background: theme?.hex || '#0ECCEE' }
                      : active
                        ? { boxShadow: `0 0 0 2px ${theme?.hex || '#0ECCEE'}` }
                        : undefined
                  }
                  animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={active ? { repeat: Infinity, duration: 2 } : undefined}
                >
                  {done ? '✓' : step.short}
                </motion.div>
                <p
                  className={`mt-1.5 text-center text-[9px] font-medium leading-tight sm:text-[10px] ${
                    done || active ? 'text-white/80' : locked ? 'text-white/25' : 'text-white/40'
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
