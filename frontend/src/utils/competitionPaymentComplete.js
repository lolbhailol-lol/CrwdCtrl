import { API_BASE_URL } from '../services/api/client';
import { extractDraftTextResponses } from './registrationDraft';

/**
 * Guaranteed registration after a verified Cashfree payment.
 * Uses pay-and-register so the user always gets a booking/ticket even when
 * the full form re-submit fails (e.g. file inputs lost after redirect checkout).
 * Draft text responses are included so registration details show what they filled.
 */
export async function payAndRegisterCompetition(competitionId, verifiedFields, token, draft = null) {
    const responses = extractDraftTextResponses(draft);
    const regRes = await fetch(`${API_BASE_URL}/registrations/competitions/${competitionId}/pay-and-register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            payment_order_id: verifiedFields.payment_order_id,
            payment_id: verifiedFields.payment_id,
            ...(Object.keys(responses).length > 0 ? { responses } : {}),
        }),
    });
    const regData = await regRes.json().catch(() => ({}));
    if (!regRes.ok) {
        throw new Error(regData.error || regData.message || 'Registration failed after payment.');
    }
    return regData._id || regData.registration?._id || regData.registrationId || null;
}

/**
 * Try full form submission first (preserves answers when possible).
 * Falls back to pay-and-register so payment never ends on a dead form screen.
 */
export async function finalizeCompetitionAfterPayment({
    competitionId,
    verifiedFields,
    token,
    draft = null,
    tryFormSubmit,
}) {
    if (typeof tryFormSubmit === 'function') {
        try {
            const regId = await tryFormSubmit();
            if (regId) return { regId, via: 'form' };
        } catch (err) {
            console.warn(
                '[finalizeCompetitionAfterPayment] form submit failed, using pay-and-register:',
                err?.message || err,
            );
        }
    }

    const regId = await payAndRegisterCompetition(competitionId, verifiedFields, token, draft);
    return { regId, via: 'pay-and-register' };
}
