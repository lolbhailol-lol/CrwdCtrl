import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  adminExportOfflinePacks,
  adminListChallenges,
  adminListCheckpoints,
  adminListTeams,
  adminResyncClue1,
} from '../services/campusHunt.api';
import { downloadOfflinePacks } from '../offline/downloadOfflinePacks';
import { CAMPUS_HUNT_PATHS } from '../config';
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

/** CC001 → 1, CC008 → 8 */
function teamNumberFromCode(teamCode) {
  const m = String(teamCode || '').match(/CC0*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function formatTeamNumbers(teamCodes = []) {
  const nums = teamCodes
    .map((code) => teamNumberFromCode(code))
    .filter((n) => n != null)
    .sort((a, b) => a - b);
  if (!nums.length) return '—';
  return nums.map((n) => `#${n}`).join(', ');
}

function formatTeamLabel(teamCode) {
  const n = teamNumberFromCode(teamCode);
  return n != null ? `#${n} · ${teamCode}` : teamCode;
}

function teamsAtPlace(propRows, stage, stationCode) {
  const code = String(stationCode || '').toUpperCase();
  return propRows
    .filter((row) => placeKey(row[stage]) === code)
    .map((row) => row.teamCode)
    .filter(Boolean)
    .sort((a, b) => (teamNumberFromCode(a) || 0) - (teamNumberFromCode(b) || 0));
}

function teamsAtPlaceDetailed(propRows, stage, stationCode) {
  const code = String(stationCode || '').toUpperCase();
  return propRows
    .filter((row) => placeKey(row[stage]) === code)
    .map((row) => ({
      teamCode: row.teamCode,
      teamNumber: row.teamNumber ?? teamNumberFromCode(row.teamCode),
      clue2Code: stage === 'green' ? row.clue2Code : undefined,
      propCode: stage === 'purple' ? row.propCode : undefined,
    }))
    .sort((a, b) => (a.teamNumber || 0) - (b.teamNumber || 0));
}

function LocationTeamMatrix({ row, posterCols }) {
  const stages = posterCols
    .filter((col) => row[col.key])
    .map((col) => ({
      key: col.key,
      theme: col.theme,
      label: `${col.theme.scanLabel}`,
      teams: row[`${col.key}TeamsDetailed`] || [],
    }));

  const hasAny = stages.some((s) => s.teams.length > 0);
  if (!hasAny) return null;

  return (
    <div className="mb-3 overflow-x-auto rounded border border-white/12 bg-black/25 print:border-black/30 print:bg-gray-50">
      <p className="border-b border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white/70 print:border-black/20 print:text-[8px] print:text-black">
        Team numbers at this location
      </p>
      <table className="w-full border-collapse text-left text-[10px] print:text-[8.5px]">
        <thead>
          <tr className="border-b border-white/10 text-[9px] uppercase tracking-wide text-white/45 print:border-black/20 print:text-[7.5px] print:text-black/55">
            <th className="px-2 py-1 font-semibold">Scan</th>
            <th className="px-2 py-1 font-semibold">Team #</th>
            <th className="px-2 py-1 font-semibold">Code</th>
            <th className="px-2 py-1 font-semibold">Clue 2 / Prop</th>
          </tr>
        </thead>
        <tbody>
          {stages.flatMap((stage) => (
            stage.teams.length
              ? stage.teams.map((t, idx) => (
                <tr
                  key={`${stage.key}-${t.teamCode}`}
                  className="border-b border-white/5 last:border-0 print:border-black/10"
                  style={{ background: idx === 0 ? `${stage.theme.hex}12` : undefined }}
                >
                  {idx === 0 ? (
                    <td
                      className="px-2 py-1 align-top font-semibold"
                      rowSpan={stage.teams.length}
                      style={{ color: stage.theme.hex }}
                    >
                      {stage.label}
                    </td>
                  ) : null}
                  <td className="px-2 py-1 font-bold text-white print:text-black">
                    {t.teamNumber != null ? `#${t.teamNumber}` : '—'}
                  </td>
                  <td className="px-2 py-1 font-mono text-[9px] text-white/70 print:text-[8px] print:text-black/75">
                    {t.teamCode}
                  </td>
                  <td
                    className="px-2 py-1 font-mono text-[9px] font-bold print:text-[8px]"
                    style={{
                      color: stage.key === 'purple'
                        ? T.clue4.hex
                        : stage.key === 'green'
                          ? T.clue2.hex
                          : undefined,
                    }}
                  >
                    {stage.key === 'purple' && t.propCode && t.propCode !== '—'
                      ? t.propCode
                      : stage.key === 'green' && t.clue2Code && t.clue2Code !== '—'
                        ? t.clue2Code
                        : '—'}
                  </td>
                </tr>
              ))
              : [(
                <tr key={`${stage.key}-empty`} className="border-b border-white/5 print:border-black/10">
                  <td className="px-2 py-1 font-semibold" style={{ color: stage.theme.hex }}>
                    {stage.label}
                  </td>
                  <td className="px-2 py-1 text-white/40 print:text-black/45" colSpan={3}>
                    Shared poster — tape even if no teams listed yet
                  </td>
                </tr>
              )]
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocationWriteHereBox({ codesHere, propsHere }) {
  const hasGreen = codesHere?.length > 0;
  const hasPurple = propsHere?.length > 0;

  if (!hasGreen && !hasPurple) {
    return (
      <div className="mb-3 rounded-lg border border-white/12 bg-black/15 px-2.5 py-2 print:border-black/25 print:bg-gray-50">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/70 print:text-[9px] print:text-black/70">
          Write / hide at this location
        </p>
        <p className="mt-1 text-[10px] text-white/50 print:text-[8.5px] print:text-black/55">
          No 3-digit marks or props here — tape all 4 QR posters only.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mb-3 rounded-lg border-2 px-2.5 py-2 print:border-black/40 print:py-1.5"
      style={{ borderColor: `${T.clue2.hex}66`, background: `${T.clue2.hex}10` }}
    >
      <p className="text-[11px] font-black uppercase tracking-wide print:text-[10px]" style={{ color: T.clue2.hex }}>
        Write / hide at this location
      </p>
      <p className="mt-0.5 text-[9px] text-white/55 print:text-[8px] print:text-black/60">
        Copy these exactly — one per team listed below
      </p>

      {hasGreen ? (
        <div className="mt-2 rounded border border-emerald-400/35 bg-emerald-500/10 px-2 py-1.5 print:border-emerald-700 print:bg-emerald-50">
          <p className="text-[10px] font-bold print:text-[9px]" style={{ color: T.clue2.hex }}>
            Near GREEN QR — write or tape 3-digit number
          </p>
          <ul className="mt-1.5 space-y-1">
            {codesHere.map((c) => (
              <li
                key={`write-green-${c.teamCode}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-white/10 bg-black/20 px-2 py-1 print:border-black/15 print:bg-white"
              >
                <label className="huddle-check flex flex-1 flex-wrap items-center gap-2 text-[10px] print:text-[8.5px]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 print:h-3 print:w-3"
                    style={{ accentColor: T.clue2.hex }}
                  />
                  <span className="font-bold text-white print:text-black">
                    Team #{c.teamNumber}
                  </span>
                  <span className="font-mono text-[9px] text-white/55 print:text-black/55">
                    {c.teamCode}
                  </span>
                  <span className="text-[9px] text-white/45 print:text-black/50">write</span>
                  <span
                    className="font-mono text-[18px] font-black tracking-[0.2em] print:text-[15px]"
                    style={{ color: T.clue2.hex }}
                  >
                    {c.clue2Code}
                  </span>
                  <span className="text-[9px] text-white/45 print:text-black/50">near green QR</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasPurple ? (
        <div
          className="mt-2 rounded border px-2 py-1.5 print:border-purple-800 print:bg-purple-50"
          style={{ borderColor: `${T.clue4.hex}55`, background: `${T.clue4.hex}14` }}
        >
          <p className="text-[10px] font-bold print:text-[9px]" style={{ color: T.clue4.hex }}>
            On PURPLE prop — sticker word (exact spelling)
          </p>
          <ul className="mt-1.5 space-y-1">
            {propsHere.map((p) => (
              <li
                key={`write-purple-${p.teamCode}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-white/10 bg-black/20 px-2 py-1 print:border-black/15 print:bg-white"
              >
                <label className="huddle-check flex flex-1 flex-wrap items-center gap-2 text-[10px] print:text-[8.5px]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 print:h-3 print:w-3"
                    style={{ accentColor: T.clue4.hex }}
                  />
                  <span className="font-bold text-white print:text-black">
                    Team #{p.teamNumber ?? '?'}
                  </span>
                  <span className="font-mono text-[9px] text-white/55 print:text-black/55">
                    {p.teamCode}
                  </span>
                  <span className="text-[9px] text-white/45 print:text-black/50">sticker</span>
                  <span
                    className="font-mono text-[14px] font-black tracking-wider print:text-[12px]"
                    style={{ color: T.clue4.hex }}
                  >
                    {p.propCode}
                  </span>
                  <span className="text-[9px] text-white/45 print:text-black/50">beside purple QR</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LocationPlantCard({
  row,
  people,
  posterCols,
}) {
  const qrs = posterCols.filter((col) => row[col.key]);
  const stageTeams = {
    orange: row.orangeTeams || [],
    green: row.greenTeams || [],
    blue: row.blueTeams || [],
    purple: row.purpleTeams || [],
  };
  const stageTeamsDetailed = {
    orange: row.orangeTeamsDetailed || [],
    green: row.greenTeamsDetailed || [],
    blue: row.blueTeamsDetailed || [],
    purple: row.purpleTeamsDetailed || [],
  };

  return (
    <article
      className="huddle-keep huddle-location-card rounded-lg border border-white/12 bg-white/3 p-3 print:rounded-none print:border print:border-black/35 print:p-2.5"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-white/15 pb-1.5 print:border-black/25">
        <div>
          <h4 className="text-[15px] font-bold print:text-[12px]">
            {row.code}
            <span className="ml-1.5 font-semibold text-white/75 print:text-black/75">
              {row.name}
            </span>
          </h4>
          <p className="mt-0.5 text-[10px] text-white/45 print:text-[8px] print:text-black/50">
            Walk this spot · tape all 4 colors · plant props next to purple QR only
          </p>
        </div>
        <label className="huddle-check flex items-center gap-1.5 text-[10px] font-semibold print:text-[9px]">
          <input type="checkbox" className="h-3.5 w-3.5 print:h-3 print:w-3" />
          Location done
        </label>
      </header>

      <LocationWriteHereBox codesHere={row.codesHere} propsHere={row.propsHere} />

      <LocationTeamMatrix row={row} posterCols={posterCols} />

      <div className="mb-2 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] leading-snug text-white/75 print:border-black/20 print:bg-gray-50 print:text-[8.5px] print:text-black/80">
        <strong className="text-white print:text-black">Step 1 — Tape QR posters</strong>
        {' '}
        (shared — any team listed can scan, then enter their team code)
      </div>

      <ul className="mb-3 space-y-1.5">
        {qrs.length ? qrs.map((col) => {
          const teams = stageTeams[col.key] || [];
          const detailed = stageTeamsDetailed[col.key] || [];
          return (
            <li
              key={col.key}
              className="rounded border border-white/8 px-2 py-1.5 print:border-black/15 print:py-1"
              style={{ background: `${col.theme.hex}18` }}
            >
              <label className="huddle-check flex items-start gap-2 text-[10px] print:text-[8.5px]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 print:h-3 print:w-3"
                  style={{ accentColor: col.theme.hex }}
                />
                <span>
                  <ColorChip
                    theme={col.theme}
                    short={`${col.theme.colorName} · ${col.theme.scanLabel}`}
                  />
                  <span className="mt-1 block text-white/80 print:text-black/80">
                    {col.key === 'purple'
                      ? `After prop CODE typed on phone · then all ${people} scan + team code → Final`
                      : col.key === 'green'
                        ? `Hide each team’s 3-digit mark near this green QR · leader finds code · then all ${people} scan`
                      : col.key === 'blue'
                        ? `No 3-digit mark here · teams solve Clue 3 riddle on phone · then all ${people} scan + team code`
                      : `After ${col.when.toLowerCase().replace(/^after /, '')} · unlocks ${col.unlocks}`}
                  </span>
                  {teams.length > 0 ? (
                    <>
                      <span className="mt-1 block text-[10px] font-bold text-white print:text-[9px] print:text-black">
                        Team numbers:
                        {' '}
                        {formatTeamNumbers(teams)}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9px] text-white/55 print:text-[8px] print:text-black/60">
                        {teams.map((code) => formatTeamLabel(code)).join(' · ')}
                      </span>
                      {col.key === 'green' && detailed.some((t) => t.clue2Code && t.clue2Code !== '—') ? (
                        <span
                          className="mt-1 block rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-1 font-mono text-[10px] font-bold leading-relaxed print:border-emerald-700 print:bg-emerald-50 print:text-[9px]"
                          style={{ color: T.clue2.hex }}
                        >
                          {detailed
                            .filter((t) => t.clue2Code && t.clue2Code !== '—')
                            .map((t) => `#${t.teamNumber} → ${t.clue2Code}`)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="mt-1 block text-[9px] italic text-white/40 print:text-black/45">
                      Shared poster — keep taped even if no team listed yet
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        }) : (
          <li className="text-[10px] text-amber-200 print:text-[8.5px] print:text-amber-900">
            No QR bindings — open Clues → Save setup → Update Clues 1–4, then refresh.
          </li>
        )}
      </ul>

      <div className="mb-1.5 rounded border border-purple-400/25 bg-purple-500/10 px-2 py-1.5 text-[10px] leading-snug text-purple-100 print:border-purple-800 print:bg-purple-50 print:text-[8.5px] print:text-purple-950">
        <strong>Step 2 — Plant props (Clue 4)</strong>
        {' '}
        Hide silly objects with sticker words · place within arm’s reach of
        {' '}
        <strong>purple QR</strong>
        {' '}
        · leader types word first, then team scans purple
      </div>

      {row.propsHere.length ? (
        <ul className="space-y-1.5">
          {row.propsHere.map((p) => (
            <li
              key={`${p.teamCode}-${p.propCode}`}
              className="rounded border border-purple-400/20 px-2 py-1.5 print:border-black/20 print:py-1"
              style={{ background: `${T.clue4.hex}22` }}
            >
              <label className="huddle-check flex flex-wrap items-start gap-x-2 gap-y-1 text-[10px] print:text-[8.5px]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 print:h-3 print:w-3"
                  style={{ accentColor: T.clue4.hex }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="font-mono text-[13px] font-black tracking-wider print:text-[11px]"
                    style={{ color: T.clue4.hex }}
                  >
                    {p.propCode}
                  </span>
                  <span className="mx-1.5 text-white/35 print:text-black/35">→</span>
                  <span className="font-bold text-white print:text-black">
                    {p.teamNumber != null ? `#${p.teamNumber}` : ''}
                    {' '}
                    <span className="font-mono font-normal text-white/70 print:text-black/70">
                      {p.teamCode}
                    </span>
                  </span>
                  <span className="mt-1 block text-[9px] leading-snug text-white/60 print:text-[8px] print:text-black/65">
                    ☐ Pick visible object · ☐ Sticker shows exact word
                    {' '}
                    <strong>{p.propCode}</strong>
                    {' '}
                    · ☐ Purple QR visible beside it
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-white/45 print:text-[8.5px] print:text-black/50">
          No props planted here — teams don’t use this place as their purple stop.
          {row.purple ? ' Still tape the purple QR poster above.' : ''}
        </p>
      )}

      <p className="mt-2 border-t border-white/10 pt-1.5 text-[9px] text-white/40 print:border-black/15 print:text-[7.5px] print:text-black/50">
        Do not mix poster colors · do not move posters mid-hunt · START desks have no hunt QRs
      </p>
    </article>
  );
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
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportWarnings, setExportWarnings] = useState([]);
  const autoFixAttempted = useRef(false);

  useEffect(() => {
    autoFixAttempted.current = false;
  }, [eventId]);

  const buildPropRows = useCallback((teams, challenges, checkpoints) => {
    const cpById = new Map(checkpoints.map((c) => [String(c.id || c._id), c]));
    const clue4ById = new Map(
      challenges
        .filter((c) => Number(c.challengeNumber) === 4)
        .map((c) => [String(c.id || c._id), c]),
    );
    const clue2ById = new Map(
      challenges
        .filter((c) => Number(c.challengeNumber) === 2)
        .map((c) => [String(c.id || c._id), c]),
    );
    const layoutTeams = teams
      .filter((t) => /^CC00[1-8]$/i.test(String(t.teamCode || '')))
      .sort((a, b) => String(a.teamCode).localeCompare(String(b.teamCode)));
    const source = layoutTeams.length ? layoutTeams : teams.slice(0, 12);

    return source.map((t) => {
      const prop = clue4ById.get(String(t.clue4ChallengeId || ''));
      const clue2 = clue2ById.get(String(t.clue2ChallengeId || ''));
      const purple = placeLabel(cpById.get(String(t.fourthCheckpointId || '')));
      const purpleCode = placeKey(purple);
      return {
        teamCode: t.teamCode,
        teamNumber: teamNumberFromCode(t.teamCode),
        orange: placeLabel(cpById.get(String(t.firstCheckpointId || ''))),
        green: placeLabel(cpById.get(String(t.secondCheckpointId || ''))),
        blue: placeLabel(cpById.get(String(t.thirdCheckpointId || ''))),
        purple,
        purpleOutOfLayout: Boolean(purpleCode && !activeStationCodes.has(purpleCode)),
        clue2Code: String(clue2?.answer || '').trim() || '—',
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

  const exportOffline = useCallback(async (perTeam = false) => {
    if (!eventId || exportBusy) return;
    setExportBusy(true);
    setExportMessage('');
    setExportWarnings([]);
    setError('');
    try {
      const res = await adminExportOfflinePacks(eventId);
      const data = res.data || res;
      await downloadOfflinePacks(data, { perTeam });
      const warnings = [
        ...(data.warnings || []),
        ...(data.incompleteTeams?.length
          ? [`${data.incompleteTeams.length} team(s) skipped — finish clue/checkpoint bindings first.`]
          : []),
      ];
      setExportWarnings(warnings);
      setExportMessage(
        data.teamCount
          ? `Exported ${data.teamCount} team pack${data.teamCount === 1 ? '' : 's'}. Load one JSON per team on all 4 phones before fest.`
          : 'No complete team packs — finish Round 1 bindings and team passwords first.',
      );
    } catch (err) {
      setError(err.message || 'Could not export offline packs');
    } finally {
      setExportBusy(false);
    }
  }, [eventId, exportBusy]);

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
      const codesHere = propRows
        .filter((r) => placeKey(r.green) === String(row.code).toUpperCase())
        .filter((r) => r.clue2Code && r.clue2Code !== '—')
        .map((r) => ({
          teamCode: r.teamCode,
          teamNumber: r.teamNumber,
          clue2Code: r.clue2Code,
        }))
        .sort((a, b) => (a.teamNumber || 0) - (b.teamNumber || 0));
      return {
        ...row,
        propsHere,
        codesHere,
        orangeTeams: teamsAtPlace(propRows, 'orange', row.code),
        greenTeams: teamsAtPlace(propRows, 'green', row.code),
        blueTeams: teamsAtPlace(propRows, 'blue', row.code),
        purpleTeams: propsHere.map((p) => p.teamCode),
        orangeTeamsDetailed: teamsAtPlaceDetailed(propRows, 'orange', row.code),
        greenTeamsDetailed: teamsAtPlaceDetailed(propRows, 'green', row.code),
        blueTeamsDetailed: teamsAtPlaceDetailed(propRows, 'blue', row.code),
        purpleTeamsDetailed: teamsAtPlaceDetailed(propRows, 'purple', row.code),
      };
    });
  }, [qrByPlace, stations, propRows]);

  const propCount = propRows.filter((r) => r.propCode && r.propCode !== '—').length;
  const expectedPosterCount = stations.length * 4;
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
            Campus plant checklist · location by location
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-white/55 print:mt-0.5 print:max-w-none print:text-[9px] print:leading-snug print:text-black/65">
            Print this and walk each place. Tape
            {' '}
            <strong>{stations.length} places × 4 QR colors = {expectedPosterCount} posters</strong>
            {' '}
            + plant
            {' '}
            <strong>{propCount} prop objects</strong>
            {' '}
            with sticker codes at purple stops only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            disabled={exportBusy || !eventId}
            onClick={() => exportOffline(false)}
            className="rounded-xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/15 px-4 py-2 text-xs font-bold text-[#0ECCEE] disabled:opacity-50"
          >
            {exportBusy ? 'Exporting…' : 'Export offline packs'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-xs font-bold text-black"
          >
            Print plant sheet
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-[11px] text-white/70 print:hidden">
        <p>
          <strong className="text-white">Offline fest mode:</strong>
          {' '}
          export packs here (laptop, before fest) → share each team JSON to all 4 phones →
          {' '}
          <a href={CAMPUS_HUNT_PATHS.offline} className="text-[#0ECCEE] underline" target="_blank" rel="noreferrer">
            /campus-hunt/offline
          </a>
          {' '}
          → airplane mode on venue.
        </p>
        {exportMessage ? (
          <p className="mt-1 text-emerald-300">{exportMessage}</p>
        ) : null}
        {exportWarnings.length ? (
          <ul className="mt-1 list-disc pl-4 text-amber-200/90">
            {exportWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
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
                {' '}
                <strong className="text-emerald-300 print:text-emerald-800">
                  Hide each team’s 3-digit mark near the green QR only
                </strong>
                {' '}
                (not at blue).
              </li>
              <li>
                Solve
                {' '}
                <ColorChip theme={T.clue3} short="Clue 3" />
                {' '}
                (Caesar riddle on phone — no hidden number)
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
            <CheckRow id="m1" accent="#0ECCEE">
              Printed {expectedPosterCount} QR posters ({stations.length} places × 4 colors)
            </CheckRow>
            <CheckRow id="m1b" accent="#0ECCEE">
              Prepared {propCount} prop objects + sticker codes
            </CheckRow>
            <CheckRow id="m2" accent="#0ECCEE">Team links + password · phones on play screen</CheckRow>
            <CheckRow id="m3" accent="#0ECCEE">Schedule locked · Round started · finish desk staffed</CheckRow>
            <CheckRow id="m4" accent="#0ECCEE">Walked every location card below · checked each box</CheckRow>
            <CheckRow id="m5" accent={T.clue4.hex}>
              Purple: teams type prop word FIRST, then scan purple QR
            </CheckRow>
          </div>
        </section>
      </div>

      {/* PER LOCATION — main plant sheet */}
      <div className="huddle-print-block huddle-print-break mt-4 space-y-3 print:mt-0 print:space-y-2">
        <section>
          <SectionTitle n="2" note={`${stations.length} cards — one per campus place`}>
            Plant by location (detailed)
          </SectionTitle>
          <p className="mb-3 text-[10px] text-white/50 print:mb-2 print:text-[8.5px] print:text-black/55">
            At each place: check <strong>Write / hide at this location</strong> first (3-digit numbers + prop stickers),
            then Step 1 (4 QR posters), then Step 2 (props if listed).
            Each card shows team numbers (#1–#8) for every scan color at that spot.
          </p>

          {/* Print: quick location × team numbers grid */}
          <div className="huddle-print-only mb-3 hidden overflow-x-auto print:block">
            <table className="huddle-table w-full border-collapse text-left text-[8.5px]">
              <thead>
                <tr>
                  <th className="huddle-th w-[14%]">Place</th>
                  <th className="huddle-th w-[18%]" style={{ color: T.clue1.hex }}>① Orange · team #</th>
                  <th className="huddle-th w-[18%]" style={{ color: T.clue2.hex }}>② Green · # + 3-digit</th>
                  <th className="huddle-th w-[18%]" style={{ color: T.clue3.hex }}>③ Blue · team # only</th>
                  <th className="huddle-th w-[32%]" style={{ color: T.clue4.hex }}>④ Purple · team # + prop</th>
                </tr>
              </thead>
              <tbody>
                {placeRows.map((row) => (
                  <tr key={`print-grid-${row.code}`}>
                    <td className="huddle-td font-semibold">
                      {row.code}
                      <span className="block font-normal text-black/60">{row.name}</span>
                    </td>
                    <td className="huddle-td">
                      <span className="font-bold">{formatTeamNumbers(row.orangeTeams)}</span>
                      {row.orangeTeams?.length ? (
                        <span className="mt-0.5 block font-mono text-[7.5px] text-black/55">
                          {row.orangeTeams.join(', ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="huddle-td">
                      <span className="font-bold">{formatTeamNumbers(row.greenTeams)}</span>
                      {row.codesHere?.length ? (
                        <span
                          className="mt-0.5 block font-mono text-[7.5px] font-bold leading-snug"
                          style={{ color: T.clue2.hex }}
                        >
                          {row.codesHere.map((c) => `#${c.teamNumber}=${c.clue2Code}`).join(' · ')}
                        </span>
                      ) : row.greenTeams?.length ? (
                        <span className="mt-0.5 block font-mono text-[7.5px] text-black/55">
                          {row.greenTeams.join(', ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="huddle-td">
                      <span className="font-bold">{formatTeamNumbers(row.blueTeams)}</span>
                      {row.blueTeams?.length ? (
                        <span className="mt-0.5 block font-mono text-[7.5px] text-black/55">
                          {row.blueTeams.join(', ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="huddle-td">
                      <span className="font-bold">{formatTeamNumbers(row.purpleTeams)}</span>
                      {row.propsHere?.length ? (
                        <span className="mt-0.5 block text-[7.5px] leading-snug text-black/70">
                          {row.propsHere.map((p) => (
                            `#${p.teamNumber ?? '?'} ${p.propCode !== '—' ? p.propCode : ''}`.trim()
                          )).join(' · ')}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="huddle-place-grid grid gap-3 print:grid-cols-1 print:gap-2">
            {placeRows.map((row) => (
              <LocationPlantCard
                key={row.code}
                row={row}
                people={people}
                posterCols={QR_COLS}
              />
            ))}
          </div>

          {!placeRows.length && !loading ? (
            <p className="text-xs text-amber-200 print:text-amber-900">
              No campus places configured — set places in Clues → Save setup.
            </p>
          ) : null}
        </section>
      </div>

      {/* QUICK REFERENCE TABLES — hidden on print to save paper; location cards are the walk sheet */}
      <div className="huddle-print-block huddle-screen-only mt-4 space-y-3 print:hidden">
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
                  {QR_COLS.map((col) => {
                    const teamKey = `${col.key}Teams`;
                    const teams = row[teamKey] || [];
                    return (
                    <td
                      key={col.key}
                      className="huddle-td font-semibold"
                      style={{ background: row[col.key] ? `${col.theme.hex}28` : undefined }}
                    >
                      {row[col.key] ? (
                        <>
                          <span className="block">☐ tape</span>
                          {teams.length > 0 ? (
                            <span className="mt-0.5 block text-[10px] font-bold">
                              {formatTeamNumbers(teams)}
                            </span>
                          ) : null}
                          {col.key === 'green' && row.codesHere?.length ? (
                            <span
                              className="mt-0.5 block font-mono text-[9px] font-bold leading-snug"
                              style={{ color: T.clue2.hex }}
                            >
                              {row.codesHere.map((c) => `#${c.teamNumber}=${c.clue2Code}`).join(' · ')}
                            </span>
                          ) : null}
                          {col.key === 'purple' && row.propsHere?.length ? (
                            <span
                              className="mt-0.5 block font-mono text-[9px] font-bold leading-snug"
                              style={{ color: T.clue4.hex }}
                            >
                              {row.propsHere.map((p) => `#${p.teamNumber}=${p.propCode}`).join(' · ')}
                            </span>
                          ) : null}
                        </>
                      ) : '—'}
                    </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="huddle-keep">
          <SectionTitle n="4" note="3-digit mark to hide at each team’s green (2nd) stop">
            Clue 2 code checklist
          </SectionTitle>
          <table className="huddle-table w-full border-collapse text-left text-[11px] print:text-[8.5px]">
            <thead>
              <tr>
                <th className="huddle-th w-[8%]">#</th>
                <th className="huddle-th w-[10%]">Team</th>
                <th className="huddle-th w-[12%]" style={{ color: T.clue2.hex }}>3-digit</th>
                <th className="huddle-th w-[40%]">Hide at (green / 2nd stop)</th>
                <th className="huddle-th w-[15%]">☐ Mark hidden</th>
                <th className="huddle-th w-[15%]">☐ Green QR</th>
              </tr>
            </thead>
            <tbody>
              {propRows.map((r) => (
                <tr key={`clue2-${r.teamCode}`}>
                  <td className="huddle-td font-bold">
                    {r.teamNumber != null ? `#${r.teamNumber}` : '—'}
                  </td>
                  <td className="huddle-td font-mono font-bold">{r.teamCode}</td>
                  <td
                    className="huddle-td font-mono text-[12px] font-black tracking-wider print:text-[10px]"
                    style={{ color: T.clue2.hex }}
                  >
                    {r.clue2Code && r.clue2Code !== '—' ? r.clue2Code : '—'}
                  </td>
                  <td className="huddle-td">{r.green}</td>
                  <td className="huddle-td">☐</td>
                  <td className="huddle-td">☐</td>
                </tr>
              ))}
              {!propRows.length && !loading ? (
                <tr>
                  <td className="huddle-td" colSpan={6}>
                    No Clue 2 bindings — save Clue 2 in admin first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="huddle-keep">
          <SectionTitle n="5" note="Prop CODE sticker + purple QR at that purple stop">
            Prop checklist
          </SectionTitle>
          <table className="huddle-table w-full border-collapse text-left text-[11px] print:text-[8.5px]">
            <thead>
              <tr>
                <th className="huddle-th w-[8%]">#</th>
                <th className="huddle-th w-[10%]">Team</th>
                <th className="huddle-th w-[16%]" style={{ color: T.clue4.hex }}>CODE</th>
                <th className="huddle-th w-[38%]">Plant at (purple stop)</th>
                <th className="huddle-th w-[14%]">☐ Prop</th>
                <th className="huddle-th w-[14%]">☐ Purple</th>
              </tr>
            </thead>
            <tbody>
              {propRows.map((r) => (
                <tr key={`prop-${r.teamCode}`}>
                  <td className="huddle-td font-bold">
                    {r.teamNumber != null ? `#${r.teamNumber}` : '—'}
                  </td>
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
                  <td className="huddle-td" colSpan={6}>
                    No Clue 4 bindings — bootstrap / resync first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="huddle-keep">
          <SectionTitle n="6" note="Each team’s stop order (verify before open)">
            Team routes
          </SectionTitle>
          <table className="huddle-table w-full border-collapse text-left text-[10px] print:text-[8px]">
            <thead>
              <tr>
                <th className="huddle-th w-[6%]">#</th>
                <th className="huddle-th w-[8%]">Team</th>
                <th className="huddle-th w-[18%]" style={{ color: T.clue1.hex }}>① Orange</th>
                <th className="huddle-th w-[18%]" style={{ color: T.clue2.hex }}>② Green</th>
                <th className="huddle-th w-[8%]" style={{ color: T.clue2.hex }}>Clue 2</th>
                <th className="huddle-th w-[18%]" style={{ color: T.clue3.hex }}>③ Blue</th>
                <th className="huddle-th w-[10%]" style={{ color: T.clue4.hex }}>Prop</th>
                <th className="huddle-th w-[22%]" style={{ color: T.clue4.hex }}>④ Purple</th>
              </tr>
            </thead>
            <tbody>
              {propRows.map((r) => (
                <tr key={`route-${r.teamCode}`}>
                  <td className="huddle-td font-bold">
                    {r.teamNumber != null ? `#${r.teamNumber}` : '—'}
                  </td>
                  <td className="huddle-td font-mono font-bold">{r.teamCode}</td>
                  <td className="huddle-td" style={{ background: `${T.clue1.hex}18` }}>{r.orange}</td>
                  <td className="huddle-td" style={{ background: `${T.clue2.hex}18` }}>{r.green}</td>
                  <td
                    className="huddle-td font-mono text-[11px] font-black tracking-wider print:text-[9px]"
                    style={{ background: `${T.clue2.hex}28`, color: T.clue2.hex }}
                  >
                    {r.clue2Code && r.clue2Code !== '—' ? r.clue2Code : '—'}
                  </td>
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

      {/* Print-only: team routes summary on last page */}
      <div className="huddle-print-only mt-4 hidden space-y-2 print:block">
        <SectionTitle n="3" note="Verify prop word + purple place per team">
          Team routes (print copy)
        </SectionTitle>
          <table className="huddle-table w-full border-collapse text-left text-[9px]">
            <thead>
              <tr>
                <th className="huddle-th w-[8%]">#</th>
                <th className="huddle-th w-[10%]">Code</th>
                <th className="huddle-th" style={{ color: T.clue1.hex }}>Orange</th>
                <th className="huddle-th" style={{ color: T.clue2.hex }}>Green</th>
                <th className="huddle-th" style={{ color: T.clue2.hex }}>Clue 2</th>
                <th className="huddle-th" style={{ color: T.clue3.hex }}>Blue</th>
                <th className="huddle-th" style={{ color: T.clue4.hex }}>Prop</th>
                <th className="huddle-th" style={{ color: T.clue4.hex }}>Purple</th>
              </tr>
            </thead>
            <tbody>
              {propRows.map((r) => (
                <tr key={`print-route-${r.teamCode}`}>
                  <td className="huddle-td font-bold">
                    {r.teamNumber != null ? `#${r.teamNumber}` : '—'}
                  </td>
                  <td className="huddle-td font-mono font-bold">{r.teamCode}</td>
                <td className="huddle-td">{r.orange}</td>
                  <td className="huddle-td">{r.green}</td>
                  <td className="huddle-td font-mono font-bold" style={{ color: T.clue2.hex }}>
                    {r.clue2Code && r.clue2Code !== '—' ? r.clue2Code : '—'}
                  </td>
                <td className="huddle-td">{r.blue}</td>
                <td className="huddle-td font-mono font-bold" style={{ color: T.clue4.hex }}>{r.propCode}</td>
                <td className="huddle-td">{r.purple}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .huddle-location-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 6px !important;
          }
          .huddle-screen-only {
            display: none !important;
          }
          .huddle-print-only {
            display: block !important;
            break-before: page;
            page-break-before: always;
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
