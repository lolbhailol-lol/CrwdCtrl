/**
 * First screen before organizer start code — brand + fest collaboration.
 * No Google Fonts / framer-motion — those break taps in airplane mode.
 */
export default function OfflineHuntWelcome({
  teamCode,
  teamName,
  startName,
  onContinue,
  onBack,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(14,204,238,0.28), transparent 55%),'
            + 'radial-gradient(ellipse 70% 50% at 100% 80%, rgba(234,179,8,0.12), transparent 50%),'
            + 'linear-gradient(165deg, #07090b 0%, #0b1218 45%, #0a0c0e 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-6 self-start text-xs text-white/40 transition hover:text-white/70"
          >
            ← Home
          </button>
        ) : (
          <div className="mb-6 h-4" />
        )}

        <div className="flex flex-1 flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]/90">
            CrwdCtrl × Mindspark
          </p>

          <h1 className="mt-4 text-[2.75rem] font-black uppercase leading-[0.95] tracking-tight text-white sm:text-[3.25rem]">
            Campus Hunt
          </h1>
          <p className="mt-1 text-xl font-bold tracking-wide text-[#0ECCEE]">
            Challenge
          </p>

          <p className="mt-5 max-w-[22rem] text-[15px] leading-relaxed text-white/65">
            Six clues. Leader phone only. Wait for the organizer, then start.
          </p>

          {(teamCode || startName) ? (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
              {teamCode ? (
                <p className="font-mono text-lg font-bold tracking-wide text-white">
                  {teamCode}
                  {teamName ? (
                    <span className="ml-2 font-sans text-sm font-normal text-white/45">
                      {teamName}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {startName ? (
                <p className="mt-1 text-sm text-white/50">
                  Gather at <span className="text-white/80">{startName}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
              Mindspark 2026
            </p>
            <p className="mt-1.5 text-sm leading-snug text-amber-50/90">
              Top <span className="font-bold text-amber-100">10 teams</span> get a chance
              to volunteer at Mindspark 2026.
            </p>
          </div>

          <div className="mt-auto pt-10">
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black shadow-[0_12px_40px_-12px_rgba(14,204,238,0.55)] active:scale-[0.98]"
            >
              Continue
            </button>
            <p className="mt-3 text-center text-[11px] text-white/40">
              Powered by CrwdCtrl
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
