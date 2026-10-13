import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminListMysteryCases, adminCreateMysteryCase } from '../services/mystery.api';

export default function MysteryAdminDashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', tagline: '', synopsis: '', mysteryIdentityName: '', mysteryIdentityPrompt: '', correctIdentityTheory: '', difficulty: 'medium' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    adminListMysteryCases().then((res) => setCases(res.data || res || [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createCase = async () => {
    if (!form.title.trim()) { setError('Title chahiye'); return; }
    setBusy(true);
    setError('');
    try {
      await adminCreateMysteryCase(form);
      setShowForm(false);
      setForm({ title: '', tagline: '', synopsis: '', mysteryIdentityName: '', mysteryIdentityPrompt: '', correctIdentityTheory: '', difficulty: 'medium' });
      load();
    } catch (err) {
      setError(err.message || 'Failed to create case');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CTRL Mystery — Admin</h1>
          <button type="button" onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black">
            {showForm ? 'Cancel' : '+ New case'}
          </button>
        </div>

        {showForm && (
          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            <input placeholder="Tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            <textarea placeholder="Synopsis" rows={3} value={form.synopsis} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            <input placeholder="Mystery identity name (e.g. A-17)" value={form.mysteryIdentityName} onChange={(e) => setForm({ ...form, mysteryIdentityName: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            <input placeholder="Correct identity theory (answer key)" value={form.correctIdentityTheory} onChange={(e) => setForm({ ...form, correctIdentityTheory: e.target.value })} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25" />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <button type="button" disabled={busy} onClick={createCase} className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black disabled:opacity-40">
              {busy ? 'Creating…' : 'Create case'}
            </button>
          </div>
        )}

        {loading && <p className="mt-6 text-white/40">Loading…</p>}

        <div className="mt-6 space-y-3">
          {cases.map((c) => (
            <Link key={c._id} to={`/admin/mystery/case/${c._id}`} className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:border-[#0ECCEE]/40">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{c.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.status === 'published' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{c.status}</span>
              </div>
              <p className="mt-1 text-sm text-white/50">{c.tagline}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}