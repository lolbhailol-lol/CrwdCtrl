import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  adminGetCaseDetail, adminGetMysteryEventOverview, adminListMysteryCases,
  adminRotateMysteryQr, adminUpdateMysteryEvent,
} from '../services/mystery.api';
import { MYSTERY_PATHS, mysteryEnterUrl } from '../config';
import {
  EVENT_STATUS_LABEL, EVENT_STATUS_TONE, cardClass, ghostBtn, inputClass, labelClass, primaryBtn, toLocalInput,
} from './mysteryAdminUtils';
import MysteryEventTeams from './MysteryEventTeams';
import MysteryEventLinks from './MysteryEventLinks';
import MysteryQrPanel from './MysteryQrPanel';
import { MysteryEventLive, MysteryEventResults } from './MysteryEventResults';

const TABS = [
  ['setup', 'Setup'],
  ['teams', 'Teams'],
  ['links', 'Links'],
  ['clues', 'QR clues'],
  ['live', 'Live'],
  ['results', 'Results'],
];

const STATUS_ACTIONS = {
  draft: [['registration_open', 'Open registration'], ['live', 'Go live']],
  upcoming: [['registration_open', 'Open registration'], ['live', 'Go live']],
  registration_open: [['live', 'Go live'], ['draft', 'Close registration']],
  live: [['paused', 'Pause'], ['completed', 'End game']],
  paused: [['live', 'Resume'], ['completed', 'End game']],
  completed: [['live', 'Reopen']],
  cancelled: [['draft', 'Restore as draft']],
};

const FAST_POLL_TABS = new Set(['live', 'results', 'teams']);

function SetupTab({ overview, cases, onSave, busy }) {
  const event = overview.event;
  const hasTeams = (overview.counts?.teamsRegistered || 0) > 0;
  const [form, setForm] = useState(() => ({
    name: event.name || event.title || '',
    college: event.college || '',
    date: toLocalInput(event.date || event.dateTime),
    venue: event.venue || '',
    caseId: event.caseId ? String(event.caseId) : '',
    teamCapacity: event.teamCapacity || 20,
    teamSize: event.teamSize || 4,
    operationsNotes: event.operationsNotes || '',
    allowInterTeamExchange: event.allowInterTeamExchange !== false,
  }));
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const stats = overview.caseStats || {};
  const checks = [
    [Boolean(overview.case), 'Case linked', overview.case ? overview.case.title : 'Choose a case below'],
    [overview.case?.status === 'published', 'Case published', overview.case?.status === 'published' ? `${stats.evidence} clues · ${stats.qrEvidence} QR · ${stats.branches} branch · ${stats.twists} twist` : 'Publish it in the case builder'],
    [Boolean(event.college && (event.date || event.dateTime)), 'College + date set', event.college ? `${event.college}` : 'Fill in below'],
    [(overview.counts?.teamsRegistered || 0) > 0, 'Teams ready', `${overview.counts?.teamsRegistered || 0} teams`],
  ];

  const save = () => onSave({
    ...form,
    date: form.date ? new Date(form.date).toISOString() : undefined,
    caseId: form.caseId || undefined,
    teamCapacity: Number(form.teamCapacity) || 20,
    teamSize: Number(form.teamSize) || 4,
  });

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <p className="text-sm font-semibold text-[#0ECCEE]">Readiness</p>
        <ul className="mt-3 space-y-2">
          {checks.map(([ok, label, hint]) => (
            <li key={label} className="flex items-start gap-3 text-sm">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-300'}`}>
                {ok ? '✓' : '!'}
              </span>
              <span><span className="font-semibold">{label}</span> <span className="text-white/45">— {hint}</span></span>
            </li>
          ))}
        </ul>
        {stats.qrEvidence > 0 && <p className="mt-3 text-xs text-white/45">Before the game: print the {stats.qrEvidence} QR codes from the QR clues tab and put them up at the venue.</p>}
        {overview.case && <Link to={MYSTERY_PATHS.adminCase(overview.case._id)} className={`mt-3 inline-block ${ghostBtn}`}>Open case builder</Link>}
      </section>

      <section className={`${cardClass} space-y-3`}>
        <p className="text-sm font-semibold text-[#0ECCEE]">Event details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Event name<input value={form.name} onChange={set('name')} className={`mt-1 ${inputClass}`} /></label>
          <label className={labelClass}>College<input value={form.college} onChange={set('college')} className={`mt-1 ${inputClass}`} /></label>
          <label className={labelClass}>Date & time<input type="datetime-local" value={form.date} onChange={set('date')} className={`mt-1 ${inputClass}`} /></label>
          <label className={labelClass}>Venue<input value={form.venue} onChange={set('venue')} className={`mt-1 ${inputClass}`} /></label>
          <label className={labelClass}>Case {hasTeams && <span className="text-white/30">(locked — teams already created)</span>}
            <select value={form.caseId} disabled={hasTeams} onChange={set('caseId')} className={`mt-1 ${inputClass} disabled:opacity-50`}>
              <option value="">— select —</option>
              {cases.map((c) => <option key={c._id} value={c._id}>{c.title}{c.status !== 'published' ? ' (draft)' : ''}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Max teams<input type="number" min={1} value={form.teamCapacity} onChange={set('teamCapacity')} className={`mt-1 ${inputClass}`} /></label>
            <label className={labelClass}>Per team<input type="number" min={1} value={form.teamSize} onChange={set('teamSize')} className={`mt-1 ${inputClass}`} /></label>
          </div>
          <label className={`${labelClass} sm:col-span-2`}>Operations notes (admin only)
            <textarea rows={2} value={form.operationsNotes} onChange={set('operationsNotes')} placeholder="Reporting time, volunteer contacts, emergency number" className={`mt-1 ${inputClass}`} />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70 sm:col-span-2">
            <input type="checkbox" checked={form.allowInterTeamExchange} onChange={set('allowInterTeamExchange')} />
            Teams can trade clues with each other
          </label>
        </div>
        <button type="button" disabled={busy} onClick={save} className={primaryBtn}>Save details</button>
      </section>
    </div>
  );
}

export default function MysteryEventControl() {
  const { eventId } = useParams();
  const [overview, setOverview] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [cases, setCases] = useState([]);
  const [tab, setTab] = useState('setup');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const refresh = useCallback(async () => {
    const res = await adminGetMysteryEventOverview(eventId);
    setOverview(res.data);
    setLastRefresh(new Date());
    return res.data;
  }, [eventId]);

  const loadCase = useCallback(async (caseId) => {
    if (!caseId) { setCaseDetail(null); return; }
    setCaseDetail(await adminGetCaseDetail(caseId));
  }, []);

  useEffect(() => {
    refresh()
      .then((data) => loadCase(data?.case?._id))
      .catch((err) => setError(err.message || 'Could not load the event'));
    adminListMysteryCases().then((c) => setCases(Array.isArray(c) ? c : [])).catch(() => {});
  }, [refresh, loadCase]);

  useEffect(() => {
    const ms = FAST_POLL_TABS.has(tab) ? 10000 : 45000;
    const id = setInterval(() => { refresh().catch(() => {}); }, ms);
    return () => clearInterval(id);
  }, [tab, refresh]);

  const save = async (updates, okMsg = 'Saved ✓') => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      await adminUpdateMysteryEvent(eventId, updates);
      const data = await refresh();
      if (updates.caseId !== undefined) await loadCase(data?.case?._id);
      setMsg(okMsg);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status, label) => {
    if (status === 'completed' && !window.confirm('End the game? Teams will no longer be able to play.')) return;
    save({ status }, `${label} ✓`);
  };

  const rotateQr = async (evidence) => {
    await adminRotateMysteryQr(evidence.caseId, evidence._id);
    await loadCase(evidence.caseId);
  };

  if (!overview) {
    return <div className="p-6 text-white">{error || 'Loading…'}</div>;
  }

  const { event } = overview;
  const actions = STATUS_ACTIONS[event.status] || [];
  const demoTeam = event.isDemo ? overview.teams?.[0] : null;

  return (
    <div className="space-y-5 p-4 text-white md:p-6">
      <Link to={MYSTERY_PATHS.adminDashboard} className="text-xs text-white/50 hover:text-white">← All Mystery events</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{event.name || event.title}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${EVENT_STATUS_TONE[event.status] || 'bg-white/10 text-white/70'}`}>{EVENT_STATUS_LABEL[event.status] || event.status}</span>
          </div>
          <p className="text-sm text-white/50">{event.college || '—'} · {event.venue || 'Venue TBA'} · {overview.case?.title || 'No case'}</p>
          {lastRefresh && <p className="text-[11px] text-white/30">Updated {lastRefresh.toLocaleTimeString()}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map(([status, label]) => (
            <button
              key={status}
              type="button"
              disabled={busy}
              onClick={() => changeStatus(status, label)}
              className={status === 'live' ? 'rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40' : status === 'completed' ? 'rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-40' : `${ghostBtn} py-2 text-sm`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {event.status !== 'live' && (overview.counts?.teamsRegistered || 0) > 0 && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">Teams can log in, but clues unlock only after you press <b>Go live</b>.</p>
      )}
      {demoTeam && (
        <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          Demo login: <span className="font-mono">{demoTeam.teamCode}</span> / <span className="font-mono">demo1234</span> —{' '}
          <a href={mysteryEnterUrl(demoTeam.teamCode)} target="_blank" rel="noreferrer" className="underline">play ↗</a>
        </p>
      )}

      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? 'bg-[#0ECCEE] text-black' : 'bg-white/10 text-white/60'}`}>{label}</button>
        ))}
      </div>

      {tab === 'setup' && <SetupTab key={event.updatedAt} overview={overview} cases={cases} onSave={(u) => save(u)} busy={busy} />}
      {tab === 'teams' && <MysteryEventTeams eventId={eventId} overview={overview} onChanged={refresh} />}
      {tab === 'links' && <MysteryEventLinks eventId={eventId} overview={overview} onChanged={refresh} />}
      {tab === 'clues' && (caseDetail
        ? <MysteryQrPanel title={caseDetail.case?.title || 'Mystery'} evidence={caseDetail.evidence || []} branches={caseDetail.branches || []} onRotate={rotateQr} />
        : <p className={`${cardClass} text-sm text-white/50`}>Link a case in the Setup tab first.</p>)}
      {tab === 'live' && <MysteryEventLive overview={overview} />}
      {tab === 'results' && <MysteryEventResults eventId={eventId} overview={overview} onChanged={refresh} />}
    </div>
  );
}
