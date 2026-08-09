/**
 * Resolve per-person registration fee for sports / run events.
 * Supports legacy single fee and custom tiers.
 */

function sanitizeParticipantCount(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(10, Math.round(n));
}

function inferParticipantCountFromName(name = '') {
    const n = String(name || '').toLowerCase();
    if (/\bpenta\b/.test(n)) return 5;
    if (/\bquattro\b/.test(n)) return 4;
    if (/\btrio\b/.test(n)) return 3;
    return 1;
}

function sanitizeSportsTiers(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((tier, index) => ({
            id: String(tier?.id || `tier_${index}_${Date.now()}`).trim(),
            name: String(tier?.name || '').trim(),
            description: String(tier?.description || '').trim(),
            fee: Math.max(0, Number(tier?.fee) || 0),
            participantCount: sanitizeParticipantCount(
                tier?.participantCount
                ?? tier?.driverCount
                ?? inferParticipantCountFromName(tier?.name || tier?.description),
            ),
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
    const fees = tiers.map((t) => Math.max(0, Number(t.fee) || 0));
    const paid = fees.filter((f) => f > 0);
    // Prefer lowest paid package so a free "drive only" option does not zero the list price
    if (paid.length) return Math.min(...paid);
    return Math.min(...fees);
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

function sanitizeEventAddOns(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((addOn, index) => ({
            id: String(addOn?.id || `addon_${index}`).trim(),
            name: String(addOn?.name || addOn?.label || '').trim(),
            description: String(addOn?.description || '').trim(),
            vehicles: String(addOn?.vehicles || '').trim(),
            fee: Math.max(0, Number(addOn?.fee) || 0),
            enabled: addOn?.enabled !== false,
            order: Number.isFinite(Number(addOn?.order)) ? Number(addOn.order) : index,
        }))
        .filter((addOn) => addOn.enabled && addOn.id && addOn.name)
        .map((addOn, index) => ({ ...addOn, order: index }));
}

function resolveEventAddOns(event, selectedIds = []) {
    const requested = new Set(
        (Array.isArray(selectedIds) ? selectedIds : [selectedIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean),
    );
    const available = sanitizeEventAddOns(event?.addOns);
    const selected = available.filter((addOn) => requested.has(addOn.id));
    if (selected.length !== requested.size) {
        const err = new Error('One or more selected add-ons are unavailable.');
        err.status = 400;
        throw err;
    }
    return {
        selected,
        total: selected.reduce((sum, addOn) => sum + addOn.fee, 0),
    };
}

/**
 * Ticket subtotal before platform fee / coupons.
 * Add-on (if enabled + selected) is charged per person.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.inferMissingTier=false] - For coupon preview only: if tierId
 *   is missing, match expectedTicketTotal to a tier+addon combo, or use the sole tier.
 *   Never enable for create-order / charge paths.
 */
function resolveSportsTicketTotal(event, {
    tierId,
    people = 1,
    addOnSelected = false,
    expectedTicketTotal = null,
    inferMissingTier = false,
} = {}) {
    const peopleCount = Math.max(1, Number(people) || 1);
    const addOn = resolveOptionalAddOn(event);
    let resolvedTierId = String(tierId || '').trim();
    let selected = Boolean(addOnSelected) && Boolean(addOn);

    if (inferMissingTier && !resolvedTierId && event?.pricingMode === 'tiers') {
        const tiers = getSportsTiers(event);
        if (tiers.length === 1) {
            resolvedTierId = tiers[0].id;
        } else if (tiers.length > 1) {
            const expected = Number(expectedTicketTotal);
            if (Number.isFinite(expected) && expected >= 0) {
                const candidates = [];
                for (const tier of tiers) {
                    const fee = Math.max(0, Number(tier.fee) || 0);
                    candidates.push({ tierId: tier.id, addOnSelected: false, total: fee * peopleCount });
                    if (addOn) {
                        candidates.push({
                            tierId: tier.id,
                            addOnSelected: true,
                            total: (fee + addOn.fee) * peopleCount,
                        });
                    }
                }
                const match = candidates.find((c) => c.total === expected);
                if (match) {
                    resolvedTierId = match.tierId;
                    selected = match.addOnSelected;
                }
            }
        }
    }

    const priced = resolveSportsPerPersonFee(event, resolvedTierId);
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
    sanitizeEventAddOns,
    resolveEventAddOns,
    mirrorRegistrationFeeFromTiers,
};
