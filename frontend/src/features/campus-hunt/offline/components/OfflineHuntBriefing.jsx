import { useEffect, useState } from 'react';
import { getHuntStartGate } from '../offlineEngine';
import OfflineHuntWelcome from './OfflineHuntWelcome';
import HuntColorFlowGuide from '../../components/HuntColorFlowGuide';

const WELCOME_KEY = 'ch_hunt_welcome_seen';

/** Welcome → organizer start code → hunt begins. */
export default function OfflineHuntBriefing({
  bundle,
  session,
  onStartHunt,
  starting = false,
  error = '',
  onBackToRounds,
}) {
  const isLeader = session?.role === 'leader';
  const startName = bundle?.team?.startingPoint?.name;
  const expectsGo = Boolean(String(bundle?.event?.organizerStartCode || 'GO').trim());
  const teamKey = String(bundle?.team?.teamCode || 'team');

  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return sessionStorage.getItem(`${WELCOME_KEY}_${teamKey}`) !== '1';
    } catch {
      return true;
    }
  });

  const [goCode, setGoCode] = useState('');
  const [gateHint, setGateHint] = useState('');
  const [gate, setGate] = useState(() => getHuntStartGate(bundle, new Date(), { goCode: '' }));

  useEffect(() => {
    setGate(getHuntStartGate(bundle, new Date(), { goCode }));
    setGateHint('');
  }, [bundle, goCode]);

  const markWelcomeDone = () => {
    try {
      sessionStorage.setItem(`${WELCOME_KEY}_${teamKey}`, '1');
    } catch { /* ignore */ }
    setShowWelcome(false);
  };

  if (showWelcome) {
    return (
      <OfflineHuntWelcome
        teamCode={bundle?.team?.teamCode}
        teamName={bundle?.team?.teamName}
        startName={startName}
        onContinue={markWelcomeDone}
        onBack={onBackToRounds}
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14,204,238,0.18), transparent 55%),'
            + 'linear-gradient(180deg, #07090b 0%, #0b0c0d 100%)',
        }}
      />

      <div className="relative mx-auto max-w-md space-y-5 px-4 py-10">
        {onBackToRounds ? (
          <button
            type="button"
            onClick={onBackToRounds}
            className="text-xs text-white/40"
          >
            ← Home
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setShowWelcome(true)}
          className="text-[11px] text-[#0ECCEE]/70 hover:text-[#0ECCEE]"
        >
          ← Welcome
        </button>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0ECCEE]">
            Campus Hunt Challenge
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {bundle?.team?.teamCode}
          </h1>
          {startName ? (
            <p className="mt-2 text-sm text-white/55">Meet at {startName}</p>
          ) : null}
        </div>

        {expectsGo ? (
          <div className="overflow-hidden rounded-3xl border border-[#0ECCEE]/35 bg-[#071016] shadow-[0_0_48px_-24px_rgba(14,204,238,0.9)]">
            <div className="h-1 w-full bg-[#0ECCEE]" />
            <div className="px-4 py-5">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0ECCEE]">
              Organizer start code
            </p>
            <p className="mt-2 text-center text-sm text-white/65">
              Type the code, then Start.
            </p>
            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Code
              <input
                value={goCode}
                onChange={(e) => setGoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
                placeholder="Organizer will tell you"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.28em] text-white outline-none focus:border-[#0ECCEE]"
                autoComplete="off"
                autoCapitalize="characters"
              />
            </label>
            {goCode && !gate.open ? (
              <p className="mt-2 text-center text-xs text-rose-300">Not the right code yet</p>
            ) : null}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {gateHint ? <p className="text-sm text-amber-200/90">{gateHint}</p> : null}

        {isLeader ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => {
              const latest = getHuntStartGate(bundle, new Date(), { goCode });
              setGate(latest);
              if (!latest.open) {
                setGateHint(
                  goCode.trim()
                    ? 'Not the right start code — ask the organizer and try again.'
                    : 'Type the organizer start code above first, then tap Start.',
                );
                return;
              }
              setGateHint('');
              onStartHunt?.(goCode);
            }}
            className="w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black shadow-[0_16px_40px_-16px_rgba(14,204,238,0.85)] disabled:opacity-40"
          >
            {starting
              ? 'Starting…'
              : gate.open
                ? 'Start the hunt'
                : 'Type start code, then tap here'}
          </button>
        ) : (
          <p className="text-center text-sm text-white/50">
            Use the leader phone to start.
          </p>
        )}

        <HuntColorFlowGuide title="Six clues" />

        <p className="text-center text-[11px] text-white/40">
          Powered by CrwdCtrl
        </p>
      </div>
    </div>
  );
}
