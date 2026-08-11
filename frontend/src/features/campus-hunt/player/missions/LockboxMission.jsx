import { useState } from 'react';
import { missionTheme } from '../../admin/finaleMissionTheme';
import MissionBriefBox from './MissionBriefBox';

export default function LockboxMission({
  view,
  isLeader,
  busy,
  onSubmit,
  onAbandon,
}) {
  const [answer, setAnswer] = useState('');
  const step = view?.step || 'find_key';
  const theme = missionTheme('lockbox');
  const isKey = step === 'find_key';
  const locationName = view?.locationName || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = answer.trim();
    if (!value || !isLeader) return;
    const result = await onSubmit(value);
    if (result?.ok !== false) setAnswer('');
  };

  if (step === 'done') {
    return (
      <div className="space-y-3 p-1">
        <MissionBriefBox
          theme={theme}
          eyebrow="The Lockbox"
          title="Cleared"
          body={view?.message || 'Mission complete.'}
        />
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

  return (
    <div className="space-y-3 p-1">
      <MissionBriefBox
        theme={theme}
        eyebrow={`The Lockbox · ${theme.colorName}`}
        title={
          isKey
            ? (locationName || 'Go to location')
            : 'Digital lockbox'
        }
        body={
          isKey
            ? (locationName
              ? 'Travel together. Read the clue, then pick up the key at this spot.'
              : (view?.locationHint || 'Travel together to this spot, then pick up the key.'))
            : (view?.instruction || 'Each seat has a piece. Talk it out — leader submits the code.')
        }
        requirements={
          isKey
            ? [
              'All 4 stay together',
              locationName
                ? `Go to ${locationName}`
                : 'Go to the location from the clue',
              'Find the physical key · enter its ID',
            ]
            : [
              'Each player reads only their piece',
              'Share out loud — do not show phones',
              'Only the Team Leader submits the final code',
            ]
        }
      >
        {/* Location-first (like Round 1 destination) */}
        {isKey && locationName && (
          <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">
              Next · go here
            </p>
            <p className="mt-1 text-lg font-semibold text-white">{locationName}</p>
            {view?.locationHint && (
              <p className="mt-1 text-sm text-white/55">{view.locationHint}</p>
            )}
          </div>
        )}

        {isKey && view?.clue && (
          <div className="mt-3 rounded-xl bg-black/30 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Clue
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-white/85">
              {view.clue}
            </p>
          </div>
        )}

        {isKey && (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
              At the location
            </p>
            <p className="mt-1 text-sm text-white/70">
              Pick up the physical key, then enter the ID engraved on it.
            </p>
          </div>
        )}

        {!isKey && (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Your piece · {view?.yourLabel || 'Player'}
            </p>
            <p className={`mt-1.5 text-base font-semibold ${theme.textClass}`}>
              {view?.yourInfo || 'No piece assigned — ask an organizer.'}
            </p>
          </div>
        )}

        {view?.rosterError && (
          <p className="mt-2 text-sm text-amber-200">{view.rosterError}</p>
        )}
        {view?.message && (
          <p className={`mt-2 text-sm ${view.locked ? 'text-amber-200' : 'text-emerald-300'}`}>
            {view.message}
          </p>
        )}
        {view?.attemptsLeft != null && !view.locked && (
          <p className="mt-1 text-xs text-white/40">{view.attemptsLeft} attempt(s) left</p>
        )}
      </MissionBriefBox>

      {!isLeader ? (
        isKey ? (
          <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center text-sm text-white/50">
            Only the Team Leader verifies the key.
          </p>
        ) : null
      ) : view?.locked ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-center text-sm text-amber-100">
          Submission locked — ask an organizer.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className={`w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-white outline-none ${theme.accentRing}`}
            placeholder={isKey ? 'Key ID · e.g. 07 or KEY-07' : 'Final code…'}
            autoComplete="off"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !answer.trim()}
            className={`w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-40 ${theme.solidClass} ${theme.solidTextClass}`}
          >
            {busy ? 'Submitting…' : isKey ? 'Verify key' : 'Open lockbox'}
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
