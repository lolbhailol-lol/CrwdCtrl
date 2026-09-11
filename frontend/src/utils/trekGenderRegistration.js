export const GENDER_PHASE_OPTIONS = [
    { value: 'women_only', label: 'Women only', short: 'Women can register now' },
    { value: 'men_only', label: 'Men only', short: 'Men can register now' },
    { value: 'all', label: 'Open to all', short: 'Everyone can register' },
    { value: 'closed', label: 'Paused', short: 'Nobody can register' },
];

export const PHASE_LABELS = {
    closed: 'Registration paused',
    women_only: 'Women registration open',
    men_only: 'Men registration open',
    all: 'Open to all',
};

export function normalizeGender(value) {
    if (!value) return null;
    const s = String(value).trim().toLowerCase();
    if (['female', 'f', 'woman', 'women'].includes(s)) return 'Female';
    if (['male', 'm', 'man', 'men'].includes(s)) return 'Male';
    if (['others', 'other'].includes(s)) return 'Others';
    if (value === 'Female' || value === 'Male' || value === 'Others') return value;
    return null;
}

export function isGenderQuotasEnabled(trekOrReg) {
    const reg = trekOrReg?.registration || trekOrReg;
    return Boolean(reg?.genderQuotas?.enabled);
}

export function isGenderPhaseRestricted(phase) {
    return phase === 'women_only' || phase === 'men_only';
}

export function requiresSinglePersonGenderBooking(trekOrGenderReg) {
    const phase = trekOrGenderReg?.phase
        ?? trekOrGenderReg?.registration?.genderPhase
        ?? trekOrGenderReg?.genderPhase
        ?? 'all';
    if (!isGenderQuotasEnabled(trekOrGenderReg)) return false;
    return isGenderPhaseRestricted(phase);
}

export function evaluateUserRegistrationAccess({ genderRegistration, userGender, people = 1 }) {
    if (!genderRegistration?.enabled) {
        return { canRegister: true, message: null, phaseLabel: null };
    }

    const gender = normalizeGender(userGender);
    const phase = genderRegistration.phase || 'all';
    const phaseLabel = genderRegistration.phaseLabel || PHASE_LABELS[phase] || '';

    if (!gender) {
        return {
            canRegister: false,
            message: 'Please select Female or Male to continue.',
            phaseLabel,
        };
    }

    // Open to all — only gender quota (seats full) can block, not phase rules
    if (phase === 'all') {
        const bucket = gender === 'Female' ? 'female' : gender === 'Male' ? 'male' : 'others';
        const quota = genderRegistration.quotas?.[bucket];
        const requested = Math.max(1, Number(people) || 1);
        if (quota?.cap > 0 && (quota.filled + requested) > quota.cap) {
            const remaining = Math.max(0, quota.cap - quota.filled);
            return {
                canRegister: false,
                message: remaining > 0
                    ? `Only ${remaining} ${quota.label.toLowerCase()} seat${remaining === 1 ? '' : 's'} left.`
                    : `No ${quota.label.toLowerCase()} seats left (${quota.filled}/${quota.cap} filled).`,
                phaseLabel,
            };
        }
        return { canRegister: true, message: null, phaseLabel };
    }

    if (phase === 'closed') {
        return {
            canRegister: false,
            message: 'Registration is paused for this trek.',
            phaseLabel,
        };
    }

    if (phase === 'women_only' && gender !== 'Female') {
        return {
            canRegister: false,
            message: 'Registration is open for women only right now. Men\'s registration will open later.',
            phaseLabel,
        };
    }

    if (phase === 'men_only' && gender !== 'Male') {
        return {
            canRegister: false,
            message: 'Registration is open for men only right now.',
            phaseLabel,
        };
    }

    const bucket = gender === 'Female' ? 'female' : gender === 'Male' ? 'male' : 'others';
    const quota = genderRegistration.quotas?.[bucket];
    if (quota?.full) {
        return {
            canRegister: false,
            message: `No ${quota.label.toLowerCase()} seats left (${quota.filled}/${quota.cap} filled).`,
            phaseLabel,
        };
    }

    return { canRegister: true, message: null, phaseLabel };
}

export function formatQuotaLine(quota) {
    if (!quota || !quota.cap) return `${quota?.label || ''}: no limit set`;
    const remaining = quota.remaining ?? Math.max(0, quota.cap - quota.filled);
    return `${quota.label}: ${quota.filled}/${quota.cap} filled · ${remaining} left`;
}

export function getGenderPhaseStepNotice(phase) {
    if (phase === 'women_only') {
        return 'Registration is open to women only. For everyone else, it will open from tomorrow.';
    }
    if (phase === 'men_only') {
        return 'Registration is open to men only. For everyone else, it will open from tomorrow.';
    }
    return null;
}
