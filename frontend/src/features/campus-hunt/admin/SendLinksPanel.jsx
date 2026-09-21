import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminExportOfflinePacks,
  adminImportOfflineResults,
  adminListOfflineInstalls,
  adminPreviewOfflineImport,
} from '../services/campusHunt.api';
import OfflineInstallCards from '../offline/components/OfflineInstallCards';
import { downloadOfflinePacks } from '../offline/downloadOfflinePacks';

/**
 * Create WhatsApp install links — passwords + clues ready.
 * No schedule / lock step required (bindings auto-fill on create).
 */
export default function SendLinksPanel({
  eventId,
  teamCapacity = 20,
  teamSize = 10,
  readiness = null,
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

  const preflight = useMemo(() => {
    const r = readiness || {};
    const teamsTotal = Number(r.teamsTotal) || 0;
    const passwordsReady = Number(r.passwordsReady ?? r.teamsReady) || 0;
    const leftover = Number(r.leftoverTeams) || 0;
    const linksGate = r.offlineLinksReady != null
      ? Boolean(r.offlineLinksReady)
      : (
        teamsTotal > 0
        && passwordsReady >= teamsTotal
        && Boolean(r.startingPointsReady)
        && Number(r.routesReady) > 0
      );
    const checks = [
      {
        id: 'teams',
        ok: teamsTotal > 0 && passwordsReady >= teamsTotal,
        label: `Team passwords · ${passwordsReady || '—'}/${teamsTotal || teamCapacity}`,
        fix: 'Teams tab — set a password for every team',
      },
      {
        id: 'clues',
        ok: Number(r.routesReady) > 0,
        label: 'Clues 1–6 + place QRs ready',
        fix: 'Clues tab — save Clue 1–6',
      },
      {
        id: 'starts',
        ok: Boolean(r.startingPointsReady),
        label: 'Starting place ready',
        fix: 'Places tab — keep at least one gather point',
      },
      ...(leftover > 0
        ? [{
          id: 'leftover',
          ok: false,
          label: `${leftover} leftover team(s) beyond capacity`,
          fix: 'Teams → Trim to capacity (or Save setup again)',
        }]
        : []),
    ];
    const blockers = checks.filter((c) => !c.ok);
    return {
      checks,
      blockers,
      // Leftovers auto-prune on create links — don't block the button.
      ready: linksGate && blockers.filter((b) => b.id !== 'leftover').length === 0,
    };
  }, [readiness, teamCapacity]);

  const exportLinks = useCallback(async (perTeam = false) => {
    if (!eventId || busy) return;
    if (!preflight.ready) {
      setError(
        `Fix setup first: ${preflight.blockers.filter((b) => b.id !== 'leftover').map((b) => b.fix).join(' · ')}`,
      );
      return;
    }
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
            `${data.incompleteTeams.length} team(s) skipped — finish Clues 1–6, then Create again.`,
          ]
          : []),
      ];
      setWarnings(nextWarnings);
      setMessage(
        data.teamCount
          ? `Ready: ${data.teamCount} team pack${data.teamCount === 1 ? '' : 's'} `
            + `(batch ${data.exportBatchId || '—'}). WhatsApp each leader.`
          : 'No packs yet — finish Places, Clues 1–6, and team passwords first.',
      );
      await refreshStatus();
    } catch (err) {
      setError(err.message || 'Could not create install links');
    } finally {
      setBusy('');
    }
  }, [busy, eventId, preflight, refreshStatus]);

  const runImport = useCallback(async (payload, force = false) => {
    if (!eventId || !payload) return;
    setBusy('import');
    setError('');
    try {
      const res = await adminImportOfflineResults(eventId, payload, { force });
      const row = res.data || res;
      setMessage(
        `Imported ${row.teamCode}: ${row.score} pts`
        + `${row.overwritten ? ' (overwrote locked)' : ''}. `
        + 'Live / Results board updates from this score.',
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
  const installedCount = statusRows.filter((r) => r.installed || r.installedAt).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Send links</h2>
        <p className="mt-1 text-sm text-white/55">
          One WhatsApp install link per team · leader phone only.
          {' '}
          No schedule step — create when passwords + clues are ready.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/4 p-3">
        <ul className="space-y-1.5 text-sm">
          {preflight.checks.map((c) => (
            <li key={c.id} className={c.ok ? 'text-emerald-200' : 'text-amber-100'}>
              {c.ok ? '✓' : '○'} {c.label}
              {!c.ok ? <span className="text-white/45"> — {c.fix}</span> : null}
            </li>
          ))}
        </ul>
      </section>

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
          Day-before ready · {installedCount}/{statusRows.length} installed
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
        <h3 className="text-sm font-bold text-white">Create & send</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !eventId || !preflight.ready}
            onClick={() => exportLinks(false)}
            className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40"
            title={!preflight.ready ? 'Fix preflight blockers first' : undefined}
          >
            {busy === 'links' ? 'Creating…' : 'Create team links'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !eventId || !preflight.ready}
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
        {!preflight.ready ? (
          <p className="mt-3 text-sm text-amber-100/90">
            Need: team passwords + Clues 1–6 saved + at least one gather place.
          </p>
        ) : null}
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
          After the hunt, leaders export JSON from the phone. Upload here to lock scores.
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
          {teamSize}
          /team · capacity
          {' '}
          {teamCapacity}
        </p>
      </section>
    </div>
  );
}
