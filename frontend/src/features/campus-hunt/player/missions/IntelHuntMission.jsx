import { useState } from 'react';
import { missionTheme } from '../../admin/finaleMissionTheme';
import MissionBriefBox from './MissionBriefBox';

export default function IntelHuntMission({
  view,
  isLeader,
  busy,
  onSubmit,
  onAbandon,
}) {
  const [answer, setAnswer] = useState('');
  const step = view?.step || 'loc1';
  const theme = missionTheme('intel_hunt');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = answer.trim();
    if (!value || !isLeader) return;
    const result = await onSubmit(value);
    if (result?.ok !== false) setAnswer('');
  };

  const stepTitle = step === 'combine'
    ? 'Combine the fragments'
    : view?.locationName || 'Go to location';

  return (
    <div className="space-y-3 p-1">
      <MissionBriefBox
        theme={theme}
        eyebrow={`Intel Hunt · ${theme.colorName}`}
        title={stepTitle}
        body={view?.instruction || 'Gather the fragment at this spot.'}
        requirements={[
          'Stay together as a team',
          'Only the Team Leader submits answers',
          step === 'combine'
            ? 'Type fragment₁ + fragment₂ as one word'
            : 'Enter the fragment from the location',
        ]}
      >
        {(view?.intel1Fragment || view?.intel2Fragment) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {view.intel1Fragment && (
              <span className={`rounded-lg px-2.5 py-1 font-mono text-sm ${theme.bgClass} ${theme.textClass}`}>
                {view.intel1Fragment}
              </span>
            )}
            {view.intel2Fragment && (
              <span className={`rounded-lg px-2.5 py-1 font-mono text-sm ${theme.bgClass} ${theme.textClass}`}>
                {view.intel2Fragment}
              </span>
            )}
          </div>
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
        <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center text-sm text-white/50">
          Only the Team Leader can submit.
        </p>
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
            placeholder={step === 'combine' ? 'Combined word…' : 'Fragment…'}
            autoComplete="off"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !answer.trim()}
            className={`w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-40 ${theme.solidClass} ${theme.solidTextClass}`}
          >
            {busy ? 'Submitting…' : 'Submit'}
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
