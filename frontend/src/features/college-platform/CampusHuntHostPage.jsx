import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Flag,
  LockKeyhole,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import {
  createHostedCampusHunt,
  createHostedHuntControlSession,
  createHostedHuntOperator,
  activateHostedHuntCheckInPack,
  emergencyOperatorAction,
  emergencyOperatorLogin,
  getCampusHostProfile,
  getHostedHuntDashboard,
  listHostedCampusHunts,
  requestHostedHuntRefund,
  revokeHostedHuntOperator,
  runHostedHuntOperation,
  saveCampusHostProfile,
  sendHostedHuntAnnouncement,
  submitHostedCampusHunt,
  syncHostedHuntCheckInPack,
  updateHostedCampusHunt,
} from './api';
import './campusHuntHost.css';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const dateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const formDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
const READINESS_LABELS = {
  hostApproved: 'Host approval',
  minimumPaidTeams: 'Minimum paid teams',
  teammatesVerified: 'All teammates verified',
  eventProvisioned: 'Hunt provisioned',
  infrastructureReady: 'Routes and schedule ready',
  offlinePackCurrent: 'Final offline packs ready',
  emergencyOperator: 'Emergency operator added',
  notEmergencyStopped: 'No emergency stop',
};

async function hashText(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function HostShell({ title, children, back = false }) {
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
  return (
    <main className={`hunt-host ${isDark ? 'hunt-host--dark' : ''}`}>
      <header className="hunt-host__header">
        {back ? <button type="button" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button> : <span className="hunt-host__mark">Ctrl.</span>}
        <div><small>Campus Hunt Host</small><h1>{title}</h1></div>
        <ShieldCheck className="hunt-host__shield" />
      </header>
      {children}
    </main>
  );
}

function Notice({ type = 'info', children }) {
  return <div className={`hunt-host__notice hunt-host__notice--${type}`}>{type === 'error' ? <AlertTriangle /> : <BadgeCheck />}{children}</div>;
}

function StatusChip({ value }) {
  return <span className={`hunt-host__status hunt-host__status--${String(value || '').replace(/_/g, '-')}`}>{String(value || 'draft').replace(/_/g, ' ')}</span>;
}

function HostFlowPreview() {
  const steps = [
    ['01', 'Verify host', 'College, phone and club details'],
    ['02', 'Create event', 'Date, teams, entry fee and prize'],
    ['03', 'Build Hunt', 'Places, clues, routes and test teams'],
    ['04', 'Get approval', 'CrwdCtrl reviews the complete setup'],
    ['05', 'Run game day', 'Check-in, start, pause and live control'],
    ['06', 'Finish', 'Results, disputes, prizes and payout'],
  ];
  return <section className="hunt-host__flow"><div><span className="hunt-host__eyebrow">Complete organizer journey</span><h2>Everything from setup to results</h2><p>Each stage opens only when the previous one is complete.</p></div><div className="hunt-host__flow-grid">{steps.map(([number, title, copy]) => <article key={number}><b>{number}</b><span><strong>{title}</strong><small>{copy}</small></span></article>)}</div></section>;
}

const emptyDraft = () => ({
  title: '', tagline: '', description: '', coverImage: '', city: '', venue: '', meetingPoint: '',
  startsAt: '', endsAt: '', registrationOpensAt: '', registrationClosesAt: '', checkInOpensAt: '', checkInClosesAt: '',
  teamSize: 4, capacity: 10, minimumTeams: 5, feePerTeam: 200, prizeAmount: 0,
  rules: ['Stay with your team', 'Follow volunteer instructions'],
  requirements: ['One charged phone per team'],
  safetyNotes: ['Do not enter restricted areas'],
  campusStarts: [{ name: '' }],
  campusStations: Array.from({ length: 6 }, () => ({ name: '', zone: '', riddle: '', joinedWord: '' })),
  destinationName: '',
});

function StringList({ label, value, onChange }) {
  return <label>{label}<textarea rows={3} value={(value || []).join('\n')} onChange={(event) => onChange(event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} /><small>One item per line</small></label>;
}

function HostProfileForm({ user, initial, onSaved }) {
  const [form, setForm] = useState({
    fullName: initial?.fullName || user?.name || '', collegeName: initial?.college?.name || '', phone: initial?.phone || '', clubName: initial?.clubName || '',
    roleTitle: initial?.roleTitle || '',
    responsibilityAccepted: false, conductAccepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const data = await saveCampusHostProfile(form); onSaved(data.profile); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="hunt-host__panel hunt-host__form" onSubmit={save}>
      <div className="hunt-host__eyebrow">Step 1 · Host verification</div>
      <h2>Become a verified Campus Hunt host</h2>
      <div className="hunt-host__grid">
        <label>Full name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
        <label>Login email<input value={user?.email || ''} disabled /></label>
        <label>College name<input value={form.collegeName} onChange={(e) => setForm({ ...form, collegeName: e.target.value })} placeholder="Type your college name" required /></label>
        <label>Verified phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required inputMode="tel" /></label>
        <label>Club / student body<input value={form.clubName} onChange={(e) => setForm({ ...form, clubName: e.target.value })} /></label>
        <label>Your role<input value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} placeholder="Coordinator, president…" required /></label>
      </div>
      <label className="hunt-host__check"><input type="checkbox" checked={form.responsibilityAccepted} onChange={(e) => setForm({ ...form, responsibilityAccepted: e.target.checked })} />I accept responsibility for safety and on-ground execution.</label>
      <label className="hunt-host__check"><input type="checkbox" checked={form.conductAccepted} onChange={(e) => setForm({ ...form, conductAccepted: e.target.checked })} />I will follow participant conduct, refund and fair-play rules.</label>
      {error ? <Notice type="error">{error}</Notice> : null}
      <button className="hunt-host__primary" disabled={busy}>{busy ? 'Saving…' : 'Submit host profile'}</button>
    </form>
  );
}

function HuntWizard({ onCreated, initial = null, gameId = '', collegeName = '', initialStep = 1 }) {
  const [step, setStep] = useState(Math.min(initialStep, 2));
  const [form, setForm] = useState(() => {
    if (!initial) return emptyDraft();
    const source = initial.pendingRevision || initial.hostDraft || initial;
    return {
      ...emptyDraft(),
      ...source,
      startsAt: formDateTime(source.startsAt),
      endsAt: formDateTime(source.endsAt),
      registrationOpensAt: formDateTime(source.registrationOpensAt),
      registrationClosesAt: formDateTime(source.registrationClosesAt),
      checkInOpensAt: formDateTime(source.checkInOpensAt),
      checkInClosesAt: formDateTime(source.checkInClosesAt),
    };
  });
  const [game, setGame] = useState(gameId ? { id: gameId } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const economics = useMemo(() => {
    const projected = Number(form.feePerTeam || 0) * Number(form.capacity || 0);
    const minimum = Number(form.feePerTeam || 0) * Number(form.minimumTeams || 0);
    return { projected, minimum, gateway: projected * 0.016, payout: Math.max(0, projected * 0.584 - Number(form.prizeAmount || 0)), covers: minimum * 0.584 >= Number(form.prizeAmount || 0) };
  }, [form.capacity, form.feePerTeam, form.minimumTeams, form.prizeAmount]);
  const updateStart = (index, value) => setForm({ ...form, campusStarts: form.campusStarts.map((item, i) => i === index ? { name: value } : item) });
  const updateStation = (index, key, value) => setForm({ ...form, campusStations: form.campusStations.map((item, i) => i === index ? { ...item, [key]: value } : item) });
  const saveDraft = async () => {
    setBusy(true); setError('');
    try {
      const eventDate = form.startsAt ? new Date(form.startsAt) : null;
      const registrationClosesAt = form.registrationClosesAt || (eventDate && !Number.isNaN(eventDate.getTime())
        ? new Date(eventDate.getTime() - 60 * 60 * 1000).toISOString()
        : '');
      const payload = {
        ...form,
        description: form.description || form.title || 'Campus Hunt',
        endsAt: form.endsAt || form.startsAt,
        registrationOpensAt: form.registrationOpensAt || '',
        registrationClosesAt,
      };
      const existingGameId = gameId || game?.id || game?._id;
      const data = existingGameId ? await updateHostedCampusHunt(existingGameId, payload) : await createHostedCampusHunt(payload);
      setGame(data.game);
      if (!existingGameId) onCreated(data.game?.id || data.game?._id);
      else if (step === 2) {
        await submitHostedCampusHunt(data.game?.id || data.game?._id);
        onCreated(data.game?.id || data.game?._id);
      } else setStep(1);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <section className="hunt-host__panel hunt-host__wizard">
      <div className="hunt-host__wizard-head"><div><small>Campus Hunt</small><h2>Create your Campus Hunt</h2></div><span>{step === 1 ? (game ? 'Event saved' : 'Event details') : 'Places and clues'}</span></div>
      {step === 1 && !game ? <div className="hunt-host__form"><div className="hunt-host__grid"><label>College name<input value={collegeName} disabled /></label><label>Event name<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Spring Campus Hunt" required /></label><label>Event date<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></label><label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label><label>Venue<input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} required /></label><label>Overall teams<input type="number" min="2" max="200" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required /></label><label>People per team<input type="number" min="2" max="12" value={form.teamSize} onChange={(e) => setForm({ ...form, teamSize: Number(e.target.value) })} required /></label><label>Minimum teams<input type="number" min="1" max="200" value={form.minimumTeams} onChange={(e) => setForm({ ...form, minimumTeams: Number(e.target.value) })} required /></label><label>Entry fee / team<input type="number" min="0" value={form.feePerTeam} onChange={(e) => setForm({ ...form, feePerTeam: Number(e.target.value) })} /></label><label>Prize allocation <small>(optional)</small><input type="number" min="0" value={form.prizeAmount} onChange={(e) => setForm({ ...form, prizeAmount: Number(e.target.value) })} /></label></div><div className="hunt-host__money-grid"><div><small>Potential collection</small><b>{money(economics.projected)}</b></div><div><small>Gateway estimate</small><b>{money(economics.gateway)}</b></div><div><small>Estimated host payout</small><b>{money(economics.payout)}</b></div></div>{!economics.covers ? <Notice type="error">Minimum-team collection does not fully fund the prize and fees.</Notice> : null}</div> : null}
      {step === 1 && game ? <div className="hunt-host__saved-box"><div><span className="hunt-host__eyebrow">Saved</span><h3>{form.title || game.title}</h3><p>{form.city || game.city} · {form.venue || game.venue}</p></div><button type="button" className="hunt-host__primary" onClick={() => setStep(2)}>Places <ChevronRight /></button></div> : null}
      {step === 2 ? <div className="hunt-host__form"><div className="hunt-host__section-title"><MapPin /><div><h3>Places</h3><p>Starting points and campus stations.</p></div><button type="button" onClick={() => form.campusStarts.length < 4 && setForm({ ...form, campusStarts: [...form.campusStarts, { name: '' }] })}><Plus /></button></div>{form.campusStarts.map((item, index) => <div className="hunt-host__inline" key={`start-${index}`}><input placeholder={`Start ${index + 1}`} value={item.name} onChange={(e) => updateStart(index, e.target.value)} />{form.campusStarts.length > 1 ? <button type="button" onClick={() => setForm({ ...form, campusStarts: form.campusStarts.filter((_, i) => i !== index) })}><X /></button> : null}</div>)}<div className="hunt-host__section-title"><Flag /><div><h3>Campus stations</h3><p>Clues and locations.</p></div><button type="button" onClick={() => form.campusStations.length < 20 && setForm({ ...form, campusStations: [...form.campusStations, { name: '', zone: '', riddle: '', joinedWord: '' }] })}><Plus /></button></div>{form.campusStations.map((station, index) => <article className="hunt-host__station" key={`station-${index}`}><div><strong>S{String(index + 1).padStart(2, '0')}</strong>{form.campusStations.length > 6 ? <button type="button" onClick={() => setForm({ ...form, campusStations: form.campusStations.filter((_, i) => i !== index) })}><X /></button> : null}</div><input placeholder="Location name" value={station.name} onChange={(e) => updateStation(index, 'name', e.target.value)} /><input placeholder="Zone" value={station.zone} onChange={(e) => updateStation(index, 'zone', e.target.value)} /><textarea placeholder="Location riddle" value={station.riddle} onChange={(e) => updateStation(index, 'riddle', e.target.value)} /><input placeholder="Joined word (optional)" value={station.joinedWord} onChange={(e) => updateStation(index, 'joinedWord', e.target.value)} /></article>)}<label>Finish destination<input value={form.destinationName} onChange={(e) => setForm({ ...form, destinationName: e.target.value })} /></label></div> : null}
      {error ? <Notice type="error">{error}</Notice> : null}
      <div className="hunt-host__wizard-actions">{step > 1 ? <button type="button" onClick={() => setStep(step - 1)}>Back</button> : null}{step === 1 && !game ? <button type="button" className="hunt-host__primary" disabled={busy} onClick={saveDraft}>{busy ? 'Saving…' : 'Save event details'} <ChevronRight /></button> : null}{step === 2 ? <button type="button" className="hunt-host__primary" disabled={busy} onClick={saveDraft}>{busy ? 'Submitting…' : 'Save & submit for approval'} <Send /></button> : null}</div>
    </section>
  );
}

export default function CampusHuntHostPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      if (!isAuthenticated) return;
      const profileData = await getCampusHostProfile(); setProfile(profileData.profile);
      if (profileData.profile) { const gameData = await listHostedCampusHunts(); setGames(gameData.games || []); }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [isAuthenticated]);
  if (!isAuthenticated) return <HostShell title="Host a Campus Hunt"><section className="hunt-host__hero"><LockKeyhole /><h2>Sign in to become a host</h2><p>Use your normal Google or CrwdCtrl login to apply.</p><Link className="hunt-host__primary" to="/login?redirect=/host-a-game">Sign in</Link></section></HostShell>;
  if (loading) return <HostShell title="Host a Campus Hunt"><div className="hunt-host__loading"><RefreshCw /> Loading host workspace…</div></HostShell>;
  return (
    <HostShell title="Host a Campus Hunt">
      <section className="hunt-host__content">
        {error ? <Notice type="error">{error}</Notice> : null}
        <HostFlowPreview />
        {!profile || profile.status !== 'approved' ? <><HostProfileForm user={user} initial={profile} onSaved={(next) => { setProfile(next); setError(next.status === 'approved' ? '' : 'Profile submitted. CrwdCtrl must approve it before you create a Hunt.'); }} />{profile ? <Notice>Your host profile is <strong>{profile.status.replace(/_/g, ' ')}</strong>. Approval expires annually.</Notice> : null}</> : null}
        {profile?.status === 'approved' ? <>
          <div className="hunt-host__owner"><div><BadgeCheck /><span><strong>{profile.fullName}</strong><small>Verified Campus Hunt Host · until {new Date(profile.verifiedUntil).toLocaleDateString('en-IN')}</small></span></div><button type="button" onClick={() => setCreating(!creating)}>{creating ? 'Close wizard' : 'Create from start'} <Plus /></button></div>
          {creating ? <HuntWizard collegeName={profile.college?.name || profile.collegeName || ''} onCreated={(id) => navigate(`/host-a-game/${id}`)} /> : null}
          <div className="hunt-host__section-title"><Trophy /><div><h3>Your Campus Hunts</h3><p>Drafts, approvals and live operations.</p></div></div>
          <div className="hunt-host__cards">{games.map((game) => <Link className="hunt-host__game-card" to={`/host-a-game/${game.id || game._id}`} key={game.id || game._id}><div><StatusChip value={game.approvalStatus} /><StatusChip value={game.operationalStatus} /></div><h3>{game.title}</h3><p><MapPin /> {game.venue} · {game.city}</p><p><Users /> {game.reservedSlots || 0}/{game.capacity} teams</p><span>Open workspace <ChevronRight /></span></Link>)}{!games.length && !creating ? <div className="hunt-host__empty"><Trophy /><h3>No hunts yet</h3><p>Use Create from start to build your Campus Hunt.</p></div> : null}</div>
        </> : null}
      </section>
    </HostShell>
  );
}

export function CampusHuntHostDashboardPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [announcement, setAnnouncement] = useState({ title: '', message: '' });
  const [operator, setOperator] = useState({ role: 'emergency_operator', label: '', password: '', checkpointId: '' });
  const [issuedPassword, setIssuedPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const packKey = `campus_hunt_checkin_pack_${gameId}`;
  const [checkInPack, setCheckInPack] = useState(() => { try { return JSON.parse(localStorage.getItem(packKey) || 'null'); } catch { return null; } });
  const [passToken, setPassToken] = useState('');
  const load = async () => {
    try {
      const dashboard = await getHostedHuntDashboard(gameId);
      setData(dashboard);
      setError('');
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [gameId]);
  const openControl = async () => { setBusy('control'); setError(''); try { const session = await createHostedHuntControlSession(gameId); localStorage.setItem('campus_hunt_admin_token', session.accessToken); navigate(`/campus-hunt/admin/${session.eventId}`); } catch (err) { setError(err.message); } finally { setBusy(''); } };
  const submitSetup = async () => { setBusy('submit'); setError(''); try { await submitHostedCampusHunt(gameId); await load(); } catch (err) { setError(err.message); } finally { setBusy(''); } };
  const runLifecycle = async (action) => {
    const labels = {
      'close-registration': 'Close registration and lock the final roster?',
      ready: 'Mark this Hunt ready for launch?',
      start: 'Start the Hunt and open player access?',
      pause: 'Pause new team releases?',
      resume: 'Resume team releases?',
      complete: 'Complete the Hunt and finalize results?',
    };
    if (!window.confirm(labels[action] || `Run ${action}?`)) return;
    setBusy(action);
    setError('');
    try {
      await runHostedHuntOperation(gameId, action);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };
  const broadcast = async (event) => { event.preventDefault(); setBusy('announce'); try { await sendHostedHuntAnnouncement(gameId, announcement); setAnnouncement({ title: '', message: '' }); await load(); } catch (err) { setError(err.message); } finally { setBusy(''); } };
  const addOperator = async (event) => { event.preventDefault(); setBusy('operator'); try { const payload = { ...operator, checkpointIds: operator.role === 'checkpoint_volunteer' ? [operator.checkpointId] : [] }; const result = await createHostedHuntOperator(gameId, payload); setIssuedPassword(result.password); setOperator({ role: 'emergency_operator', label: '', password: '', checkpointId: '' }); await load(); } catch (err) { setError(err.message); } finally { setBusy(''); } };
  const activateCheckIn = async () => { setBusy('checkin-pack'); try { const deviceId = localStorage.getItem('campus_hunt_host_device') || cryptoRandomId(); localStorage.setItem('campus_hunt_host_device', deviceId); const response = await activateHostedHuntCheckInPack(gameId, deviceId); const next = { ...response.pack, deviceId, queue: [] }; localStorage.setItem(packKey, JSON.stringify(next)); setCheckInPack(next); } catch (err) { setError(err.message); } finally { setBusy(''); } };
  const queueCheckIn = async (event) => { event.preventDefault(); if (!checkInPack || !passToken.trim()) return; const passHash = await hashText(passToken.trim()); const known = checkInPack.passes.find((entry) => entry.passHash === passHash); if (!known) { setError('Pass is not in this final roster, or it was revoked.'); return; } const sequence = Math.max(checkInPack.lastSequence || 0, ...checkInPack.queue.map((item) => item.sequence), 0) + 1; const next = { ...checkInPack, queue: [...checkInPack.queue, { sequence, passHash }] }; localStorage.setItem(packKey, JSON.stringify(next)); setCheckInPack(next); setPassToken(''); setError(''); };
  const syncCheckIns = async () => { if (!checkInPack?.queue?.length) return; setBusy('checkin-sync'); try { const result = await syncHostedHuntCheckInPack(gameId, { packId: checkInPack.id, deviceId: checkInPack.deviceId, actions: checkInPack.queue }); const next = { ...checkInPack, queue: [], lastSequence: result.lastSequence }; localStorage.setItem(packKey, JSON.stringify(next)); setCheckInPack(next); if (result.conflicts?.length) setError(`${result.conflicts.length} offline check-in conflict(s) need admin review.`); await load(); } catch (err) { setError(err.message); } finally { setBusy(''); } };
  if (!data) return <HostShell title="Hunt workspace" back>{error ? <Notice type="error">{error}</Notice> : <div className="hunt-host__loading"><RefreshCw /> Loading Hunt…</div>}</HostShell>;
  const { game, readiness, finance } = { ...data, finance: data.readiness?.finance || {} };
  const blockedChecks = Object.entries(readiness.checks || {}).filter(([, passed]) => !passed);
  return (
    <HostShell title={game.title} back>
      <section className="hunt-host__content hunt-host__dashboard">
        {error ? <Notice type="error">{error}</Notice> : null}
        {game.emergencyStoppedAt ? <Notice type="error">Emergency stop active · {game.emergencyStopReason}</Notice> : null}
        <div className="hunt-host__owner"><div><span><strong>{dateTime(game.startsAt)}</strong><small>{game.venue} · {game.city}</small></span></div><div><StatusChip value={game.approvalStatus} /><StatusChip value={game.operationalStatus} /></div></div>
        {!['live', 'completed', 'cancelled'].includes(game.operationalStatus) ? <div className="hunt-host__actions"><button type="button" className="hunt-host__text-link" onClick={() => { setWizardStep(1); setEditing(!editing); }}>{editing ? 'Close revision editor' : 'Edit draft / submit revision'}</button></div> : null}
        {editing ? <HuntWizard collegeName={data.profile?.college?.name || data.profile?.collegeName || ''} initial={game} gameId={gameId} initialStep={wizardStep} onCreated={() => { setEditing(false); load(); }} /> : null}
        <article className="hunt-host__panel hunt-host__launch-card">
          <div><span className="hunt-host__eyebrow">Next step</span><h2>{['draft', 'changes_required'].includes(game.approvalStatus) ? 'Build your Hunt in Campus Hunt control' : game.approvalStatus === 'pending_approval' ? 'Waiting for CrwdCtrl approval' : 'Open Campus Hunt control'}</h2><p>{['draft', 'changes_required'].includes(game.approvalStatus) ? 'Open the real control room to create Locations, Clues, Teams, Links and test the Hunt. Return here when ready to submit.' : game.approvalStatus === 'pending_approval' ? 'Your Hunt setup is being reviewed. You can still open the control room to review it.' : 'Use the proven Campus Hunt control room for Places, Clues, Teams, Links, testing and Live operations.'}</p></div>
          <div className="hunt-host__actions">
            {data.profile?.status === 'approved' ? <button type="button" className="hunt-host__primary" onClick={openControl} disabled={busy === 'control'}>{busy === 'control' ? 'Preparing…' : 'Open Campus Hunt control'} <ChevronRight /></button> : null}
            {['draft', 'changes_required'].includes(game.approvalStatus) ? <button type="button" onClick={submitSetup} disabled={busy === 'submit'}>{busy === 'submit' ? 'Submitting…' : 'Submit setup for approval'} <Send /></button> : null}
          </div>
          {game.approvalStatus === 'approved' && blockedChecks.length ? <div className="hunt-host__launch-blockers">{blockedChecks.map(([key]) => <span key={key}><X /> {READINESS_LABELS[key] || key.replace(/([A-Z])/g, ' $1')}</span>)}</div> : null}
        </article>
        <div className="hunt-host__stats"><div><Users /><b>{finance.paidTeams || 0}/{game.capacity}</b><span>Paid teams</span></div><div><CircleDollarSign /><b>{money(finance.netCollected)}</b><span>Net collected</span></div><div><Trophy /><b>{money(finance.hostPayout)}</b><span>Host payout</span></div><div><ShieldCheck /><b>{readiness.ready ? 'Ready' : 'Blocked'}</b><span>Launch status</span></div></div>
        {game.approvalStatus === 'approved' && !['completed', 'cancelled'].includes(game.operationalStatus) ? <article className="hunt-host__panel"><div className="hunt-host__section-title"><Play /><div><h3>Run event</h3><p>Use these in order. Online players and offline packs stay on the same scoreboard.</p></div></div><div className="hunt-host__actions">{game.operationalStatus === 'published' ? <button type="button" onClick={() => runLifecycle('close-registration')} disabled={Boolean(busy)}>1. Close registration</button> : null}{game.operationalStatus === 'registration_closed' ? <button type="button" onClick={() => runLifecycle('ready')} disabled={Boolean(busy)}>2. Mark ready</button> : null}{game.operationalStatus === 'ready' ? <button type="button" className="hunt-host__primary" onClick={() => runLifecycle('start')} disabled={Boolean(busy)}><Play /> 3. Start Hunt</button> : null}{game.operationalStatus === 'live' ? <><button type="button" onClick={() => runLifecycle('pause')} disabled={Boolean(busy)}><Pause /> Pause releases</button><button type="button" onClick={() => runLifecycle('resume')} disabled={Boolean(busy)}><Play /> Resume releases</button><button type="button" className="hunt-host__primary" onClick={() => runLifecycle('complete')} disabled={Boolean(busy)}><Flag /> Complete &amp; finalize</button></> : null}</div>{game.operationalStatus === 'registration_closed' && blockedChecks.length ? <Notice type="error">Finish the launch blockers shown above before marking ready.</Notice> : null}</article> : null}
        <article id="host-workflow-links" className="hunt-host__panel"><div className="hunt-host__section-title"><Smartphone /><div><h3>Offline pass check-in</h3><p>Activate online once. Only pass hashes and queued sequence numbers stay on this device.</p></div></div>{!checkInPack ? <button type="button" onClick={activateCheckIn} disabled={busy === 'checkin-pack'}>Activate final roster pack</button> : <><Notice>Batch {checkInPack.exportBatchId} · {checkInPack.passes.length} passes · expires {dateTime(checkInPack.expiresAt)}</Notice><form className="hunt-host__inline-form" onSubmit={queueCheckIn}><input value={passToken} onChange={(e) => setPassToken(e.target.value)} placeholder="Scan or paste signed pass token" required /><button>Queue offline</button><button type="button" className="hunt-host__primary" onClick={syncCheckIns} disabled={!checkInPack.queue.length || busy === 'checkin-sync'}>Sync {checkInPack.queue.length || ''}</button></form></>}</article>
        <article className="hunt-host__panel"><div className="hunt-host__section-title"><Smartphone /><div><h3>Emergency operator and volunteers</h3><p>Temporary, expiring and device-bound access.</p></div></div><form className="hunt-host__inline-form" onSubmit={addOperator}><select value={operator.role} onChange={(e) => setOperator({ ...operator, role: e.target.value, checkpointId: '' })}><option value="emergency_operator">Emergency operator</option><option value="checkpoint_volunteer">Checkpoint volunteer</option></select>{operator.role === 'checkpoint_volunteer' ? <select required value={operator.checkpointId} onChange={(e) => setOperator({ ...operator, checkpointId: e.target.value })}><option value="">Choose one checkpoint</option>{data.checkpoints.map((checkpoint) => <option key={checkpoint._id} value={checkpoint._id}>{checkpoint.locationName} · {checkpoint.progressionKey || checkpoint.checkpointKey}</option>)}</select> : null}<input placeholder="Name / label" value={operator.label} onChange={(e) => setOperator({ ...operator, label: e.target.value })} required /><input placeholder="Password or auto-generate" value={operator.password} onChange={(e) => setOperator({ ...operator, password: e.target.value })} /><button disabled={busy === 'operator'}>Create access</button></form>{issuedPassword ? <Notice>Show once: <strong>{issuedPassword}</strong></Notice> : null}<div className="hunt-host__list">{data.operators.map((item) => <div key={item._id}><span><strong>{item.label}</strong><small>{item.role.replace(/_/g, ' ')} · {item.code} · expires {dateTime(item.expiresAt)}</small></span><button onClick={async () => { await revokeHostedHuntOperator(gameId, item._id); load(); }}>Revoke</button></div>)}</div><Link className="hunt-host__text-link" to="/campus-hunt/host-mode">Open emergency Host Mode <ChevronRight /></Link></article>
        <article className="hunt-host__panel"><div className="hunt-host__section-title"><Users /><div><h3>Participants</h3><p>Teammate emails stay hidden.</p></div></div><div className="hunt-host__table">{data.registrations.map((registration) => <div key={registration.id}><span><strong>{registration.teamName}</strong><small>{registration.captainName} · {registration.captainEmail} · {registration.verifiedTeammates}/{registration.teammateCount} teammates verified</small></span><span><StatusChip value={registration.status} /><b>{money(registration.amountPaid)}</b>{!['cancelled'].includes(registration.status) ? <button onClick={async () => { const reason = window.prompt('Refund reason'); if (reason) { await requestHostedHuntRefund(gameId, registration.id, reason); load(); } }}>Request refund</button> : null}</span></div>)}</div></article>
        <article className="hunt-host__panel"><div className="hunt-host__section-title"><Bell /><div><h3>Announcements</h3><p>Five broadcasts per event per day.</p></div></div><form className="hunt-host__form" onSubmit={broadcast}><input placeholder="Announcement title" value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} required /><textarea placeholder="Message to registered captains" value={announcement.message} onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })} required /><button className="hunt-host__primary" disabled={busy === 'announce'}><Send /> Send in-app + email</button></form><div className="hunt-host__list">{data.announcements.map((item) => <div key={item._id}><span><strong>{item.title}</strong><small>{item.message}</small></span><small>{item.emailSent}/{item.emailAttempted} emails</small></div>)}</div></article>
        <article className="hunt-host__panel"><div className="hunt-host__section-title"><CircleDollarSign /><div><h3>Finance</h3><p>Final payout waits for settlement, disputes and refunds.</p></div></div><div className="hunt-host__money-grid"><div><small>Gross paid</small><b>{money(finance.grossPaid)}</b></div><div><small>Refunds</small><b>{money(finance.successfulRefunds)}</b></div><div><small>Gateway fees</small><b>{money(finance.gatewayFees)}</b></div><div><small>CrwdCtrl fee</small><b>{money(finance.platformFee)}</b></div><div><small>Prize funded</small><b>{money(finance.prizeFunded)}</b></div><div><small>Your payout</small><b>{money(finance.hostPayout)}</b></div></div><Notice>Payout status: <strong>{finance.payoutStatus}</strong>{game.payoutEligibleAt ? ` · earliest ${dateTime(game.payoutEligibleAt)}` : ''}</Notice></article>
      </section>
    </HostShell>
  );
}

export function CampusHuntEmergencyModePage() {
  const [form, setForm] = useState({ gameId: '', code: '', password: '', deviceId: localStorage.getItem('campus_hunt_host_device') || cryptoRandomId() });
  const [session, setSession] = useState(() => { try { return JSON.parse(sessionStorage.getItem('campus_hunt_operator') || 'null'); } catch { return null; } });
  const [message, setMessage] = useState('');
  useEffect(() => { localStorage.setItem('campus_hunt_host_device', form.deviceId); }, [form.deviceId]);
  const login = async (event) => { event.preventDefault(); try { const data = await emergencyOperatorLogin(form); const next = { ...data.operator, token: data.token }; sessionStorage.setItem('campus_hunt_operator', JSON.stringify(next)); setSession(next); setMessage('Device verified.'); } catch (err) { setMessage(err.message); } };
  const action = async (name) => { try { await emergencyOperatorAction(session.gameId, name, session.token); setMessage(`${name} completed.`); } catch (err) { setMessage(err.message); } };
  return <HostShell title="Emergency Host Mode" back><section className="hunt-host__content">{!session ? <form className="hunt-host__panel hunt-host__form" onSubmit={login}><Notice>Emergency operators have live controls only. No participant or finance access.</Notice><label>Game ID<input value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })} /></label><label>Operator code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label><label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><button className="hunt-host__primary">Enter Host Mode</button></form> : <article className="hunt-host__panel"><h2>{session.label}</h2><p>Device-bound event controls.</p><div className="hunt-host__actions"><button className="hunt-host__primary" onClick={() => action('start')}><Play /> Start</button><button onClick={() => action('pause')}><Pause /> Pause</button><button onClick={() => action('resume')}><Play /> Resume</button><button onClick={() => action('complete')}><Flag /> Complete</button></div><button onClick={() => { sessionStorage.removeItem('campus_hunt_operator'); setSession(null); }}>Log out</button></article>}{message ? <Notice type={message.includes('failed') || message.includes('Invalid') ? 'error' : 'info'}>{message}</Notice> : null}</section></HostShell>;
}

function cryptoRandomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
