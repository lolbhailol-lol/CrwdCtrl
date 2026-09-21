import { motion } from 'framer-motion';

/**
 * First screen before organizer start code — brand + fest collaboration.
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
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&display=swap"
      />

      {/* Atmosphere */}
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

      <div
        className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8"
        style={{ fontFamily: 'Outfit, Poppins, sans-serif' }}
      >
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

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-1 flex-col"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]/90">
            CrwdCtrl × Mindspark
          </p>

          <h1
            className="mt-4 text-[3.4rem] leading-[0.9] tracking-wide text-white sm:text-[3.85rem]"
            style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}
          >
            Campus Hunt
          </h1>
          <p
            className="mt-1 text-2xl tracking-[0.08em] text-[#0ECCEE]"
            style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}
          >
            Challenge
          </p>

          <p className="mt-5 max-w-[22rem] text-[15px] leading-relaxed text-white/65">
            A campus-wide clue run across COEP — powered by{' '}
            <span className="font-semibold text-white">CrwdCtrl</span>
            {' '}in collaboration with{' '}
            <span className="font-semibold text-white">Mindspark · COEP Fest</span>.
          </p>

          {(teamCode || startName) ? (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm">
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

          <p className="mt-5 text-sm text-white/45">
            Ranking updates as you clear clues. Play the course — the leaderboard decides.
          </p>

          <div className="mt-auto pt-10">
            <motion.button
              type="button"
              onClick={onContinue}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black shadow-[0_12px_40px_-12px_rgba(14,204,238,0.55)]"
            >
              Continue
            </motion.button>
            <p className="mt-3 text-center text-[11px] text-white/35">
              Next: wait for the organizer start code
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
