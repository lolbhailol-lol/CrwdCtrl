import { useState } from 'react';
import LocalQRCode from '../../../components/LocalQRCode';
import { cardClass, ghostBtn, primaryBtn, printQrSheet } from './mysteryAdminUtils';

const WORLD_TONE = {
  physical: 'text-amber-300',
  digital: 'text-sky-300',
  human: 'text-pink-300',
  logic: 'text-violet-300',
};

function unlockRule(e, evidenceById, branchesById) {
  const parts = [];
  if (e.unlockedByEvidenceIds?.length) {
    parts.push(`after ${e.unlockedByEvidenceIds.map((id) => evidenceById.get(String(id))?.code || '?').join(' + ')}`);
  }
  if (e.unlockedByBranchId) {
    const branch = branchesById.get(String(e.unlockedByBranchId));
    const lead = branch?.leads?.find((l) => l.id === e.unlockedByLeadId);
    parts.push(`lead "${lead?.label || e.unlockedByLeadId}"`);
  }
  return parts.length ? parts.join(' · ') : 'start se available';
}

export default function MysteryQrPanel({ title, evidence = [], branches = [], onRotate }) {
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const evidenceById = new Map(evidence.map((e) => [String(e._id), e]));
  const branchesById = new Map(branches.map((b) => [String(b._id), b]));
  const qrClues = evidence.filter((e) => e.requiresQR && e.qrSecret);
  const autoClues = evidence.filter((e) => !e.requiresQR);

  const print = async () => {
    setError('');
    try {
      await printQrSheet({ title, evidence });
    } catch (err) {
      setError(err.message);
    }
  };

  const rotate = async (e) => {
    if (!window.confirm(`${e.code} ka naya QR banega — purana printed QR kaam nahi karega. Continue?`)) return;
    setBusyId(e._id);
    try {
      await onRotate(e);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0ECCEE]">{qrClues.length} QR clues to print</p>
            <p className="text-xs text-white/45">Har QR venue pe chipkao. Team scan kare ya neeche wala manual code type kare. Order lock rehta hai — pehle wale clues ke bina agla nahi khulega.</p>
          </div>
          <button type="button" disabled={!qrClues.length} onClick={print} className={primaryBtn}>Print QR sheet</button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {qrClues.map((e) => (
          <div key={e._id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex gap-3">
              <div className="shrink-0 rounded-lg bg-white p-1"><LocalQRCode data={e.qrSecret} size={96} printSafe /></div>
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold">{e.code}</p>
                <p className="text-sm">{e.title}</p>
                <p className={`text-xs ${WORLD_TONE[e.world] || 'text-white/50'}`}>{e.world} · {e.points} pts</p>
                <p className="mt-1 font-mono text-xs text-[#0ECCEE]">{e.qrSecret}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-white/50">📍 {e.placementNote || 'Placement note nahi — case builder me add karo'}</p>
            <p className="text-xs text-white/40">🔓 {unlockRule(e, evidenceById, branchesById)}</p>
            {onRotate && <button type="button" disabled={busyId === e._id} onClick={() => rotate(e)} className={`mt-2 ${ghostBtn}`}>New QR</button>}
          </div>
        ))}
      </div>

      {autoClues.length > 0 && (
        <section className={cardClass}>
          <p className="text-sm font-semibold">Auto-unlock clues ({autoClues.length}) — print nahi karne</p>
          <ul className="mt-2 space-y-1 text-xs text-white/55">
            {autoClues.map((e) => <li key={e._id}><span className="font-mono text-white/70">{e.code}</span> {e.title} — 🔓 {unlockRule(e, evidenceById, branchesById)}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
