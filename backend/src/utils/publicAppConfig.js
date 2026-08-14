/**
 * Typed public app copy / UI configuration.
 * Clients must always merge this over hardcoded defaults — missing keys are safe.
 * Never put secrets, admin fields, or executable content here.
 */

const MAX_LABEL_LEN = 80;
const MAX_EMPTY_LEN = 160;
const MAX_ANNOUNCEMENT_LEN = 280;
const MAX_HREF_LEN = 500;

const DEFAULT_HOME_SECTION_LABELS = {
    ongoing: 'Ongoing Events',
    happening: 'Happening near you',
};

const DEFAULT_HUB_SECTION_LABELS = {
    fests: {
        ongoing: 'Ongoing Events',
        upcoming: 'Upcoming Events',
        lastYearHits: 'Last Year Hits',
        featured: 'Featured Fests',
    },
    treks: {
        communities: 'Explore the Communities',
        weekendPlans: 'Upcoming Weekend Plans',
        browseCategories: 'Browse by Trek Categories',
        beginner: 'Beginner Friendly',
    },
    sports: {
        upcoming: 'Upcoming Activities',
        runClubs: 'Explore Run Clubs',
    },
    events: {
        spotlight: 'In the Spotlight',
        upcoming: 'Upcoming Shows',
        community: 'Community Events',
    },
};

const DEFAULT_EMPTY_STATES = {
    home: {
        happening: 'No events happening near you right now',
    },
    fests: {
        none: 'No fests available yet',
    },
    treks: {
        communities: 'No communities added yet',
        weekendPlans: 'No weekend plans added yet',
        category: 'No treks in this category yet',
        beginner: 'No beginner treks added yet',
    },
    sports: {
        upcoming: 'No upcoming sports activities yet',
        runClubs: 'No run clubs added yet',
    },
    events: {
        spotlight: 'No spotlight events yet',
        upcoming: 'No upcoming shows yet',
        community: 'No community events yet',
    },
};

const DEFAULT_ANNOUNCEMENT = {
    enabled: false,
    text: '',
    href: '',
    dismissible: true,
};

const ALLOWED_PUBLIC_HOSTS = new Set(['crwdctrl.in']);

function clipString(value, maxLen) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/<[^>]*>/g, '').slice(0, maxLen);
}

function pickStringMap(incoming, defaults, maxLen) {
    const out = { ...defaults };
    if (!incoming || typeof incoming !== 'object') return out;
    for (const key of Object.keys(defaults)) {
        if (typeof incoming[key] !== 'string') continue;
        const trimmed = clipString(incoming[key], maxLen);
        if (trimmed) out[key] = trimmed;
    }
    return out;
}

function pickNestedStringMap(incoming, defaults, maxLen) {
    const out = {};
    for (const group of Object.keys(defaults)) {
        out[group] = pickStringMap(incoming?.[group], defaults[group], maxLen);
    }
    return out;
}

/** Relative app paths or https://crwdctrl.in links only. */
function sanitizePublicHref(raw) {
    if (typeof raw !== 'string') return '';
    const href = raw.trim().slice(0, MAX_HREF_LEN);
    if (!href) return '';
    if (href.startsWith('/') && !href.startsWith('//') && !href.includes('://')) {
        return href;
    }
    try {
        const url = new URL(href);
        if (url.protocol !== 'https:') return '';
        const host = url.hostname.replace(/^www\./i, '').toLowerCase();
        if (!ALLOWED_PUBLIC_HOSTS.has(host)) return '';
        return url.toString().slice(0, MAX_HREF_LEN);
    } catch {
        return '';
    }
}

function sanitizeAnnouncement(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const text = clipString(src.text, MAX_ANNOUNCEMENT_LEN);
    return {
        enabled: src.enabled === true && Boolean(text),
        text,
        href: sanitizePublicHref(src.href),
        dismissible: src.dismissible !== false,
    };
}

function buildPublicConfig({ homeLabels, hubLabels, emptyStates, announcement } = {}) {
    const labelsHome = pickStringMap(homeLabels, DEFAULT_HOME_SECTION_LABELS, MAX_LABEL_LEN);
    const labelsHub = pickNestedStringMap(hubLabels, DEFAULT_HUB_SECTION_LABELS, MAX_LABEL_LEN);
    return {
        version: 1,
        labels: {
            home: labelsHome,
            ...labelsHub,
        },
        announcement: sanitizeAnnouncement(announcement),
        emptyStates: pickNestedStringMap(emptyStates, DEFAULT_EMPTY_STATES, MAX_EMPTY_LEN),
    };
}

function normalizeAppCopyWrite(incoming) {
    const src = incoming && typeof incoming === 'object' ? incoming : {};
    const labels = src.labels && typeof src.labels === 'object' ? src.labels : {};
    return {
        homeLabels: pickStringMap(labels.home, DEFAULT_HOME_SECTION_LABELS, MAX_LABEL_LEN),
        hubLabels: pickNestedStringMap(labels, DEFAULT_HUB_SECTION_LABELS, MAX_LABEL_LEN),
        emptyStates: pickNestedStringMap(src.emptyStates, DEFAULT_EMPTY_STATES, MAX_EMPTY_LEN),
        announcement: sanitizeAnnouncement(src.announcement),
    };
}

module.exports = {
    DEFAULT_HOME_SECTION_LABELS,
    DEFAULT_HUB_SECTION_LABELS,
    DEFAULT_EMPTY_STATES,
    DEFAULT_ANNOUNCEMENT,
    MAX_LABEL_LEN,
    MAX_EMPTY_LEN,
    MAX_ANNOUNCEMENT_LEN,
    buildPublicConfig,
    normalizeAppCopyWrite,
    sanitizePublicHref,
    sanitizeAnnouncement,
    pickStringMap,
    pickNestedStringMap,
};
