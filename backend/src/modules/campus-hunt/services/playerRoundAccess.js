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

  const cards = [
    {
      id: 'round1',
      label: 'Round 1',
      subtitle: 'Campus Hunt',
      detail: 'Clues, checkpoints, campus scan.',
      globallyOpen: access.round1,
      teamLocked: Boolean(teamLocks.round1),
      eligible: true,
      open: access.round1 && !teamLocks.round1,
      statusHint: String(round1Status || '').toLowerCase() || null,
      lockedReason: !access.round1
        ? 'Organizers have locked Round 1'
        : teamLocks.round1
          ? 'Locked for your team'
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
  assertRoundPlayable,
};
