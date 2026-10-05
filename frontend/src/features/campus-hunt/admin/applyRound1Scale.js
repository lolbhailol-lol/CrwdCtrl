import { adminUpdateEvent } from '../services/campusHunt.api';
import { deriveCompetitionFormat } from './competitionFormat';
import { suggestHuntLayout } from './campusHuntFormat';

/**
 * First-page save: teams × people only.
 * Starts/places follow suggested layout counts; no clue rebuild.
 */
export async function applyRound1Scale(eventId, {
  teamCapacity,
  teamSize,
} = {}) {
  if (!eventId) throw new Error('Missing event');

  const format = deriveCompetitionFormat({ teamCapacity, teamSize });
  const layout = suggestHuntLayout(format.teamCapacity);

  await adminUpdateEvent(eventId, {
    teamCapacity: format.teamCapacity,
    teamSize: format.teamSize,
    startCount: layout.startCount,
    stationCount: layout.stationCount,
    reason: 'Save teams × people',
  });

  return {
    format,
    geometry: {
      teamCapacity: format.teamCapacity,
      teamSize: format.teamSize,
      startCount: layout.startCount,
      stationCount: layout.stationCount,
    },
    message: `Saved ${format.teamCapacity} teams · ${format.teamSize}/team · ${layout.stationCount} places · ${layout.startCount} start(s).`,
  };
}
