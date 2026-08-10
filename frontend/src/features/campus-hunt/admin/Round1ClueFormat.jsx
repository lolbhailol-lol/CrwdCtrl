import { useEffect, useState } from 'react';
import Clue1VariantManager from './Clue1VariantManager';
import Clue2VariantManager from './Clue2VariantManager';
import Clue3VariantManager from './Clue3VariantManager';
import RouteClueEditor from './RouteClueEditor';
import CheckpointManager from './CheckpointManager';
import CampusStationNamesEditor from './CampusStationNamesEditor';
import FirstStopPosterPrint from './FirstStopPosterPrint';
import SecondStopPosterPrint from './SecondStopPosterPrint';
import ThirdStopPosterPrint from './ThirdStopPosterPrint';
import {
  STATION_TARGET_COUNT,
  TARGET_TEAMS_PER_STATION,
  destinationsSummary,
  resolveStations,
} from './campusHuntFormat';
import { adminBootstrapRound1 } from '../services/campusHunt.api';
import { STAGE_THEME_LIST, themeForChallengeNumber } from '../types/stageTheme';

export {
  CAMPUS_BUILDINGS,
  CAMPUS_STARTS,
  CAMPUS_STATIONS,
  TEAM_WAVES,
  TEAM_SLOTS,
  WAIT_POINTS,
} from './campusHuntFormat';

export const ROUND1_CLUES = [
  {
    id: 'clue1',
    number: 1,
    label: 'CLUE 1 · First stop',
    short: 'FIRST STOP · YELLOW',
    detail: `${STATION_TARGET_COUNT} places · ${TARGET_TEAMS_PER_STATION} teams each · 4 labeled QRs · all 4 members scan → Clue 2`,
    checkpointKeys: [
      '1',
      ...Array.from({ length: 10 }, (_, i) => `1-T${i + 1}`),
    ],
    checkpointLabel: 'FIRST SCAN',
    type: 'navigation',
    showCheckpoints: false,
  },
  {
    id: 'clue2',
    number: 2,
    label: 'CLUE 2 · Second stop',
    short: 'SECOND STOP · GREEN',
    detail:
      `${STATION_TARGET_COUNT} places · ${TARGET_TEAMS_PER_STATION} teams each · `
      + 'unlock after Clue 1 scans · 20s read · then 3:00 timer',
    checkpointKeys: [
      '2',
      ...Array.from({ length: 10 }, (_, i) => `2-T${i + 1}`),
    ],
    checkpointLabel: 'SECOND SCAN',
    takesToSummary: destinationsSummary(2),
    type: 'timed_search',
    showCheckpoints: false,
  },
  {
    id: 'clue3',
    number: 3,
    label: 'CLUE 3 · Third stop',
    short: 'THIRD STOP · BLUE',
    detail:
      `${STATION_TARGET_COUNT} places · ${TARGET_TEAMS_PER_STATION} teams each · `
      + 'after green scan → Caesar riddle → then blue CP3 card → Final',
    checkpointKeys: [
      '3',
      ...Array.from({ length: 10 }, (_, i) => `3-T${i + 1}`),
    ],
    checkpointLabel: 'THIRD SCAN',
    takesToSummary: destinationsSummary(3),
    type: 'decode',
    showCheckpoints: false,
  },
  {
    id: 'final',
    number: 4,
    label: 'FINAL CLUE · One word',
    short: 'FINAL · RED',
    detail:
      'All 4 get a code fragment → one word. Then report to start; organizer marks reached.',
    checkpointKeys: ['FINISH', '4'],
    checkpointLabel: 'START CHECK-IN',
    takesToSummary: 'Back to each team’s own start — organizer marks complete',
    type: 'collaborative',
    showCheckpoints: false,
  },
];

export function getRound1Clue(clueId) {
  return ROUND1_CLUES.find((clue) => clue.id === clueId) || null;
}

function ClueBox({
  clue,
  index,
  open,
  onToggle,
  eventId,
  roundId,
  onChanged,
  checkpointReloadKey = 0,
  onClueContentChanged,
  campusStations,
}) {
  const theme = themeForChallengeNumber(clue.number);

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-white/5 ${theme.borderClass}`}
      style={{ boxShadow: open ? `inset 3px 0 0 ${theme.hex}` : undefined }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: theme.hex }}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${theme.solidClass} ${theme.solidTextClass}`}
            >
              {theme.colorName}
            </span>
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${theme.textClass}`}>
              Step {index + 1} · {clue.short}
            </p>
          </div>
          <h3 className="mt-1 text-lg font-bold uppercase tracking-wide text-white">
            {clue.label}
          </h3>
          <p className="mt-1 text-xs text-white/50">{clue.detail}</p>
          {(clue.number === 1 || clue.number === 2 || clue.number === 3) ? (
            <p className="mt-1.5 text-[11px] text-white/40">
              {destinationsSummary(clue.number, campusStations)}
            </p>
          ) : clue.takesToSummary ? (
            <p className="mt-1.5 text-[11px] text-white/40 line-clamp-2">
              {clue.takesToSummary}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm text-white/50">{open ? 'Hide' : 'Edit'}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          {clue.number === 1 ? (
            <>
              <Clue1VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStations={campusStations}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <FirstStopPosterPrint
                eventId={eventId}
                reloadKey={checkpointReloadKey}
              />
            </>
          ) : clue.number === 2 ? (
            <>
              <Clue2VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStations={campusStations}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <SecondStopPosterPrint
                eventId={eventId}
                reloadKey={checkpointReloadKey}
              />
            </>
          ) : clue.number === 3 ? (
            <>
              <Clue3VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStations={campusStations}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <ThirdStopPosterPrint
                eventId={eventId}
                reloadKey={checkpointReloadKey}
              />
            </>
          ) : (
            <>
              <RouteClueEditor
                eventId={eventId}
                roundId={roundId}
                challengeNumber={clue.number}
                clueLabel={clue.label}
                campusStations={campusStations}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              {clue.number === 4 && (
                <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  After teams solve the Final word they report to their start.
                  Mark them reached on the <span className="font-semibold">Live → Finish desk</span> tab
                  (not here).
                </p>
              )}
            </>
          )}
          {clue.showCheckpoints !== false && (
            <CheckpointManager
              eventId={eventId}
              roundId={roundId}
              onChanged={onChanged}
              progressionFilter={clue.checkpointKeys}
              title={`${clue.checkpointLabel} · Checkpoint ${clue.number === 4 ? 'Finish' : clue.number}`}
              reloadKey={checkpointReloadKey}
              campusStations={campusStations}
              stageTheme={theme}
            />
          )}
        </div>
      )}
    </section>
  );
}

export default function Round1ClueFormat({
  eventId,
  roundId,
  onChanged,
  campusStations: campusStationsProp,
}) {
  const [openId, setOpenId] = useState('clue1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [checkpointReloadKey, setCheckpointReloadKey] = useState(0);
  const [campusStations, setCampusStations] = useState(() => (
    resolveStations(campusStationsProp)
  ));

  useEffect(() => {
    setCampusStations(resolveStations(campusStationsProp));
  }, [campusStationsProp]);

  const bumpCheckpoints = () => setCheckpointReloadKey((n) => n + 1);

  const bootstrap = async () => {
    if (!eventId) return;
    setBusy(true);
    setMessage('');
    try {
      await adminBootstrapRound1(eventId, { createTeams: true });
      setMessage(
        `Ready: 4 starting points · ${STATION_TARGET_COUNT} places · ${TARGET_TEAMS_PER_STATION} teams each.`,
      );
      bumpCheckpoints();
      onChanged?.();
    } catch (error) {
      setMessage(error.message || 'Bootstrap failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
        <div>
          <p className="text-sm text-white/80">
            <span className="font-semibold text-white">Clue setup</span>
            {' '}· 40 teams · 4 starts · {STATION_TARGET_COUNT} campus places ·{' '}
            {TARGET_TEAMS_PER_STATION} teams per place
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            Work top to bottom: Bootstrap → edit each clue → print pocket cards → place on campus.
            After all 4 members scan a card, they pick it up so the next team only finds theirs.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !eventId}
          onClick={bootstrap}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          {busy ? 'Bootstrapping…' : 'Bootstrap defaults'}
        </button>
      </div>
      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <p className="w-full text-[11px] uppercase tracking-wide text-white/40">
          Stage colours · posters + scanners match
        </p>
        {STAGE_THEME_LIST.map((theme) => (
          <span
            key={theme.id}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.bgClass} ${theme.textClass}`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: theme.hex }}
            />
            {theme.label} · {theme.scanLabel}
          </span>
        ))}
      </div>

      <CampusStationNamesEditor
        eventId={eventId}
        campusStations={campusStations}
        onChanged={(next) => {
          setCampusStations(resolveStations(next));
          bumpCheckpoints();
          onChanged?.();
        }}
      />

      {ROUND1_CLUES.map((clue, index) => (
        <ClueBox
          key={clue.id}
          clue={clue}
          index={index}
          open={openId === clue.id}
          onToggle={() => setOpenId((prev) => (prev === clue.id ? '' : clue.id))}
          eventId={eventId}
          roundId={roundId}
          onChanged={onChanged}
          checkpointReloadKey={checkpointReloadKey}
          onClueContentChanged={bumpCheckpoints}
          campusStations={campusStations}
        />
      ))}
    </div>
  );
}
