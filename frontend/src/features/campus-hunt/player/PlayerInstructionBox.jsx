import { motion } from 'framer-motion';

/**
 * “What to do now” — one clear action above the clue form.
 */
export default function PlayerInstructionBox({ guide, themeHex }) {
  if (!guide) return null;

  return (
    <motion.div
      key={`${guide.eyebrow}-${guide.title}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-2xl border px-4 py-4"
      style={{
        borderColor: `${themeHex || '#0ECCEE'}55`,
        background: `linear-gradient(180deg, ${(themeHex || '#0ECCEE')}18 0%, #0b0c0d 100%)`,
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: themeHex || '#0ECCEE' }}
      >
        {guide.eyebrow || 'Do now'}
      </p>

      <h2 className="mt-1.5 text-[1.3rem] font-bold leading-snug tracking-tight text-white">
        {guide.title}
      </h2>

      {guide.body ? (
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {guide.body}
        </p>
      ) : null}
    </motion.div>
  );
}
