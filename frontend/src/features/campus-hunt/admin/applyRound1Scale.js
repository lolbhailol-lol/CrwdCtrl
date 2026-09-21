import {
  adminUpdateEvent,
  adminBootstrapRound1,
  adminPruneExcessTeams,
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
 * Save teams × people — light path (no full clue rebuild).
 * Clues stay as-is; only capacity/starts/teams/passwords refresh.
 * Use Clues → "Save clues + teams" when you actually change clue content.
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
    reason: 'Save hunt size',
  });

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
    // Event counts already saved; catalog sync is best-effort.
  }

  try {
    await adminPruneExcessTeams(eventId);
  } catch {
    // Best-effort trim of leftovers beyond capacity.
  }

  let bootstrap = null;
  if (createDemoTeams) {
    // teamsOnly: skip rebuilding all clues (that was timing out / 500 on save size).
    bootstrap = await adminBootstrapRound1(eventId, {
      createTeams: true,
      enablePublicLeaderboard: true,
      teamsOnly: true,
    });
  }

  return {
    format,
    geometry,
    bootstrap,
    message:
      `Saved ${format.teamCapacity} teams × ${format.teamSize} · `
      + `${geometry.startCount} gather · ${geometry.stationCount} places. `
      + 'Open Links when ready — re-save clues only if you edit them.',
  };
}
