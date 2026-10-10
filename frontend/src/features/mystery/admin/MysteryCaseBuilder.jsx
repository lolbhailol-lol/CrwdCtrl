import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminGetCaseDetail, adminAddMysteryEvidence, adminAddMysteryBranch,
  adminAddFightsBack, adminPublishMysteryCase,
} from '../services/mystery.api';

const WORLDS = ['physical', 'digital', 'human', 'logic'];
const RELIABILITY = ['reliable', 'unreliable', 'ambiguous'];

export default function MysteryCaseBuilder() {
  const { caseId } = useParams();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('evidence');
  const [msg, setMsg] = useState('');

  const [ev, setEv] = useState({ title: '', summary: '', world: 'physical', reliability: 'reliable', requiresQR: true, qrSecret: '', points: 10, canonicalOrder: 1 });
  const [branch, setBranch] = useState({ question: '', leads: [{ id: '', label: '', description: '' }] });
  const [fb, setFb] = useState({ triggerAfterEvidenceCount: 3, invalidatedEvidenceId: '', systemMessage: '' });

  const load = () => adminGetCaseDetail(caseId).then((res) => setDetail(res.data || res));
  useEffect(() => { load(); }, [caseId]);

  const submitEvidence = async () => {
    await adminAddMysteryEvidence(caseId, ev);
    setMsg('Evidence added ✓');
    setEv({ ...ev, title: '', summary: '', qrSecret: '' });
    load();
  };
  const submitBranch = async () => {
    await adminAddMysteryBranch(caseId, branch);
    setMsg('Branch added ✓');
    load();
  };
  const submitFightsBack = async () => {
    await adminAddFightsBack(caseId, fb);
    setMsg('Fights-back event added ✓');
    load();
  };
  const publish = async () => {
    await adminPublishMysteryCase(caseId);
    setMsg('Case published ✓');
    load();
  };

  if (!detail) return <div className="min-h-screen bg-[#0b0c0d] p-6 text-white">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-6 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{detail.title}</h1>
          <button type="button" onClick={publish} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black">Publish case</button>
        </div>
        {msg && <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p>}

        <div className="mt-5 flex gap-2">
          {['evidence', 'branch', 'fightsback'].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t ? 'bg-[#0ECCEE] text-black' : 'bg-white/10 text-white/60'}`}>
              {t === 'fightsback' ? 'Fights Back' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'evidence' && (
          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input placeholder="Title" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            <textarea placeholder="Summary (player ko dikhega)" value={ev.summary} onChange={(e) => setEv({ ...ev, summary: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            <div className="flex gap-2">
              <select value={ev.world} onChange={(e) => setEv({ ...ev, world: e.target.value })} className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white">
                {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <select value={ev.reliability} onChange={(e) => setEv({ ...ev, reliability: e.target.value })} className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white">
                {RELIABILITY.map((r) => <option key={r} value={r}>{r} (ground truth)</option>)}
              </select>
            </div>
            <input placeholder="QR secret (unique code — print as QR)" value={ev.qrSecret} onChange={(e) => setEv({ ...ev, qrSecret: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-white placeholder:text-white/25" />
            <div className="flex gap-2">
              <input type="number" placeholder="Points" value={ev.points} onChange={(e) => setEv({ ...ev, points: Number(e.target.value) })} className="w-1/2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white" />
              <input type="number" placeholder="Timeline order" value={ev.canonicalOrder} onChange={(e) => setEv({ ...ev, canonicalOrder: Number(e.target.value) })} className="w-1/2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white" />
            </div>
            <button type="button" onClick={submitEvidence} className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black">Add evidence</button>
            <div className="mt-4 space-y-2">
              {(detail.evidence || []).map((e) => (
                <div key={e._id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span className="font-semibold">{e.title}</span> <span className="text-white/40">· {e.world} · {e.qrSecret}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'branch' && (
          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input placeholder="Question (e.g. Pehle kis lead ko follow karoge?)" value={branch.question} onChange={(e) => setBranch({ ...branch, question: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            {branch.leads.map((lead, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <input placeholder="id" value={lead.id} onChange={(e) => { const leads = [...branch.leads]; leads[i].id = e.target.value; setBranch({ ...branch, leads }); }} className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-white" />
                <input placeholder="label" value={lead.label} onChange={(e) => { const leads = [...branch.leads]; leads[i].label = e.target.value; setBranch({ ...branch, leads }); }} className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-white" />
                <input placeholder="description" value={lead.description} onChange={(e) => { const leads = [...branch.leads]; leads[i].description = e.target.value; setBranch({ ...branch, leads }); }} className="rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm text-white" />
              </div>
            ))}
            <button type="button" onClick={() => setBranch({ ...branch, leads: [...branch.leads, { id: '', label: '', description: '' }] })} className="text-xs text-[#0ECCEE] underline">+ Add another lead</button>
            <button type="button" onClick={submitBranch} className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black">Add branch</button>
          </div>
        )}

        {tab === 'fightsback' && (
          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input type="number" placeholder="Trigger after N evidence unlocked" value={fb.triggerAfterEvidenceCount} onChange={(e) => setFb({ ...fb, triggerAfterEvidenceCount: Number(e.target.value) })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white" />
            <select value={fb.invalidatedEvidenceId} onChange={(e) => setFb({ ...fb, invalidatedEvidenceId: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white">
              <option value="">Select evidence to invalidate</option>
              {(detail.evidence || []).map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
            <textarea placeholder="System message shown to player" value={fb.systemMessage} onChange={(e) => setFb({ ...fb, systemMessage: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            <button type="button" onClick={submitFightsBack} className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black">Add fights-back event</button>
          </div>
        )}
      </div>
    </div>
  );
}