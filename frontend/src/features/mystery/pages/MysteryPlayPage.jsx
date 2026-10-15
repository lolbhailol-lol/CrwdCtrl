import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ScanLine, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { WORLD_ORDER, WORLD_THEME } from '../worldTheme';
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
  const [seenIds, setSeenIds] = useState(null);

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
    const ids = (data?.unlockedEvidence || []).map((e) => String(e._id));
    if (!ids.length || (seenIds && ids.every((id) => seenIds.has(id)))) return undefined;
    const t = setTimeout(() => setSeenIds(new Set(ids)), seenIds ? 6000 : 0);
    return () => clearTimeout(t);
  }, [data, seenIds]);

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
        setScanMessage(res.alreadyUnlocked ? 'This evidence is already unlocked' : `Unlocked: ${res.lastUnlocked?.title || 'evidence'}`);
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
  const totalClues = evidenceList.length + (data?.lockedEvidenceCount ?? 0);
  const worldCounts = WORLD_ORDER.reduce((acc, w) => ({ ...acc, [w]: evidenceList.filter((e) => e.world === w).length }), { all: evidenceList.length });
  const compromisedCount = evidenceList.filter((e) => e.invalidated).length;

  return (
    <div className="min-h-screen bg-[#0b0c0d] bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(167,139,250,0.18),transparent),radial-gradient(ellipse_60%_30%_at_100%_10%,rgba(34,211,238,0.12),transparent)] pb-28 text-white">
      <MysteryOfflineBanner isOnline={isOnline} pendingCount={pendingCount} />
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="bg-gradient-to-r from-cyan-300 via-violet-300 to-orange-300 bg-clip-text text-xs font-bold uppercase tracking-[0.28em] text-transparent">{data?.team?.teamName || 'Investigation'}</p>
            <h1 className="mt-1 text-2xl font-black">{data?.case?.title || 'CTRL Mystery'}</h1>
          </div>
          <button type="button" onClick={() => { clearMysteryAuth(); navigate(MYSTERY_PATHS.landing); }} className="text-xs text-white/40 underline">Exit</button>
        </div>

        {error && !data && <p className="mt-6 text-sm text-rose-300">{error}</p>}
        {loading && !data && <p className="mt-6 text-white/40">Loading investigation…</p>}

        {data && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-white/50">Clues found</p>
                <p className="text-2xl font-black">{evidenceList.length}<span className="text-base font-semibold text-white/40"> / {totalClues}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/50">Score</p>
                <p className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text font-mono text-2xl font-black text-transparent">{data.totalScore ?? 0}</p>
              </div>
            </div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/10">
              {WORLD_ORDER.map((w) => (worldCounts[w] > 0 && totalClues > 0 ? (
                <div key={w} style={{ width: `${(worldCounts[w] / totalClues) * 100}%`, background: WORLD_THEME[w].color }} className="h-full transition-all duration-500" />
              ) : null))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {WORLD_ORDER.map((w) => (
                <span key={w} className="flex items-center gap-1 text-white/60">
                  <span className="h-2 w-2 rounded-full" style={{ background: WORLD_THEME[w].color }} />
                  {WORLD_THEME[w].label} {worldCounts[w]}
                </span>
              ))}
              {compromisedCount > 0 && <span className="text-rose-300">{compromisedCount} compromised</span>}
            </div>
          </div>
        )}

        {data && !canPlay && !finished && (
          <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            The event isn't live yet — the investigation opens as soon as the organiser starts it.
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

        <div className="mt-6"><MysteryWorldTabs active={worldFilter} onChange={setWorldFilter} counts={worldCounts} /></div>

        <div className="mt-4 grid gap-4">
          {filtered.map((ev) => {
            const trusted = trustById.get(String(ev._id));
            return (
              <div key={ev._id}>
                <MysteryEvidenceCard evidence={ev} trusted={trusted} isNew={Boolean(seenIds) && !seenIds.has(String(ev._id))} />
                {canPlay && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleTrustDecision(ev._id, 'reliable')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${trusted === true ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-emerald-400/30 bg-emerald-400/5 text-emerald-300'}`}><ShieldCheck size={14} /> Trust</button>
                    <button type="button" onClick={() => handleTrustDecision(ev._id, 'unreliable')} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${trusted === false ? 'border-amber-400 bg-amber-400 text-black' : 'border-amber-400/30 bg-amber-400/5 text-amber-300'}`}><ShieldQuestion size={14} /> Doubt</button>
                  </div>
                )}
              </div>
            );
          })}
          {data && filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">No evidence unlocked yet — scan a QR code to begin.</p>
          )}
        </div>

        {caseReadyToSubmit && <div className="mt-8"><MysteryFinalSubmitForm onSubmit={handleFinalSubmit} busy={submitBusy} /></div>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0c0d]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {scanMessage && <p className="mb-2 text-center text-xs text-white/60">{scanMessage}</p>}
          <button type="button" disabled={!canPlay} onClick={() => setScannerOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-violet-400 to-orange-400 py-3.5 text-sm font-black text-black shadow-[0_8px_30px_rgba(167,139,250,0.35)] disabled:opacity-40"><ScanLine size={18} /> Scan evidence QR</button>
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
              <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Camera not working? Type the code" autoCapitalize="characters" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/30" />
              <button type="submit" disabled={scanBusy || !manualCode.trim()} className="rounded-xl bg-[#0ECCEE] px-4 text-sm font-bold text-black disabled:opacity-40">Unlock</button>
            </form>
            {scanBusy && <p className="mt-2 text-center text-xs text-white/50">Checking…</p>}
          </div>
        </div>
      )}

      {fightsBack && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 px-5">
          <div className="w-full max-w-sm rounded-2xl border border-rose-400/50 bg-gradient-to-b from-rose-950 to-[#1a0d0d] p-5 text-center shadow-[0_0_60px_rgba(251,113,133,0.35)]">
            <span className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-rose-500/20 text-rose-300"><AlertTriangle size={24} /></span>
            <p className="mt-3 text-xs font-black uppercase tracking-widest text-rose-300">Mystery Fights Back</p>
            <p className="mt-2 text-sm text-white/80">{fightsBack.systemMessage || 'One of your evidence pieces has been invalidated.'}</p>
            <button type="button" onClick={handleAckFightsBack} className="mt-4 w-full rounded-xl bg-rose-400 py-2.5 text-sm font-bold text-black">Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}