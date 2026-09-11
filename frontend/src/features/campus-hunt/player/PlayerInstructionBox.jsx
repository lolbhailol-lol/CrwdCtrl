import { motion } from 'framer-motion';

/**
 * Calm “what to do” strip — sits under progress, above the action panel.
 */
export default function PlayerInstructionBox({ guide, themeHex, roleLabel }) {
  if (!guide) return null;

  return (
    <motion.div
      key={`${guide.eyebrow}-${guide.title}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-2xl border border-white/[0.08] bg-[#121416]/90 px-4 py-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: themeHex || '#0ECCEE' }}
        />
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: themeHex || '#0ECCEE' }}
        >
          {guide.eyebrow || 'Next'}
        </p>
      </div>

      <h2 className="mt-2 text-[1.35rem] font-semibold leading-snug tracking-tight text-white">
        {guide.title}
      </h2>

      {guide.unlockAt && guide.unlockAt !== guide.title && (
        <p
          className="mt-2 rounded-xl px-3 py-2.5 text-center text-sm font-semibold"
          style={{
            background: `${themeHex || '#F97316'}18`,
            color: themeHex || '#F97316',
          }}
        >
          {guide.unlockAt}
        </p>
      )}

      {guide.body && (
        <p className="mt-1.5 text-sm leading-relaxed text-white/60">
          {guide.body}
        </p>
      )}

      {guide.steps?.length > 0 && (
        <ol className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          {guide.steps.map((step, index) => (
            <li key={`${index}-${step}`} className="flex gap-2.5 text-sm text-white/75">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-black"
                style={{ background: themeHex || '#0ECCEE' }}
              >
                {index + 1}
              </span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {roleLabel && (
        <p className="mt-3 text-[11px] text-white/35">{roleLabel}</p>
      )}
    </motion.div>
  );
}
