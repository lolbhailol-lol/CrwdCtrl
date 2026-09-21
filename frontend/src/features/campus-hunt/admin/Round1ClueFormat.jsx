import { useEffect, useMemo, useState } from 'react';
import Clue1VariantManager from './Clue1VariantManager';
import Clue2VariantManager from './Clue2VariantManager';
import Clue3VariantManager from './Clue3VariantManager';
import Clue4VariantManager from './Clue4VariantManager';
import Clue5VariantManager from './Clue5VariantManager';
import Clue6VariantManager from './Clue6VariantManager';
import CheckpointManager from './CheckpointManager';
import FirstStopPosterPrint from './FirstStopPosterPrint';
import SecondStopPosterPrint from './SecondStopPosterPrint';
import ThirdStopPosterPrint from './ThirdStopPosterPrint';
import FourthStopPosterPrint from './FourthStopPosterPrint';
import FifthStopPosterPrint from './FifthStopPosterPrint';
import TeamPathsPanel from './TeamPathsPanel';
import ClueOrganizerPack from './ClueOrganizerPack';
import {
  DESTINATION_PLACE,
  deriveClueGeometry,
  suggestHuntLayout,
  resolveStarts,
  resolveStations,
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
  void geometry;
  return [
    {
      id: 'clue1',
      number: 1,
      label: 'Clue 1',
      short: 'PLACE',
      detail: 'Type campus place → orange scan',
      checkpointKeys: ['1'],
      type: 'navigation',
      showCheckpoints: false,
    },
    {
      id: 'clue2',
      number: 2,
      label: 'Clue 2',
      short: 'DIGITS',
      detail: 'Numbered digit slips → join number → green scan',
      checkpointKeys: ['2'],
      type: 'decode',
      showCheckpoints: false,
    },
    {
      id: 'clue3',
      number: 3,
      label: 'Clue 3',
      short: 'PLAQUE',
      detail: 'Find physical lockbox → type code → blue scan',
      checkpointKeys: ['3'],
      type: 'decode',
      showCheckpoints: false,
    },
    {
      id: 'clue4',
      number: 4,
      label: 'Clue 4',
      short: 'ZIP GRID',
      detail: 'Laptop Zip Grid → GRID-XXXX → purple scan',
      checkpointKeys: ['4'],
      type: 'timed_search',
      showCheckpoints: false,
    },
    {
      id: 'clue5',
      number: 5,
      label: 'Clue 5',
      short: 'LETTERS',
      detail: 'Letter slips → one word → red scan',
      checkpointKeys: ['5'],
      type: 'collaborative',
      showCheckpoints: false,
    },
    {
      id: 'destination',
      number: 6,
      label: 'Clue 6',
      short: 'LOBBY',
      detail: 'Mindspark Lobby · organizer finish code',
      checkpointKeys: ['FINISH'],
      type: 'navigation',
      showCheckpoints: false,
    },
  ];
}

export const ROUND1_CLUES = buildRound1Clues(deriveClueGeometry(20, 6));

function ClueBox({
  clue,
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
              {clue.short}
            </p>
          </div>
          <h3 className="mt-1 text-lg font-bold text-white">
            {clue.label}
          </h3>
          {clue.detail ? (
            <p className="mt-1 text-xs text-white/50">{clue.detail}</p>
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
                <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55">
                  No poster QR. Set start + finish codes above. Live → Finish desk to lock scores.
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

  const bootstrap = async () => {
    if (!eventId) return;
    setBusy(true);
    setMessage('');
    try {
      await adminBootstrapRound1(eventId, { createTeams: true });
      setMessage(
        `Ready for Links: ${geometry.teamCapacity} leader packs · clues saved · paths bound. `
        + 'Open Links → Create leader packs.',
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
            Open a color · edit hint / QR · set start + finish codes on Clue 6
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !eventId}
          onClick={bootstrap}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save clues + teams'}
        </button>
      </div>
      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}

      <details className="rounded-xl border border-white/10 bg-white/4 px-4 py-3">
        <summary className="cursor-pointer text-sm text-white/45">
          Team paths (optional)
        </summary>
        <div className="mt-3">
          <TeamPathsPanel
            campusStations={campusStations}
            campusStarts={campusStarts}
            teamsPerWait={geometry.teamsPerWait}
            teamCapacity={geometry.teamCapacity}
          />
        </div>
      </details>

      {clues.map((clue) => (
        <ClueBox
          key={`${clue.id}-${clueReloadKey}`}
          clue={clue}
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
          layoutDirty={false}
          teamCapacity={geometry.teamCapacity}
          teamSize={geometry.teamSize}
          teamsPerWait={geometry.teamsPerWait}
          teamsPerStation={geometry.teamsPerStation}
        />
      ))}
    </div>
  );
}
