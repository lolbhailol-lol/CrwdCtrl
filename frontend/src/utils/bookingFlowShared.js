import { getPendingPayment, shouldResumePendingPayment } from './deepLinks';
import {
    openCashfreeCheckout,
    buildVerifiedPaymentFields,
    classifyCheckoutError,
} from './useCashfree';
import { prepareLogin, currentAppPath } from './loginFlow';

function readSessionDraft(draftKey) {
    if (!draftKey) return {};
    const raw = sessionStorage.getItem(draftKey);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/** Pick the first valid booking step (> 0); ignores NaN from Number(undefined). */
function positiveStep(...candidates) {
    for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
}

export function registrationIdFromVerifyPayload(data) {
    if (!data || typeof data !== 'object') return null;
    return data.registrationId
        || data.registration_id
        || data.registration?._id
        || data.registration?.id
        || null;
}

/**
 * Shared draft + pending-payment bootstrap for booking pages.
 */
export function getInitialBookingUiState({
    entityId,
    search,
    returnPath,
    defaults,
    draftKeyFactory,
    restoreStepFromDraft = true,
}) {
    const safeDefaults = defaults || {};
    if (!entityId || typeof draftKeyFactory !== 'function') return safeDefaults;

    const draft = readSessionDraft(draftKeyFactory(entityId));
    const pending = getPendingPayment();
    const resuming = shouldResumePendingPayment(pending, returnPath, search);

    if (resuming) {
        const resumeStep = positiveStep(
            draft.confirmStep,
            safeDefaults.confirmStep,
            draft.step,
        ) || 3;
        return {
            ...safeDefaults,
            step: resumeStep,
            payDone: false,
            paying: true,
            selDate: draft.selDate || safeDefaults.selDate || '',
            selTime: draft.selTime || safeDefaults.selTime || '',
            people: Math.max(1, Number(draft.people) || Number(safeDefaults.people) || 1),
            extraFields: draft.extraFields || safeDefaults.extraFields || {},
            tierId: draft.tierId || safeDefaults.tierId || '',
            addOnSelected: Boolean(draft.addOnSelected ?? safeDefaults.addOnSelected),
            bookingGender: draft.bookingGender || safeDefaults.bookingGender || '',
        };
    }

    return {
        ...safeDefaults,
        step: restoreStepFromDraft ? Number(draft.step) || Number(safeDefaults.step) || 1 : Number(safeDefaults.step) || 1,
        payDone: false,
        paying: false,
        selDate: draft.selDate || safeDefaults.selDate || '',
        selTime: draft.selTime || safeDefaults.selTime || '',
        people: Math.max(1, Number(draft.people) || Number(safeDefaults.people) || 1),
        extraFields: draft.extraFields || safeDefaults.extraFields || {},
        tierId: draft.tierId || safeDefaults.tierId || '',
        addOnSelected: Boolean(draft.addOnSelected ?? safeDefaults.addOnSelected),
        bookingGender: draft.bookingGender || safeDefaults.bookingGender || '',
    };
}

export function createAuthModalHandlers({ setShowLogin, setShowRegister }) {
    return {
        handleCloseLogin: () => setShowLogin(false),
        handleCloseRegister: () => setShowRegister(false),
        handleSwitchToRegister: () => {
            setShowLogin(false);
            setShowRegister(true);
        },
        handleSwitchToLogin: () => {
            setShowRegister(false);
            prepareLogin({ returnPath: currentAppPath() });
            setShowLogin(true);
        },
    };
}

/**
 * Shared Cashfree checkout + verification pipeline for booking pages.
 */
export async function runCashfreeCheckoutAndVerify({
    order,
    returnPath,
    entityType,
    cashfreeMode,
    verifyOrder,
    customerEmail = '',
}) {
    let checkoutResult;
    try {
        checkoutResult = await openCashfreeCheckout({
            paymentSessionId: order.paymentSessionId,
            orderId: order.orderId,
            returnPath,
            entityType,
            cashfreeMode,
            customerEmail,
        });
    } catch (checkoutErr) {
        const { kind, message } = classifyCheckoutError(checkoutErr);
        return {
            status: kind === 'cancelled' ? 'cancelled' : 'checkout_error',
            message,
        };
    }

    if (checkoutResult?.redirectDeferred) {
        return { status: 'redirect_deferred' };
    }

    const checkoutPaymentId =
        checkoutResult?.paymentDetails?.paymentId ||
        checkoutResult?.paymentDetails?.cf_payment_id ||
        '';

    const verification = await verifyOrder({
        orderId: order.orderId,
        paymentId: checkoutPaymentId,
    });

    const verifiedPayload = verification?.data || verification;
    if (verification?.ok && verifiedPayload?.verified) {
        const verified = buildVerifiedPaymentFields(verifiedPayload, order.orderId);
        const registrationId = registrationIdFromVerifyPayload(verifiedPayload);
        return {
            status: 'verified',
            verified,
            checkoutPaymentId,
            registrationId,
        };
    }

    return {
        status: 'verify_failed',
        message: verifiedPayload?.message || 'Payment verification failed. Contact support.',
    };
}

export function setPaymentFlowToStepTwo({ setStep, setPayDone, setPaying, setError, message = '', step = 2 }) {
    setStep(step);
    setPayDone(false);
    setPaying(false);
    if (typeof message === 'string') setError(message);
}

export function setPaymentFlowToSuccess({ setPayDone, setPaying, setError }) {
    setPayDone(true);
    setPaying(false);
    if (typeof setError === 'function') setError('');
}

