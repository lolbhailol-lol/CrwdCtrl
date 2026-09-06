/** Target pages for custom scrolling sections. */
export const TARGET_PAGE_OPTIONS = [
    { value: 'home', label: 'Homepage', route: '/', description: 'Main landing page' },
    { value: 'fests', label: 'All Fests', route: '/fests', description: 'Fests discovery page' },
    { value: 'cultural-fest', label: 'Cultural Fests', route: '/cultural-fest', description: 'Cultural fest category' },
    { value: 'tech-fest', label: 'Tech Fests', route: '/tech-fest', description: 'Technical fest category' },
    { value: 'sports-fest', label: 'Sports Fests', route: '/sports-fest', description: 'Sports fest category' },
    { value: 'treks', label: 'Treks', route: '/treks', description: 'Treks & communities page' },
    { value: 'sports', label: 'Sports', route: '/sports', description: 'Run clubs & activities' },
    { value: 'events', label: 'Events', route: '/events', description: 'Events & shows page' },
];

export function getTargetPageLabel(targetPage) {
    return TARGET_PAGE_OPTIONS.find((o) => o.value === targetPage)?.label || targetPage;
}

export function getCustomSectionAssignment(entity, targetPage) {
    if (targetPage === 'home') return null;
    return (entity.customPageSections || []).find((a) => a.page === targetPage) || null;
}

export function getEntitySectionValue(entity, targetPage, { festSlide = false } = {}) {
    if (targetPage === 'home') {
        if (festSlide && entity.showOnHomeSlide) return 'movingSlide';
        return entity.homeSection || '';
    }
    return getCustomSectionAssignment(entity, targetPage)?.sectionSlug || '';
}

export function getEntitySectionPriority(entity, targetPage) {
    if (targetPage === 'home') {
        return entity.homePriority ?? entity.priority ?? 999;
    }
    return getCustomSectionAssignment(entity, targetPage)?.priority ?? 999;
}

/** Build updated customPageSections array for a target page (single slug — legacy). */
export function setCustomPageSection(entity, targetPage, sectionSlug, priority = 999) {
    const rest = (entity.customPageSections || []).filter((a) => a.page !== targetPage);
    if (!sectionSlug) return rest;
    return [...rest, { page: targetPage, sectionSlug, priority }];
}

/** All assignment keys `page:slug` for the given pages (supports many). */
export function getCustomPageAssignmentKeys(entity, pages = []) {
    return (entity.customPageSections || [])
        .filter((a) => pages.includes(a.page))
        .map((a) => `${a.page}:${a.sectionSlug}`);
}

/** Toggle one custom section assignment without wiping other pages/sections. */
export function toggleCustomPageAssignment(entity, page, sectionSlug, checked, priority = 999) {
    const list = [...(entity.customPageSections || [])];
    const next = list.filter((a) => !(a.page === page && a.sectionSlug === sectionSlug));
    if (checked) {
        next.push({ page, sectionSlug, priority });
    }
    return next;
}

/**
 * Home carousel memberships (built-in + custom), multi-select friendly.
 * All checked home slugs live in customPageSections (page:'home') so one item
 * can appear in many carousels; homeSection keeps a legacy primary value.
 */
export function getHomeAssignmentSlugs(entity) {
    const slugs = new Set();
    const home = entity?.homeSection;
    if (home && home !== 'slide' && home !== 'movingSlide') slugs.add(home);
    (entity?.customPageSections || []).forEach((a) => {
        if (a.page === 'home' && a.sectionSlug && a.sectionSlug !== 'slide' && a.sectionSlug !== 'movingSlide') {
            slugs.add(a.sectionSlug);
        }
    });
    return [...slugs];
}

/** True when entity is on the home hero banner (incl. legacy run-club homeSection:'slide'). */
export function isOnHomeHero(entity) {
    if (!entity) return false;
    if (entity.showOnHomeSlide) return true;
    return entity.homeSection === 'slide';
}

export function applyHomeAssignmentSlugs(entity, slugs, { showOnHomeSlide = false } = {}) {
    const unique = [...new Set((slugs || []).filter((s) => s && s !== 'slide' && s !== 'movingSlide'))];
    const builtIn = unique.find((s) => s === 'trending' || s === 'happening') || null;
    const rest = (entity.customPageSections || []).filter((a) => a.page !== 'home');
    const homeEntries = unique.map((sectionSlug) => ({
        page: 'home',
        sectionSlug,
        priority: 999,
    }));
    // Legacy run clubs used homeSection:'slide' — clear that when using the boolean flag
    let homeSection = builtIn || unique[0] || null;
    if (homeSection === 'slide') homeSection = null;
    return {
        homeSection,
        showOnHomeSlide: Boolean(showOnHomeSlide),
        customPageSections: [...rest, ...homeEntries],
    };
}

export function groupSectionsByPage(sections) {
    const grouped = {};
    TARGET_PAGE_OPTIONS.forEach(({ value }) => { grouped[value] = []; });
    (sections || []).forEach((section) => {
        const page = section.targetPage || 'home';
        if (!grouped[page]) grouped[page] = [];
        grouped[page].push(section);
    });
    return grouped;
}
