import { useCallback, useEffect, useState } from 'react';
import {
  adminExportOfflinePacks,
  adminImportOfflineResults,
  adminListOfflineInstalls,
  adminPreviewOfflineImport,
} from '../services/campusHunt.api';
import OfflineInstallCards from '../offline/components/OfflineInstallCards';
import { downloadOfflinePacks } from '../offline/downloadOfflinePacks';

/**
 * Primary ops surface: create one WhatsApp install link per team and send them.
 */
export default function SendLinksPanel({
  eventId,
  teamCapacity = 40,
  teamSize = 4,
}) {
  const [installs, setInstalls] = useState([]);
  const [statusRows, setStatusRows] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);

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
        ...(data.incompleteTeams?.length
          ? [`${data.incompleteTeams.length} team(s) skipped — finish Clue 1–5 / checkpoint bindings first.`]
          : []),
      ];
      setWarnings(nextWarnings);
      setMessage(
        data.teamCount
          ? `Ready: ${data.teamCount} team link${data.teamCount === 1 ? '' : 's'} `
            + `(batch ${data.exportBatchId || '—'}). WhatsApp each team.`
          : 'No complete packs — finish Locations, Clues (incl. Clue 5), Teams first.',
      );
      await refreshStatus();
    } catch (err) {
      setError(err.message || 'Could not create install links');
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
      setMessage(`Imported ${row.teamCode}: ${row.score} pts${row.overwritten ? ' (overwrote locked)' : ''}.`);
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
        setMessage(`${preview.team} already locked at ${preview.finalScore ?? preview.currentScore}. Confirm overwrite to continue.`);
      } else {
        setMessage(`Preview OK · ${preview.team} → ${preview.score} pts. Confirm import.`);
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
          Send links
        </p>
        <h2 className="mt-1 text-xl font-bold">One WhatsApp link per team</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Round 1 offline for ~{teamCapacity} teams × {teamSize} players.
          Leader opens once on Wi‑Fi → pack saves → Installed badge appears here.
        </p>
      </div>

      {dayBeforeGate ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Day-before gate · {missingInstall.length} team(s) not installed</p>
          <p className="mt-1 text-xs text-amber-100/80">
            Chase WhatsApp acks before fest day:
            {' '}
            {missingInstall.slice(0, 12).map((r) => r.teamCode).join(', ')}
            {missingInstall.length > 12 ? '…' : ''}
          </p>
        </div>
      ) : statusRows.length > 0 ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          Day-before ready · {statusRows.filter((r) => r.installed || r.installedAt).length}/{statusRows.length} installed
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
        <h3 className="text-sm font-bold text-white">Create & send</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !eventId}
            onClick={() => exportLinks(false)}
            className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40"
          >
            {busy === 'links' ? 'Creating…' : 'Create team links'}
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
                      {row.installedAt ? new Date(row.installedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <h3 className="text-sm font-bold text-white">After the fest · import results</h3>
        <p className="mt-1 text-xs text-white/50">
          Preview first. Locked scores need an explicit overwrite.
        </p>
        <label className="mt-3 flex cursor-pointer flex-wrap items-center gap-2 text-sm text-white/70">
          <span className="font-semibold text-white/85">Choose results JSON</span>
          <input
            type="file"
            accept=".json,application/json"
            disabled={Boolean(busy) || !eventId}
            className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-xs file:text-white"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onPickImportFile(file);
            }}
          />
        </label>
        {importPreview ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/75">
            <p>
              <strong className="text-white">{importPreview.team}</strong>
              {' → '}
              {importPreview.score}
              {' pts · sig '}
              {importPreview.signatureOk ? 'OK' : 'BAD'}
              {importPreview.alreadyLocked ? ' · already locked' : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === 'import' || !pendingImport || !importPreview.signatureOk}
                onClick={() => runImport(pendingImport, false)}
                className="rounded-lg bg-[#0ECCEE] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
              >
                Confirm import
              </button>
              {importPreview.alreadyLocked ? (
                <button
                  type="button"
                  disabled={busy === 'import' || !pendingImport}
                  onClick={() => {
                    if (!window.confirm(`Overwrite locked score for ${importPreview.team}?`)) return;
                    runImport(pendingImport, true);
                  }}
                  className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100"
                >
                  Force overwrite
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
