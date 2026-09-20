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
 * Primary ops surface: create one WhatsApp install link per team and send them.
 * Also explains live board sync + post-fest import for ranking.
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
    const bindingsReady = Number(r.startAssignmentsReady) || 0;
    const linksGate = r.offlineLinksReady != null
      ? Boolean(r.offlineLinksReady)
      : (
        teamsTotal > 0
        && passwordsReady >= teamsTotal
        && bindingsReady >= teamsTotal
        && Boolean(r.startingPointsReady)
        && Number(r.routesReady) > 0
      );
    const checks = [
      {
        id: 'teams',
        ok: teamsTotal > 0 && passwordsReady >= teamsTotal,
        label: `Team passwords · ${passwordsReady || '—'}/${teamsTotal || teamCapacity}`,
        fix: 'Teams tab — set a password for every field team',
      },
      {
        id: 'bindings',
        ok: teamsTotal > 0 && bindingsReady >= teamsTotal,
        label: `Clue 1–6 path bindings · ${bindingsReady || '—'}/${teamsTotal || teamCapacity}`,
        fix: 'Clues → Update, then Live → Generate schedule (binds 5 stops + Clue 6)',
      },
      {
        id: 'schedule',
        ok: Boolean(r.scheduleLocked) || Boolean(r.scheduleGenerated && bindingsReady >= teamsTotal && teamsTotal > 0),
        label: r.scheduleLocked
          ? 'Schedule locked'
          : (r.scheduleGenerated ? 'Schedule generated (lock when ready)' : 'Schedule not generated'),
        fix: 'Live / Schedule — Generate schedule (Lock optional for links)',
      },
      {
        id: 'starts',
        ok: Boolean(r.startingPointsReady),
        label: 'Starting point(s) ready',
        fix: 'Locations — keep at least one gather point active',
      },
      {
        id: 'routes',
        ok: Number(r.routesReady) > 0,
        label: 'Clues + station QRs ready',
        fix: 'Clues + Locations — ensure Clue 1–6 and orange→red posters exist',
      },
    ];
    const blockers = checks.filter((c) => !c.ok);
    return {
      checks,
      blockers,
      ready: linksGate && blockers.length === 0,
    };
  }, [readiness, teamCapacity]);

  const exportLinks = useCallback(async (perTeam = false) => {
    if (!eventId || busy) return;
    if (!preflight.ready) {
      setError(
        `Fix setup first: ${preflight.blockers.map((b) => b.fix).join(' · ')}`,
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
        ...(data.incompleteTeams?.length
          ? [
            `${data.incompleteTeams.length} team(s) skipped — missing Clue 1–6 / 5 path stops. `
              + 'Generate schedule again after clues are complete.',
          ]
          : []),
      ];
      setWarnings(nextWarnings);
      setMessage(
        data.teamCount
          ? `Ready: ${data.teamCount} team pack${data.teamCount === 1 ? '' : 's'} `
            + `(batch ${data.exportBatchId || '—'}). WhatsApp each leader — install on Wi‑Fi before fest.`
          : 'No complete packs — finish Locations, Clues 1–6, Teams, Generate schedule first.',
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
            Links unlock when every team has a password and Clue 1–6 path bindings
            (Generate schedule). Schedule Lock is optional for creating links.
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
        <h3 className="text-sm font-bold text-white">How ranking works (offline fest)</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-white/65">
          <li>
            <strong className="text-white/90">During the hunt</strong>
            {' '}
            — play is offline on the leader phone. If data flickers on briefly, the phone
            <em> best-effort</em>
            {' '}
            syncs score/stage to the Live board. Airplane mode is fine; the board may lag or stay quiet.
          </li>
          <li>
            <strong className="text-white/90">Live board</strong>
            {' '}
            — ranks by score (then faster finish, fewer hints, fewer fails). Only updates when a sync or import lands.
          </li>
          <li>
            <strong className="text-white/90">After the hunt</strong>
            {' '}
            — leader exports results JSON from Hunt → you import below → score locks → Results / finalize.
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-white/40">
          Do not rely on live sync alone for medals. Import every team’s results file (or finish desk) before finalize.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <h3 className="text-sm font-bold text-white">After the fest · import results</h3>
        <p className="mt-1 text-xs text-white/50">
          Preview first. Locked scores need an explicit overwrite. This is what makes the leaderboard official.
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

      <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
        <h3 className="text-sm font-bold text-white">Quick test (1 team)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/60">
          <li>Preflight all green → Create team links → WhatsApp yourself</li>
          <li>Open link in Chrome → Pack saved → Install Hunt → turn data OFF</li>
          <li>Play 1–2 stops offline → turn data ON briefly → check Live board score moved</li>
          <li>Finish or export results JSON → import here → confirm Results rank</li>
        </ol>
      </section>
    </div>
  );
}
