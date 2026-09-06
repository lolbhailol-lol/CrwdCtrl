import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'mindspark_payments_session',
    memoryKey: '__mindsparkPaymentsSession',
});

export const getMindSparkPaymentsSession = session.get;
export const setMindSparkPaymentsSession = session.set;
export const clearMindSparkPaymentsSession = session.clear;
export const getMindSparkPaymentsToken = session.token;
export const isMindSparkPaymentsTokenExpired = session.isExpired;
