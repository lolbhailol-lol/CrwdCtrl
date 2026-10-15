import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminCreateMysteryCase, adminCreateMysteryDemo, adminCreateMysteryEvent,
  adminDeleteMysteryCase, adminDeleteMysteryEvent, adminListMysteryCases, adminListMysteryDemoTemplates,
  adminListMysteryEvents,
} from '../services/mystery.api';
import { MYSTERY_PATHS, mysteryEnterUrl, mysteryPublicUrl } from '../config';
import { difficultyTheme } from '../worldTheme';
import {
  EVENT_STATUS_LABEL, EVENT_STATUS_TONE, cardClass, copyText, dangerBtn, formatDateTime,
  ghostBtn, inputClass, labelClass, primaryBtn, slugify,
} from './mysteryAdminUtils';

const FLOW = [
  ['Create a case', 'Write the story, the suspect (like A-17) and the correct answer.'],
  ['Add clues', 'Each clue is physical, digital, human or logic. Only you know whether it can be trusted.'],
  ['Branch + twist', 'Let players choose a lead. Mid-game, declare one clue fake.'],
  ['Publish', 'Once the case is published, practice mode goes live at /mystery.'],
  ['Create an event', 'Set college, date, venue and capacity, then link a published case.'],
  ['Teams + links', 'Create teams from admin (code + password) or open registration. Copy the WhatsApp links.'],
  ['QR print', 'Print the QR sheet and stick the codes around the venue. Only you can see placement notes.'],
  ['Go live', 'Teams can scan as soon as you go live. Pause or end any time.'],
  ['Monitor', 'The Live tab shows each team\'s score, clues and last activity.'],
  ['Grade + results', 'Grade theories, finalize results and share the leaderboard.'],
];

const EMPTY_CASE = { title: '', tagline: '', synopsis: '', mysteryIdentityName: '', correctIdentityTheory: '', difficulty: 'detective', estimatedMinutes: 60 };
const EMPTY_EVENT = { name: '', college: '', slug: '', date: '', venue: '', caseId: '', teamCapacity: 20, teamSize: 4 };

export default function MysteryAdminDashboard() {
  const [tab, setTab] = useState('events');
  const [cases, setCases] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const [demo, setDemo] = useState(null);
  const [demoTemplates, setDemoTemplates] = useState([]);
  const [caseForm, setCaseForm] = useState(EMPTY_CASE);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT);
  const [slugTouched, setSlugTouched] = useState(false);

  const load = useCallback(async () => {
    const [c, e] = await Promise.all([adminListMysteryCases(), adminListMysteryEvents()]);
    setCases(Array.isArray(c) ? c : c?.data || []);
    setEvents(e?.data?.events || []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message || 'Load failed')).finally(() => setLoading(false));
    adminListMysteryDemoTemplates().then((res) => setDemoTemplates(res.data?.templates || [])).catch(() => {});
  }, [load]);

  const run = async (key, action) => {
    setBusy(key);
    setError('');
    setMsg('');
    try {
      await action();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy('');
    }
  };

  const createDemo = (template) => run(`demo-${template || 'default'}`, async () => {
    const res = await adminCreateMysteryDemo(template);
    setDemo(res.data);
    await load();
  });

  const createCase = () => run('case', async () => {
    if (!caseForm.title.trim() || !caseForm.synopsis.trim()) throw new Error('Title and synopsis are required');
    const created = await adminCreateMysteryCase({ ...caseForm, estimatedMinutes: Number(caseForm.estimatedMinutes) || 60 });
    setCaseForm(EMPTY_CASE);
    setMsg(`Case "${created.title}" created — now add clues.`);
    await load();
  });

  const createEvent = () => run('event', async () => {
    if (!eventForm.name.trim() || !eventForm.college.trim()) throw new Error('Event name and college are required');
    const slug = eventForm.slug.trim() || slugify(`${eventForm.college}-${eventForm.name}`);
    const res = await adminCreateMysteryEvent({
      ...eventForm,
      slug,
      date: eventForm.date || undefined,
      caseId: eventForm.caseId || undefined,
      teamCapacity: Number(eventForm.teamCapacity) || 20,
      teamSize: Number(eventForm.teamSize) || 4,
      status: 'draft',
    });
    setEventForm(EMPTY_EVENT);
    setSlugTouched(false);
    setMsg(`Event "${res.data?.event?.name}" created as a draft — open it to set up teams and links.`);
    await load();
  });

  const deleteEvent = (ev) => {
    if (!window.confirm(`Delete "${ev.name}" and all its teams and progress? This can't be undone.`)) return;
    run(`del-${ev._id}`, async () => {
      await adminDeleteMysteryEvent(ev._id);
      await load();
    });
  };

  const deleteCase = (c) => {
    if (!window.confirm(`Delete case "${c.title}" and all its clues?`)) return;
    run(`del-${c._id}`, async () => {
      await adminDeleteMysteryCase(c._id);
      await load();
    });
  };

  const updateEventName = (field, value) => setEventForm((f) => {
    const next = { ...f, [field]: value };
    if (!slugTouched && (field === 'name' || field === 'college')) next.slug = slugify(`${next.college}-${next.name}`);
    return next;
  });

  const publishedCases = cases.filter((c) => c.status === 'published');

  return (
    <div className="space-y-6 p-4 text-white md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">CTRL Mystery</h1>
          <p className="text-sm text-white/50">Manage cases, events, teams, QR clues and results — all in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={MYSTERY_PATHS.landing} target="_blank" rel="noreferrer" className={ghostBtn}>Player page ↗</a>
          <button type="button" onClick={() => setShowGuide((v) => !v)} className={ghostBtn}>{showGuide ? 'Hide guide' : 'How it works'}</button>
        </div>
      </div>

      {showGuide && (
        <section className={cardClass}>
          <p className="text-sm font-semibold text-[#0ECCEE]">Full flow — 10 steps</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {FLOW.map(([title, text], i) => (
              <li key={title} className="flex gap-3 rounded-xl bg-black/20 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0ECCEE]/15 text-xs font-bold text-[#0ECCEE]">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-white/50">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-orange-500/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">Ready-made games — play in 1 click</p>
            <p className="text-xs text-white/55">Each one creates the case, a live event and a team login. Great for testing and for showing CTRL Mystery to a college. Delete them any time.</p>
          </div>
          {demoTemplates.length === 0 && (
            <button type="button" disabled={Boolean(busy)} onClick={() => createDemo()} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
              {busy === 'demo-default' ? 'Creating…' : 'Create demo'}
            </button>
          )}
        </div>
        {demoTemplates.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {demoTemplates.map((t) => {
              const level = difficultyTheme(t.difficulty);
              return (
                <div key={t.id} className="flex flex-col rounded-xl border bg-black/30 p-4" style={{ borderColor: `${level.color}55` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${level.color}26`, color: level.color }}>{level.label}</span>
                    <span className="text-xs text-white/45">{t.estimatedMinutes} min</span>
                  </div>
                  <p className="mt-2 font-bold">{t.title}</p>
                  <p className="mt-1 flex-1 text-xs text-white/55">{t.tagline}</p>
                  <p className="mt-3 text-[11px] text-white/45">
                    {t.clueCount} clues · {t.branchCount ? `${t.branchCount} branch · ` : ''}{t.twistCount} twist{t.twistCount === 1 ? '' : 's'}
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => createDemo(t.id)}
                    className="mt-3 rounded-xl py-2 text-sm font-bold text-black disabled:opacity-40"
                    style={{ background: level.color }}
                  >
                    {busy === `demo-${t.id}` ? 'Creating…' : 'Create & play'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {demo && (
          <div className="mt-4 grid gap-3 rounded-xl bg-black/30 p-3 text-sm sm:grid-cols-2">
            <p className="font-semibold text-emerald-300 sm:col-span-2">Ready to play: {demo.case.title}</p>
            <div>
              <p className="text-xs text-white/40">Team login</p>
              <p className="font-mono text-lg text-[#0ECCEE]">{demo.team.teamCode}</p>
              <p className="font-mono text-white/80">password: {demo.team.password}</p>
            </div>
            <div className="flex flex-wrap content-start gap-2">
              <a href={mysteryEnterUrl(demo.team.teamCode)} target="_blank" rel="noreferrer" className={primaryBtn}>Play as team ↗</a>
              <Link to={MYSTERY_PATHS.adminEvent(demo.event._id)} className={ghostBtn}>Open event control</Link>
              <Link to={MYSTERY_PATHS.adminCase(demo.case._id)} className={ghostBtn}>See case setup</Link>
              <button type="button" className={ghostBtn} onClick={() => copyText(`CTRL Mystery demo\nLink: ${mysteryEnterUrl(demo.team.teamCode)}\nTeam code: ${demo.team.teamCode}\nPassword: ${demo.team.password}`).then(() => setMsg('Demo login copied'))}>Copy login</button>
            </div>
            <p className="text-xs text-white/40 sm:col-span-2">Tip: log in on your phone, then open the QR tab in event control and scan the codes off your screen.</p>
          </div>
        )}
      </section>

      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="flex gap-2">
        {[['events', `Events (${events.length})`], ['cases', `Cases (${cases.length})`]].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? 'bg-[#0ECCEE] text-black' : 'bg-white/10 text-white/60'}`}>{label}</button>
        ))}
      </div>

      {loading && <p className="text-white/50">Loading…</p>}

      {tab === 'events' && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-3`}>
            <p className="text-sm font-semibold text-[#0ECCEE]">New event</p>
            {publishedCases.length === 0 && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">No published cases yet. The event will be saved as a draft — publish a case in the Cases tab, then link it.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>College
                <input value={eventForm.college} onChange={(e) => updateEventName('college', e.target.value)} placeholder="e.g. MIT WPU" className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Event name
                <input value={eventForm.name} onChange={(e) => updateEventName('name', e.target.value)} placeholder="e.g. Mystery Night 2026" className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Case
                <select value={eventForm.caseId} onChange={(e) => setEventForm((f) => ({ ...f, caseId: e.target.value }))} className={`mt-1 ${inputClass}`}>
                  <option value="">— choose later —</option>
                  {publishedCases.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </label>
              <label className={labelClass}>Date & time
                <input type="datetime-local" value={eventForm.date} onChange={(e) => setEventForm((f) => ({ ...f, date: e.target.value }))} className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Venue
                <input value={eventForm.venue} onChange={(e) => setEventForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Main auditorium" className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Slug
                <input value={eventForm.slug} onChange={(e) => { setSlugTouched(true); setEventForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} className={`mt-1 font-mono ${inputClass}`} />
              </label>
              <label className={labelClass}>Max teams
                <input type="number" min={1} max={500} value={eventForm.teamCapacity} onChange={(e) => setEventForm((f) => ({ ...f, teamCapacity: e.target.value }))} className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>People per team
                <input type="number" min={1} max={12} value={eventForm.teamSize} onChange={(e) => setEventForm((f) => ({ ...f, teamSize: e.target.value }))} className={`mt-1 ${inputClass}`} />
              </label>
            </div>
            <button type="button" disabled={Boolean(busy)} onClick={createEvent} className={primaryBtn}>{busy === 'event' ? 'Creating…' : 'Create event'}</button>
          </section>

          {events.map((ev) => (
            <div key={ev._id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link to={MYSTERY_PATHS.adminEvent(ev._id)} className="min-w-0 flex-1 hover:text-[#0ECCEE]">
                  <p className="font-semibold">{ev.name || ev.title}{ev.isDemo && <span className="ml-2 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">demo</span>}</p>
                  <p className="text-sm text-white/50">{ev.college || '—'} · {formatDateTime(ev.date || ev.dateTime)} · {ev.caseId?.title || 'No case linked'}</p>
                  <p className="mt-1 text-xs text-white/40">{ev.teamsRegistered}/{ev.teamCapacity || '∞'} teams · {ev.teamSize || 4}/team</p>
                </Link>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${EVENT_STATUS_TONE[ev.status] || 'bg-white/10 text-white/70'}`}>{EVENT_STATUS_LABEL[ev.status] || ev.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={MYSTERY_PATHS.adminEvent(ev._id)} className={ghostBtn}>Open control</Link>
                <button type="button" className={ghostBtn} onClick={() => copyText(mysteryPublicUrl(MYSTERY_PATHS.leaderboard(ev._id))).then(() => setMsg('Leaderboard link copied'))}>Copy leaderboard link</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => deleteEvent(ev)} className={`ml-auto ${dangerBtn}`}>Delete</button>
              </div>
            </div>
          ))}
          {!loading && events.length === 0 && <p className="text-sm text-white/40">No events yet. Create one above, or try the demo.</p>}
        </div>
      )}

      {tab === 'cases' && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-3`}>
            <p className="text-sm font-semibold text-[#0ECCEE]">New case</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Title
                <input value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} placeholder="The 17-Minute Gap" className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Tagline
                <input value={caseForm.tagline} onChange={(e) => setCaseForm({ ...caseForm, tagline: e.target.value })} placeholder="One-line hook" className={`mt-1 ${inputClass}`} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Synopsis (shown to players on the first screen)
                <textarea rows={3} value={caseForm.synopsis} onChange={(e) => setCaseForm({ ...caseForm, synopsis: e.target.value })} className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Mystery identity
                <input value={caseForm.mysteryIdentityName} onChange={(e) => setCaseForm({ ...caseForm, mysteryIdentityName: e.target.value })} placeholder="A-17" className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Difficulty
                <select value={caseForm.difficulty} onChange={(e) => setCaseForm({ ...caseForm, difficulty: e.target.value })} className={`mt-1 ${inputClass}`}>
                  <option value="rookie">Rookie</option>
                  <option value="detective">Detective</option>
                  <option value="master">Master</option>
                </select>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Correct answer (visible only to admins — used for grading)
                <input value={caseForm.correctIdentityTheory} onChange={(e) => setCaseForm({ ...caseForm, correctIdentityTheory: e.target.value })} className={`mt-1 ${inputClass}`} />
              </label>
              <label className={labelClass}>Estimated minutes
                <input type="number" min={5} value={caseForm.estimatedMinutes} onChange={(e) => setCaseForm({ ...caseForm, estimatedMinutes: e.target.value })} className={`mt-1 ${inputClass}`} />
              </label>
            </div>
            <button type="button" disabled={Boolean(busy)} onClick={createCase} className={primaryBtn}>{busy === 'case' ? 'Creating…' : 'Create case'}</button>
          </section>

          {cases.map((c) => (
            <div key={c._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Link to={MYSTERY_PATHS.adminCase(c._id)} className="min-w-0 flex-1 hover:text-[#0ECCEE]">
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-white/50">{c.tagline || '—'} · {c.difficulty}</p>
              </Link>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${c.status === 'published' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{c.status}</span>
              <Link to={MYSTERY_PATHS.adminCase(c._id)} className={ghostBtn}>Edit clues</Link>
              <button type="button" disabled={Boolean(busy)} onClick={() => deleteCase(c)} className={dangerBtn}>Delete</button>
            </div>
          ))}
          {!loading && cases.length === 0 && <p className="text-sm text-white/40">No cases yet.</p>}
        </div>
      )}
    </div>
  );
}
