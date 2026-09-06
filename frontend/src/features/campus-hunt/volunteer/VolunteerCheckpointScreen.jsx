import { useEffect, useState } from 'react';
import {
  volunteerMe,
  volunteerScanTeam,
  volunteerScanRaw,
  volunteerVerifyMember,
  volunteerComplete,
  clearVolunteerSession,
} from '../services/campusHunt.api';
import IssueReportForm from '../components/IssueReportForm';
import HuntQrScanner from '../components/HuntQrScanner';

export default function VolunteerCheckpointScreen({ onLogout }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointId, setCheckpointId] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showIssue, setShowIssue] = useState(false);
  const [showCamera, setShowCamera] = useState(true);
  const [completeReason, setCompleteReason] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await volunteerMe();
        const cps = res.data?.checkpoints || [];
        setCheckpoints(cps);
        if (cps[0]) setCheckpointId(String(cps[0]._id));
      } catch (err) {
        setMessage(err.message || 'Session expired');
      }
    })();
  }, []);

  const selected = checkpoints.find((c) => String(c._id) === checkpointId);
  const expectedCheckpoint = preview?.expectedCheckpoint || preview?.team?.expectedCheckpoint;

  const applyPreview = (data) => {
    setPreview(data);
    if (!data?.valid) setMessage(data?.message || 'Invalid');
    else if (data.autoVerified) {
      setMessage(`${data.verifiedCount || data.autoVerified.verifiedCount || 0}/4 verified`);
    } else {
      setMessage('');
    }
  };

  const scan = async (e) => {
    e.preventDefault();
    if (!checkpointId || !teamCode.trim()) return;
    setBusy(true);
    setMessage('');
    setPreview(null);
    try {
      const res = await volunteerScanTeam(checkpointId, teamCode.trim());
      applyPreview(res.data);
    } catch (err) {
      setMessage(err.message || 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const onQr = async (raw) => {
    if (!checkpointId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await volunteerScanRaw(checkpointId, raw);
      applyPreview(res.data);
      if (res.data?.team?.teamCode) setTeamCode(res.data.team.teamCode);
    } catch (err) {
      setMessage(err.message || 'QR scan failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleMember = async (userId) => {
    if (!preview?.team?.id) return;
    setBusy(true);
    try {
      const res = await volunteerVerifyMember(checkpointId, {
        teamId: preview.team.id,
        userId,
      });
      const again = await volunteerScanTeam(checkpointId, preview.team.teamCode);
      setPreview(again.data);
      setMessage(`${res.data?.verifiedCount || 0}/4 verified`);
    } catch (err) {
      setMessage(err.message || 'Verify failed');
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!preview?.team?.id) return;
    const reason = completeReason.trim();
    if (reason.length < 8) {
      setMessage('Enter a reason (why you are verifying — team must be present)');
      return;
    }
    setBusy(true);
    try {
      const res = await volunteerComplete(checkpointId, preview.team.id, reason);
      setMessage(res.data?.message || 'CHECKPOINT VERIFIED');
      setPreview(null);
      setTeamCode('');
      setCompleteReason('');
    } catch (err) {
      setMessage(err.message || 'Complete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-5 bg-[#0b0c0d] px-4 py-6 text-white">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#0ECCEE]">Volunteer</p>
          <h1 className="text-2xl font-bold">
            CHECKPOINT {selected?.checkpointKey || selected?.checkpointNumber || '—'}
          </h1>
          <p className="text-sm text-white/50">{selected?.locationName}</p>
        </div>
        <button
          type="button"
          className="text-xs text-white/50 underline"
          onClick={() => {
            clearVolunteerSession();
            onLogout?.();
          }}
        >
          Logout
        </button>
      </header>

      {checkpoints.length > 1 && (
        <select
          value={checkpointId}
          onChange={(e) => setCheckpointId(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
        >
          {checkpoints.map((c) => (
            <option key={c._id} value={c._id}>
              {c.checkpointKey} — {c.locationName}
            </option>
          ))}
        </select>
      )}

      {selected && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          You are verifying arrivals at{' '}
          <span className="font-semibold text-white">
            {selected.checkpointKey} — {selected.locationName}
          </span>
          . The server confirms whether this is the team&apos;s expected checkpoint.
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className={`flex-1 rounded-lg py-2 text-sm ${showCamera ? 'bg-[#0ECCEE] text-black' : 'bg-white/10'}`}
        >
          Scan QR
        </button>
        <button
          type="button"
          onClick={() => setShowCamera(false)}
          className={`flex-1 rounded-lg py-2 text-sm ${!showCamera ? 'bg-white text-black' : 'bg-white/10'}`}
        >
          Type code
        </button>
      </div>

      {showCamera ? (
        <HuntQrScanner active={Boolean(checkpointId)} onScan={onQr} />
      ) : (
        <form onSubmit={scan} className="space-y-3">
          <label className="block text-sm text-white/60">Scan Team</label>
          <input
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
            placeholder="e.g. CC027"
            className="w-full rounded-xl border border-white/20 bg-[#161718] px-4 py-3 font-mono text-lg uppercase"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-white py-3 font-semibold text-black disabled:opacity-50"
          >
            Look up team
          </button>
        </form>
      )}

      {preview?.valid && (
        <div className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
          <div className="flex justify-between text-sm">
            <span>Team</span>
            <span className="font-mono font-bold">{preview.team.teamCode}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Members</span>
            <span>
              {preview.verifiedCount}/{preview.requiredCount}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Checkpoint</span>
            <span>{preview.checkpoint.checkpointKey}</span>
          </div>
          {expectedCheckpoint && (
            <div className="rounded-lg border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-[#0ECCEE]">Expected checkpoint</p>
              <p className="mt-1 font-semibold">
                {expectedCheckpoint.checkpointKey || expectedCheckpoint.code || '—'}
                {expectedCheckpoint.locationName ? ` — ${expectedCheckpoint.locationName}` : ''}
              </p>
              {expectedCheckpoint.publicInstruction && (
                <p className="mt-1 text-xs text-white/65">{expectedCheckpoint.publicInstruction}</p>
              )}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>Status</span>
            <span className="font-semibold text-emerald-400">
              {preview.status === 'complete' ? 'COMPLETE' : 'VALID'}
            </span>
          </div>

          <ul className="space-y-2 pt-2">
            {(preview.members || []).map((m) => (
              <li key={m.userId}>
                <button
                  type="button"
                  disabled={busy || m.verified}
                  onClick={() => toggleMember(m.userId)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                    m.verified ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10'
                  }`}
                >
                  <span>
                    {m.name}
                    {m.isLeader ? ' (Leader)' : ''}
                  </span>
                  <span>{m.verified ? '✓' : 'Tap to verify'}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <p className="text-xs text-amber-200/90">
              Prefer player station QR scans. Volunteer VERIFY only if the team is physically here.
            </p>
            <input
              value={completeReason}
              onChange={(e) => setCompleteReason(e.target.value)}
              placeholder="Reason (required) e.g. Team present at booth"
              className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={
              busy
              || preview.verifiedCount < 4
              || preview.status === 'complete'
              || completeReason.trim().length < 8
            }
            onClick={complete}
            className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-lg font-bold text-black disabled:opacity-40"
          >
            VERIFY
          </button>
        </div>
      )}

      {preview && !preview.valid && expectedCheckpoint && (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4">
          <p className="font-semibold text-amber-100">Wrong checkpoint for this team</p>
          <p className="mt-1 text-sm text-white/75">
            Expected: {expectedCheckpoint.checkpointKey || expectedCheckpoint.code || '—'}
            {expectedCheckpoint.locationName ? ` — ${expectedCheckpoint.locationName}` : ''}
          </p>
          <p className="mt-2 text-xs text-white/55">
            Direct the team there. Do not override or reveal route/clue details.
          </p>
        </div>
      )}

      {message && (
        <p className="text-center text-sm font-medium text-[#0ECCEE]">{message}</p>
      )}

      <button
        type="button"
        onClick={() => setShowIssue((v) => !v)}
        className="w-full rounded-xl border border-amber-400/40 py-2 text-sm text-amber-200"
      >
        REPORT ISSUE
      </button>
      {showIssue && (
        <IssueReportForm
          checkpointId={checkpointId}
          teamId={preview?.team?.id}
        />
      )}
    </div>
  );
}
