/** Client-side team size helpers (mirrors backend/src/utils/teamSize.js) */

export function clampTeam(n, fallback = 1) {
    const num = Number(n);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(20, Math.max(1, Math.floor(num)));
}

export function buildTeamSizeLabel(min, max) {
    const a = clampTeam(min);
    const b = clampTeam(max, a);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo === 1 && hi === 1) return 'Solo';
    if (lo === hi) return `${lo} people`;
    if (lo === 1) return `Max ${hi} people`;
    return `${lo}–${hi} people`;
}

export function normalizeTeamSizeFields({
    teamSizeMin,
    teamSizeMax,
    teamSizeLabel,
} = {}) {
    let lo = clampTeam(teamSizeMin ?? 1);
    let hi = clampTeam(teamSizeMax ?? lo, lo);
    if (hi < lo) {
        const t = lo;
        lo = hi;
        hi = t;
    }
    const rawLabel = String(teamSizeLabel || '').trim();
    const dirty = !rawLabel || /participant/i.test(rawLabel) || /per\s*team/i.test(rawLabel);
    return {
        teamSizeMin: lo,
        teamSizeMax: hi,
        teamSizeLabel: dirty ? buildTeamSizeLabel(lo, hi) : rawLabel,
    };
}

/** Gate: max team size in the 3–6 band */
export function requiresTeamRosterGate({ teamSizeMin, teamSizeMax } = {}) {
    const lo = clampTeam(teamSizeMin);
    const hi = clampTeam(teamSizeMax, lo);
    return hi >= 3 && hi <= 6;
}

/** Competition registration step 1: pick count when team can be more than 1 */
export function needsParticipantCountStep({ teamSizeMin, teamSizeMax } = {}) {
    const lo = clampTeam(teamSizeMin);
    const hi = clampTeam(teamSizeMax, lo);
    return hi >= 2;
}

/** Effective min/max for roster UI — respects organizer teamSizeMin/teamSizeMax as saved */
export function getRosterBounds({ teamSizeMin, teamSizeMax } = {}) {
    const lo = clampTeam(teamSizeMin);
    const hi = clampTeam(teamSizeMax, lo);
    return { min: lo, max: hi };
}

export function formatSlotsLabel(slotsAllotted, slotsLeft, { showSlotsPublic = true } = {}) {
    if (showSlotsPublic === false) return 'Unlimited entries';
    const allotted = Math.max(0, Number(slotsAllotted) || 0);
    if (allotted <= 0) return 'Unlimited entries';
    if (slotsLeft != null && Number.isFinite(Number(slotsLeft))) {
        const left = Math.max(0, Math.floor(Number(slotsLeft)));
        return left === 1 ? '1 slot remains' : `${left} slots remain`;
    }
    return allotted === 1 ? '1 slot' : `${allotted} slots`;
}

