import {
  adminUpdateEvent,
  adminBootstrapRound1,
  adminRepairTeamRosters,
  adminUpdateCampusStations,
} from '../services/campusHunt.api';
import { deriveCompetitionFormat } from './competitionFormat';
import {
  deriveClueGeometry,
  resolveStarts,
  resolveStations,
  suggestHuntLayout,
} from './campusHuntFormat';

/**
 * One action: set teams × people → update starts/places/layout → demo teams.
 * Organizer can rename places / passwords afterwards.
 */
export async function applyRound1Scale(eventId, {
  teamCapacity,
  teamSize,
  startCount: startCountOverride,
  stationCount: stationCountOverride,
  createDemoTeams = true,
  existingStations,
  existingStarts,
} = {}) {
  if (!eventId) throw new Error('Missing event');

  const format = deriveCompetitionFormat({ teamCapacity, teamSize });
  const suggested = suggestHuntLayout(format.teamCapacity);
  const geometry = deriveClueGeometry(format.teamCapacity, format.teamSize, {
    startCount: startCountOverride ?? suggested.startCount,
    stationCount: stationCountOverride ?? suggested.stationCount,
  });

  await adminUpdateEvent(eventId, {
    teamCapacity: format.teamCapacity,
    teamSize: format.teamSize,
    startCount: geometry.startCount,
    stationCount: geometry.stationCount,
    reason: 'Apply Round 1 scale across Locations · Teams · Links · Live',
  });

  // Keep catalog sliced to the active counts (names preserved when possible).
  const stations = resolveStations(existingStations, geometry.stationCount);
  const starts = resolveStarts(existingStarts, geometry.startCount);
  try {
    await adminUpdateCampusStations(eventId, {
      campusStations: stations.map((s) => ({
        code: s.code,
        name: s.name,
        ...(Array.isArray(s.plantFragments) ? { plantFragments: s.plantFragments } : {}),
        ...(s.joinedWord ? { joinedWord: s.joinedWord } : {}),
      })),
      campusStarts: starts.map((s) => ({ code: s.code, name: s.name })),
      stationCount: geometry.stationCount,
      startCount: geometry.startCount,
      reason: 'Scale layout to team field',
    });
  } catch {
    // Event startCount/stationCount already saved; catalog sync is best-effort.
  }

  let bootstrap = null;
  if (createDemoTeams) {
    bootstrap = await adminBootstrapRound1(eventId, {
      createTeams: true,
      enablePublicLeaderboard: false,
    });
    await adminRepairTeamRosters(eventId);
  }

  return {
    format,
    geometry,
    bootstrap,
    message:
      `Updated whole Round 1 for ${format.teamCapacity}×${format.teamSize}: `
      + `${geometry.startCount} start(s) · ${geometry.stationCount} place(s)`
      + (createDemoTeams ? ' · demo teams created/repaired' : '')
      + '. Rename places & passwords anytime.',
  };
}
