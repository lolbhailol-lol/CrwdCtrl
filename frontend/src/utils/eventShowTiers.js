/** Client helpers for EventShow custom registration tiers (mirrors sports tiers). */

export {
    createEmptyTier,
    sanitizeSportsTiers as sanitizeEventShowTiers,
    getSportsTiers as getEventShowTiers,
    isTiersPricing as isEventShowTiersPricing,
    findSportsTier as findEventShowTier,
    resolveTierParticipantCount,
    formatInr,
} from './sportsTiers';

import {
    getSportsTiers,
    isTiersPricing,
    findSportsTier,
} from './sportsTiers';

export function resolveEventShowFee(event, tierId) {
    if (isTiersPricing(event)) {
        const tier = findSportsTier(event, tierId);
        if (!tier) return { fee: 0, tier: null, error: 'Please select a registration package.' };
        return { fee: Math.max(0, Number(tier.fee) || 0), tier, error: null };
    }
    return { fee: Math.max(0, Number(event?.ticketPrice) || 0), tier: null, error: null };
}

export function minEventShowFee(event) {
    if (isTiersPricing(event)) {
        const fees = getSportsTiers(event).map((t) => Math.max(0, Number(t.fee) || 0));
        // Include free tiers so events with a free option (e.g. Independence Day Drive) show Free
        return fees.length ? Math.min(...fees) : 0;
    }
    return Math.max(0, Number(event?.ticketPrice) || 0);
}

export function sanitizeEventShowAddOns(list) {
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
        .sort((a, b) => a.order - b.order);
}

export function createEmptyEventShowAddOn(order = 0) {
    return {
        id: `addon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: '',
        description: '',
        vehicles: '',
        fee: 0,
        enabled: true,
        order,
    };
}
