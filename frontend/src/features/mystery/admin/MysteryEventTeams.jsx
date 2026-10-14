import { useState } from 'react';
import {
  adminCreateMysteryTeams, adminDeleteMysteryTeam, adminMysteryCheckIn,
  adminResetMysteryTeamPassword, adminResetMysteryTeamProgress, adminUpdateMysteryTeam,
} from '../services/mystery.api';
import { mysteryEnterUrl } from '../config';
import {
  cardClass, copyText, dangerBtn, formatDateTime, ghostBtn, inputClass, labelClass, primaryBtn,
} from './mysteryAdminUtils';

export default function MysteryEventTeams({ eventId, overview, onChanged }) {
  const teams = overview?.teams || [];
  const capacity = overview?.counts?.teamCapacity || 0;
  const [count, setCount] = useState(5);
  const [prefix, setPrefix] = useState('Team');
  const [password, setPassword] = useState('');
  const [namesText, setNamesText] = useState('');
  const [checkinCode, setCheckinCode] = useState('');
  const [created, setCreated] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const run = async (key, action) => {
    setBusy(key);
    setMsg('');
    setError('');
    try {
      await action();
      await onChanged?.();
    } catch (err) {
      setError(err.message || 'Kuch galat hua');
    } finally {
      setBusy('');
    }
  };

  const createTeams = () => run('create', async () => {
    const names = namesText.split('\n').map((line) => line.trim()).filter(Boolean);
    const body = names.length
      ? { teams: names.map((line) => { const [teamName, captainName, captainPhone] = line.split(',').map((s) => s?.trim()); return { teamName, captainName, captainPhone }; }), password }
      : { count: Number(count) || 0, namePrefix: prefix, password };
    const res = await adminCreateMysteryTeams(eventId, body);
    const list = res.data?.teams || [];
    setCreated(list);
    setNamesText('');
    setMsg(`${list.length} team${list.length === 1 ? '' : 's'} bani — logins neeche aur Links tab me.`);
  });

  const checkIn = () => run('checkin', async () => {
    const code = checkinCode.trim();
    if (!code) throw new Error('Game pass ya team code daalo');
    try {
      const res = await adminMysteryCheckIn(code);
      setMsg(`✓ ${res.data?.team?.teamName} checked in`);
    } catch (err) {
      if (err.status === 409) { setMsg(err.message); return; }
      throw err;
    }
    setCheckinCode('');
  });

  const resetPassword = (team) => run(`pw-${team._id}`, async () => {
    const custom = window.prompt(`${team.teamName} ka naya password (khaali chhodo = random)`, '');
    if (custom === null) return;
    const res = await adminResetMysteryTeamPassword(team._id, custom.trim());
    const pw = res.data?.password;
    await copyText(`Team code: ${team.teamCode}\nPassword: ${pw}\nLogin: ${mysteryEnterUrl(team.teamCode)}`);
    setMsg(`${team.teamName}: naya password "${pw}" (copied)`);
  });

  const resetProgress = (team) => {
    if (!window.confirm(`${team.teamName} ka saara progress, score aur submission mita dein? Login same rahega.`)) return;
    run(`rp-${team._id}`, async () => {
      await adminResetMysteryTeamProgress(team._id);
      setMsg(`${team.teamName} fresh start pe hai`);
    });
  };

  const removeTeam = (team) => {
    if (!window.confirm(`${team.teamName} delete karein? Progress bhi chala jayega.`)) return;
    run(`del-${team._id}`, () => adminDeleteMysteryTeam(team._id));
  };

  const toggleCheckIn = (team) => run(`ci-${team._id}`, () => adminUpdateMysteryTeam(team._id, { checkedIn: !team.checkedInAt }));

  const rename = (team) => {
    const name = window.prompt('Team name', team.teamName);
    if (!name || name.trim() === team.teamName) return;
    run(`rn-${team._id}`, () => adminUpdateMysteryTeam(team._id, { teamName: name.trim() }));
  };

  const filtered = teams.filter((t) => !search || `${t.teamName} ${t.teamCode} ${t.captainName}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <section className={`${cardClass} space-y-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-[#0ECCEE]">Teams banao</p>
          <p className="text-xs text-white/40">{teams.length}/{capacity || '∞'} teams</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Kitni teams
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>Name prefix
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>Common password (optional)
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Khaali = har team ka random" className={`mt-1 font-mono ${inputClass}`} />
          </label>
        </div>
        <label className={labelClass}>Ya exact list paste karo — har line: Team name, Captain name, Phone
          <textarea rows={3} value={namesText} onChange={(e) => setNamesText(e.target.value)} placeholder={'Sherlocks, Riya, 9876543210\nByte Busters, Aman, 9123456780'} className={`mt-1 font-mono ${inputClass}`} />
        </label>
        <button type="button" disabled={Boolean(busy)} onClick={createTeams} className={primaryBtn}>{busy === 'create' ? 'Creating…' : 'Create teams'}</button>

        {created.length > 0 && (
          <div className="rounded-xl bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-300">Naye logins</p>
              <button type="button" className={ghostBtn} onClick={() => copyText(created.map((t) => `${t.teamName} — code ${t.teamCode} · password ${t.password}`).join('\n')).then(() => setMsg('Logins copied'))}>Copy all</button>
            </div>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {created.map((t) => <li key={t._id}>{t.teamName} — <span className="text-[#0ECCEE]">{t.teamCode}</span> · {t.password}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className={`${cardClass} space-y-2`}>
        <p className="text-sm font-semibold text-[#0ECCEE]">Check-in desk</p>
        <p className="text-xs text-white/45">Venue pe aate hi team code ya game pass daalo.</p>
        <div className="flex gap-2">
          <input value={checkinCode} onChange={(e) => setCheckinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && checkIn()} placeholder="TEAM CODE / GAME PASS" className={`font-mono ${inputClass}`} />
          <button type="button" disabled={Boolean(busy)} onClick={checkIn} className={primaryBtn}>Check in</button>
        </div>
      </section>

      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">All teams</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-40 rounded-lg border border-white/15 bg-[#161718] px-3 py-1.5 text-xs text-white" />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-white/40">
              <tr>
                <th className="py-2">Team</th>
                <th>Code</th>
                <th>Captain</th>
                <th>Check-in</th>
                <th>Source</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t._id} className="border-t border-white/5 align-top">
                  <td className="py-2 font-semibold">{t.teamName}</td>
                  <td className="font-mono text-[#0ECCEE]">{t.teamCode}</td>
                  <td className="text-white/60">{t.captainName || '—'}{t.captainPhone ? <span className="block text-xs text-white/40">{t.captainPhone}</span> : null}</td>
                  <td>
                    <button type="button" disabled={Boolean(busy)} onClick={() => toggleCheckIn(t)} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.checkedInAt ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                      {t.checkedInAt ? `✓ ${formatDateTime(t.checkedInAt)}` : 'Not yet'}
                    </button>
                  </td>
                  <td className="text-xs text-white/45">{t.createdByAdmin ? 'Admin' : 'Self-registered'}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" disabled={Boolean(busy)} onClick={() => rename(t)} className={ghostBtn}>Rename</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => resetPassword(t)} className={ghostBtn}>New password</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => resetProgress(t)} className={ghostBtn}>Reset progress</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => removeTeam(t)} className={dangerBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-4 text-sm text-white/40">Koi team nahi. Upar banao, ya registration kholo (Setup tab).</p>}
        </div>
      </section>
    </div>
  );
}
