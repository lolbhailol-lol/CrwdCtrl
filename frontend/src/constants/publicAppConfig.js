/** Client defaults for public app copy. Must match backend/src/utils/publicAppConfig.js. */
export const DEFAULT_PUBLIC_CONFIG = {
  version: 1,
  labels: {
    home: {
      ongoing: 'Ongoing Events',
      happening: 'Happening near you',
    },
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
  },
  announcement: {
    enabled: false,
    text: '',
    href: '',
    dismissible: true,
  },
  emptyStates: {
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
  },
};

function mergeGroup(defaults, incoming) {
  if (!incoming || typeof incoming !== 'object') return { ...defaults };
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (typeof incoming[key] === 'string' && incoming[key].trim()) {
      out[key] = incoming[key].trim();
    }
  }
  return out;
}

function mergeNested(defaults, incoming) {
  const out = {};
  for (const group of Object.keys(defaults)) {
    out[group] = mergeGroup(defaults[group], incoming?.[group]);
  }
  return out;
}

/** Merge a partial API payload over defaults. Never throws. Extra keys ignored. */
export function mergePublicConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const labelsIn = src.labels && typeof src.labels === 'object' ? src.labels : {};
  const announcementIn = src.announcement && typeof src.announcement === 'object' ? src.announcement : {};
  return {
    version: 1,
    labels: mergeNested(DEFAULT_PUBLIC_CONFIG.labels, labelsIn),
    announcement: {
      enabled: announcementIn.enabled === true && Boolean(String(announcementIn.text || '').trim()),
      text: typeof announcementIn.text === 'string' ? announcementIn.text.trim() : '',
      href: typeof announcementIn.href === 'string' ? announcementIn.href.trim() : '',
      dismissible: announcementIn.dismissible !== false,
    },
    emptyStates: mergeNested(DEFAULT_PUBLIC_CONFIG.emptyStates, src.emptyStates),
  };
}
