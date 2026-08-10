import { useMemo, useState } from 'react';
import {
  adminApplyPenalty,
  adminReconcileManual,
  adminRemovePenalty,
} from '../services/campusHunt.api';

/**
 * Live ops: manual score penalty + paper-sheet checkpoint reconcile.
 */
export default function LiveOpsTools({ eventId, teams = [], stations = [], onChanged }) {
  const [teamId, setTeamId] = useState('');
  const [amount, setAmount] = useState('15');
  const [reason, setReason] = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const teamOptions = useMemo(
    () => [...teams].sort((a, b) => String(a.teamCode || '').localeCompare(String(b.teamCode || ''))),
    [teams],
  );

  const checkpointOptions = useMemo(
    () => [...stations]
      .filter((s) => s.active !== false && String(s.progressionKey || s.checkpointKey || '').toUpperCase() !== 'FINISH')
      .sort((a, b) => String(a.locationName || '').localeCompare(String(b.locationName || ''))),
    [stations],
  );

  const selectedTeam = teamOptions.find((t) => String(t._id || t.id) === String(teamId));

  const run = async (key, fn, okLabel) => {
    setBusy(key);
    setMessage('');
    try {
      await fn();
      setMessage(okLabel);
      onChanged?.();
    } catch (err) {
      setMessage(err.message || 'Action failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Live ops tools</h2>
        <p className="text-xs text-white/50">
          Apply score penalties or reconcile a stuck 4/4 checkpoint from a paper sheet.
        </p>
      </div>

      <label className="block text-xs text-white/55">
        Team
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        >
          <option value="">Select team…</option>
          {teamOptions.map((t) => (
            <option key={t._id || t.id} value={t._id || t.id}>
              {t.teamCode} · {t.teamName} · {t.currentScore ?? 0} pts
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Penalty</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Points"
              className="w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
              className="min-w-40 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!teamId || Boolean(busy)}
              onClick={() => run(
                'penalty',
                () => adminApplyPenalty(teamId, {
                  amount: Number(amount),
                  reason: reason || 'Manual penalty',
                }),
                `Penalty applied to ${selectedTeam?.teamCode || 'team'}`,
              )}
              className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-amber-100 disabled:opacity-40"
            >
              Apply penalty
            </button>
            <button
              type="button"
              disabled={!teamId || Boolean(busy)}
              onClick={() => run(
                'unpenalty',
                () => adminRemovePenalty(teamId, {
                  amount: Number(amount) || undefined,
                  reason: reason || 'Remove penalty',
                }),
                `Penalty removed from ${selectedTeam?.teamCode || 'team'}`,
              )}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
            >
              Remove penalty
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">
            Manual reconcile
          </p>
          <select
            value={checkpointId}
            onChange={(e) => setCheckpointId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
          >
            <option value="">Checkpoint…</option>
            {checkpointOptions.map((s) => (
              <option key={s.checkpointId || s._id} value={s.checkpointId || s._id}>
                {s.progressionKey || s.checkpointKey} · {s.locationName}
                {s.teamCode ? ` · ${s.teamCode}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!teamId || !checkpointId || Boolean(busy)}
            onClick={() => {
              if (!window.confirm('Mark this checkpoint complete for the team (paper reconcile)?')) return;
              run(
                'reconcile',
                () => adminReconcileManual({
                  teamId,
                  checkpointId,
                  notes: reason || 'Paper sheet reconciliation',
                  reason: reason || 'Live ops reconcile',
                }),
                `Checkpoint reconciled for ${selectedTeam?.teamCode || 'team'}`,
              );
            }}
            className="mt-2 rounded-lg bg-[#0ECCEE]/20 px-3 py-2 text-xs text-[#0ECCEE] disabled:opacity-40"
          >
            Reconcile checkpoint
          </button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-white/70">{busy ? `${busy}…` : message}</p>
      )}
      {!eventId && <p className="text-xs text-red-200">Missing event id</p>}
    </div>
  );
}
