import { useEffect, useMemo, useState } from 'react';
import { adminUpdateEvent, adminBootstrapRound1, adminRepairTeamRosters } from '../services/campusHunt.api';
import { deriveCompetitionFormat, formatLadderLabel } from './competitionFormat';

/**
 * Organizer control: how many teams + people per team.
 * Round 1 capacity and Finale ladder update from this.
 */
export default function DemoScalePanel({
  eventId,
  eventMeta,
  teamCount = 0,
  onChanged,
}) {
  const initial = useMemo(() => deriveCompetitionFormat({
    teamCapacity: eventMeta?.teamCapacity,
    teamSize: eventMeta?.teamSize,
    directFromR1: eventMeta?.finaleDirectFromR1,
    finaleTeams: eventMeta?.finaleCapacity,
  }), [
    eventMeta?.teamCapacity,
    eventMeta?.teamSize,
    eventMeta?.finaleDirectFromR1,
    eventMeta?.finaleCapacity,
  ]);

  const [teams, setTeams] = useState(initial.teamCapacity);
  const [people, setPeople] = useState(initial.teamSize);
  const [finaleTeams, setFinaleTeams] = useState(initial.finaleTeams);
  const [directFromR1, setDirectFromR1] = useState(initial.directFromR1);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setTeams(initial.teamCapacity);
    setPeople(initial.teamSize);
    setFinaleTeams(initial.finaleTeams);
    setDirectFromR1(initial.directFromR1);
  }, [initial.teamCapacity, initial.teamSize, initial.finaleTeams, initial.directFromR1]);

  const preview = useMemo(() => deriveCompetitionFormat({
    teamCapacity: teams,
    teamSize: people,
    directFromR1,
    finaleTeams,
  }), [teams, people, directFromR1, finaleTeams]);

  const saveScale = async ({ alsoCreateTeams = false } = {}) => {
    if (!eventId) return;
    setBusy(alsoCreateTeams ? 'create' : 'save');
    setMsg('');
    try {
      const format = deriveCompetitionFormat({
        teamCapacity: teams,
        teamSize: people,
        directFromR1,
        finaleTeams,
      });
      await adminUpdateEvent(eventId, {
        teamCapacity: format.teamCapacity,
        teamSize: format.teamSize,
        finaleCapacity: format.finaleTeams,
        finaleDirectFromR1: format.directFromR1,
        reason: 'Organizer set demo / event scale',
      });
      if (alsoCreateTeams) {
        await adminBootstrapRound1(eventId, {
          createTeams: true,
          enablePublicLeaderboard: true,
        });
        await adminRepairTeamRosters(eventId);
      }
      setMsg(
        alsoCreateTeams
          ? `Saved · ${format.teamCapacity} teams × ${format.teamSize} people · demo teams created/repaired`
          : `Saved · ${formatLadderLabel(format)}`,
      );
      await onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Could not save scale');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
        Demo / event scale
      </p>
      <h3 className="mt-1 text-lg font-bold text-white">Teams & people</h3>
      <p className="mt-1 text-sm text-white/55">
        Set overall teams and people per team. Round 1 capacity and Finale ladder follow this.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-white/50">
          Overall teams
          <input
            type="number"
            min={2}
            max={200}
            value={teams}
            onChange={(e) => {
              const next = Number(e.target.value) || 2;
              setTeams(next);
              const auto = deriveCompetitionFormat({
                teamCapacity: next,
                teamSize: people,
              });
              setFinaleTeams(auto.finaleTeams);
              setDirectFromR1(auto.directFromR1);
            }}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-white/50">
          People per team
          <select
            value={people}
            onChange={(e) => setPeople(Number(e.target.value) || 4)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white"
          >
            <option value={2}>2 (leader + 1)</option>
            <option value={3}>3 (leader + 2)</option>
            <option value={4}>4 (leader + 3)</option>
            <option value={5}>5</option>
            <option value={6}>6</option>
            <option value={7}>7</option>
            <option value={8}>8</option>
          </select>
        </label>
        <label className="text-xs text-white/50">
          Finale teams
          <input
            type="number"
            min={1}
            max={Math.min(12, Number(teams) || 12)}
            value={finaleTeams}
            onChange={(e) => setFinaleTeams(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-white/50">
          Direct from Round 1
          <input
            type="number"
            min={1}
            max={Math.max(1, Number(finaleTeams) || 1)}
            value={directFromR1}
            onChange={(e) => setDirectFromR1(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white"
          />
        </label>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/75">
        <p className="font-medium text-white">{formatLadderLabel(preview)}</p>
        <p className="mt-1 text-xs text-white/45">
          {preview.totalPlayers} players total · scans need {preview.teamSize}/{preview.teamSize}
          {' · '}have {teamCount} team row(s) now
          {people < 4 ? ' · Blackout works best with 4 people (roles)' : ''}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => saveScale({ alsoCreateTeams: false })}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy === 'save' ? 'Saving…' : 'Save scale'}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            if (!window.confirm(
              `Save ${preview.teamCapacity} teams × ${preview.teamSize} people, then create/repair demo teams up to capacity?`,
            )) return;
            saveScale({ alsoCreateTeams: true });
          }}
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy === 'create' ? 'Working…' : 'Save + create/repair demo teams'}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p>}
    </section>
  );
}
