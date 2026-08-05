/** Client helpers for sports/run custom registration tiers */

export function createEmptyTier(order = 0, name = '') {
    return {
        id: `tier_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: name || (order === 0 ? 'Basic' : `Tier ${order + 1}`),
        description: '',
        fee: 0,
        participantCount: 1,
        inclusions: [],
        order,
    };
}

function sanitizeParticipantCount(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(10, Math.round(n));
}

/** Infer driver count from package name when participantCount is missing. */
export function resolveTierParticipantCount(tier) {
    if (!tier) return 1;
    const explicit = Number(tier.participantCount ?? tier.driverCount);
    if (Number.isFinite(explicit) && explicit >= 1) return Math.min(10, Math.round(explicit));
    const name = String(tier.name || tier.description || '').toLowerCase();
    if (/\bpenta\b/.test(name)) return 5;
    if (/\bquattro\b/.test(name)) return 4;
    if (/\btrio\b/.test(name)) return 3;
    return 1;
}

export function sanitizeSportsTiers(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((tier, index) => ({
            id: String(tier?.id || `tier_${index}`).trim(),
            name: String(tier?.name || '').trim(),
            description: String(tier?.description || '').trim(),
            fee: Math.max(0, Number(tier?.fee) || 0),
            participantCount: sanitizeParticipantCount(
                tier?.participantCount ?? tier?.driverCount ?? resolveTierParticipantCount(tier),
            ),
            inclusions: Array.isArray(tier?.inclusions)
                ? tier.inclusions.map((s) => String(s).trim()).filter(Boolean)
                : String(tier?.inclusions || '')
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
            order: Number.isFinite(Number(tier?.order)) ? Number(tier.order) : index,
        }))
        .filter((tier) => tier.name || tier.fee > 0 || tier.inclusions.length || tier.description)
        .map((tier, index) => ({
            ...tier,
            name: tier.name || `Tier ${index + 1}`,
            order: index,
        }));
}

export function getSportsTiers(event) {
    if (!event || event.pricingMode !== 'tiers') return [];
    return sanitizeSportsTiers(event.tiers).sort((a, b) => a.order - b.order);
}

export function isTiersPricing(event) {
    return event?.pricingMode === 'tiers' && getSportsTiers(event).length > 0;
}

export function findSportsTier(event, tierId) {
    const tiers = getSportsTiers(event);
    const id = String(tierId || '').trim();
    if (!id) return null;
    return tiers.find((t) => t.id === id) || null;
}

export function resolveSportsPerPersonFee(event, tierId) {
    if (isTiersPricing(event)) {
        const tier = findSportsTier(event, tierId);
        if (!tier) return { fee: 0, tier: null, error: 'Please select a registration tier.' };
        return { fee: Math.max(0, Number(tier.fee) || 0), tier, error: null };
    }
    return { fee: Math.max(0, Number(event?.registrationFee) || 0), tier: null, error: null };
}

export function minSportsFee(event) {
    if (isTiersPricing(event)) {
        const fees = getSportsTiers(event).map((t) => Math.max(0, Number(t.fee) || 0));
        const paid = fees.filter((f) => f > 0);
        if (paid.length) return Math.min(...paid);
        return fees.length ? Math.min(...fees) : 0;
    }
    return Math.max(0, Number(event?.registrationFee) || 0);
}

export function formatInr(amount) {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

/** Optional per-person booking add-on from admin (checkbox on book page). */
export function resolveOptionalAddOn(event) {
    const raw = event?.optionalAddOn;
    if (!raw || raw.enabled !== true) return null;
    const label = String(raw.label || '').trim();
    const fee = Math.max(0, Number(raw.fee) || 0);
    if (!label) return null;
    return { label, fee };
}

export function sanitizeOptionalAddOn(raw) {
    if (!raw || typeof raw !== 'object') {
        return { enabled: false, label: '', fee: 0 };
    }
    const enabled = Boolean(raw.enabled);
    const label = String(raw.label || '').trim();
    const fee = Math.max(0, Number(raw.fee) || 0);
    return {
        enabled: enabled && Boolean(label),
        label: enabled ? label : '',
        fee: enabled ? fee : 0,
    };
}
