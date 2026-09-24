/**
 * Always-visible clue steps — short, action-first.
 * Scoring notes stay behind “More”.
 */
export default function ClueHowTo({ challenge, accentHex = '#0ECCEE' }) {
  if (!challenge) return null;

  const howTo = challenge.howTo;
  const n = Number(challenge.challengeNumber);
  const steps = Array.isArray(howTo?.steps) ? howTo.steps.slice(0, 5) : [];

  if (!steps.length) return null;

  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{
        borderColor: `${accentHex}33`,
        background: `${accentHex}0d`,
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: accentHex }}
      >
        {howTo?.title || `Clue ${n} · steps`}
      </p>

      <ol className="mt-2 space-y-1.5">
        {steps.map((step, i) => (
          <li key={`${n}-${i}`} className="flex gap-2 text-sm leading-snug text-white/75">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
              style={{ background: accentHex }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
