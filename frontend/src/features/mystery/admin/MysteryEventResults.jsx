import { useState } from 'react';
import { adminFinalizeMysteryResult, adminGradeMysteryTheory } from '../services/mystery.api';
import { MYSTERY_PATHS, mysteryPublicUrl } from '../config';
import { cardClass, copyText, formatDateTime, ghostBtn, inputClass, primaryBtn, timeAgo } from './mysteryAdminUtils';

function rankTeams(teams) {
  return [...teams].sort((a, b) => {
    const sa = a.progress?.totalScore ?? -1;
    const sb = b.progress?.totalScore ?? -1;
    if (sb !== sa) return sb - sa;
    const fa = a.progress?.finishedAt ? new Date(a.progress.finishedAt).getTime() : Infinity;
    const fb = b.progress?.finishedAt ? new Date(b.progress.finishedAt).getTime() : Infinity;
    return fa - fb;
  });
}

export function MysteryEventLive({ overview }) {
  const teams = rankTeams(overview?.teams || []);
  const totalClues = overview?.caseStats?.evidence || 0;
  const counts = overview?.counts || {};
  const stats = [
    ['Teams', counts.teamsRegistered],
    ['Checked in', counts.teamsCheckedIn],
    ['Playing', counts.teamsPlaying],
    ['Submitted', counts.teamsSubmitted],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-white/45">{label}</p>
            <p className="text-2xl font-bold">{value ?? 0}</p>
          </div>
        ))}
      </div>
      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Live progress</p>
          <p className="text-xs text-white/40">Har 10s refresh</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-white/40">
              <tr>
                <th className="py-2">#</th>
                <th>Team</th>
                <th>Score</th>
                <th>Clues</th>
                <th>Trust calls</th>
                <th>Leads</th>
                <th>Links</th>
                <th>Last activity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => {
                const p = t.progress;
                const pct = totalClues ? Math.round(((p?.unlocked || 0) / totalClues) * 100) : 0;
                return (
                  <tr key={t._id} className="border-t border-white/5">
                    <td className="py-2 text-white/40">{i + 1}</td>
                    <td><span className="font-semibold">{t.teamName}</span> <span className="font-mono text-xs text-white/40">{t.teamCode}</span></td>
                    <td className="font-bold text-[#0ECCEE]">{p?.totalScore ?? '—'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-[#0ECCEE]" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-white/60">{p?.unlocked || 0}/{totalClues}{p?.invalidated ? ` (${p.invalidated}✗)` : ''}</span>
                      </div>
                    </td>
                    <td className="text-white/60">{p?.trustCalls ?? 0}</td>
                    <td className="text-white/60">{p?.branchChoices ?? 0}</td>
                    <td className="text-white/60">{p?.connections ?? 0}</td>
                    <td className="text-xs text-white/50">{timeAgo(p?.lastActivityAt)}</td>
                    <td>
                      {t.submission
                        ? <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-300">Submitted</span>
                        : p ? <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-xs text-sky-300">Playing</span>
                          : <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">Not started</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {teams.length === 0 && <p className="py-4 text-sm text-white/40">Abhi koi team nahi.</p>}
        </div>
      </section>
    </div>
  );
}

function GradeForm({ team, onGraded }) {
  const [correct, setCorrect] = useState(Boolean(team.submission?.graded && team.submission.scoreBreakdown?.theoryPoints > 0));
  const [points, setPoints] = useState(team.submission?.scoreBreakdown?.theoryPoints || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await adminGradeMysteryTheory(team._id, correct, Number(points) || 0);
      await onGraded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setCorrect(true)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${correct ? 'bg-emerald-400 text-black' : 'bg-white/10 text-white/60'}`}>Correct</button>
      <button type="button" onClick={() => setCorrect(false)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${!correct ? 'bg-rose-400 text-black' : 'bg-white/10 text-white/60'}`}>Wrong</button>
      <label className="flex items-center gap-1.5 text-xs text-white/50">Theory points (0–100)
        <input type="number" min={0} max={100} value={points} onChange={(e) => setPoints(e.target.value)} className={`w-20 ${inputClass}`} />
      </label>
      <button type="button" disabled={busy} onClick={save} className={primaryBtn}>{busy ? 'Saving…' : team.submission?.graded ? 'Re-grade' : 'Save grade'}</button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}

export function MysteryEventResults({ eventId, overview, onChanged }) {
  const teams = rankTeams(overview?.teams || []);
  const mysteryCase = overview?.case || {};
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const leaderboardUrl = mysteryPublicUrl(MYSTERY_PATHS.leaderboard(eventId));

  const finalizeAll = async () => {
    const ready = teams.filter((t) => t.progress);
    if (!window.confirm(`${ready.length} teams ka current score final karein?`)) return;
    setBusy('all');
    setError('');
    try {
      for (const t of ready) {
        await adminFinalizeMysteryResult(t._id);
      }
      setMsg(`${ready.length} results finalized`);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const exportCsv = () => {
    const rows = [['Rank', 'Team', 'Code', 'Score', 'Clues', 'Submitted', 'Theory', 'Graded', 'Finalized']];
    teams.forEach((t, i) => rows.push([
      i + 1, t.teamName, t.teamCode, t.progress?.totalScore ?? '', t.progress?.unlocked ?? 0,
      t.submission ? formatDateTime(t.submission.submittedAt) : '', t.submission?.identityTheory || '',
      t.submission?.graded ? 'yes' : 'no', t.resultFinalized ? 'yes' : 'no',
    ]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${overview?.event?.slug || 'mystery'}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitted = teams.filter((t) => t.submission);

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#0ECCEE]">Correct answer</p>
            <p className="text-sm">{mysteryCase.mysteryIdentityName ? `${mysteryCase.mysteryIdentityName}: ` : ''}{mysteryCase.correctIdentityTheory || 'Case me correct answer set nahi hai'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => copyText(leaderboardUrl).then(() => setMsg('Leaderboard link copied'))}>Copy leaderboard link</button>
            <a href={leaderboardUrl} target="_blank" rel="noreferrer" className={ghostBtn}>Open leaderboard ↗</a>
            <button type="button" className={ghostBtn} onClick={exportCsv}>Export CSV</button>
            <button type="button" disabled={Boolean(busy)} onClick={finalizeAll} className={primaryBtn}>{busy === 'all' ? 'Finalizing…' : 'Finalize all'}</button>
          </div>
        </div>
        {msg && <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p>}
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      </section>

      <p className="text-sm font-semibold">Submissions to grade ({submitted.filter((t) => !t.submission.graded).length} pending)</p>
      {submitted.map((t) => {
        const s = t.submission;
        const b = s.scoreBreakdown || {};
        return (
          <section key={t._id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.teamName} <span className="font-mono text-xs text-white/40">{t.teamCode}</span></p>
                <p className="text-xs text-white/40">Submitted {formatDateTime(s.submittedAt)} · confidence {s.confidenceLevel}%</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#0ECCEE]">{b.total ?? 0}</p>
                <p className="text-[11px] text-white/40">clues {b.missionPoints} · links {b.connectionPoints} · timeline {b.timelinePoints} · verdicts {b.verdictPoints} · theory {b.theoryPoints} · bonus {b.confidenceBonus}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/40">Theory</p>
            <p className="text-sm font-semibold">{s.identityTheory}</p>
            <p className="mt-2 text-xs text-white/40">Explanation</p>
            <p className="whitespace-pre-wrap text-sm text-white/75">{s.fullExplanation}</p>
            <GradeForm team={t} onGraded={onChanged} />
            {s.graded && <p className="mt-2 text-xs text-emerald-300">✓ Graded{t.resultFinalized ? ' · result finalized' : ''}</p>}
          </section>
        );
      })}
      {submitted.length === 0 && <p className="text-sm text-white/40">Abhi tak kisi team ne final case submit nahi kiya.</p>}
    </div>
  );
}
