import { adminResyncClue1 } from '../services/campusHunt.api';

/**
 * Rebind team → challenge IDs after clue edits so players see saved content.
 */
export async function syncAfterClueSave(eventId, { roundId } = {}) {
  if (!eventId) return null;
  try {
    return await adminResyncClue1(eventId, { roundId });
  } catch (err) {
    return { error: err.message || 'Resync failed' };
  }
}
