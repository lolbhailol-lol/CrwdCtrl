/**
 * Resolve per-person registration fee for sports / run events.
 * Supports legacy single fee and custom tiers.
 */

function sanitizeSportsTiers(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((tier, index) => ({
            id: String(tier?.id || `tier_${index}_${Date.now()}`).trim(),
            name: String(tier?.name || '').trim(),
            description: String(tier?.description || '').trim(),
            fee: Math.max(0, Number(tier?.fee) || 0),
            inclusions: Array.isArray(tier?.inclusions)
                ? tier.inclusions.map((s) => String(s).trim()).filter(Boolean)
                : typeof tier?.inclusions === 'string'
                    ? String(tier.inclusions).split('\n').map((s) => s.trim()).filter(Boolean)
                    : [],
            order: Number.isFinite(Number(tier?.order)) ? Number(tier.order) : index,
        }))
        .filter((tier) => tier.name || tier.fee > 0 || tier.inclusions.length > 0 || tier.description)
        .map((tier, index) => ({
            ...tier,
            name: tier.name || `Tier ${index + 1}`,
            order: index,
        }));
}

function getSportsTiers(event) {
    if (!event) return [];
    if (event.pricingMode === 'tiers') {
        return sanitizeSportsTiers(event.tiers).sort((a, b) => a.order - b.order);
    }
    return [];
}

function minTierFee(tiers) {
    if (!tiers.length) return 0;
    return Math.min(...tiers.map((t) => Math.max(0, Number(t.fee) || 0)));
}

function maxTierFee(tiers) {
    if (!tiers.length) return 0;
    return Math.max(...tiers.map((t) => Math.max(0, Number(t.fee) || 0)));
}

function findSportsTier(event, tierId) {
    const tiers = getSportsTiers(event);
    if (!tiers.length) return null;
    const id = String(tierId || '').trim();
    if (!id) return null;
    return tiers.find((t) => t.id === id) || null;
}

/**
 * @returns {{ fee: number, tier: object|null, pricingMode: string }}
 */
function resolveSportsPerPersonFee(event, tierId) {
    const pricingMode = event?.pricingMode === 'tiers' ? 'tiers' : 'single';
    if (pricingMode === 'tiers') {
        const tiers = getSportsTiers(event);
        if (!tiers.length) {
            return { fee: Math.max(0, Number(event?.registrationFee) || 0), tier: null, pricingMode };
        }
        const tier = findSportsTierByIdOrThrow(tiers, tierId);
        return { fee: Math.max(0, Number(tier.fee) || 0), tier, pricingMode };
    }
    return {
        fee: Math.max(0, Number(event?.registrationFee) || 0),
        tier: null,
        pricingMode,
    };
}

function findSportsTierByIdOrThrow(tiers, tierId) {
    const id = String(tierId || '').trim();
    if (!id) {
        const err = new Error('Please select a registration tier.');
        err.status = 400;
        throw err;
    }
    const tier = tiers.find((t) => t.id === id);
    if (!tier) {
        const err = new Error('Invalid registration tier selected.');
        err.status = 400;
        throw err;
    }
    return tier;
}

function resolveOptionalAddOn(event) {
    const raw = event?.optionalAddOn;
    if (!raw || raw.enabled !== true) return null;
    const label = String(raw.label || '').trim();
    const fee = Math.max(0, Number(raw.fee) || 0);
    if (!label) return null;
    return { label, fee };
}

/**
 * Ticket subtotal before platform fee / coupons.
 * Add-on (if enabled + selected) is charged per person.
 */
function resolveSportsTicketTotal(event, { tierId, people = 1, addOnSelected = false } = {}) {
    const priced = resolveSportsPerPersonFee(event, tierId);
    const peopleCount = Math.max(1, Number(people) || 1);
    const addOn = resolveOptionalAddOn(event);
    const selected = Boolean(addOnSelected) && Boolean(addOn);
    const addOnFeePerPerson = selected ? addOn.fee : 0;
    const ticketPricePerPerson = Math.max(0, Number(priced.fee) || 0);
    const perPerson = ticketPricePerPerson + addOnFeePerPerson;
    return {
        pricingMode: priced.pricingMode,
        tier: priced.tier,
        ticketPricePerPerson,
        addOn,
        addOnSelected: selected,
        addOnFeePerPerson,
        people: peopleCount,
        baseTicketTotal: perPerson * peopleCount,
    };
}

function sanitizeOptionalAddOn(raw) {
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

function mirrorRegistrationFeeFromTiers(pricingMode, tiers, fallbackFee) {
    if (pricingMode !== 'tiers') {
        return Math.max(0, Number(fallbackFee) || 0);
    }
    const cleaned = sanitizeSportsTiers(tiers);
    if (!cleaned.length) return 0;
    return minTierFee(cleaned);
}

module.exports = {
    sanitizeSportsTiers,
    getSportsTiers,
    minTierFee,
    maxTierFee,
    findSportsTier,
    resolveSportsPerPersonFee,
    resolveOptionalAddOn,
    resolveSportsTicketTotal,
    sanitizeOptionalAddOn,
    mirrorRegistrationFeeFromTiers,
};
