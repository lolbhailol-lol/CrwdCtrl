import { useCallback, useEffect, useMemo, useState } from 'react';
import Clue1VariantManager from './Clue1VariantManager';
import Clue2VariantManager from './Clue2VariantManager';
import Clue3VariantManager from './Clue3VariantManager';
import Clue4VariantManager from './Clue4VariantManager';
import Clue5VariantManager from './Clue5VariantManager';
import Clue6VariantManager from './Clue6VariantManager';
import CheckpointManager from './CheckpointManager';
import CampusStationNamesEditor from './CampusStationNamesEditor';
import StationPlantFragmentsPanel from './StationPlantFragmentsPanel';
import FirstStopPosterPrint from './FirstStopPosterPrint';
import SecondStopPosterPrint from './SecondStopPosterPrint';
import ThirdStopPosterPrint from './ThirdStopPosterPrint';
import FourthStopPosterPrint from './FourthStopPosterPrint';
import FifthStopPosterPrint from './FifthStopPosterPrint';
import TeamPathsPanel from './TeamPathsPanel';
import ClueOrganizerPack from './ClueOrganizerPack';
import {
  DESTINATION_PLACE,
  STATION_TARGET_COUNT,
  destinationsSummary,
  deriveClueGeometry,
  resolveStarts,
  resolveStations,
  suggestHuntLayout,
} from './campusHuntFormat';
import { adminBootstrapRound1 } from '../services/campusHunt.api';
import { themeForChallengeNumber } from '../types/stageTheme';

export {
  CAMPUS_STARTS,
  CAMPUS_STATIONS,
  TEAM_SLOTS,
  WAIT_POINTS,
} from './campusHuntFormat';

export function buildRound1Clues(geometry) {
  const g = geometry || deriveClueGeometry();
  const perStation = g.teamsPerStation;
  const perWait = g.teamsPerWait;
  const people = g.teamSize;
  const places = g.stationCount || STATION_TARGET_COUNT;
  const starts = g.startCount || 1;
  const dest = g.destinationName || 'Finale Assembly';
  return [
    {
      id: 'clue1',
      number: 1,
      label: 'CLUE 1 · First stop',
      short: 'FIRST STOP',
      detail:
        `${places} places · ${starts} gather · ~${perStation} team(s) each · `
        + `unique 5-stop path · leader scans → Clue 2`,
      checkpointKeys: ['1'],
      checkpointLabel: 'FIRST SCAN',
      type: 'navigation',
      showCheckpoints: false,
    },
    {
      id: 'clue2',
      number: 2,
      label: 'CLUE 2 · Second stop',
      short: 'SECOND STOP',
      detail: `${places} places · ~${perStation} team(s) each · 2nd stop on each team’s path`,
      checkpointKeys: ['2'],
      checkpointLabel: 'SECOND SCAN',
      takesToSummary: destinationsSummary(2, undefined, perStation, perWait),
      type: 'timed_search',
      showCheckpoints: false,
    },
    {
      id: 'clue3',
      number: 3,
      label: 'CLUE 3 · Lockbox',
      short: 'LOCKBOX',
      detail: `${places} places · ~${perStation} team(s) each · 3rd stop · Lockbox`,
      checkpointKeys: ['3'],
      checkpointLabel: 'THIRD SCAN',
      takesToSummary: destinationsSummary(3, undefined, perStation, perWait),
      type: 'decode',
      showCheckpoints: false,
    },
    {
      id: 'clue4',
      number: 4,
      label: 'CLUE 4 · Field Terminal',
      short: 'FIELD TERMINAL',
      detail: `${places} places · ~${perStation} team(s) each · 4th stop · Field Terminal`,
      checkpointKeys: ['4'],
      checkpointLabel: 'FOURTH SCAN',
      takesToSummary: destinationsSummary(4, undefined, perStation, perWait),
      type: 'timed_search',
      showCheckpoints: false,
    },
    {
      id: 'clue5',
      number: 5,
      label: 'CLUE 5 · Fifth stop',
      short: 'FIFTH STOP',
      detail:
        `${places} places · ~${perStation} team(s) each · 5th stop · team word → scan → destination clue`,
      checkpointKeys: ['5'],
      checkpointLabel: 'FIFTH SCAN',
      takesToSummary: destinationsSummary(5, undefined, perStation, perWait),
      type: 'collaborative',
      showCheckpoints: false,
    },
    {
      id: 'destination',
      number: 6,
      label: 'CLUE 6 · Destination',
      short: 'DESTINATION',
      detail: `All teams solve this last clue, then go to ${dest} and check in.`,
      checkpointKeys: ['FINISH'],
      checkpointLabel: 'DESTINATION CHECK-IN',
      takesToSummary: `Everyone → ${dest}`,
      type: 'navigation',
      showCheckpoints: false,
    },
  ];
}

export const ROUND1_CLUES = buildRound1Clues(deriveClueGeometry(20, 4));

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
  campusStarts,
  stationCount,
  layoutDirty = false,
  teamCapacity,
  teamSize,
  teamsPerWait,
  teamsPerStation,
}) {
  const theme = themeForChallengeNumber(clue.number);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  const updateThisClue = async (e) => {
    e?.stopPropagation?.();
    if (!eventId || updating) return;
    setUpdating(true);
    setUpdateMsg('');
    try {
      await adminBootstrapRound1(eventId, {
        createTeams: false,
        enablePublicLeaderboard: false,
        challengeNumbers: [clue.number],
      });
      setUpdateMsg(`Clue ${clue.number} rebuilt for current teams / starts / places`);
      onClueContentChanged?.();
      onChanged?.();
    } catch (err) {
      setUpdateMsg(err.message || `Could not update Clue ${clue.number}`);
    } finally {
      setUpdating(false);
    }
  };

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
          {(clue.number >= 1 && clue.number <= 5) ? (
            <p className="mt-1.5 text-[11px] text-white/40">
              {destinationsSummary(clue.number, campusStations, teamsPerStation, teamsPerWait, campusStarts)}
            </p>
          ) : clue.number === 6 ? (
            <p className="mt-1.5 text-[11px] text-white/40">
              Everyone → {DESTINATION_PLACE.name}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm text-white/50">{open ? 'Hide' : 'Edit'}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={updating || !eventId || layoutDirty}
              onClick={updateThisClue}
              title={layoutDirty ? 'Save setup first' : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${theme.solidClass} ${theme.solidTextClass}`}
            >
              {updating ? 'Updating…' : `Update Clue ${clue.number}`}
            </button>
            {updateMsg ? (
              <p className="text-[11px] text-[#0ECCEE]">{updateMsg}</p>
            ) : null}
          </div>
          {clue.number === 1 ? (
            <>
              <Clue1VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStations={campusStations}
                campusStarts={campusStarts}
                stationCount={stationCount}
                teamCapacity={teamCapacity}
                teamSize={teamSize}
                teamsPerWait={teamsPerWait}
                teamsPerStation={teamsPerStation}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <ClueOrganizerPack
                eventId={eventId}
                challengeNumber={1}
                reloadKey={checkpointReloadKey}
              >
                <FirstStopPosterPrint
                  eventId={eventId}
                  reloadKey={checkpointReloadKey}
                  campusStations={campusStations}
                  stationCount={stationCount}
                  teamSize={teamSize}
                />
              </ClueOrganizerPack>
            </>
          ) : clue.number === 2 ? (
            <>
              <Clue2VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStations={campusStations}
                campusStarts={campusStarts}
                stationCount={stationCount}
                teamCapacity={teamCapacity}
                teamSize={teamSize}
                teamsPerWait={teamsPerWait}
                teamsPerStation={teamsPerStation}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <ClueOrganizerPack
                eventId={eventId}
                challengeNumber={2}
                reloadKey={checkpointReloadKey}
              >
                <SecondStopPosterPrint
                  eventId={eventId}
                  reloadKey={checkpointReloadKey}
                  campusStations={campusStations}
                  stationCount={stationCount}
                  teamSize={teamSize}
                />
              </ClueOrganizerPack>
            </>
          ) : clue.number === 3 ? (
            <>
              <Clue3VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStations={campusStations}
                campusStarts={campusStarts}
                stationCount={stationCount}
                teamCapacity={teamCapacity}
                teamSize={teamSize}
                teamsPerWait={teamsPerWait}
                teamsPerStation={teamsPerStation}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <ClueOrganizerPack
                eventId={eventId}
                challengeNumber={3}
                reloadKey={checkpointReloadKey}
              >
                <ThirdStopPosterPrint
                  eventId={eventId}
                  reloadKey={checkpointReloadKey}
                  campusStations={campusStations}
                  stationCount={stationCount}
                  teamSize={teamSize}
                />
              </ClueOrganizerPack>
            </>
          ) : clue.number === 4 ? (
            <>
              <Clue4VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStations={campusStations}
                campusStarts={campusStarts}
                stationCount={stationCount}
                teamCapacity={teamCapacity}
                teamSize={teamSize}
                teamsPerWait={teamsPerWait}
                teamsPerStation={teamsPerStation}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <ClueOrganizerPack
                eventId={eventId}
                challengeNumber={4}
                reloadKey={checkpointReloadKey}
              >
                <FourthStopPosterPrint
                  eventId={eventId}
                  reloadKey={checkpointReloadKey}
                  campusStations={campusStations}
                  stationCount={stationCount}
                  teamSize={teamSize}
                />
              </ClueOrganizerPack>
            </>
          ) : clue.number === 5 ? (
            <>
              <Clue5VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStarts={campusStarts}
                teamCapacity={teamCapacity}
                teamSize={teamSize}
                teamsPerWait={teamsPerWait}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <ClueOrganizerPack
                eventId={eventId}
                challengeNumber={5}
                reloadKey={checkpointReloadKey}
              >
                <FifthStopPosterPrint
                  eventId={eventId}
                  reloadKey={checkpointReloadKey}
                  campusStations={campusStations}
                  stationCount={stationCount}
                  teamSize={teamSize}
                />
              </ClueOrganizerPack>
            </>
          ) : (
            <>
              <Clue6VariantManager
                eventId={eventId}
                roundId={roundId}
                campusStarts={campusStarts}
                destinationName={DESTINATION_PLACE.name}
                onChanged={() => {
                  onClueContentChanged?.();
                  onChanged?.();
                }}
              />
              <ClueOrganizerPack
                eventId={eventId}
                challengeNumber={6}
                reloadKey={checkpointReloadKey}
              >
                <p className="rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                  No stage QR — after Clue 5, teams go to{' '}
                  <span className="font-semibold">{DESTINATION_PLACE.name}</span>.
                  Tell them the finish code (default{' '}
                  <span className="font-mono font-semibold">MSFINISH</span>
                  ). They type it to lock score — or mark them on{' '}
                  <span className="font-semibold">Live → Finish desk</span>.
                </p>
              </ClueOrganizerPack>
            </>
          )}
          {clue.showCheckpoints !== false && (
            <CheckpointManager
              eventId={eventId}
              roundId={roundId}
              onChanged={onChanged}
              progressionFilter={clue.checkpointKeys}
              title={`${clue.checkpointLabel} · Checkpoint ${clue.number === 6 ? 'Finish' : clue.number}`}
              reloadKey={checkpointReloadKey}
              campusStations={campusStations}
              stageTheme={theme}
              teamsPerStation={teamsPerStation}
              teamsPerWait={teamsPerWait}
              teamCapacity={teamCapacity}
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
  campusStationsCatalog,
  campusStarts: campusStartsProp,
  startCount: startCountProp,
  stationCount: stationCountProp,
  teamCapacity = 20,
  teamSize = 4,
}) {
  const [localCapacity, setLocalCapacity] = useState(teamCapacity);
  const [localTeamSize, setLocalTeamSize] = useState(teamSize);
  const [startCount, setStartCount] = useState(startCountProp ?? suggestHuntLayout(teamCapacity).startCount);
  const [stationCount, setStationCount] = useState(
    () => stationCountProp
      ?? (Array.isArray(campusStationsProp) && campusStationsProp.length
        ? campusStationsProp.length
        : suggestHuntLayout(teamCapacity).stationCount),
  );

  useEffect(() => {
    setLocalCapacity(teamCapacity);
    setLocalTeamSize(teamSize);
  }, [teamCapacity, teamSize]);

  useEffect(() => {
    if (startCountProp != null) setStartCount(startCountProp);
  }, [startCountProp]);

  useEffect(() => {
    if (stationCountProp != null) setStationCount(stationCountProp);
  }, [stationCountProp]);

  const geometry = useMemo(
    () => deriveClueGeometry(localCapacity, localTeamSize, {
      startCount,
      stationCount,
    }),
    [localCapacity, localTeamSize, startCount, stationCount],
  );
  const layoutDirty = useMemo(() => (
    localCapacity !== teamCapacity
    || localTeamSize !== teamSize
    || (startCountProp != null && startCount !== startCountProp)
    || (stationCountProp != null && stationCount !== stationCountProp)
  ), [
    localCapacity,
    localTeamSize,
    teamCapacity,
    teamSize,
    startCount,
    startCountProp,
    stationCount,
    stationCountProp,
  ]);
  const clues = useMemo(() => buildRound1Clues(geometry), [geometry]);
  const [openId, setOpenId] = useState('clue1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [checkpointReloadKey, setCheckpointReloadKey] = useState(0);
  const [clueReloadKey, setClueReloadKey] = useState(0);
  const [campusStations, setCampusStations] = useState(() => (
    resolveStations(campusStationsCatalog || campusStationsProp, geometry.stationCount)
  ));
  const [campusStarts, setCampusStarts] = useState(() => (
    resolveStarts(campusStartsProp, geometry.startCount)
  ));

  useEffect(() => {
    const nextGeo = deriveClueGeometry(localCapacity, localTeamSize, {
      startCount: startCountProp ?? startCount,
      stationCount: stationCountProp ?? stationCount,
    });
    if (startCountProp != null) setStartCount(nextGeo.startCount);
    if (stationCountProp != null) setStationCount(nextGeo.stationCount);
    setCampusStations(resolveStations(
      campusStationsCatalog || campusStationsProp,
      nextGeo.stationCount,
    ));
    setCampusStarts(resolveStarts(campusStartsProp, nextGeo.startCount));
  }, [
    campusStationsProp,
    campusStationsCatalog,
    campusStartsProp,
    startCountProp,
    stationCountProp,
    localCapacity,
    localTeamSize,
  ]);

  const bumpCheckpoints = () => setCheckpointReloadKey((n) => n + 1);
  const bumpClues = () => {
    bumpCheckpoints();
    setClueReloadKey((n) => n + 1);
  };

  const handleLayoutDraftChange = useCallback((draft) => {
    const nextStation = draft?.stationCount ?? stationCount;
    const nextStart = draft?.startCount ?? startCount;
    setStationCount(nextStation);
    setStartCount(nextStart);
    if (Array.isArray(draft?.campusStations) && draft.campusStations.length) {
      setCampusStations(draft.campusStations);
    } else {
      setCampusStations(resolveStations(
        campusStationsCatalog || campusStationsProp,
        nextStation,
      ));
    }
    if (Array.isArray(draft?.campusStarts) && draft.campusStarts.length) {
      setCampusStarts(draft.campusStarts);
    }
  }, [
    campusStationsCatalog,
    campusStationsProp,
    startCount,
    stationCount,
  ]);

  const bootstrap = async () => {
    if (!eventId) return;
    if (layoutDirty) {
      setMessage('Save setup first — bootstrap uses the last saved teams / starts / places, not unsaved edits.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await adminBootstrapRound1(eventId, { createTeams: true });
      setMessage(
        `Ready: ${geometry.teamCapacity} teams · ${geometry.startCount} start(s) · `
        + `${geometry.stationCount} places · ~${geometry.teamsPerStation} teams each · `
        + `${geometry.teamSize}/team.`,
      );
      bumpClues();
      onChanged?.();
    } catch (error) {
      setMessage(error.message || 'Bootstrap failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Clues</h2>
          <p className="text-sm text-white/55">
            {geometry.teamCapacity} teams · {geometry.stationCount} places · open a color for hint + QR
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !eventId || layoutDirty}
          onClick={bootstrap}
          title={layoutDirty ? 'Save setup first' : undefined}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy ? 'Bootstrapping…' : 'Bootstrap all clues'}
        </button>
      </div>
      {layoutDirty && (
        <p className="text-xs text-amber-200">
          Unsaved layout — save place names before bootstrap.
        </p>
      )}
      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}

      <CampusStationNamesEditor
        eventId={eventId}
        campusStations={campusStationsCatalog || campusStations}
        campusStarts={campusStartsProp || campusStarts}
        startCount={startCount}
        stationCount={stationCount}
        teamCapacity={geometry.teamCapacity}
        teamSize={geometry.teamSize}
        onLayoutDraftChange={handleLayoutDraftChange}
        onChanged={(data) => {
          const nextStart = data?.startCount ?? startCount;
          const nextStation = data?.stationCount ?? stationCount;
          if (data?.teamCapacity != null) setLocalCapacity(data.teamCapacity);
          if (data?.teamSize != null) setLocalTeamSize(data.teamSize);
          setStartCount(nextStart);
          setStationCount(nextStation);
          setCampusStations(resolveStations(
            data?.campusStationsCatalog || data?.campusStations || campusStations,
            nextStation,
          ));
          setCampusStarts(resolveStarts(
            data?.campusStartsCatalog || data?.campusStarts || campusStarts,
            nextStart,
          ));
          bumpCheckpoints();
          onChanged?.();
        }}
      />

      <details className="rounded-xl border border-white/10 bg-white/4 px-4 py-3">
        <summary className="cursor-pointer text-sm text-white/60">
          Optional · team paths & plant fragments
        </summary>
        <div className="mt-3 space-y-4">
          <TeamPathsPanel
            campusStations={campusStations}
            campusStarts={campusStarts}
            teamsPerWait={geometry.teamsPerWait}
            teamCapacity={geometry.teamCapacity}
          />
          <StationPlantFragmentsPanel
            eventId={eventId}
            campusStations={campusStationsCatalog || campusStations}
            stationCount={stationCount}
            teamSize={geometry.teamSize}
            onChanged={onChanged}
          />
        </div>
      </details>

      {clues.map((clue, index) => (
        <ClueBox
          key={`${clue.id}-${clueReloadKey}`}
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
          campusStarts={campusStarts}
          stationCount={geometry.stationCount}
          layoutDirty={layoutDirty}
          teamCapacity={geometry.teamCapacity}
          teamSize={geometry.teamSize}
          teamsPerWait={geometry.teamsPerWait}
          teamsPerStation={geometry.teamsPerStation}
        />
      ))}
    </div>
  );
}
