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
  const [manualCode, setManualCode] = useState('');
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
        const pending = Array.isArray(res) ? res[0] : res?.data?.[0];
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
        setData(res);
        setScanMessage(res.alreadyUnlocked ? 'Ye evidence pehle se unlocked hai' : `Unlocked: ${res.lastUnlocked?.title || 'evidence'}`);
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
        setData(res);
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
        setData(res);
      } else {
        await queueAction({ type: 'trust', payload: { evidenceId, decision } });
      }
    } catch { /* non-blocking */ }
  };

  const handleFinalSubmit = async (payload) => {
    setSubmitBusy(true);
    try {
      if (isOnline) {
        const res = await submitFinalCase(teamId, payload);
        setData(res);
        if (data?.team?.eventId) navigate(MYSTERY_PATHS.leaderboard(data.team.eventId), { replace: true });
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

  const evidenceList = data?.unlockedEvidence || [];
  const filtered = worldFilter === 'all' ? evidenceList : evidenceList.filter((e) => e.world === worldFilter);
  const canPlay = Boolean(data?.canPlay);
  const activeBranch = canPlay ? data?.pendingBranch : null;
  const caseReadyToSubmit = Boolean(data?.canSubmitFinal);
  const trustById = new Map((data?.trustDecisions || []).map((t) => [String(t.evidenceId), t.trusted]));
  const finished = data?.status === 'finished';

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

        {data && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="text-white/60">{evidenceList.length} found · {data.lockedEvidenceCount ?? 0} still hidden</span>
            <span className="font-mono font-semibold text-[#0ECCEE]">{data.totalScore ?? 0} pts</span>
          </div>
        )}

        {data && !canPlay && !finished && (
          <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Event abhi live nahi hai — organiser start karte hi investigation khul jayegi.
          </p>
        )}

        {finished && (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm">
            <p className="font-semibold text-emerald-200">Case submitted</p>
            <p className="mt-1 text-white/70">
              Score: <span className="font-mono">{data.submission?.scoreBreakdown?.total ?? data.totalScore ?? 0}</span>
              {data.submission?.graded ? ' (final)' : ' · theory grading pending'}
            </p>
          </div>
        )}

        {activeBranch && <div className="mt-6"><MysteryBranchPicker branch={activeBranch} onChoose={handleBranchChoice} /></div>}

        <div className="mt-6"><MysteryWorldTabs active={worldFilter} onChange={setWorldFilter} /></div>

        <div className="mt-4 grid gap-3">
          {filtered.map((ev) => {
            const trusted = trustById.get(String(ev._id));
            return (
              <div key={ev._id}>
                <MysteryEvidenceCard evidence={ev} />
                {canPlay && (
                  <div className="mt-2 flex gap-2 pl-1">
                    <button type="button" onClick={() => handleTrustDecision(ev._id, 'reliable')} className={`rounded-lg border border-emerald-400/30 px-3 py-1 text-xs ${trusted === true ? 'bg-emerald-400 text-black' : 'text-emerald-300'}`}>Mark reliable</button>
                    <button type="button" onClick={() => handleTrustDecision(ev._id, 'unreliable')} className={`rounded-lg border border-rose-400/30 px-3 py-1 text-xs ${trusted === false ? 'bg-rose-400 text-black' : 'text-rose-300'}`}>Mark unreliable</button>
                  </div>
                )}
              </div>
            );
          })}
          {data && filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">Abhi tak koi evidence unlock nahi hua — QR scan karke shuru karo.</p>
          )}
        </div>

        {caseReadyToSubmit && <div className="mt-8"><MysteryFinalSubmitForm onSubmit={handleFinalSubmit} busy={submitBusy} /></div>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0c0d]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {scanMessage && <p className="mb-2 text-center text-xs text-white/60">{scanMessage}</p>}
          <button type="button" disabled={!canPlay} onClick={() => setScannerOpen(true)} className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black disabled:opacity-40">Scan evidence QR</button>
        </div>
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-5">
          <div className="w-full max-w-sm">
            <MysteryQrScanner active={scannerOpen} onScan={handleScan} onClose={() => setScannerOpen(false)} />
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) handleScan(manualCode.trim().toUpperCase());
                setManualCode('');
              }}
            >
              <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Camera nahi chal raha? Code type karo" autoCapitalize="characters" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/30" />
              <button type="submit" disabled={scanBusy || !manualCode.trim()} className="rounded-xl bg-[#0ECCEE] px-4 text-sm font-bold text-black disabled:opacity-40">Unlock</button>
            </form>
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