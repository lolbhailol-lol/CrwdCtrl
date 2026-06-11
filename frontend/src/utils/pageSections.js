/** Target pages for custom scrolling sections. */
export const TARGET_PAGE_OPTIONS = [
    { value: 'home', label: 'Homepage', route: '/', description: 'Main landing page' },
    { value: 'fests', label: 'All Fests', route: '/fests', description: 'Fests discovery page' },
    { value: 'cultural-fest', label: 'Cultural Fests', route: '/cultural-fest', description: 'Cultural fest category' },
    { value: 'tech-fest', label: 'Tech Fests', route: '/tech-fest', description: 'Technical fest category' },
    { value: 'sports-fest', label: 'Sports Fests', route: '/sports-fest', description: 'Sports fest category' },
    { value: 'treks', label: 'Treks', route: '/treks', description: 'Treks & communities page' },
    { value: 'sports', label: 'Sports', route: '/sports', description: 'Run clubs & activities' },
    { value: 'theatre', label: 'Theatre', route: '/theatre', description: 'Theatre shows page' },
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

/** Build updated customPageSections array for a target page. */
export function setCustomPageSection(entity, targetPage, sectionSlug, priority = 999) {
    const rest = (entity.customPageSections || []).filter((a) => a.page !== targetPage);
    if (!sectionSlug) return rest;
    return [...rest, { page: targetPage, sectionSlug, priority }];
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
