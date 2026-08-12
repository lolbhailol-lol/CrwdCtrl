/**
 * After team login — pick Round 1 / Survival / Finals.
 * Locked rounds stay visible, tinted, and full — not grayed out.
 */

const ROUND_LOOK = {
  round1: {
    hex: '#0ECCEE',
    openShell: 'border-[#0ECCEE]/45 bg-[#0ECCEE]/12 hover:border-[#0ECCEE]/70',
    lockedShell: 'border-[#0ECCEE]/30 bg-[#0ECCEE]/10',
  },
  survival: {
    hex: '#A855F7',
    openShell: 'border-violet-400/45 bg-violet-500/12 hover:border-violet-400/70',
    lockedShell: 'border-violet-400/30 bg-violet-500/10',
  },
  finale: {
    hex: '#F97316',
    openShell: 'border-orange-400/45 bg-orange-500/12 hover:border-orange-400/70',
    lockedShell: 'border-orange-400/30 bg-orange-500/10',
  },
};

export default function PlayerRoundsHub({
  team,
  rounds = [],
  onOpenRound,
  eventName,
  lastRound = null,
  onSwitchPerson,
}) {
  const cards = Array.isArray(rounds) ? rounds : [];

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 50% at 50% -10%, rgba(14,204,238,0.14) 0%, transparent 55%),
            radial-gradient(ellipse 70% 40% at 100% 85%, rgba(249,115,22,0.08) 0%, transparent 50%),
            linear-gradient(180deg, #0b0c0d 0%, #0e1012 50%, #0b0c0d 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative mx-auto max-w-lg px-4 py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
          Campus Hunt
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold tracking-tight">
          {team?.teamCode || 'Team'}
          {team?.teamName ? (
            <span className="font-normal text-white/50"> · {team.teamName}</span>
          ) : null}
        </h1>
        {eventName && (
          <p className="mt-1 text-sm text-white/50">{eventName}</p>
        )}
        <p className="mt-4 text-sm text-white/60">
          Choose a round. Locked rounds stay visible until organizers open them.
        </p>

        <div className="mt-6 space-y-3">
          {cards.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/4 px-4 py-6 text-center text-sm text-white/50">
              Loading rounds…
            </p>
          )}
          {cards.map((card, index) => {
            const canOpen = Boolean(card.open) && !card.comingSoon;
            const look = ROUND_LOOK[card.id] || ROUND_LOOK.round1;
            return (
              <button
                key={card.id}
                type="button"
                disabled={!canOpen}
                onClick={() => canOpen && onOpenRound?.(card.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  canOpen ? look.openShell : look.lockedShell
                } ${!canOpen ? 'cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: look.hex }}
                        aria-hidden
                      />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                        Round {index + 1}
                        {card.subtitle ? ` · ${card.subtitle}` : ''}
                      </p>
                    </div>
                    <h2 className="mt-1.5 text-lg font-semibold text-white">{card.label}</h2>
                    {card.detail && (
                      <p className="mt-0.5 text-sm text-white/55">{card.detail}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      canOpen
                        ? 'bg-emerald-500/20 text-emerald-100'
                        : 'bg-amber-500/20 text-amber-100'
                    }`}
                  >
                    {canOpen ? 'Open' : card.comingSoon ? 'Soon' : 'Locked'}
                  </span>
                </div>
                {!canOpen && (
                  <p className="mt-2.5 text-xs leading-snug text-amber-100/85">
                    {card.lockedReason || 'Not open yet'}
                  </p>
                )}
                {canOpen && (
                  <p
                    className="mt-2.5 text-xs font-semibold"
                    style={{ color: look.hex }}
                  >
                    {lastRound === card.id ? 'Continue →' : 'Enter →'}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {team?.isLeader === false && (
          <p className="mt-6 text-center text-xs text-white/40">
            Playing as {team.myName || 'player'} — leader starts timed releases.
          </p>
        )}
        {onSwitchPerson && (
          <button
            type="button"
            onClick={onSwitchPerson}
            className="mt-6 w-full py-2 text-center text-xs text-white/35 transition hover:text-white/60"
          >
            Not you? Switch person on this phone
          </button>
        )}
      </div>
    </div>
  );
}
