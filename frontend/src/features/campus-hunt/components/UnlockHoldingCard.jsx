import CountdownTimer from './CountdownTimer';
import { formatUnlockDateTime } from '../utils/format';

/**
 * Shared unlock / wave-hold card for Round 1 and Finals.
 * One composition: meet place → unlock time → countdown → short steps.
 */
export default function UnlockHoldingCard({
  accentHex = '#F97316',
  eyebrow = 'Unlocks on',
  unlockAt,
  meetLabel,
  meetHint,
  steps = [],
  paused = false,
  pausedText = 'Releases paused — stay where you are.',
  emptyText = 'Waiting for organizers to set your unlock time.',
  footer,
  serverTime,
  onReady,
  children,
}) {
  return (
    <section
      className="space-y-4 rounded-2xl border bg-[#121416]/90 p-4 text-center backdrop-blur-sm"
      style={{ borderColor: `${accentHex}55` }}
    >
      {children}

      {unlockAt ? (
        <>
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: accentHex }}
            >
              {eyebrow}
            </p>
            <p className="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl">
              {formatUnlockDateTime(unlockAt)}
            </p>
            {meetLabel && (
              <p className="mt-2 text-sm text-white/55">
                Meet at{' '}
                <span className="font-medium text-white/90">{meetLabel}</span>
                {meetHint ? ` · ${meetHint}` : ''}
              </p>
            )}
          </div>
          <CountdownTimer
            expiresAt={unlockAt}
            serverTime={serverTime}
            label="Time remaining"
            expiredLabel="READY"
            onComplete={onReady}
            longForm
            className="mx-auto w-full"
          />
        </>
      ) : (
        <div className="space-y-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: accentHex }}
          >
            Standing by
          </p>
          <p className="text-sm text-white/70">{emptyText}</p>
          {meetLabel && (
            <p className="text-sm text-white/55">
              Meet at{' '}
              <span className="font-medium text-white/90">{meetLabel}</span>
            </p>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <ol className="space-y-1.5 border-t border-white/[0.06] pt-3 text-left">
          {steps.map((step, index) => (
            <li key={`${index}-${step}`} className="flex gap-2.5 text-sm text-white/75">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-black"
                style={{ background: accentHex }}
              >
                {index + 1}
              </span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {paused && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {pausedText}
        </p>
      )}

      {footer}
    </section>
  );
}
