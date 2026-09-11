/**
 * Minimal “before you play” strip for an opened Finale mission.
 * One job: required rules, then the action UI below.
 */
export default function MissionBriefBox({
  theme,
  eyebrow,
  title,
  body,
  requirements = [],
  children,
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${theme.borderClass} ${theme.bgClass}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: theme.hex }}
          aria-hidden
        />
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: theme.hex }}
        >
          {eyebrow}
        </p>
      </div>

      {title && (
        <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white">
          {title}
        </h2>
      )}

      {body && (
        <p className="mt-1 text-sm leading-relaxed text-white/60">
          {body}
        </p>
      )}

      {requirements.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/[0.08] pt-3">
          {requirements.map((item) => (
            <li key={item} className="flex gap-2 text-[13px] leading-snug text-white/75">
              <span
                className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full"
                style={{ background: theme.hex }}
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {children}
    </div>
  );
}
