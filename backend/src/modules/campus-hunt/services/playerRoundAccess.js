/**
 * Player-facing Round 1 / Survival / Finals access.
 * Event flags = overall open/locked. Team locks override to force lock.
 */

const ROUND_IDS = ['round1', 'survival', 'finale'];

const DEFAULT_ACCESS = {
  round1: true,
  survival: false,
  finale: false,
};

function normalizeAccess(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    round1: src.round1 !== false,
    survival: src.survival === true,
    finale: src.finale === true,
  };
}

function normalizeTeamLocks(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const id of ROUND_IDS) {
    if (src[id] === true) out[id] = true;
  }
  return out;
}

/**
 * Build hub cards for a player after login.
 */
function buildPlayerRoundsHub({
  event,
  team,
  round1Status = null,
  finaleStatus = null,
  hasFinaleEntry = false,
}) {
  const access = normalizeAccess(event?.playerRoundAccess);
  const teamLocks = normalizeTeamLocks(team?.playerRoundLocks);
  const phase = team?.competitionPhase || 'round1';
  const finaleEligible = phase === 'finale' || Boolean(hasFinaleEntry || team?.finaleEntryId);

  const round1Live = String(round1Status || '').toLowerCase() === 'live';
  const cards = [
    {
      id: 'round1',
      label: 'Round 1',
      subtitle: 'Campus Hunt',
      detail: 'Clues, checkpoints, campus scan.',
      globallyOpen: access.round1,
      teamLocked: Boolean(teamLocks.round1),
      eligible: true,
      open: access.round1 && !teamLocks.round1 && round1Live,
      statusHint: String(round1Status || '').toLowerCase() || null,
      lockedReason: !access.round1
        ? 'Organizers have locked Round 1'
        : teamLocks.round1
          ? 'Locked for your team'
          : !round1Live
            ? 'Round 1 is not live yet — wait for organizers to start'
            : null,
    },
    {
      id: 'survival',
      label: 'Survival',
      subtitle: 'Round 2',
      detail: 'Top teams after Round 1.',
      globallyOpen: access.survival,
      teamLocked: Boolean(teamLocks.survival),
      eligible: true,
      open: access.survival && !teamLocks.survival,
      statusHint: null,
      lockedReason: !access.survival
        ? 'Survival is locked — wait for organizers'
        : teamLocks.survival
          ? 'Locked for your team'
          : null,
      comingSoon: true,
    },
    {
      id: 'finale',
      label: 'Finals',
      subtitle: 'Final round',
      detail: '12 teams · four missions.',
      globallyOpen: access.finale,
      teamLocked: Boolean(teamLocks.finale),
      eligible: finaleEligible,
      open: access.finale && !teamLocks.finale && finaleEligible,
      statusHint: String(finaleStatus || '').toLowerCase() || null,
      lockedReason: !finaleEligible
        ? 'Your team is not in the Finals yet'
        : !access.finale
          ? 'Finals are locked — wait for organizers'
          : teamLocks.finale
            ? 'Locked for your team'
            : null,
    },
  ];

  return {
    access,
    teamLocks,
    cards,
  };
}

async function loadPlayerHubState(eventId, team) {
  const CampusHuntEvent = require('../models/CampusHuntEvent');
  const CampusHuntRound = require('../models/CampusHuntRound');
  const event = await CampusHuntEvent.findById(eventId)
    .select('slug name college playerRoundAccess teamSize teamCapacity finaleCapacity')
    .lean();
  const rounds = await CampusHuntRound.find({ eventId })
    .select('name roundNumber status')
    .lean();
  const round1Doc = rounds.find((r) => Number(r.roundNumber) === 1)
    || rounds.find((r) => /hunt|round\s*1/i.test(String(r.name || '')));
  const finaleRound = rounds.find((r) => /finale/i.test(String(r.name || '')))
    || rounds.find((r) => Number(r.roundNumber) >= 4);
  const hub = buildPlayerRoundsHub({
    event,
    team,
    round1Status: round1Doc?.status,
    finaleStatus: finaleRound?.status,
    hasFinaleEntry: Boolean(team?.finaleEntryId),
  });
  return { event, hub };
}

function publicEventView(event, access) {
  if (!event) return null;
  return {
    id: String(event._id || event.id),
    slug: event.slug,
    name: event.name,
    college: event.college,
    teamSize: Math.max(2, Math.min(8, Number(event.teamSize) || 4)),
    teamCapacity: Math.max(2, Math.min(200, Number(event.teamCapacity) || 40)),
    finaleCapacity: Math.max(1, Math.min(200, Number(event.finaleCapacity) || 12)),
    playerRoundAccess: access || event.playerRoundAccess || DEFAULT_ACCESS,
  };
}

function assertRoundPlayable(hub, roundId) {
  const card = (hub.cards || []).find((c) => c.id === roundId);
  if (!card) {
    const err = new Error('Unknown round');
    err.status = 400;
    err.code = 'BAD_ROUND';
    throw err;
  }
  if (!card.open) {
    const err = new Error(card.lockedReason || 'This round is locked');
    err.status = 403;
    err.code = 'ROUND_LOCKED';
    throw err;
  }
  if (card.comingSoon) {
    const err = new Error('Survival stage is not open for play yet');
    err.status = 403;
    err.code = 'ROUND_COMING_SOON';
    throw err;
  }
  return card;
}

module.exports = {
  ROUND_IDS,
  DEFAULT_ACCESS,
  normalizeAccess,
  normalizeTeamLocks,
  buildPlayerRoundsHub,
  loadPlayerHubState,
  publicEventView,
  assertRoundPlayable,
};
