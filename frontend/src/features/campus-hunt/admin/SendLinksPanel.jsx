import { useCallback, useEffect, useState } from 'react';
import {
  adminExportOfflinePacks,
  adminImportOfflineResults,
  adminListOfflineInstalls,
  adminPreviewOfflineImport,
  adminSetAllTeamPasswords,
  adminUpdateEvent,
} from '../services/campusHunt.api';
import OfflineInstallCards from '../offline/components/OfflineInstallCards';
import { downloadOfflinePacks } from '../offline/downloadOfflinePacks';

/**
 * Links — default ready. Create anytime; change teams/clues then Create again.
 */
export default function SendLinksPanel({
  eventId,
  teamCapacity = 20,
  teamSize = 10,
  readiness = null,
  organizerStartCode = 'GO',
  organizerFinishCode = 'MSFINISH',
  onChanged,
}) {
  const [installs, setInstalls] = useState([]);
  const [statusRows, setStatusRows] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [startCode, setStartCode] = useState(String(organizerStartCode || 'GO').toUpperCase());
  const [finishCode, setFinishCode] = useState(String(organizerFinishCode || 'MSFINISH').toUpperCase());
  const [leaderPassword, setLeaderPassword] = useState('');

  useEffect(() => {
    setStartCode(String(organizerStartCode || 'GO').toUpperCase());
    setFinishCode(String(organizerFinishCode || 'MSFINISH').toUpperCase());
  }, [organizerStartCode, organizerFinishCode]);

  const teamsTotal = Number(readiness?.teamsTotal) || 0;
  const passwordsReady = Number(readiness?.passwordsReady ?? readiness?.teamsReady) || 0;

  const refreshStatus = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await adminListOfflineInstalls(eventId);
      setStatusRows(res.data?.installs || []);
    } catch {
      setStatusRows([]);
    }
  }, [eventId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const saveCodes = useCallback(async () => {
    if (!eventId || busy) return;
    const start = String(startCode || 'GO').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GO';
    const finish = String(finishCode || 'MSFINISH').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'MSFINISH';
    setBusy('codes');
    setError('');
    setMessage('');
    try {
      await adminUpdateEvent(eventId, {
        organizerStartCode: start,
        organizerFinishCode: finish,
      });
      setStartCode(start);
      setFinishCode(finish);
      setMessage(`Saved. Start code ${start}. Finish code ${finish}. Create leader packs again so phones get them.`);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save codes');
    } finally {
      setBusy('');
    }
  }, [busy, eventId, finishCode, onChanged, startCode]);

  const saveLeaderPassword = useCallback(async () => {
    const password = String(leaderPassword || '').trim();
    if (!eventId || busy) return;
    if (password.length < 4) {
      setError('Password needs at least 4 characters');
      return;
    }
    if (!window.confirm(`Set password "${password}" for every team?`)) return;
    setBusy('password');
    setError('');
    setMessage('');
    try {
      const res = await adminSetAllTeamPasswords(eventId, password);
      setLeaderPassword('');
      setMessage(res.data?.message || `Password set for ${res.data?.teamsUpdated || 0} teams. Create leader packs again so WhatsApp includes it.`);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not set passwords');
    } finally {
      setBusy('');
    }
  }, [busy, eventId, leaderPassword, onChanged]);

  const exportLinks = useCallback(async (perTeam = false) => {
    if (!eventId || busy) return;
    setBusy(perTeam ? 'zip' : 'links');
    setMessage('');
    setWarnings([]);
    setError('');
    try {
      const res = await adminExportOfflinePacks(eventId);
      const data = res.data || res;
      setInstalls(Array.isArray(data.installs) ? data.installs : []);
      await downloadOfflinePacks(data, { perTeam });
      const nextWarnings = [
        ...(data.warnings || []),
        ...(data.pruned?.removed
          ? [`Removed ${data.pruned.removed} leftover team(s) beyond capacity.`]
          : []),
        ...(data.incompleteTeams?.length
          ? [
            `${data.incompleteTeams.length} team(s) skipped — save Clues 1–6, then Create again.`,
          ]
          : []),
      ];
      setWarnings(nextWarnings);
      setMessage(
        data.teamCount
          ? `Ready: ${data.teamCount} leader pack${data.teamCount === 1 ? '' : 's'} `
            + `(batch ${data.exportBatchId || '—'}). WhatsApp each leader only.`
          : 'No packs yet — open Teams / Clues once, then Create again.',
      );
      await refreshStatus();
    } catch (err) {
      const msg = err.status === 503 || err.code === 'DB_UNAVAILABLE'
        ? 'Database briefly unavailable — tap Create links again in a few seconds.'
        : (err.message || 'Could not create install links');
      setError(msg);
    } finally {
      setBusy('');
    }
  }, [busy, eventId, refreshStatus]);

  const runImport = useCallback(async (payload, force = false) => {
    if (!eventId || !payload) return;
    setBusy('import');
    setError('');
    try {
      const res = await adminImportOfflineResults(eventId, payload, { force });
      const row = res.data || res;
      setMessage(
        `Imported ${row.teamCode}: ${row.score} pts`
        + `${row.overwritten ? ' (overwrote locked)' : ''}.`,
      );
      setImportPreview(null);
      setPendingImport(null);
    } catch (err) {
      if (err.status === 409 || err.code === 'SCORE_LOCKED' || /already has a locked/i.test(err.message || '')) {
        setError(err.message);
        setImportPreview(err.data?.preview || importPreview);
        return;
      }
      setError(err.message || 'Could not import results');
    } finally {
      setBusy('');
    }
  }, [eventId, importPreview]);

  const onPickImportFile = useCallback(async (file) => {
    if (!eventId || !file) return;
    setBusy('preview');
    setError('');
    setImportPreview(null);
    setPendingImport(null);
    try {
      const parsed = JSON.parse(await file.text());
      const payload = parsed?.t ? parsed : (parsed?.data || parsed);
      setPendingImport(payload);
      const res = await adminPreviewOfflineImport(eventId, payload);
      const preview = res.data?.preview || res.preview;
      setImportPreview(preview);
      if (preview?.alreadyLocked) {
        setMessage(`${preview.team} already locked. Confirm overwrite to continue.`);
      } else {
        setMessage(`Preview OK · ${preview.team} → ${preview.score} pts.`);
      }
    } catch (err) {
      setError(err.message || 'Could not preview import');
    } finally {
      setBusy('');
    }
  }, [eventId]);

  const statusByCode = Object.fromEntries(statusRows.map((r) => [r.teamCode, r]));
  const missingInstall = statusRows.filter((r) => !(r.installed || r.installedAt));
  const dayBeforeGate = statusRows.length > 0 && missingInstall.length > 0;
  const installedCount = statusRows.filter((r) => r.installed || r.installedAt).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Send links</h2>
        <p className="mt-1 text-sm text-white/55">
          One pack per team → WhatsApp the leader only. Walkers share that one phone.
        </p>
      </div>

      <section className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        {teamsTotal > 0
          ? `✓ ${teamsTotal} leader pack${teamsTotal === 1 ? '' : 's'} · passwords ${passwordsReady}/${teamsTotal || teamCapacity}`
          : 'Create teams on the Teams tab first (or Save size on the hub), then Create links.'}
      </section>

      {dayBeforeGate ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">{missingInstall.length} team(s) not installed yet</p>
          <p className="mt-1 text-xs text-amber-100/80">
            {missingInstall.slice(0, 12).map((r) => r.teamCode).join(', ')}
            {missingInstall.length > 12 ? '…' : ''}
          </p>
        </div>
      ) : statusRows.length > 0 ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          Installed · {installedCount}/{statusRows.length}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
        <h3 className="text-sm font-bold text-white">Password and codes</h3>
        <p className="mt-1 text-xs text-white/50">
          Leaders type the password after download. They type the start code when you say it. Finish code is at the lobby.
          Passwords ready {passwordsReady}/{teamsTotal || teamCapacity}.
        </p>
        <label className="mt-3 block text-xs text-white/60">
          Leader password for all teams
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              value={leaderPassword}
              onChange={(e) => setLeaderPassword(e.target.value)}
              placeholder="At least 4 characters"
              className="min-w-[12rem] flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
              autoComplete="off"
            />
            <button
              type="button"
              disabled={Boolean(busy) || !eventId}
              onClick={saveLeaderPassword}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === 'password' ? 'Saving…' : 'Set password'}
            </button>
          </div>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-white/60">
            Start code
            <input
              value={startCode}
              onChange={(e) => setStartCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-[0.2em] text-white"
            />
          </label>
          <label className="block text-xs text-white/60">
            Finish code
            <input
              value={finishCode}
              onChange={(e) => setFinishCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-[0.2em] text-white"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={Boolean(busy) || !eventId}
          onClick={saveCodes}
          className="mt-3 rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy === 'codes' ? 'Saving…' : 'Save codes'}
        </button>
      </section>

      <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
        <h3 className="text-sm font-bold text-white">Create & send</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !eventId}
            onClick={() => exportLinks(false)}
            className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40"
          >
            {busy === 'links' ? 'Creating…' : 'Create leader packs'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !eventId}
            onClick={() => exportLinks(true)}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy === 'zip' ? 'Downloading…' : 'Also download JSON packs'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !eventId}
            onClick={() => refreshStatus()}
            className="rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white/80"
          >
            Refresh installed
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {warnings.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-200/90">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        <OfflineInstallCards
          installs={(installs.length ? installs : statusRows).map((row) => ({
            ...row,
            installed: statusByCode[row.teamCode]?.installed || Boolean(row.installedAt),
          }))}
        />
        {statusRows.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="text-white/45">
                <tr>
                  <th className="py-1">Team</th>
                  <th>Installed</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((row) => (
                  <tr key={row.token} className="border-t border-white/5">
                    <td className="py-1.5 font-mono text-[#0ECCEE]">{row.teamCode}</td>
                    <td>
                      <span className={row.installed ? 'text-emerald-300' : 'text-amber-200'}>
                        {row.installed ? 'Installed' : 'Not yet'}
                      </span>
                    </td>
                    <td className="text-white/45">
                      {row.installedAt
                        ? new Date(row.installedAt).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <h3 className="text-sm font-bold text-white">Import results</h3>
        <p className="mt-1 text-xs text-white/50">
          After the hunt, upload a leader’s results JSON to lock the score.
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm text-white/80">
          {busy === 'preview' ? 'Reading…' : 'Choose results file'}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={Boolean(busy)}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onPickImportFile(file);
            }}
          />
        </label>
        {importPreview ? (
          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
            <p>
              {importPreview.team}
              {' · '}
              {importPreview.score}
              {' pts'}
              {importPreview.alreadyLocked ? ' · already locked' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy) || !pendingImport}
                onClick={() => runImport(pendingImport, false)}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
              >
                {busy === 'import' ? 'Importing…' : 'Confirm import'}
              </button>
              {importPreview.alreadyLocked ? (
                <button
                  type="button"
                  disabled={Boolean(busy) || !pendingImport}
                  onClick={() => runImport(pendingImport, true)}
                  className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-sm text-amber-100 disabled:opacity-40"
                >
                  Overwrite locked score
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-white/40">
          {teamSize}/team · capacity {teamCapacity}
        </p>
      </section>
    </div>
  );
}
