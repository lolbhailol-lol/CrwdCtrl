/**
 * WhatsApp click-to-chat helpers (no WhatsApp API).
 * Opens the organizer's installed WhatsApp with a prefilled message.
 */

export function normalizeWhatsAppPhone(raw, defaultCountryCode = '91') {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `${defaultCountryCode}${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) {
        return `${defaultCountryCode}${digits.slice(1)}`;
    }
    if (digits.length >= 12 && digits.startsWith(defaultCountryCode)) {
        return digits.slice(0, 12);
    }
    return digits;
}

export function isValidWhatsAppPhone(raw) {
    const normalized = normalizeWhatsAppPhone(raw);
    return /^\d{10,15}$/.test(normalized);
}

export function buildWhatsAppUrl(phone, text = '') {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) return '';
    const base = `https://wa.me/${normalized}`;
    const trimmed = String(text || '').trim();
    if (!trimmed) return base;
    return `${base}?text=${encodeURIComponent(trimmed)}`;
}

export function openWhatsApp(phone, text = '') {
    const url = buildWhatsAppUrl(phone, text);
    if (!url) return false;
    if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    return true;
}

function firstName(name = '') {
    const part = String(name || '').trim().split(/\s+/)[0];
    return part || '';
}

function trekLabel({ trekName, trekDate } = {}) {
    const name = trekName || 'the trek';
    if (trekDate) return `${name} (${trekDate})`;
    return name;
}

export const WHATSAPP_PRESETS = [
    {
        id: 'reminder',
        label: 'Trek reminder',
        build: ({ name, trekName, trekDate, meetingPoint } = {}) => {
            const who = firstName(name);
            const trek = trekLabel({ trekName, trekDate });
            const meet = meetingPoint ? ` Meeting point: ${meetingPoint}.` : '';
            return `Hi${who ? ` ${who}` : ''}! Reminder about ${trek}. Please arrive on time with your QR ticket.${meet}`;
        },
    },
    {
        id: 'meeting',
        label: 'Meeting point',
        build: ({ name, trekName, trekDate, meetingPoint } = {}) => {
            const who = firstName(name);
            const trek = trekLabel({ trekName, trekDate });
            const meet = meetingPoint
                ? ` Meeting point: ${meetingPoint}.`
                : ' Sharing the meeting point / reporting time.';
            return `Hi${who ? ` ${who}` : ''}!${meet} For ${trek} — please confirm once you see this.`;
        },
    },
    {
        id: 'thanks',
        label: 'Thanks for joining',
        build: ({ name, trekName } = {}) => {
            const who = firstName(name);
            return `Hi${who ? ` ${who}` : ''}! Thanks for joining ${trekName || 'us'}. Hope you had a great time — see you on the next one!`;
        },
    },
    {
        id: 'payment',
        label: 'Payment follow-up',
        build: ({ name, trekName, trekDate } = {}) => {
            const who = firstName(name);
            const trek = trekLabel({ trekName, trekDate });
            return `Hi${who ? ` ${who}` : ''}! Just checking on the payment for ${trek}. Please share the screenshot when ready.`;
        },
    },
    {
        id: 'custom',
        label: 'Custom message',
        build: () => '',
    },
];

export function whatsappCustomStorageKey(communityId = '') {
    return `trek_org_wa_custom_${communityId || 'default'}`;
}

export function loadSavedWhatsAppCustom(communityId = '') {
    if (typeof window === 'undefined') return '';
    try {
        return localStorage.getItem(whatsappCustomStorageKey(communityId)) || '';
    } catch {
        return '';
    }
}

export function saveWhatsAppCustom(communityId = '', text = '') {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(whatsappCustomStorageKey(communityId), String(text || ''));
    } catch {
        /* ignore quota */
    }
}
