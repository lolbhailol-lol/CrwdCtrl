import { motion } from 'framer-motion';

/**
 * Calm “what to do” strip — title + one line. Action UI sits below.
 */
export default function PlayerInstructionBox({ guide, themeHex }) {
  if (!guide) return null;

  return (
    <motion.div
      key={`${guide.eyebrow}-${guide.title}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-2xl border border-white/[0.08] bg-[#121416]/90 px-4 py-4"
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: themeHex || '#0ECCEE' }}
      >
        {guide.eyebrow || 'Next'}
      </p>

      <h2 className="mt-1.5 text-[1.25rem] font-semibold leading-snug tracking-tight text-white">
        {guide.title}
      </h2>

      {guide.body ? (
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          {guide.body}
        </p>
      ) : null}
    </motion.div>
  );
}
