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
        const paid = fees.filter((f) => f > 0);
        if (paid.length) return Math.min(...paid);
        return fees.length ? Math.min(...fees) : 0;
    }
    return Math.max(0, Number(event?.ticketPrice) || 0);
}
