import { HUNT_COLOR_RAIL } from '../../components/HuntColorFlowGuide';
import PoweredByCrwdCtrl from '../../components/PoweredByCrwdCtrl';

/** First screen before the organizer code. No web fonts — those break taps offline. */

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
            'radial-gradient(ellipse 90% 55% at 50% -8%, rgba(14,204,238,0.34), transparent 58%),'
            + 'radial-gradient(ellipse 60% 45% at 100% 100%, rgba(168,85,247,0.18), transparent 50%),'
            + 'radial-gradient(ellipse 50% 40% at 0% 80%, rgba(234,179,8,0.12), transparent 46%),'
            + 'linear-gradient(165deg, #07090b 0%, #0b1218 48%, #07090b 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-8">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0ECCEE]">
            CrwdCtrl × Mindspark
          </p>

          <h1 className="mt-4 text-[3.1rem] font-black uppercase leading-[0.88] tracking-tight text-white">
            Campus
            <span className="block text-[#0ECCEE]">Hunt</span>
          </h1>

          <div
            className="mt-5 h-1.5 w-full max-w-[16rem] rounded-full"
            style={{ background: `linear-gradient(90deg, ${HUNT_COLOR_RAIL})` }}
          />

          {(teamCode || startName) ? (
            <div className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[#0ECCEE] to-transparent" />
              <div className="px-4 py-4">
                {teamCode ? (
                  <p className="font-mono text-2xl font-black tracking-[0.08em] text-white">
                    {teamCode}
                  </p>
                ) : null}
                {teamName ? (
                  <p className="mt-1 text-sm text-white/50">{teamName}</p>
                ) : null}
                {startName ? (
                  <p className="mt-2 text-sm text-white/70">
                    Meet at <span className="font-semibold text-white">{startName}</span>
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-transparent px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
              Mindspark 2026
            </p>
            <p className="mt-1.5 text-sm leading-snug text-amber-50/90">
              Top <span className="font-bold text-amber-100">10 teams</span> can volunteer.
            </p>
          </div>

          <div className="mt-auto pt-8">
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black shadow-[0_16px_40px_-16px_rgba(14,204,238,0.85)] active:scale-[0.98]"
            >
              Continue
            </button>
            <PoweredByCrwdCtrl />
          </div>
        </div>
      </div>
    </div>
  );
}
