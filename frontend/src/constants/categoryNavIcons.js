/** Optimized category nav icons — 3× WebP (234×255) in /public for early preload. */

const BASE = '/category-icons';

export const CATEGORY_NAV_ICONS = {
  light: {
    fests: `${BASE}/fests-light.webp`,
    sports: `${BASE}/sports-light.webp`,
    treks: `${BASE}/treks-light.webp`,
    events: `${BASE}/events-light.webp`,
  },
  dark: {
    fests: `${BASE}/fests-dark.webp`,
    sports: `${BASE}/sports-dark.webp`,
    treks: `${BASE}/treks-dark.webp`,
    events: `${BASE}/events-dark.webp`,
  },
};

export const ALL_CATEGORY_NAV_ICON_URLS = [
  ...Object.values(CATEGORY_NAV_ICONS.light),
  ...Object.values(CATEGORY_NAV_ICONS.dark),
];

/** Warm browser cache via Image() — does not use <link rel="preload"> (avoids unused-preload console noise). */
export function preloadCategoryNavIcons(isDark) {
  const set = isDark ? CATEGORY_NAV_ICONS.dark : CATEGORY_NAV_ICONS.light;
  Object.values(set).forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}

/** Preload both themes after idle — prefer preloadCategoryNavIcons(current) at boot. */
export function preloadAllCategoryNavIcons() {
  ALL_CATEGORY_NAV_ICON_URLS.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}

export function getCategoryNavIcon(categoryId, isDark) {
  const set = isDark ? CATEGORY_NAV_ICONS.dark : CATEGORY_NAV_ICONS.light;
  return set[categoryId] ?? set.fests;
}
