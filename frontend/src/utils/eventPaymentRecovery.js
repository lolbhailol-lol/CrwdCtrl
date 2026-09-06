import { getPendingPayment } from './deepLinks';

const EVENT_PAY_DRAFT_PREFIX = 'crwdctrl_event_pay_draft_';
const EVENT_REG_DRAFT_PREFIX = 'event_reg_draft_';
const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

function writeBoth(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

function readEither(key) {
  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeBoth(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function eventRegDraftKey(eventId) {
  return `${EVENT_REG_DRAFT_PREFIX}${eventId}`;
}

export function eventPayDraftKey(orderId) {
  return `${EVENT_PAY_DRAFT_PREFIX}${orderId}`;
}

/** Persist form answers for post-GPay recovery (local + session). */
export function saveEventRegistrationDraft(eventId, {
  values,
  tierId,
  selectedAddOnIds,
  couponCode,
} = {}) {
  if (!eventId) return;
  const payload = JSON.stringify({
    values: values || {},
    tierId: tierId || '',
    selectedAddOnIds: Array.isArray(selectedAddOnIds) ? selectedAddOnIds : [],
    couponCode: couponCode || '',
    eventShowId: String(eventId),
    ts: Date.now(),
  });
  writeBoth(eventRegDraftKey(eventId), payload);
}

export function loadEventRegistrationDraft(eventId) {
  if (!eventId) return null;
  const parsed = safeParse(readEither(eventRegDraftKey(eventId)));
  if (!parsed?.ts || Date.now() - parsed.ts > DRAFT_MAX_AGE_MS) {
    clearEventRegistrationDraft(eventId);
    return null;
  }
  return parsed;
}

export function clearEventRegistrationDraft(eventId) {
  if (!eventId) return;
  removeBoth(eventRegDraftKey(eventId));
}

/** Link draft to a Cashfree orderId for PaymentReturn / bookings recovery. */
export function saveEventPayDraft(orderId, draft) {
  if (!orderId || !draft) return;
  const payload = JSON.stringify({
    ...draft,
    orderId,
    ts: Date.now(),
  });
  writeBoth(eventPayDraftKey(orderId), payload);
}

export function loadEventPayDraft(orderId) {
  if (!orderId) return null;
  const parsed = safeParse(readEither(eventPayDraftKey(orderId)));
  if (!parsed?.ts || Date.now() - parsed.ts > DRAFT_MAX_AGE_MS) {
    clearEventPayDraft(orderId);
    return null;
  }
  return parsed;
}

export function clearEventPayDraft(orderId) {
  if (!orderId) return;
  removeBoth(eventPayDraftKey(orderId));
}

export function clearEventPaymentArtifacts(eventId, orderId) {
  clearEventRegistrationDraft(eventId);
  if (orderId) clearEventPayDraft(orderId);
}

/** Scan localStorage for recoverable event payment drafts. */
export function listRecoverableEventPayDrafts() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(EVENT_PAY_DRAFT_PREFIX)) continue;
      const orderId = key.slice(EVENT_PAY_DRAFT_PREFIX.length);
      const draft = loadEventPayDraft(orderId);
      if (draft) out.push({ orderId: draft.orderId || orderId, draft });
    }
  } catch {
    /* ignore */
  }
  const pending = getPendingPayment();
  if (pending?.orderId && pending.returnPath?.includes('/events/')) {
    const already = out.some((x) => x.orderId === pending.orderId);
    if (!already) {
      const eventId = (pending.returnPath.match(/\/events\/([^/]+)\/register/) || [])[1];
      const draft = loadEventPayDraft(pending.orderId) || loadEventRegistrationDraft(eventId);
      if (draft) out.push({ orderId: pending.orderId, draft: { ...draft, eventShowId: draft.eventShowId || eventId } });
    }
  }
  return out;
}

/**
 * Complete event registration after payment via pay-and-register (idempotent).
 */
export async function completeEventPayAndRegister({
  apiBase,
  token,
  eventShowId,
  orderId,
  responses = {},
  tierId = '',
  selectedAddOnIds = [],
  couponCode = '',
}) {
  const res = await fetch(`${apiBase}/registrations/events/${eventShowId}/pay-and-register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      payment_order_id: orderId,
      responses,
      tierId: tierId || undefined,
      selectedAddOnIds,
      couponCode: couponCode || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Registration failed after payment');
  return data;
}
