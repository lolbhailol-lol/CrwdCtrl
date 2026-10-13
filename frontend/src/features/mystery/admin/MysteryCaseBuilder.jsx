import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminGetCaseDetail, adminAddMysteryEvidence, adminAddMysteryBranch,
  adminAddFightsBack, adminPublishMysteryCase,
} from '../services/mystery.api';

const WORLDS = ['physical', 'digital', 'human', 'logic'];
const RELIABILITY = ['reliable', 'unreliable', 'ambiguous'];
const inputClass = 'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25';
const emptyEvidence = { code: '', title: '', description: '', timestampLabel: '', world: 'physical', reliability: 'reliable', requiresQR: true, points: 10, canonicalOrder: 1 };
const emptyLead = () => ({ id: '', label: '', description: '' });

export default function MysteryCaseBuilder() {
  const { caseId } = useParams();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('evidence');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [ev, setEv] = useState(emptyEvidence);
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

  const submitEvidence = async () => {
    if (!ev.code.trim() || !ev.title.trim() || !ev.description.trim()) { setError('Code, title aur description chahiye'); return; }
    const ok = await run(() => adminAddMysteryEvidence(caseId, ev), 'Evidence added ✓');
    if (ok) setEv({ ...emptyEvidence, world: ev.world, canonicalOrder: Number(ev.canonicalOrder) + 1 });
  };
  const submitBranch = async () => {
    const leads = branch.leads.filter((l) => l.id.trim() && l.label.trim());
    if (!branch.prompt.trim() || leads.length < 2) { setError('Question aur kam se kam 2 leads (id + label) chahiye'); return; }
    const order = (detail?.branches?.length || 0) + 1;
    const ok = await run(() => adminAddMysteryBranch(caseId, { order, prompt: branch.prompt, leads }), 'Branch added ✓');
    if (ok) setBranch({ prompt: '', leads: [emptyLead(), emptyLead()] });
  };
  const updateLead = (i, field, value) => {
    const leads = branch.leads.map((lead, idx) => (idx === i ? { ...lead, [field]: value } : lead));
    setBranch({ ...branch, leads });
  };
  const submitFightsBack = async () => {
    if (!fb.invalidatedEvidenceId || !fb.systemMessage.trim()) { setError('Evidence aur message chahiye'); return; }
    await run(() => adminAddFightsBack(caseId, fb), 'Fights-back event added ✓');
  };
  const publish = () => run(() => adminPublishMysteryCase(caseId), 'Case published ✓');

  if (!detail) {
    return <div className="min-h-screen bg-[#0b0c0d] p-6 text-white">{error || 'Loading…'}</div>;
  }

  const mysteryCase = detail.case || {};
  const evidence = detail.evidence || [];

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-6 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{mysteryCase.title}</h1>
            <p className="text-xs uppercase tracking-wide text-white/40">{mysteryCase.status}</p>
          </div>
          {mysteryCase.status !== 'published' && (
            <button type="button" disabled={busy || evidence.length === 0} onClick={publish} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">Publish case</button>
          )}
        </div>
        {msg && <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p>}
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

        <div className="mt-5 flex gap-2">
          {['evidence', 'branch', 'fightsback'].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t ? 'bg-[#0ECCEE] text-black' : 'bg-white/10 text-white/60'}`}>
              {t === 'fightsback' ? 'Fights Back' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'evidence' && (
          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex gap-2">
              <input placeholder="Code (e.g. EVD-CCTV-1703)" value={ev.code} onChange={(e) => setEv({ ...ev, code: e.target.value })} className={`${inputClass} w-1/2 font-mono`} />
              <input placeholder="Time label (e.g. 17:03)" value={ev.timestampLabel} onChange={(e) => setEv({ ...ev, timestampLabel: e.target.value })} className={`${inputClass} w-1/2`} />
            </div>
            <input placeholder="Title" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} className={inputClass} />
            <textarea placeholder="Description (player ko dikhega)" value={ev.description} onChange={(e) => setEv({ ...ev, description: e.target.value })} className={inputClass} />
            <div className="flex gap-2">
              <select value={ev.world} onChange={(e) => setEv({ ...ev, world: e.target.value })} className={`${inputClass} flex-1`}>
                {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <select value={ev.reliability} onChange={(e) => setEv({ ...ev, reliability: e.target.value })} className={`${inputClass} flex-1`}>
                {RELIABILITY.map((r) => <option key={r} value={r}>{r} (ground truth)</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input type="number" placeholder="Points" value={ev.points} onChange={(e) => setEv({ ...ev, points: Number(e.target.value) })} className={`${inputClass} w-1/2`} />
              <input type="number" placeholder="Timeline order" value={ev.canonicalOrder} onChange={(e) => setEv({ ...ev, canonicalOrder: Number(e.target.value) })} className={`${inputClass} w-1/2`} />
            </div>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={ev.requiresQR} onChange={(e) => setEv({ ...ev, requiresQR: e.target.checked })} />
              QR scan se unlock hoga (secret auto-generate hoga — print as QR)
            </label>
            <button type="button" disabled={busy} onClick={submitEvidence} className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black disabled:opacity-40">Add evidence</button>
            <div className="mt-4 space-y-2">
              {evidence.map((e) => (
                <div key={e._id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span className="font-mono text-white/40">{e.code}</span> <span className="font-semibold">{e.title}</span>
                  <span className="text-white/40"> · {e.world} · {e.reliability}</span>
                  {e.qrSecret && <p className="mt-0.5 font-mono text-xs text-[#0ECCEE]">QR: {e.qrSecret}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'branch' && (
          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input placeholder="Question (e.g. Pehle kis lead ko follow karoge?)" value={branch.prompt} onChange={(e) => setBranch({ ...branch, prompt: e.target.value })} className={inputClass} />
            {branch.leads.map((lead, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <input placeholder="id (e.g. cctv)" value={lead.id} onChange={(e) => updateLead(i, 'id', e.target.value)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-white" />
                <input placeholder="label" value={lead.label} onChange={(e) => updateLead(i, 'label', e.target.value)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-white" />
                <input placeholder="description" value={lead.description} onChange={(e) => updateLead(i, 'description', e.target.value)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-white" />
              </div>
            ))}
            <button type="button" onClick={() => setBranch({ ...branch, leads: [...branch.leads, emptyLead()] })} className="text-xs text-[#0ECCEE] underline">+ Add another lead</button>
            <button type="button" disabled={busy} onClick={submitBranch} className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black disabled:opacity-40">Add branch</button>
            <div className="mt-4 space-y-2">
              {(detail.branches || []).map((b) => (
                <div key={b._id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span className="text-white/40">#{b.order}</span> {b.prompt}
                  <span className="text-white/40"> · {b.leads.map((l) => l.id).join(' / ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'fightsback' && (
          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input type="number" placeholder="Trigger after N evidence unlocked" value={fb.triggerAfterEvidenceCount} onChange={(e) => setFb({ ...fb, triggerAfterEvidenceCount: Number(e.target.value) })} className={inputClass} />
            <select value={fb.invalidatedEvidenceId} onChange={(e) => setFb({ ...fb, invalidatedEvidenceId: e.target.value })} className={inputClass}>
              <option value="">Select evidence to invalidate</option>
              {evidence.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
            <textarea placeholder="System message shown to player" value={fb.systemMessage} onChange={(e) => setFb({ ...fb, systemMessage: e.target.value })} className={inputClass} />
            <button type="button" disabled={busy} onClick={submitFightsBack} className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black disabled:opacity-40">Add fights-back event</button>
            <div className="mt-4 space-y-2">
              {(detail.fightsBackEvents || []).map((f) => (
                <div key={f._id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  After {f.triggerAfterEvidenceCount} clues: {f.systemMessage}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
