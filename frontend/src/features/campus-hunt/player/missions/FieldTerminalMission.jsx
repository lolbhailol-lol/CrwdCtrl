import { useEffect, useState } from 'react';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { missionTheme } from '../../admin/finaleMissionTheme';
import { LAPTOP_ONLY_RULE } from '../../grid/laptopOnly';
import MissionBriefBox from './MissionBriefBox';

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
    const value = code.trim();
    if (!value || !isLeader || view?.locked) return;
    const result = await onSubmit(value);
    if (result?.ok !== false) setCode('');
  };

  return (
    <div className="space-y-3 p-1">
      <CluePopup
        open={showClue}
        imageSrc={clueImage}
        onContinue={markClueSeen}
        onDismiss={markClueSeen}
      />

      <MissionBriefBox
        theme={theme}
        eyebrow={`Field Terminal · ${theme.colorName}`}
        title={view?.locationName || 'Laptop grid'}
        body={view?.instruction || 'Clear Zip on a laptop, then bring the GRID code back here.'}
        requirements={[
          'Laptop only — phones / Desktop site = DQ',
          'Paste device key on the laptop browser',
          'Leader submits GRID-XXXX on this phone',
        ]}
      >
        <button
          type="button"
          onClick={() => setShowClue(true)}
          className="mt-3 flex w-full items-stretch overflow-hidden rounded-xl border border-white/10 bg-black/30 text-left"
        >
          <img src={clueImage} alt="" className="h-16 w-20 shrink-0 object-cover" />
          <div className="flex flex-1 flex-col justify-center px-3 py-2">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${theme.textClass}`}>
              Mission clue
            </p>
            <p className="text-xs text-white/50">Tap to view</p>
          </div>
        </button>

        {accessCode && (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-white/40">Device key</p>
            <p className={`mt-1 font-mono text-xl font-bold tracking-[0.3em] ${theme.textClass}`}>
              {accessCode}
            </p>
            <button
              type="button"
              onClick={() => copyText(accessCode, () => {
                setCopied('access');
                setTimeout(() => setCopied(''), 1500);
              })}
              className="mt-1.5 text-xs text-white/45 underline"
            >
              {copied === 'access' ? 'Copied!' : 'Copy key'}
            </button>
          </div>
        )}

        <div className="mt-2.5 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Grid link · laptop
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-white/70">{gameFullUrl}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => copyText(gameFullUrl, () => {
                setCopied('url');
                setTimeout(() => setCopied(''), 1500);
              })}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase ${theme.solidClass} ${theme.solidTextClass}`}
            >
              {copied === 'url' ? 'Copied!' : 'Copy link'}
            </button>
            <a
              href={gameFullUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-center text-xs font-bold uppercase text-white/75"
            >
              Open
            </a>
          </div>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-red-100/75">
          {LAPTOP_ONLY_RULE}
        </p>

        <button
          type="button"
          onClick={() => setOpsOpen((v) => !v)}
          className="mt-1 text-xs text-white/35 underline"
        >
          {opsOpen ? 'Hide steps' : 'Need steps?'}
        </button>
        {opsOpen && (
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-white/50">
            <li>Open grid link on a laptop</li>
            <li>Enter device key</li>
            <li>Clear 3 levels (hints cost points)</li>
            <li>Bring GRID code back to this phone</li>
          </ol>
        )}

        {view?.message && (
          <p className={`mt-2 text-sm ${view.message.includes('!') ? 'text-emerald-300' : 'text-amber-200'}`}>
            {view.message}
          </p>
        )}
        {view?.attemptsLeft != null && !view.locked && (
          <p className="mt-1 text-xs text-white/40">{view.attemptsLeft} attempt(s) left</p>
        )}
      </MissionBriefBox>

      {!isLeader ? (
        <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center text-sm text-white/50">
          Only the Team Leader submits the GRID code.
        </p>
      ) : view?.locked ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-center text-sm text-amber-100">
          Submission locked — ask an organizer.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={`w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 font-mono text-white outline-none ${theme.accentRing}`}
            placeholder="GRID-XXXX"
            autoComplete="off"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className={`w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-40 ${theme.solidClass} ${theme.solidTextClass}`}
          >
            {busy ? 'Checking…' : 'Submit code'}
          </button>
        </form>
      )}

      {isLeader && (
        <button
          type="button"
          onClick={onAbandon}
          disabled={busy}
          className="w-full py-1 text-center text-xs text-white/35 underline hover:text-white/60"
        >
          Back to board
        </button>
      )}
    </div>
  );
}
