import { useState } from 'react';
import { missionTheme } from '../../admin/finaleMissionTheme';

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
  const panel = `rounded-2xl border ${theme.borderClass} ${theme.bgClass} p-4 backdrop-blur-sm`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim() || !isLeader) return;
    await onSubmit(answer.trim());
    setAnswer('');
  };

  return (
    <div className="space-y-4 p-2">
      <div className={panel}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>
          Intel Hunt · Orange
        </p>
        {view?.locationName && (
          <h2 className="mt-1 text-xl font-bold text-white">{view.locationName}</h2>
        )}
        <p className="mt-3 text-sm leading-relaxed text-white/75">
          {view?.instruction || 'Gather Intel at this location.'}
        </p>
        {(view?.intel1Fragment || view?.intel2Fragment) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {view.intel1Fragment && (
              <span className={`rounded-lg px-3 py-1 font-mono text-sm ${theme.bgClass} ${theme.textClass}`}>
                {view.intel1Fragment}
              </span>
            )}
            {view.intel2Fragment && (
              <span className={`rounded-lg px-3 py-1 font-mono text-sm ${theme.bgClass} ${theme.textClass}`}>
                {view.intel2Fragment}
              </span>
            )}
          </div>
        )}
        {view?.message && (
          <p className={`mt-3 text-sm font-medium ${view.locked ? 'text-amber-200' : 'text-emerald-300'}`}>
            {view.message}
          </p>
        )}
        {view?.attemptsLeft != null && !view.locked && (
          <p className="mt-2 text-xs text-white/45">{view.attemptsLeft} attempt(s) left</p>
        )}
      </div>

      {!isLeader ? (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-white/60">
          Only the Team Leader can submit Intel.
        </p>
      ) : view?.locked ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
          Submission locked. Ask an organizer if you need help.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className={panel}>
          <label className="block text-xs uppercase tracking-wide text-white/50">
            {step === 'combine' ? 'Combined word' : 'Your Intel'}
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className={`mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ${theme.accentRing}`}
              placeholder={step === 'combine' ? 'Enter final word…' : 'Enter fragment…'}
              autoComplete="off"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !answer.trim()}
            className={`mt-3 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-40 ${theme.solidClass} ${theme.solidTextClass}`}
          >
            {busy ? 'Submitting…' : 'Submit Intel'}
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
