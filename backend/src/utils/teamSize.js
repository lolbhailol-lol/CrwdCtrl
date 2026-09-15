/**
 * Parse free-text team size (rulebook / admin) into structured min/max/label.
 */

function clampTeam(n, fallback = 1) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(20, Math.max(1, Math.floor(num)));
}

function buildTeamSizeLabel(min, max) {
  const a = clampTeam(min);
  const b = clampTeam(max, a);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (lo === 1 && hi === 1) return 'Solo';
  if (lo === hi) return `${lo} people`;
  if (lo === 1) return `Max ${hi} people`;
  return `${lo}–${hi} people`;
}

function normalizeTeamSizeFields({
  teamSizeMin,
  teamSizeMax,
  teamSizeLabel,
  min,
  max,
  label,
} = {}) {
  let lo = clampTeam(teamSizeMin ?? min ?? 1);
  let hi = clampTeam(teamSizeMax ?? max ?? lo, lo);
  if (hi < lo) {
    const t = lo;
    lo = hi;
    hi = t;
  }
  const rawLabel = String(teamSizeLabel ?? label ?? '').trim();
  const dirty = !rawLabel || /participant/i.test(rawLabel) || /per\s*team/i.test(rawLabel);
  return {
    teamSizeMin: lo,
    teamSizeMax: hi,
    teamSizeLabel: dirty ? buildTeamSizeLabel(lo, hi) : rawLabel,
  };
}

/** Parse rulebook-style strings into structured fields */
function parseTeamSizeStructured(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return normalizeTeamSizeFields({ min: 1, max: 1, label: 'Solo' });
  }

  if (/individual|solo|lone\s*wolf|1\s*participant/i.test(text) && !/\d+\s*[–\-to]+\s*\d+/i.test(text)) {
    return normalizeTeamSizeFields({ min: 1, max: 1, label: 'Solo' });
  }

  const range =
    text.match(/minimum\s*(?:of\s*)?(\d+)\s*(?:to|–|-|and)\s*maximum\s*(?:of\s*)?(\d+)/i) ||
    text.match(/(\d+)\s*(?:to|–|-)\s*(\d+)\s*(?:participants?|members?|players?)?/i) ||
    text.match(/min(?:imum)?\s*(\d+)\s*.{0,12}?max(?:imum)?\s*(\d+)/i);
  if (range) {
    return normalizeTeamSizeFields({
      min: Number(range[1]),
      max: Number(range[2]),
      label: text.slice(0, 80),
    });
  }

  const maxOnly =
    text.match(/max(?:imum)?(?:\s*of)?\s*(\d+)/i) ||
    text.match(/(\d+)\s*(?:participants?|members?|players?)\s*per\s*team/i);
  if (maxOnly) {
    const n = Number(maxOnly[1]);
    return normalizeTeamSizeFields({
      min: 1,
      max: n,
      label: text.slice(0, 80),
    });
  }

  const exact = text.match(/\b(\d+)\b/);
  if (exact) {
    const n = Number(exact[1]);
    return normalizeTeamSizeFields({ min: 1, max: n, label: text.slice(0, 80) });
  }

  return normalizeTeamSizeFields({ min: 1, max: 1, label: text.slice(0, 80) || 'Solo' });
}

/** Registration gate: team comps whose max size is in the 3–6 band */
function requiresTeamRosterGate({ teamSizeMin, teamSizeMax } = {}) {
  const lo = clampTeam(teamSizeMin);
  const hi = clampTeam(teamSizeMax, lo);
  return hi >= 3 && hi <= 6;
}

/** Effective min/max for the registration roster UI — respects saved teamSizeMin/teamSizeMax */
function getRosterBounds({ teamSizeMin, teamSizeMax } = {}) {
  const lo = clampTeam(teamSizeMin);
  const hi = clampTeam(teamSizeMax, lo);
  return { min: lo, max: hi };
}

module.exports = {
  clampTeam,
  buildTeamSizeLabel,
  normalizeTeamSizeFields,
  parseTeamSizeStructured,
  requiresTeamRosterGate,
  getRosterBounds,
};
