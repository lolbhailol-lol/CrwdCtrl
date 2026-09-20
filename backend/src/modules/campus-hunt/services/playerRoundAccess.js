/**
 * Player hub — single game only (no Survival / Finals).
 */

const ROUND_IDS = ['round1'];

const DEFAULT_ACCESS = {
  round1: true,
  survival: false,
  finale: false,
};

function normalizeAccess(_raw) {
  return {
    round1: true,
    survival: false,
    finale: false,
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
 * Build hub cards for a player after login — one hunt card only.
 */
function buildPlayerRoundsHub({
  event,
  team,
  round1Status = null,
}) {
  const access = normalizeAccess(event?.playerRoundAccess);
  const teamLocks = normalizeTeamLocks(team?.playerRoundLocks);
  const round1Live = String(round1Status || '').toLowerCase() === 'live';
  const huntName = String(event?.roundPlan?.round1Name || event?.name || 'Campus Hunt').trim()
    || 'Campus Hunt';

  const cards = [
    {
      id: 'round1',
      label: 'The Hunt',
      subtitle: huntName,
      detail: 'Clues, checkpoints, finish at the lobby. One phone (leader).',
      globallyOpen: access.round1,
      teamLocked: Boolean(teamLocks.round1),
      eligible: true,
      open: access.round1 && !teamLocks.round1 && round1Live,
      statusHint: String(round1Status || '').toLowerCase() || null,
      lockedReason: !access.round1
        ? 'Organizers have locked the hunt'
        : teamLocks.round1
          ? 'Locked for your team'
          : !round1Live
            ? 'Not live yet — wait for organizers to start'
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
    .select('slug name college playerRoundAccess teamSize teamCapacity finaleCapacity roundPlan')
    .lean();
  const rounds = await CampusHuntRound.find({ eventId })
    .select('name roundNumber status')
    .lean();
  const round1Doc = rounds.find((r) => Number(r.roundNumber) === 1)
    || rounds.find((r) => /hunt|round\s*1/i.test(String(r.name || '')));
  const hub = buildPlayerRoundsHub({
    event,
    team,
    round1Status: round1Doc?.status,
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
    teamSize: Math.max(2, Math.min(12, Number(event.teamSize) || 4)),
    teamCapacity: Math.max(2, Math.min(200, Number(event.teamCapacity) || 20)),
    finaleCapacity: 0,
    playerRoundAccess: access || DEFAULT_ACCESS,
  };
}

function assertRoundPlayable(hub, roundId) {
  if (roundId !== 'round1') {
    const err = new Error('This event is a single game — only the hunt is available');
    err.status = 403;
    err.code = 'SINGLE_GAME_ONLY';
    throw err;
  }
  const card = (hub.cards || []).find((c) => c.id === roundId);
  if (!card) {
    const err = new Error('Unknown round');
    err.status = 400;
    err.code = 'BAD_ROUND';
    throw err;
  }
  if (!card.open) {
    const err = new Error(card.lockedReason || 'The hunt is locked');
    err.status = 403;
    err.code = 'ROUND_LOCKED';
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
