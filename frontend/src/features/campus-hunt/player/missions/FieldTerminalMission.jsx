import { useEffect, useState } from 'react';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { missionTheme } from '../../admin/finaleMissionTheme';
import { LAPTOP_ONLY_RULE } from '../../grid/laptopOnly';

const CLUE_IMAGE_DEFAULT = '/campus-hunt/field-terminal-clue.jpg';

function clueSeenKey(accessCode) {
  return `ch_finale_terminal_clue_seen:${String(accessCode || 'none').toUpperCase()}`;
}

function copyText(text, onDone) {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => onDone?.()).catch(() => {});
}

function CluePopup({ open, imageSrc, onContinue, onDismiss }) {
  const theme = missionTheme('field_terminal');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div
        className={`w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl ${theme.borderClass}`}
        style={{
          background: 'linear-gradient(180deg, #0d121a 0%, #080a0e 100%)',
          animation: 'deviceClueIn 0.45s ease-out',
        }}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          <img
            src={imageSrc}
            alt="Mission clue"
            className="h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(8,10,14,0.92) 0%, rgba(8,10,14,0.2) 45%, transparent 70%)',
            }}
          />
          <p className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${theme.bgClass} ${theme.textClass}`}>
            Clue received
          </p>
        </div>

        <div className="space-y-3 px-5 pb-5 pt-4 text-center">
          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme.textClass}`}>
            Field Terminal
          </p>
          <h2 className="text-xl font-black uppercase tracking-wide text-white">
            Look closer.
          </h2>
          <p className="text-sm leading-relaxed text-white/65">
            Something on campus can run what your phone cannot.
            <br />
            Find a laptop. Borrow it. Phones are against the rules.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={onContinue}
              className={`w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide ${theme.solidClass} ${theme.solidTextClass}`}
            >
              I see it
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2 text-xs text-white/40 underline hover:text-white/70"
            >
              Skip clue
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes deviceClueIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function FieldTerminalMission({
  view,
  isLeader,
  busy,
  onSubmit,
  onAbandon,
}) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState('');
  const [showClue, setShowClue] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const theme = missionTheme('field_terminal');
  const panel = `rounded-2xl border ${theme.borderClass} ${theme.bgClass} p-4 backdrop-blur-sm`;

  const gamePath = view?.gameUrl || CAMPUS_HUNT_PATHS.grid;
  const gameFullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${gamePath}`
    : gamePath;
  const accessCode = view?.accessCode;
  const clueImage = view?.clueImageUrl || CLUE_IMAGE_DEFAULT;

  useEffect(() => {
    const key = clueSeenKey(accessCode);
    try {
      const seen = sessionStorage.getItem(key) === '1';
      if (!seen) setShowClue(true);
      else setShowClue(false);
    } catch {
      setShowClue(true);
    }
  }, [accessCode]);

  const markClueSeen = () => {
    try {
      sessionStorage.setItem(clueSeenKey(accessCode), '1');
    } catch {
      /* ignore */
    }
    setShowClue(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || !isLeader || view?.locked) return;
    await onSubmit(code.trim());
    setCode('');
  };

  return (
    <div className="space-y-4 p-2">
      <CluePopup
        open={showClue}
        imageSrc={clueImage}
        onContinue={markClueSeen}
        onDismiss={markClueSeen}
      />

      <div className={panel}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>
          Field Terminal · Blue
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">
          {view?.locationName || 'Field device'}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          {view?.instruction
            || 'Use what the clue showed you. When the machine finishes its work, bring the code back here.'}
        </p>

        <button
          type="button"
          onClick={() => setShowClue(true)}
          className="mt-4 flex w-full items-stretch overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-left transition hover:border-white/25"
        >
          <img
            src={clueImage}
            alt=""
            className="h-20 w-24 shrink-0 object-cover"
          />
          <div className="flex flex-1 flex-col justify-center px-3 py-2">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${theme.textClass}`}>
              Mission clue
            </p>
            <p className="text-xs text-white/55">Tap to view again</p>
          </div>
        </button>

        {accessCode && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-center ${theme.borderClass} bg-black/25`}>
            <p className="text-[10px] uppercase tracking-wide text-white/45">Device key</p>
            <p className={`mt-1 font-mono text-2xl font-bold tracking-[0.35em] ${theme.textClass}`}>
              {accessCode}
            </p>
            <button
              type="button"
              onClick={() => copyText(accessCode, () => {
                setCopied('access');
                setTimeout(() => setCopied(''), 1500);
              })}
              className="mt-2 text-xs text-white/50 underline hover:text-white"
            >
              {copied === 'access' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
              Laptop only · phones against the rules
            </p>
            <p className="mt-0.5 text-[11px] text-white/45">
              Open the channel on a real computer — not your phone. Desktop site is cheating.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpsOpen((v) => !v)}
            className="text-xs text-white/40 underline hover:text-white/70"
          >
            {opsOpen ? 'Hide details' : 'Need a nudge?'}
          </button>
        </div>

        <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-100/85">
          {LAPTOP_ONLY_RULE}
        </p>

        {opsOpen && (
          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs text-white/55">
            <p>Copy this link onto a laptop browser (phones are banned for this mission):</p>
            <p className="break-all font-mono text-white/70">{gameFullUrl}</p>
            <button
              type="button"
              onClick={() => copyText(gameFullUrl, () => {
                setCopied('url');
                setTimeout(() => setCopied(''), 1500);
              })}
              className="underline hover:text-white"
            >
              {copied === 'url' ? 'Link copied!' : 'Copy laptop link'}
            </button>
            <p className="pt-2 text-white/40">
              Enter device key on that laptop. Clear three stages. Miss a timer → 0 for that stage.
              Hints cost. Bring the final code back to your leader.
            </p>
          </div>
        )}

        {view?.message && (
          <p className={`mt-3 text-sm font-medium ${view.message.includes('!') ? 'text-emerald-300' : 'text-amber-200'}`}>
            {view.message}
          </p>
        )}
        {view?.attemptsLeft != null && !view.locked && (
          <p className="mt-2 text-xs text-white/45">{view.attemptsLeft} attempt(s) left</p>
        )}
      </div>

      {!isLeader ? (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-white/60">
          Only the Team Leader can return the final code.
        </p>
      ) : view?.locked ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
          Too many wrong codes. Ask an organizer for help.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className={panel}>
          <label className="block text-xs uppercase tracking-wide text-white/50">
            Return code
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 12))}
              className={`mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-xl tracking-widest text-white outline-none ${theme.accentRing}`}
              placeholder="GRID-XXXX"
              autoComplete="off"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className={`mt-3 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-40 ${theme.solidClass} ${theme.solidTextClass}`}
          >
            {busy ? 'Checking…' : 'Submit code'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onAbandon}
        disabled={busy}
        className="w-full text-center text-xs text-white/40 underline hover:text-white/70"
      >
        Return to mission board
      </button>
    </div>
  );
}
