import { useState } from 'react';
import { missionTheme } from '../../admin/finaleMissionTheme';
import MissionBriefBox from './MissionBriefBox';

const ROLE_LABEL = {
  scout: 'Scout',
  cracker: 'Cracker',
  navigator: 'Navigator',
  controller: 'Controller',
};

function ProgressStrip({ progress }) {
  const items = [
    { key: 'scoutDone', label: 'Scout' },
    { key: 'crackerDone', label: 'Cracker' },
    { key: 'navigatorDone', label: 'Navigator' },
    { key: 'controllerReady', label: 'Controller' },
  ];
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {items.map((item) => {
        const done = Boolean(progress?.[item.key]);
        return (
          <span
            key={item.key}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              done ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/5 text-white/35'
            }`}
          >
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

export default function BlackoutMission({
  view,
  isLeader,
  busy,
  onSubmit,
  onAbandon,
}) {
  const [answer, setAnswer] = useState('');
  const theme = missionTheme('operation_blackout');
  const step = view?.step || 'scout';
  const canSubmit = Boolean(view?.canSubmit) && !view?.locked && !view?.rosterError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = answer.trim();
    if (!value || !canSubmit) return;
    const result = await onSubmit(value);
    if (result?.ok !== false) setAnswer('');
  };

  if (step === 'done') {
    return (
      <div className="space-y-3 p-1">
        <MissionBriefBox
          theme={theme}
          eyebrow="OPERATION: BLACKOUT"
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

  const inputLabel = (
    (view.subStep === 'token' && 'Access token')
    || (view.subStep === 'route' && 'Route')
    || (view.subStep === 'puzzle' && 'Cracker answer')
    || (view.subStep === 'frequency' && 'Frequency')
    || (step === 'scout' && 'Scout station secret')
    || (step === 'controller' && 'Activation code')
    || 'Answer'
  );

  return (
    <div className="space-y-3 p-1">
      <MissionBriefBox
        theme={theme}
        eyebrow={`Blackout · ${theme.colorName}`}
        title={view?.taskLabel || ROLE_LABEL[view?.yourRole] || 'Operation'}
        body={view?.instruction || 'Stay together. Only the active role submits.'}
        requirements={[
          'All 4 players stay together — do not split',
          view?.yourRole
            ? `Your role: ${ROLE_LABEL[view.yourRole] || view.yourRole}`
            : 'Roles are seat-mapped',
          'Wrong answers cost points (capped)',
        ]}
      >
        <ProgressStrip progress={view?.progress} />

        {view?.rosterError && (
          <p className="mt-2 text-sm text-amber-200">{view.rosterError}</p>
        )}
        {view?.locationHint && (
          <p className="mt-2 text-xs text-white/45">{view.locationHint}</p>
        )}
        {view?.hint && (
          <p className="mt-1 text-xs text-white/40">{view.hint}</p>
        )}

        {view?.accessToken && (
          <div className="mt-2.5 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/40">Access token</p>
            <p className={`mt-1 font-mono text-lg font-bold ${theme.textClass}`}>{view.accessToken}</p>
          </div>
        )}
        {view?.route && (
          <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/40">Route</p>
            <p className={`mt-1 font-mono text-sm font-bold ${theme.textClass}`}>{view.route}</p>
          </div>
        )}
        {view?.frequency && (
          <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-white/40">Frequency</p>
            <p className={`mt-1 font-mono text-sm font-bold ${theme.textClass}`}>{view.frequency}</p>
          </div>
        )}
        {view?.intel && (
          <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white/70">
            <p className={`font-semibold uppercase tracking-wide ${theme.textClass}`}>Assembled</p>
            <p>Token <span className="font-mono text-white">{view.intel.accessToken || '—'}</span></p>
            <p>Route <span className="font-mono text-white">{view.intel.route || '—'}</span></p>
            <p>Freq <span className="font-mono text-white">{view.intel.frequency || '—'}</span></p>
          </div>
        )}

        {view?.message && (
          <p className={`mt-2 text-sm ${view.locked ? 'text-amber-200' : 'text-emerald-300'}`}>
            {view.message}
          </p>
        )}
        {view?.attemptsLeft != null && !view.locked && canSubmit && (
          <p className="mt-1 text-xs text-white/40">
            {view.attemptsLeft} attempt(s) left
            {view.penaltyNote ? ` · ${view.penaltyNote}` : ''}
          </p>
        )}
        {view?.penaltiesIncurred > 0 && (
          <p className="mt-1 text-xs text-rose-200/80">
            Penalties −{view.penaltiesIncurred} pts
          </p>
        )}
      </MissionBriefBox>

      {canSubmit ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-white/40">{inputLabel}</p>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className={`w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-white outline-none ${theme.accentRing}`}
            placeholder="Enter answer…"
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
      ) : (
        <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center text-sm text-white/50">
          {view?.locked
            ? 'Another role is active — stay with the team.'
            : 'Waiting for the active operator…'}
        </p>
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
