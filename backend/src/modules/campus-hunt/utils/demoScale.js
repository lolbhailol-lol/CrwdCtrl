/**
 * Organizer demo / event scale — teams count, people per team, finale slots.
 */

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Suggest finale size from Round 1 team capacity. */
function suggestFinaleScale(teamCapacity) {
  const cap = clampInt(teamCapacity, 2, 40, 40);
  if (cap <= 12) {
    const finaleCapacity = cap;
    const directFromR1 = Math.min(finaleCapacity, Math.max(1, Math.ceil(finaleCapacity * 0.4)));
    return {
      finaleCapacity,
      directFromR1,
      manualPick: Math.max(0, finaleCapacity - directFromR1),
    };
  }
  return {
    finaleCapacity: 12,
    directFromR1: 5,
    manualPick: 7,
  };
}

/**
 * Resolve full scale from event (+ optional body overrides).
 * @param {object} event
 * @param {object} [overrides]
 */
function resolveDemoScale(event = {}, overrides = {}) {
  const teamCapacity = clampInt(
    overrides.teamCapacity ?? event.teamCapacity,
    4,
    200,
    40,
  );
  const teamSize = clampInt(
    overrides.teamSize ?? event.teamSize,
    2,
    8,
    4,
  );
  const suggested = suggestFinaleScale(teamCapacity);
  const finaleCapacity = clampInt(
    overrides.finaleCapacity ?? event.finaleCapacity ?? suggested.finaleCapacity,
    2,
    Math.min(12, teamCapacity),
    suggested.finaleCapacity,
  );
  let directFromR1 = clampInt(
    overrides.finaleDirectFromR1 ?? event.finaleDirectFromR1 ?? suggested.directFromR1,
    1,
    finaleCapacity,
    Math.min(suggested.directFromR1, finaleCapacity),
  );
  if (directFromR1 > finaleCapacity) directFromR1 = finaleCapacity;
  const manualPick = Math.max(0, finaleCapacity - directFromR1);

  return {
    teamCapacity,
    teamSize,
    membersBesideLeader: teamSize - 1,
    scanRequired: teamSize,
    finaleCapacity,
    directFromR1,
    manualPick,
  };
}

function defaultMemberNames(teamSize, teamCode = 'Team') {
  const n = Math.max(1, Number(teamSize) - 1);
  const labels = ['A', 'B', 'C', 'D'];
  const names = [];
  for (let i = 0; i < n; i += 1) {
    names.push(`Member ${teamCode} ${labels[i] || i + 1}`);
  }
  return names;
}

module.exports = {
  clampInt,
  suggestFinaleScale,
  resolveDemoScale,
  defaultMemberNames,
};
