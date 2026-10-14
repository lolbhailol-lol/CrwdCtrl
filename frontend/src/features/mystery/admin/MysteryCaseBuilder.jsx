import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminAddFightsBack, adminAddMysteryBranch, adminAddMysteryEvidence, adminDeleteMysteryBranch,
  adminDeleteMysteryCase, adminDeleteMysteryEvidence, adminDeleteMysteryFightsBack, adminGetCaseDetail,
  adminPublishMysteryCase, adminRotateMysteryQr, adminUpdateMysteryCase, adminUpdateMysteryEvidence,
} from '../services/mystery.api';
import { MYSTERY_PATHS, mysteryPublicUrl } from '../config';
import { cardClass, dangerBtn, ghostBtn, inputClass, labelClass, primaryBtn } from './mysteryAdminUtils';
import MysteryQrPanel from './MysteryQrPanel';

const WORLDS = ['physical', 'digital', 'human', 'logic'];
const RELIABILITY = [
  ['reliable', 'Reliable — sach hai'],
  ['unreliable', 'Unreliable — fake / misleading'],
  ['ambiguous', 'Ambiguous — aadha sach'],
];
const TABS = [['clues', 'Clues'], ['branches', 'Branches'], ['twists', 'Twists'], ['qr', 'QR print'], ['test', 'Test']];

const emptyEvidence = {
  code: '', title: '', description: '', timestampLabel: '', world: 'physical', reliability: 'reliable',
  requiresQR: true, points: 10, canonicalOrder: 1, placementNote: '',
  unlockedByEvidenceIds: [], unlockedByBranchId: '', unlockedByLeadId: '', connectsToEvidenceIds: [], canBeInvalidated: false,
};
const emptyLead = () => ({ id: '', label: '', description: '' });

function toggleId(list, id) {
  const s = String(id);
  return list.map(String).includes(s) ? list.filter((x) => String(x) !== s) : [...list, s];
}

function CaseHeaderForm({ mysteryCase, onSave, busy }) {
  const [form, setForm] = useState({
    title: mysteryCase.title || '',
    tagline: mysteryCase.tagline || '',
    synopsis: mysteryCase.synopsis || '',
    mysteryIdentityName: mysteryCase.mysteryIdentityName || '',
    mysteryIdentityPrompt: mysteryCase.mysteryIdentityPrompt || '',
    correctIdentityTheory: mysteryCase.correctIdentityTheory || '',
    difficulty: mysteryCase.difficulty || 'detective',
    estimatedMinutes: mysteryCase.estimatedMinutes || 60,
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  return (
    <section className={`${cardClass} space-y-3`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Title<input value={form.title} onChange={set('title')} className={`mt-1 ${inputClass}`} /></label>
        <label className={labelClass}>Tagline<input value={form.tagline} onChange={set('tagline')} className={`mt-1 ${inputClass}`} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Synopsis<textarea rows={3} value={form.synopsis} onChange={set('synopsis')} className={`mt-1 ${inputClass}`} /></label>
        <label className={labelClass}>Mystery identity<input value={form.mysteryIdentityName} onChange={set('mysteryIdentityName')} className={`mt-1 ${inputClass}`} /></label>
        <label className={labelClass}>Question to players<input value={form.mysteryIdentityPrompt} onChange={set('mysteryIdentityPrompt')} className={`mt-1 ${inputClass}`} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Correct answer (admin only)<input value={form.correctIdentityTheory} onChange={set('correctIdentityTheory')} className={`mt-1 ${inputClass}`} /></label>
        <label className={labelClass}>Difficulty
          <select value={form.difficulty} onChange={set('difficulty')} className={`mt-1 ${inputClass}`}>
            <option value="rookie">Rookie</option><option value="detective">Detective</option><option value="master">Master</option>
          </select>
        </label>
        <label className={labelClass}>Minutes<input type="number" min={5} value={form.estimatedMinutes} onChange={set('estimatedMinutes')} className={`mt-1 ${inputClass}`} /></label>
      </div>
      <button type="button" disabled={busy} onClick={() => onSave({ ...form, estimatedMinutes: Number(form.estimatedMinutes) || 60 })} className={primaryBtn}>Save story</button>
    </section>
  );
}

export default function MysteryCaseBuilder() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('clues');
  const [showHeader, setShowHeader] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [ev, setEv] = useState(emptyEvidence);
  const [editingId, setEditingId] = useState('');
  const [branch, setBranch] = useState({ prompt: '', leads: [emptyLead(), emptyLead()] });
  const [fb, setFb] = useState({ triggerAfterEvidenceCount: 3, invalidatedEvidenceId: '', systemMessage: '' });

  const load = useCallback(
    () => adminGetCaseDetail(caseId).then(setDetail).catch((err) => setError(err.message || 'Case load nahi hua')),
    [caseId],
  );
  useEffect(() => { load(); }, [load]);

  const run = async (action, successMsg) => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      await action();
      setMsg(successMsg);
      await load();
      return true;
    } catch (err) {
      setError(err.message || 'Kuch galat hua');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return <div className="p-6 text-white">{error || 'Loading…'}</div>;
  }

  const mysteryCase = detail.case || {};
  const evidence = detail.evidence || [];
  const branches = detail.branches || [];
  const twists = detail.fightsBackEvents || [];
  const usage = detail.usage || { events: 0, teams: 0 };
  const evidenceById = new Map(evidence.map((e) => [String(e._id), e]));
  const isPublished = mysteryCase.status === 'published';

  const evidencePayload = () => ({
    ...ev,
    points: Number(ev.points) || 0,
    canonicalOrder: Number(ev.canonicalOrder) || 0,
    unlockedByBranchId: ev.unlockedByBranchId || null,
    unlockedByLeadId: ev.unlockedByBranchId ? ev.unlockedByLeadId || null : null,
  });

  const submitEvidence = async () => {
    if (!ev.code.trim() || !ev.title.trim() || !ev.description.trim()) { setError('Code, title aur description chahiye'); return; }
    if (ev.unlockedByBranchId && !ev.unlockedByLeadId) { setError('Branch choose kiya hai to lead bhi choose karo'); return; }
    const ok = editingId
      ? await run(() => adminUpdateMysteryEvidence(caseId, editingId, evidencePayload()), 'Clue updated ✓')
      : await run(() => adminAddMysteryEvidence(caseId, evidencePayload()), 'Clue added ✓');
    if (ok) {
      setEditingId('');
      setEv({ ...emptyEvidence, world: ev.world, canonicalOrder: Number(ev.canonicalOrder) + 1 });
    }
  };

  const editEvidence = (e) => {
    setEditingId(e._id);
    setEv({
      code: e.code, title: e.title, description: e.description, timestampLabel: e.timestampLabel || '',
      world: e.world, reliability: e.reliability, requiresQR: !!e.requiresQR, points: e.points,
      canonicalOrder: e.canonicalOrder, placementNote: e.placementNote || '',
      unlockedByEvidenceIds: (e.unlockedByEvidenceIds || []).map(String),
      unlockedByBranchId: e.unlockedByBranchId ? String(e.unlockedByBranchId) : '',
      unlockedByLeadId: e.unlockedByLeadId || '',
      connectsToEvidenceIds: (e.connectsToEvidenceIds || []).map(String),
      canBeInvalidated: !!e.canBeInvalidated,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditingId(''); setEv(emptyEvidence); };

  const deleteEvidence = (e) => {
    if (!window.confirm(`Clue ${e.code} delete karein? Isse jude twists bhi hatenge.`)) return;
    run(() => adminDeleteMysteryEvidence(caseId, e._id), 'Clue deleted');
  };

  const submitBranch = async () => {
    const leads = branch.leads.filter((l) => l.id.trim() && l.label.trim());
    if (!branch.prompt.trim() || leads.length < 2) { setError('Question aur kam se kam 2 leads (id + label) chahiye'); return; }
    const order = (branches.reduce((max, b) => Math.max(max, b.order), 0)) + 1;
    const ok = await run(() => adminAddMysteryBranch(caseId, { order, prompt: branch.prompt, leads }), 'Branch added ✓ — ab clues ko kisi lead se lock karo');
    if (ok) setBranch({ prompt: '', leads: [emptyLead(), emptyLead()] });
  };
  const updateLead = (i, field, value) => {
    const leads = branch.leads.map((lead, idx) => (idx === i ? { ...lead, [field]: field === 'id' ? value.toLowerCase().replace(/[^a-z0-9-]/g, '') : value } : lead));
    setBranch({ ...branch, leads });
  };

  const submitTwist = async () => {
    if (!fb.invalidatedEvidenceId || !fb.systemMessage.trim()) { setError('Clue aur message chahiye'); return; }
    const ok = await run(() => adminAddFightsBack(caseId, { ...fb, triggerAfterEvidenceCount: Number(fb.triggerAfterEvidenceCount) || 1 }), 'Twist added ✓');
    if (ok) setFb({ triggerAfterEvidenceCount: 3, invalidatedEvidenceId: '', systemMessage: '' });
  };

  const togglePublish = () => (isPublished
    ? run(() => adminUpdateMysteryCase(caseId, { status: 'draft' }), 'Case draft me wapas gaya')
    : run(() => adminPublishMysteryCase(caseId), 'Case published ✓ — ab event me link kar sakte ho'));

  const deleteCase = async () => {
    if (!window.confirm(`Case "${mysteryCase.title}" delete karein?`)) return;
    const ok = await run(() => adminDeleteMysteryCase(caseId), 'Deleted');
    if (ok) navigate(MYSTERY_PATHS.adminDashboard);
  };

  const selectedBranch = branches.find((b) => String(b._id) === String(ev.unlockedByBranchId));
  const otherEvidence = evidence.filter((e) => String(e._id) !== String(editingId));
  const practiceUrl = mysteryPublicUrl(MYSTERY_PATHS.practice(caseId));

  return (
    <div className="space-y-5 p-4 text-white md:p-6">
      <Link to={MYSTERY_PATHS.adminDashboard} className="text-xs text-white/50 hover:text-white">← All Mystery cases</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{mysteryCase.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${isPublished ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{mysteryCase.status}</span>
          </div>
          <p className="text-sm text-white/50">{evidence.length} clues · {evidence.filter((e) => e.requiresQR).length} QR · {branches.length} branches · {twists.length} twists · used by {usage.events} event{usage.events === 1 ? '' : 's'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowHeader((v) => !v)} className={ghostBtn}>{showHeader ? 'Hide story' : 'Edit story'}</button>
          <button type="button" disabled={busy || evidence.length === 0} onClick={togglePublish} className={isPublished ? ghostBtn : 'rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40'}>{isPublished ? 'Unpublish' : 'Publish case'}</button>
          {usage.events === 0 && usage.teams === 0 && <button type="button" disabled={busy} onClick={deleteCase} className={dangerBtn}>Delete</button>}
        </div>
      </div>
      {isPublished && usage.teams > 0 && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">{usage.teams} teams is case pe khel chuki/rahi hain — clue edit karne se unke game pe asar padega.</p>
      )}

      {showHeader && <CaseHeaderForm key={mysteryCase.updatedAt} mysteryCase={mysteryCase} busy={busy} onSave={(body) => run(() => adminUpdateMysteryCase(caseId, body), 'Story saved ✓')} />}

      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? 'bg-[#0ECCEE] text-black' : 'bg-white/10 text-white/60'}`}>{label}</button>
        ))}
      </div>

      {tab === 'clues' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className={`${cardClass} space-y-3`}>
            <p className="text-sm font-semibold text-[#0ECCEE]">{editingId ? `Edit ${ev.code}` : 'Naya clue'}</p>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Code (e.g. PHY-01)" value={ev.code} onChange={(e) => setEv({ ...ev, code: e.target.value.toUpperCase() })} className={`font-mono ${inputClass}`} />
              <input placeholder="Time label (e.g. 17:03)" value={ev.timestampLabel} onChange={(e) => setEv({ ...ev, timestampLabel: e.target.value })} className={inputClass} />
            </div>
            <input placeholder="Title" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} className={inputClass} />
            <textarea rows={3} placeholder="Description (player ko dikhega)" value={ev.description} onChange={(e) => setEv({ ...ev, description: e.target.value })} className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <label className={labelClass}>World
                <select value={ev.world} onChange={(e) => setEv({ ...ev, world: e.target.value })} className={`mt-1 ${inputClass}`}>
                  {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
              <label className={labelClass}>Truth (hidden)
                <select value={ev.reliability} onChange={(e) => setEv({ ...ev, reliability: e.target.value })} className={`mt-1 ${inputClass}`}>
                  {RELIABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={labelClass}>Points<input type="number" value={ev.points} onChange={(e) => setEv({ ...ev, points: e.target.value })} className={`mt-1 ${inputClass}`} /></label>
              <label className={labelClass}>Timeline order<input type="number" value={ev.canonicalOrder} onChange={(e) => setEv({ ...ev, canonicalOrder: e.target.value })} className={`mt-1 ${inputClass}`} /></label>
            </div>

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={ev.requiresQR} onChange={(e) => setEv({ ...ev, requiresQR: e.target.checked })} />
              QR scan se khulega (print karke venue pe lagana hoga)
            </label>
            {ev.requiresQR && (
              <input placeholder="Placement note — QR kahan lagana hai (sirf admin)" value={ev.placementNote} onChange={(e) => setEv({ ...ev, placementNote: e.target.value })} className={inputClass} />
            )}

            <div className="rounded-xl bg-black/25 p-3">
              <p className="text-xs font-semibold text-white/60">🔓 Kab khulega?</p>
              <p className="mt-1 text-[11px] text-white/40">Kuch select nahi kiya = start se available. QR off ho to conditions puri hote hi apne aap khul jayega.</p>
              {otherEvidence.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {otherEvidence.map((o) => {
                    const on = ev.unlockedByEvidenceIds.map(String).includes(String(o._id));
                    return <button key={o._id} type="button" onClick={() => setEv({ ...ev, unlockedByEvidenceIds: toggleId(ev.unlockedByEvidenceIds, o._id) })} className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${on ? 'bg-[#0ECCEE] text-black' : 'bg-white/10 text-white/60'}`}>after {o.code}</button>;
                  })}
                </div>
              )}
              {branches.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select value={ev.unlockedByBranchId} onChange={(e) => setEv({ ...ev, unlockedByBranchId: e.target.value, unlockedByLeadId: '' })} className={inputClass}>
                    <option value="">No branch lock</option>
                    {branches.map((b) => <option key={b._id} value={b._id}>#{b.order} {b.prompt}</option>)}
                  </select>
                  <select value={ev.unlockedByLeadId} disabled={!selectedBranch} onChange={(e) => setEv({ ...ev, unlockedByLeadId: e.target.value })} className={`${inputClass} disabled:opacity-40`}>
                    <option value="">Lead…</option>
                    {(selectedBranch?.leads || []).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {otherEvidence.length > 0 && (
              <div className="rounded-xl bg-black/25 p-3">
                <p className="text-xs font-semibold text-white/60">🔗 Sahi connections (hidden) — team ye link banaye to points</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {otherEvidence.map((o) => {
                    const on = ev.connectsToEvidenceIds.map(String).includes(String(o._id));
                    return <button key={o._id} type="button" onClick={() => setEv({ ...ev, connectsToEvidenceIds: toggleId(ev.connectsToEvidenceIds, o._id) })} className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${on ? 'bg-violet-400 text-black' : 'bg-white/10 text-white/60'}`}>{o.code}</button>;
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={submitEvidence} className={`flex-1 ${primaryBtn}`}>{editingId ? 'Save clue' : 'Add clue'}</button>
              {editingId && <button type="button" onClick={cancelEdit} className={ghostBtn}>Cancel</button>}
            </div>
          </section>

          <section className="space-y-2">
            {[...evidence].sort((a, b) => a.canonicalOrder - b.canonicalOrder).map((e) => (
              <div key={e._id} className={`rounded-xl border px-3 py-2 text-sm ${String(editingId) === String(e._id) ? 'border-[#0ECCEE]/60 bg-[#0ECCEE]/5' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p><span className="font-mono text-white/40">{e.code}</span> <span className="font-semibold">{e.title}</span></p>
                    <p className="text-xs text-white/40">
                      #{e.canonicalOrder} · {e.world} · <span className={e.reliability === 'reliable' ? 'text-emerald-300' : e.reliability === 'unreliable' ? 'text-rose-300' : 'text-amber-300'}>{e.reliability}</span> · {e.points} pts · {e.requiresQR ? 'QR' : 'auto'}
                    </p>
                    {(e.unlockedByEvidenceIds?.length > 0 || e.unlockedByBranchId) && (
                      <p className="text-[11px] text-white/35">🔓 {[
                        ...(e.unlockedByEvidenceIds || []).map((id) => `after ${evidenceById.get(String(id))?.code || '?'}`),
                        e.unlockedByBranchId ? `lead ${e.unlockedByLeadId}` : null,
                      ].filter(Boolean).join(' · ')}</p>
                    )}
                    {e.connectsToEvidenceIds?.length > 0 && <p className="text-[11px] text-white/35">🔗 {e.connectsToEvidenceIds.map((id) => evidenceById.get(String(id))?.code || '?').join(', ')}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => editEvidence(e)} className={ghostBtn}>Edit</button>
                    <button type="button" disabled={busy} onClick={() => deleteEvidence(e)} className={dangerBtn}>✕</button>
                  </div>
                </div>
              </div>
            ))}
            {evidence.length === 0 && <p className="text-sm text-white/40">Pehla clue add karo. Tip: 5–8 clues, 4 worlds me, kam se kam ek unreliable.</p>}
          </section>
        </div>
      )}

      {tab === 'branches' && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-3`}>
            <p className="text-sm font-semibold text-[#0ECCEE]">Naya branch (decision point)</p>
            <p className="text-xs text-white/45">Team ek lead choose karegi. Clues tab me kisi clue ko is lead se lock karo — sirf wahi team usse dekh payegi.</p>
            <input placeholder="Question (e.g. Pehle kaunsa lead follow karoge?)" value={branch.prompt} onChange={(e) => setBranch({ ...branch, prompt: e.target.value })} className={inputClass} />
            {branch.leads.map((lead, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <input placeholder="id (e.g. cctv)" value={lead.id} onChange={(e) => updateLead(i, 'id', e.target.value)} className={`font-mono ${inputClass}`} />
                <input placeholder="Label" value={lead.label} onChange={(e) => updateLead(i, 'label', e.target.value)} className={inputClass} />
                <input placeholder="Description" value={lead.description} onChange={(e) => updateLead(i, 'description', e.target.value)} className={inputClass} />
              </div>
            ))}
            <button type="button" onClick={() => setBranch({ ...branch, leads: [...branch.leads, emptyLead()] })} className="text-xs text-[#0ECCEE] underline">+ Add another lead</button>
            <button type="button" disabled={busy} onClick={submitBranch} className={`w-full ${primaryBtn}`}>Add branch</button>
          </section>
          {branches.map((b) => (
            <section key={b._id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold"><span className="text-white/40">#{b.order}</span> {b.prompt}</p>
                <button type="button" disabled={busy} onClick={() => window.confirm('Branch delete karein? Isse locked clues unlock ho jayenge.') && run(() => adminDeleteMysteryBranch(caseId, b._id), 'Branch deleted')} className={dangerBtn}>Delete</button>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {b.leads.map((l) => {
                  const gated = evidence.filter((e) => String(e.unlockedByBranchId) === String(b._id) && e.unlockedByLeadId === l.id);
                  return <li key={l.id} className="text-white/60"><span className="font-mono text-white/80">{l.id}</span> — {l.label} → {gated.length ? gated.map((g) => g.code).join(', ') : <span className="text-amber-300">koi clue locked nahi</span>}</li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {tab === 'twists' && (
        <div className="space-y-4">
          <section className={`${cardClass} space-y-3`}>
            <p className="text-sm font-semibold text-[#0ECCEE]">Mystery Fights Back — beech game twist</p>
            <p className="text-xs text-white/45">Team N clues khol le, tab ek clue ko invalid declare karo aur message dikhao.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={labelClass}>Trigger after N clues<input type="number" min={1} value={fb.triggerAfterEvidenceCount} onChange={(e) => setFb({ ...fb, triggerAfterEvidenceCount: e.target.value })} className={`mt-1 ${inputClass}`} /></label>
              <label className={labelClass}>Clue to invalidate
                <select value={fb.invalidatedEvidenceId} onChange={(e) => setFb({ ...fb, invalidatedEvidenceId: e.target.value })} className={`mt-1 ${inputClass}`}>
                  <option value="">Select clue</option>
                  {evidence.map((e) => <option key={e._id} value={e._id}>{e.code} — {e.title}</option>)}
                </select>
              </label>
            </div>
            <textarea rows={2} placeholder="Message players ko (e.g. UPDATE: CCTV timestamp edited tha)" value={fb.systemMessage} onChange={(e) => setFb({ ...fb, systemMessage: e.target.value })} className={inputClass} />
            <button type="button" disabled={busy} onClick={submitTwist} className={`w-full ${primaryBtn}`}>Add twist</button>
          </section>
          {twists.map((f) => (
            <div key={f._id} className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <p>After {f.triggerAfterEvidenceCount} clues → <span className="font-mono text-rose-300">{evidenceById.get(String(f.invalidatedEvidenceId))?.code || '?'}</span> invalid: <span className="text-white/60">{f.systemMessage}</span></p>
              <button type="button" disabled={busy} onClick={() => run(() => adminDeleteMysteryFightsBack(caseId, f._id), 'Twist deleted')} className={dangerBtn}>✕</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'qr' && (
        <MysteryQrPanel
          title={mysteryCase.title}
          evidence={evidence}
          branches={branches}
          onRotate={(e) => run(() => adminRotateMysteryQr(caseId, e._id), `${e.code} ka naya QR bana — dobara print karo`)}
        />
      )}

      {tab === 'test' && (
        <section className={`${cardClass} space-y-3`}>
          <p className="text-sm font-semibold text-[#0ECCEE]">Khud khel ke test karo</p>
          {isPublished ? (
            <>
              <p className="text-sm text-white/60">Practice mode me case turant khulta hai (event ki zarurat nahi). Phone pe kholo, aur QR print tab ke QR screen se scan karo.</p>
              <div className="flex flex-wrap gap-2">
                <a href={practiceUrl} target="_blank" rel="noreferrer" className={primaryBtn}>Open practice ↗</a>
              </div>
              <p className="font-mono text-xs text-white/40">{practiceUrl}</p>
            </>
          ) : (
            <p className="text-sm text-amber-200">Test karne ke liye pehle case publish karo.</p>
          )}
          <div className="rounded-xl bg-black/25 p-3 text-xs text-white/55">
            <p className="font-semibold text-white/70">Checklist</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li className={evidence.length >= 3 ? 'text-emerald-300' : ''}>Kam se kam 3 clues ({evidence.length})</li>
              <li className={evidence.some((e) => e.reliability === 'unreliable') ? 'text-emerald-300' : ''}>Ek unreliable clue (trust test)</li>
              <li className={evidence.some((e) => (e.unlockedByEvidenceIds || []).length === 0 && !e.unlockedByBranchId) ? 'text-emerald-300' : 'text-amber-300'}>Kam se kam ek clue start se available</li>
              <li className={branches.every((b) => b.leads.every((l) => evidence.some((e) => String(e.unlockedByBranchId) === String(b._id) && e.unlockedByLeadId === l.id))) ? 'text-emerald-300' : 'text-amber-300'}>Har branch lead ke peeche ek clue</li>
              <li className={mysteryCase.correctIdentityTheory ? 'text-emerald-300' : 'text-amber-300'}>Correct answer set (grading ke liye)</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
