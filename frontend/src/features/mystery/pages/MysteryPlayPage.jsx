import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useMysteryAuth from '../hooks/useMysteryAuth';
import { useMysteryTeam } from '../hooks/useMysteryTeam';
import {
  acknowledgeFightsBack, chooseInvestigationBranch, fetchPendingFightsBack,
  setEvidenceTrust, startInvestigation, submitFinalCase, unlockEvidenceByQr,
} from '../services/mystery.api';
import { MYSTERY_PATHS } from '../config';
import MysteryQrScanner from '../components/MysteryQrScanner';
import MysteryWorldTabs from '../components/MysteryWorldTabs';
import MysteryEvidenceCard from '../components/MysteryEvidenceCard';
import MysteryBranchPicker from '../components/MysteryBranchPicker';
import MysteryFinalSubmitForm from '../components/MysteryFinalSubmitForm';
import MysteryOfflineBanner from '../offline/MysteryOfflineBanner';
import { useMysteryOfflineQueue } from '../offline/useMysteryOfflineQueue';
import { cacheInvestigationState, readCachedInvestigationState } from '../offline/mysteryOfflineDb';

export default function MysteryPlayPage() {
  const navigate = useNavigate();
  const { meta, isMysteryAuthenticated, clearMysteryAuth } = useMysteryAuth();
  const teamId = meta?.teamId;

  const { data, loading, error, refresh, setData } = useMysteryTeam(teamId, { enabled: !!teamId });
  const { isOnline, queueAction, pendingCount } = useMysteryOfflineQueue(teamId);

  const [worldFilter, setWorldFilter] = useState('all');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [fightsBack, setFightsBack] = useState(null);

  useEffect(() => {
    if (!isMysteryAuthenticated) navigate(MYSTERY_PATHS.enter, { replace: true });
  }, [isMysteryAuthenticated, navigate]);

  useEffect(() => {
    if (!teamId) return;
    if (!data && !loading) {
      if (isOnline) {
        startInvestigation(teamId).catch(() => {}).finally(refresh);
      } else {
        readCachedInvestigationState(teamId).then((cached) => { if (cached) setData(cached); });
      }
    }
  }, [teamId, data, loading, isOnline, refresh, setData]);

  useEffect(() => {
    if (data && teamId) cacheInvestigationState(teamId, data);
  }, [data, teamId]);

  useEffect(() => {
    if (!teamId || !isOnline) return undefined;
    const id = setInterval(() => {
      fetchPendingFightsBack(teamId).then((res) => {
        const pending = res.data?.[0] || res.pending?.[0];
        if (pending) setFightsBack(pending);
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [teamId, isOnline]);

  const handleScan = useCallback(async (qrSecret) => {
    setScanBusy(true);
    setScanMessage('');
    try {
      if (isOnline) {
        const res = await unlockEvidenceByQr(teamId, qrSecret);
        setData(res.data || res);
        setScanMessage('Evidence unlocked!');
      } else {
        await queueAction({ type: 'unlock-qr', payload: { qrSecret } });
        setScanMessage('Offline — saved, will unlock when network returns');
      }
    } catch (err) {
      setScanMessage(err.message || 'Scan failed');
    } finally {
      setScanBusy(false);
      setTimeout(() => setScannerOpen(false), 900);
    }
  }, [teamId, isOnline, queueAction, setData]);

  const handleBranchChoice = async (branchId, leadId) => {
    try {
      if (isOnline) {
        const res = await chooseInvestigationBranch(teamId, branchId, leadId);
        setData(res.data || res);
      } else {
        await queueAction({ type: 'branch', payload: { branchId, leadId } });
      }
    } catch (err) {
      setScanMessage(err.message || 'Could not save choice');
    }
  };

  const handleTrustDecision = async (evidenceId, decision) => {
    try {
      if (isOnline) {
        const res = await setEvidenceTrust(teamId, evidenceId, decision);
        setData(res.data || res);
      } else {
        await queueAction({ type: 'trust', payload: { evidenceId, decision } });
      }
    } catch { /* non-blocking */ }
  };

  const handleFinalSubmit = async (payload) => {
    setSubmitBusy(true);
    try {
      if (isOnline) {
        await submitFinalCase(teamId, payload);
        navigate(MYSTERY_PATHS.leaderboard(data?.team?.eventId || ''), { replace: true });
      } else {
        await queueAction({ type: 'final-submit', payload });
        setScanMessage('Offline — final submission saved, will send when network returns');
      }
    } catch (err) {
      setScanMessage(err.message || 'Submission failed');
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleAckFightsBack = async () => {
    if (!fightsBack) return;
    try {
      await acknowledgeFightsBack(teamId, fightsBack._id || fightsBack.id);
    } finally {
      setFightsBack(null);
      refresh();
    }
  };

  if (!teamId) return null;

  const evidenceList = data?.unlockedEvidence || data?.evidence || [];
  const filtered = worldFilter === 'all' ? evidenceList : evidenceList.filter((e) => e.world === worldFilter);
  const activeBranch = data?.pendingBranch || null;
  const caseReadyToSubmit = Boolean(data?.canSubmitFinal);

  return (
    <div className="min-h-screen bg-[#0b0c0d] pb-28 text-white">
      <MysteryOfflineBanner isOnline={isOnline} pendingCount={pendingCount} />
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">{data?.team?.teamName || 'Investigation'}</p>
            <h1 className="mt-1 text-xl font-bold">{data?.case?.title || 'CTRL Mystery'}</h1>
          </div>
          <button type="button" onClick={() => { clearMysteryAuth(); navigate(MYSTERY_PATHS.landing); }} className="text-xs text-white/40 underline">Exit</button>
        </div>

        {error && !data && <p className="mt-6 text-sm text-rose-300">{error}</p>}
        {loading && !data && <p className="mt-6 text-white/40">Loading investigation…</p>}

        {activeBranch && <div className="mt-6"><MysteryBranchPicker branch={activeBranch} onChoose={handleBranchChoice} /></div>}

        <div className="mt-6"><MysteryWorldTabs active={worldFilter} onChange={setWorldFilter} /></div>

        <div className="mt-4 grid gap-3">
          {filtered.map((ev) => (
            <div key={ev._id || ev.id}>
              <MysteryEvidenceCard evidence={ev} />
              <div className="mt-2 flex gap-2 pl-1">
                <button type="button" onClick={() => handleTrustDecision(ev._id || ev.id, 'reliable')} className="rounded-lg border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300">Mark reliable</button>
                <button type="button" onClick={() => handleTrustDecision(ev._id || ev.id, 'unreliable')} className="rounded-lg border border-rose-400/30 px-3 py-1 text-xs text-rose-300">Mark unreliable</button>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">Abhi tak koi evidence unlock nahi hua — QR scan karke shuru karo.</p>
          )}
        </div>

        {caseReadyToSubmit && <div className="mt-8"><MysteryFinalSubmitForm onSubmit={handleFinalSubmit} busy={submitBusy} /></div>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0c0d]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {scanMessage && <p className="mb-2 text-center text-xs text-white/60">{scanMessage}</p>}
          <button type="button" onClick={() => setScannerOpen(true)} className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black">Scan evidence QR</button>
        </div>
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-5">
          <div className="w-full max-w-sm">
            <MysteryQrScanner active={scannerOpen} onScan={handleScan} onClose={() => setScannerOpen(false)} />
            {scanBusy && <p className="mt-2 text-center text-xs text-white/50">Checking…</p>}
          </div>
        </div>
      )}

      {fightsBack && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 px-5">
          <div className="w-full max-w-sm rounded-2xl border border-rose-400/40 bg-[#1a0d0d] p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-300">Mystery Fights Back</p>
            <p className="mt-2 text-sm text-white/80">{fightsBack.systemMessage || 'One of your evidence pieces has been invalidated.'}</p>
            <button type="button" onClick={handleAckFightsBack} className="mt-4 w-full rounded-xl bg-rose-400 py-2.5 text-sm font-bold text-black">Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}