import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  adminListChallenges,
  adminListCheckpoints,
  adminListTeams,
  adminResyncClue1,
} from '../services/campusHunt.api';
import { STAGE_THEMES } from '../types/stageTheme';
import { resolveStations, resolveStarts } from './campusHuntFormat';

const T = STAGE_THEMES;

const QR_COLS = [
  { key: 'orange', theme: T.clue1, when: 'After Clue 1 solved', unlocks: 'Clue 2' },
  { key: 'green', theme: T.clue2, when: 'After Clue 2 solved', unlocks: 'Clue 3' },
  { key: 'blue', theme: T.clue3, when: 'After Clue 3 solved', unlocks: 'Prop hunt (Clue 4)' },
  { key: 'purple', theme: T.clue4, when: 'After prop code typed', unlocks: 'Final (Clue 5)' },
];

function CheckRow({ children, id, accent }) {
  return (
    <label className="huddle-check flex items-start gap-2 border-b border-white/10 py-1 text-[11px] leading-snug last:border-0 print:border-black/15 print:py-0.5 print:text-[9.5px]">
      <input
        type="checkbox"
        id={id}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 print:h-3 print:w-3"
        style={{ accentColor: accent || '#0ECCEE' }}
      />
      <span className="text-white/85 print:text-black">{children}</span>
    </label>
  );
}

function ColorChip({ theme, short }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white print:border print:border-black/25"
      style={{ background: theme.hex }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden />
      {short || theme.colorName}
    </span>
  );
}

function SectionTitle({ n, children, note }) {
  return (
    <header className="huddle-section-head mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[#0ECCEE]/50 pb-1 print:border-black">
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-white print:text-[11px] print:text-black">
        {n != null ? <span className="mr-1.5 text-[#0ECCEE] print:text-black">{n}.</span> : null}
        {children}
      </h3>
      {note ? (
        <p className="text-[10px] text-white/45 print:text-[8.5px] print:text-black/55">{note}</p>
      ) : null}
    </header>
  );
}

function placeLabel(cp) {
  if (!cp) return '—';
  const code = cp.stationCode || '';
  const name = cp.locationName || '';
  return [code, name].filter(Boolean).join(' · ') || '—';
}

function placeKey(label) {
  return String(label || '').split(' · ')[0].trim().toUpperCase();
}

/**
 * Printable dry-run plant sheet — location → QR colors → props, with setup explained.
 */
export default function DryRunHuddleChecklist({
  eventId,
  campusStations,
  campusStarts,
  teamSize = 3,
  stationCount,
}) {
  const stations = useMemo(
    () => resolveStations(campusStations, stationCount),
    [campusStations, stationCount],
  );
  const activeStationCodes = useMemo(
    () => new Set(stations.map((s) => String(s.code || '').toUpperCase())),
    [stations],
  );
  const starts = useMemo(() => resolveStarts(campusStarts), [campusStarts]);
  const people = Math.max(2, Math.min(8, Number(teamSize) || 3));

  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState('');
  const [propRows, setPropRows] = useState([]);
  const [qrByPlace, setQrByPlace] = useState([]);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixMessage, setFixMessage] = useState('');
  const autoFixAttempted = useRef(false);

  useEffect(() => {
    autoFixAttempted.current = false;
  }, [eventId]);

  const buildPropRows = useCallback((teams, challenges, checkpoints) => {
    const cpById = new Map(checkpoints.map((c) => [String(c.id || c._id), c]));
    const clueById = new Map(
      challenges
        .filter((c) => Number(c.challengeNumber) === 4)
        .map((c) => [String(c.id || c._id), c]),
    );
    const layoutTeams = teams
      .filter((t) => /^CC00[1-8]$/i.test(String(t.teamCode || '')))
      .sort((a, b) => String(a.teamCode).localeCompare(String(b.teamCode)));
    const source = layoutTeams.length ? layoutTeams : teams.slice(0, 12);

    return source.map((t) => {
      const prop = clueById.get(String(t.clue4ChallengeId || ''));
      const purple = placeLabel(cpById.get(String(t.fourthCheckpointId || '')));
      const purpleCode = placeKey(purple);
      return {
        teamCode: t.teamCode,
        orange: placeLabel(cpById.get(String(t.firstCheckpointId || ''))),
        green: placeLabel(cpById.get(String(t.secondCheckpointId || ''))),
        blue: placeLabel(cpById.get(String(t.thirdCheckpointId || ''))),
        purple,
        purpleOutOfLayout: Boolean(purpleCode && !activeStationCodes.has(purpleCode)),
        propCode: String(prop?.answer || '').toUpperCase() || '—',
        variant: prop?.variantKey || '',
      };
    });
  }, [activeStationCodes]);

  const loadSheet = useCallback(async () => {
    if (!eventId) return { rows: [], qrRows: [] };
    const [chRes, cpRes, teamRes] = await Promise.all([
      adminListChallenges(eventId),
      adminListCheckpoints(eventId),
      adminListTeams(eventId),
    ]);
    const challenges = Array.isArray(chRes.data) ? chRes.data : (chRes.data?.challenges || []);
    const checkpoints = Array.isArray(cpRes.data) ? cpRes.data : (cpRes.data?.checkpoints || []);
    const teams = Array.isArray(teamRes.data) ? teamRes.data : (teamRes.data?.teams || []);
    const rows = buildPropRows(teams, challenges, checkpoints);

    const byStation = new Map();
    for (const s of stations) {
      byStation.set(s.code, {
        code: s.code,
        name: s.name,
        orange: false,
        green: false,
        blue: false,
        purple: false,
      });
    }
    for (const c of checkpoints) {
      if (c.active === false) continue;
      const code = String(c.stationCode || '').toUpperCase();
      if (!code || !byStation.has(code)) continue;
      const prog = String(c.progressionKey || c.checkpointKey || '');
      const row = byStation.get(code);
      if (prog === '1') row.orange = true;
      if (prog === '2') row.green = true;
      if (prog === '3') row.blue = true;
      if (prog === '4') row.purple = true;
    }

    return { rows, qrRows: [...byStation.values()] };
  }, [eventId, stations, buildPropRows]);

  const fixPurpleRoutes = useCallback(async () => {
    if (!eventId || fixBusy) return;
    setFixBusy(true);
    setFixMessage('');
    setError('');
    try {
      const result = await adminResyncClue1(eventId, {
        reason: 'Fix purple routes to match active campus places',
      });
      const fix = result.data?.clue4Fix;
      const updated = result.data?.updated ?? 0;
      const { rows, qrRows } = await loadSheet();
      setPropRows(rows);
      setQrByPlace(qrRows);
      const stillStale = rows.filter((row) => row.purpleOutOfLayout).length;
      if (stillStale > 0) {
        setFixMessage(`Updated ${updated} teams but ${stillStale} still outside layout — open Clues → Update Clue 4.`);
      } else if (fix?.reconciled) {
        setFixMessage(`Fixed — purple stops now use your ${stations.length} active places only.`);
      } else {
        setFixMessage(`Routes refreshed · ${updated} teams synced.`);
      }
    } catch (err) {
      setError(err.message || 'Could not fix purple routes');
    } finally {
      setFixBusy(false);
    }
  }, [eventId, fixBusy, loadSheet, stations.length]);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { rows, qrRows } = await loadSheet();
        if (cancelled) return;

        const staleCount = rows.filter((row) => row.purpleOutOfLayout).length;
        if (staleCount > 0 && !autoFixAttempted.current) {
          autoFixAttempted.current = true;
          try {
            await adminResyncClue1(eventId, {
              reason: 'Auto-fix stale purple routes on plant sheet load',
            });
            const refreshed = await loadSheet();
            if (!cancelled) {
              setPropRows(refreshed.rows);
              setQrByPlace(refreshed.qrRows);
              const left = refreshed.rows.filter((row) => row.purpleOutOfLayout).length;
              if (left === 0) {
                setFixMessage('Purple routes auto-fixed to your active places.');
              }
            }
            return;
          } catch {
            // Fall back to showing stale rows + manual fix button.
          }
        }

        setPropRows(rows);
        setQrByPlace(qrRows);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load plant sheet');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, loadSheet]);

  const placeRows = useMemo(() => {
    const base = qrByPlace.length
      ? qrByPlace
      : stations.map((s) => ({
        code: s.code,
        name: s.name,
        orange: false,
        green: false,
        blue: false,
        purple: false,
      }));

    return base.map((row) => {
      const propsHere = propRows.filter((r) => placeKey(r.purple) === String(row.code).toUpperCase());
      return { ...row, propsHere };
    });
  }, [qrByPlace, stations, propRows]);

  const posterCount = placeRows.reduce(
    (sum, row) => sum + [row.orange, row.green, row.blue, row.purple].filter(Boolean).length,
    0,
  );
  const stalePurpleCount = propRows.filter((row) => row.purpleOutOfLayout).length;

  return (
    <section className="dry-run-huddle rounded-2xl border border-white/12 bg-[#0f1114] p-4 text-white print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
      <div className="flex flex-wrap items-start justify-between gap-3 print:mb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE] print:text-[8px] print:tracking-[0.15em] print:text-black">
            Ops plant sheet · printable
          </p>
          <h2 className="mt-1 text-lg font-bold print:mt-0 print:text-[16px] print:leading-tight">
            Where to put each QR & prop
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-white/55 print:mt-0.5 print:max-w-none print:text-[9px] print:leading-snug print:text-black/65">
            Walk campus with this sheet. Each place gets up to four shared posters (one color each).
            Props only go at the purple stop for that team.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-xs font-bold text-black print:hidden"
        >
          Print plant sheet
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-300 print:text-red-700">{error}</p> : null}
      {stalePurpleCount > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 print:border-amber-700 print:bg-amber-50 print:text-amber-950">
          <p className="min-w-[200px] flex-1">
            {stalePurpleCount} team{stalePurpleCount === 1 ? '' : 's'} still on old places (S05/S06).
            {' '}Purple must stay within your {stations.length} active places.
          </p>
          <button
            type="button"
            disabled={fixBusy || !eventId}
            onClick={fixPurpleRoutes}
            className="rounded-lg bg-amber-300 px-3 py-1.5 text-[11px] font-bold text-black disabled:opacity-50 print:hidden"
          >
            {fixBusy ? 'Fixing…' : 'Fix purple routes now'}
          </button>
        </div>
      ) : null}
      {fixMessage ? (
        <p className="mt-2 text-xs text-emerald-300 print:text-emerald-800">{fixMessage}</p>
      ) : null}
      {loading ? <p className="mt-2 text-xs text-white/45 print:hidden">Loading live bindings…</p> : null}

      {/* SETUP EXPLAINED */}
      <div className="huddle-print-block mt-4 space-y-3 print:mt-2 print:space-y-2">
        <section className="huddle-keep rounded-lg border border-white/10 bg-white/3 p-3 print:rounded-none print:border print:border-black/30 print:p-2">
          <SectionTitle n="1" note="Read this once before taping">
            How setup works
          </SectionTitle>

          <div className="space-y-2 text-[11px] leading-snug text-white/80 print:text-[9px] print:text-black/80">
            <p>
              <strong className="text-white print:text-black">START desk</strong>
              {' '}
              (
              {starts.length
                ? starts.map((s) => `${s.code} ${s.name}`).join(' · ')
                : 'set in admin'}
              )
              {' '}
              = gather / finish only.
              {' '}
              <strong className="text-amber-200 print:text-black">No hunt QR posters at START.</strong>
            </p>
            <p>
              <strong className="text-white print:text-black">Campus places</strong>
              {' '}
              ({stations.length}):
              {' '}
              {stations.map((s) => `${s.code} ${s.name}`).join(' · ') || '—'}
              .
              Print ~{posterCount || (loading ? '…' : 0)} posters from Station QR (orange + green + blue + purple).
            </p>
            <ol className="list-decimal space-y-1.5 pl-4 print:space-y-1">
              <li>
                Team solves
                {' '}
                <ColorChip theme={T.clue1} short="Clue 1" />
                {' '}
                on phone → walks to their
                {' '}
                <strong>Orange FIRST SCAN</strong>
                {' '}
                place → all {people} scan + team code → unlocks Clue 2.
              </li>
              <li>
                Solve
                {' '}
                <ColorChip theme={T.clue2} short="Clue 2" />
                {' '}
                →
                {' '}
                <strong>Green SECOND SCAN</strong>
                {' '}
                → all {people} + team code → Clue 3.
              </li>
              <li>
                Solve
                {' '}
                <ColorChip theme={T.clue3} short="Clue 3" />
                {' '}
                →
                {' '}
                <strong>Blue THIRD SCAN</strong>
                {' '}
                → all {people} + team code → Prop hunt (Clue 4).
              </li>
              <li>
                At their
                {' '}
                <ColorChip theme={T.clue4} short="Purple" />
                {' '}
                place: find planted prop, type sticker
                {' '}
                <strong>CODE</strong>
                {' '}
                → then all {people} scan
                {' '}
                <strong>Purple FOURTH SCAN</strong>
                {' '}
                + team code → Final (Clue 5).
              </li>
              <li>
                Solve
                {' '}
                <ColorChip theme={T.final} short="Final" />
                {' '}
                word on phone → return to START → organizer marks finish.
                {' '}
                <strong>No player finish QR.</strong>
              </li>
            </ol>
            <p className="rounded border border-amber-400/40 bg-amber-500/15 px-2 py-1.5 text-[10px] text-amber-100 print:border-amber-700 print:bg-amber-50 print:text-[8.5px] print:text-black">
              <strong>Rules:</strong>
              {' '}
              Never swap poster colors · prop sticker CODE must match that team’s phone · purple QR sits next to that team’s prop · don’t move posters mid-hunt.
            </p>
          </div>

          <div className="mt-2 huddle-prep-grid grid gap-x-4 md:grid-cols-2">
            <CheckRow id="m1" accent="#0ECCEE">Printed all {posterCount || (loading ? '…' : 0)} station posters</CheckRow>
            <CheckRow id="m2" accent="#0ECCEE">Team links + password · phones on play screen</CheckRow>
            <CheckRow id="m3" accent="#0ECCEE">Schedule locked · Round started · finish desk staffed</CheckRow>
            <CheckRow id="m4" accent="#0ECCEE">Walked every place below before release</CheckRow>
          </div>
        </section>
      </div>

      {/* PER LOCATION — main plant sheet */}
      <div className="huddle-print-block huddle-print-break mt-4 space-y-3 print:mt-0 print:space-y-2">
        <section>
          <SectionTitle n="2" note="One card per campus place — tape what’s listed">
            Plant by location
          </SectionTitle>
          <p className="mb-2 text-[10px] text-white/50 print:mb-1.5 print:text-[8.5px] print:text-black/55">
            At each place: tape the colored posters listed. If props are listed, plant those objects with the exact CODE sticker, and put the purple QR next to them.
          </p>

          <div className="huddle-place-grid grid gap-2 md:grid-cols-2 print:gap-1.5">
            {placeRows.map((row) => {
              const qrs = QR_COLS.filter((col) => row[col.key]);
              return (
                <article
                  key={row.code}
                  className="huddle-keep rounded-lg border border-white/12 bg-white/3 p-2.5 print:rounded-none print:border print:border-black/35 print:p-2"
                >
                  <header className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-white/15 pb-1 print:border-black/25">
                    <h4 className="text-[13px] font-bold print:text-[11px]">
                      {row.code}
                      <span className="ml-1.5 font-semibold text-white/70 print:text-black/70">
                        {row.name}
                      </span>
                    </h4>
                    <span className="text-[9px] text-white/40 print:text-[8px] print:text-black/45">
                      ☐ done
                    </span>
                  </header>

                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-white/45 print:text-[8px] print:text-black/50">
                    Tape these QR posters
                  </p>
                  <ul className="mb-2 space-y-1">
                    {qrs.length ? qrs.map((col) => (
                      <li
                        key={col.key}
                        className="flex items-start gap-2 rounded px-1.5 py-1 text-[10px] print:text-[8.5px]"
                        style={{ background: `${col.theme.hex}22` }}
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-[11px] print:text-[9px]">☐</span>
                        <span>
                          <ColorChip
                            theme={col.theme}
                            short={`${col.theme.colorName} · ${col.theme.scanLabel}`}
                          />
                          <span className="mt-0.5 block text-white/70 print:text-black/70">
                            For
                            {' '}
                            <strong className="text-white print:text-black">{col.theme.label}</strong>
                            {' '}
                            — teams scan after
                            {' '}
                            {col.when.toLowerCase().replace(/^after /, '')}
                            . Unlocks
                            {' '}
                            {col.unlocks}.
                          </span>
                        </span>
                      </li>
                    )) : (
                      <li className="text-[10px] text-white/45 print:text-[8.5px] print:text-black/50">
                        No active QR bindings for this place.
                      </li>
                    )}
                  </ul>

                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-white/45 print:text-[8px] print:text-black/50">
                    Plant props here (Clue 4)
                  </p>
                  {row.propsHere.length ? (
                    <ul className="space-y-1">
                      {row.propsHere.map((p) => (
                        <li
                          key={`${p.teamCode}-${p.propCode}`}
                          className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1.5 py-1 text-[10px] print:text-[8.5px]"
                          style={{ background: `${T.clue4.hex}28` }}
                        >
                          <span className="font-mono">☐</span>
                          <span
                            className="font-mono text-[12px] font-black tracking-wider print:text-[10px]"
                            style={{ color: T.clue4.hex }}
                          >
                            {p.propCode}
                          </span>
                          <span className="font-mono text-white/70 print:text-black/70">
                            {p.teamCode}
                          </span>
                          {p.variant ? (
                            <span className="text-white/40 print:text-black/45">{p.variant}</span>
                          ) : null}
                          <span className="w-full text-[9px] text-white/55 print:text-[8px] print:text-black/55">
                            Sticker = exact CODE · purple QR within arm’s reach of this prop
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[10px] text-white/40 print:text-[8.5px] print:text-black/45">
                      {row.purple
                        ? 'No team’s purple stop here — still tape purple QR if listed above (shared poster).'
                        : 'No props at this place.'}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* QUICK REFERENCE TABLES */}
      <div className="huddle-print-block huddle-print-break mt-4 space-y-3 print:mt-0 print:space-y-2">
        <section className="huddle-keep">
          <SectionTitle n="3" note="Quick glance — which colors at which place">
            QR summary
          </SectionTitle>
          <table className="huddle-table w-full border-collapse text-left text-[11px] print:text-[8.5px]">
            <thead>
              <tr>
                <th className="huddle-th w-[28%]">Place</th>
                {QR_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="huddle-th"
                    style={{ color: col.theme.hex, width: '18%' }}
                  >
                    {col.theme.colorName}
                    <span className="mt-0.5 block font-normal normal-case tracking-normal text-white/40 print:text-black/45">
                      {col.theme.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {placeRows.map((row) => (
                <tr key={`sum-${row.code}`}>
                  <td className="huddle-td font-semibold">
                    {row.code}
                    <span className="font-normal text-white/50 print:text-black/50"> · {row.name}</span>
                  </td>
                  {QR_COLS.map((col) => (
                    <td
                      key={col.key}
                      className="huddle-td font-semibold"
                      style={{ background: row[col.key] ? `${col.theme.hex}28` : undefined }}
                    >
                      {row[col.key] ? '☐ tape' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="huddle-keep">
          <SectionTitle n="4" note="Prop CODE sticker + purple QR at that purple stop">
            Prop checklist
          </SectionTitle>
          <table className="huddle-table w-full border-collapse text-left text-[11px] print:text-[8.5px]">
            <thead>
              <tr>
                <th className="huddle-th w-[12%]">Team</th>
                <th className="huddle-th w-[16%]" style={{ color: T.clue4.hex }}>CODE</th>
                <th className="huddle-th w-[40%]">Plant at (purple stop)</th>
                <th className="huddle-th w-[16%]">☐ Prop</th>
                <th className="huddle-th w-[16%]">☐ Purple</th>
              </tr>
            </thead>
            <tbody>
              {propRows.map((r) => (
                <tr key={`prop-${r.teamCode}`}>
                  <td className="huddle-td font-mono font-bold">{r.teamCode}</td>
                  <td
                    className="huddle-td font-mono text-[12px] font-black tracking-wider print:text-[10px]"
                    style={{ color: T.clue4.hex }}
                  >
                    {r.propCode}
                  </td>
                  <td className="huddle-td">{r.purple}</td>
                  <td className="huddle-td">☐</td>
                  <td className="huddle-td">☐</td>
                </tr>
              ))}
              {!propRows.length && !loading ? (
                <tr>
                  <td className="huddle-td" colSpan={5}>
                    No Clue 4 bindings — bootstrap / resync first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="huddle-keep">
          <SectionTitle n="5" note="Each team’s stop order (verify before open)">
            Team routes
          </SectionTitle>
          <table className="huddle-table w-full border-collapse text-left text-[10px] print:text-[8px]">
            <thead>
              <tr>
                <th className="huddle-th w-[8%]">Team</th>
                <th className="huddle-th w-[18%]" style={{ color: T.clue1.hex }}>① Orange</th>
                <th className="huddle-th w-[18%]" style={{ color: T.clue2.hex }}>② Green</th>
                <th className="huddle-th w-[18%]" style={{ color: T.clue3.hex }}>③ Blue</th>
                <th className="huddle-th w-[12%]" style={{ color: T.clue4.hex }}>Prop</th>
                <th className="huddle-th w-[26%]" style={{ color: T.clue4.hex }}>④ Purple</th>
              </tr>
            </thead>
            <tbody>
              {propRows.map((r) => (
                <tr key={`route-${r.teamCode}`}>
                  <td className="huddle-td font-mono font-bold">{r.teamCode}</td>
                  <td className="huddle-td" style={{ background: `${T.clue1.hex}18` }}>{r.orange}</td>
                  <td className="huddle-td" style={{ background: `${T.clue2.hex}18` }}>{r.green}</td>
                  <td className="huddle-td" style={{ background: `${T.clue3.hex}18` }}>{r.blue}</td>
                  <td
                    className="huddle-td font-mono font-black"
                    style={{ background: `${T.clue4.hex}28`, color: T.clue4.hex }}
                  >
                    {r.propCode}
                  </td>
                  <td
                    className={`huddle-td ${r.purpleOutOfLayout ? 'text-amber-200 ring-1 ring-inset ring-amber-400/40' : ''}`}
                    style={{ background: `${T.clue4.hex}18` }}
                  >
                    {r.purple}
                    {r.purpleOutOfLayout ? (
                      <span className="mt-0.5 block text-[9px] font-semibold text-amber-200/90 print:text-amber-800">
                        not in layout
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-white/45 print:mt-1.5 print:text-[8px] print:text-black/50">
            After Final word → back to START → desk marks finish. Desk: keep play screens open · paste codes only if camera fails · if stuck, check poster COLOR vs phone stage.
          </p>
        </section>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 12mm;
          }
          body * { visibility: hidden !important; }
          .dry-run-huddle,
          .dry-run-huddle * { visibility: visible !important; }
          .dry-run-huddle {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #111 !important;
            font-family: ui-sans-serif, system-ui, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden { display: none !important; }
          .huddle-print-break {
            break-before: page;
            page-break-before: always;
          }
          .huddle-keep {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .huddle-place-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .huddle-prep-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            column-gap: 12px !important;
          }
          .huddle-table {
            width: 100% !important;
            table-layout: fixed !important;
            border: 1px solid #222 !important;
          }
          .huddle-th {
            border: 1px solid #333 !important;
            background: #f3f4f6 !important;
            padding: 4px 5px !important;
            font-size: 8px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
            vertical-align: bottom !important;
          }
          .huddle-td {
            border: 1px solid #ccc !important;
            padding: 4px 5px !important;
            vertical-align: top !important;
            word-wrap: break-word !important;
            overflow-wrap: anywhere !important;
            color: #111 !important;
          }
          .huddle-section-head {
            margin-bottom: 6px !important;
            padding-bottom: 3px !important;
          }
        }
        .huddle-th {
          border-bottom: 1px solid rgba(255,255,255,0.15);
          padding: 6px 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.55);
        }
        .huddle-td {
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 7px 8px;
          vertical-align: top;
        }
      `}</style>
    </section>
  );
}
