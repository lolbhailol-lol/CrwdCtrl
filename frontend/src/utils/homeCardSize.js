/** Card size presets — each maps to a real section style on the live site. */
export const CARD_SIZE_OPTIONS = [
    {
        value: 'trending',
        label: 'Same as Ongoing Events',
        shortLabel: 'Ongoing Events',
        description: 'Tall carousel cards on home',
        reference: 'Ongoing Events',
        siteSection: 'Home',
    },
    {
        value: 'hero',
        label: 'Same as Hero Banner',
        shortLabel: 'Hero Banner',
        description: 'Wide banner-style slide (2:1)',
        reference: 'Hero Banner',
        siteSection: 'Home · Featured',
    },
    {
        value: 'wide',
        label: 'Same as Upcoming Weekend Plans',
        shortLabel: 'Weekend Plans',
        description: 'Wide activity cards · Treks page',
        reference: 'Upcoming Weekend Plans',
        siteSection: 'Treks',
    },
    {
        value: 'explore',
        label: 'Same as Explore Communities',
        shortLabel: 'Explore Communities',
        description: 'Portrait cards · Treks page',
        reference: 'Explore Communities',
        siteSection: 'Treks',
    },
    {
        value: 'runclub',
        label: 'Same as Explore Run Clubs',
        shortLabel: 'Run Clubs',
        description: 'Portrait cards · Sports page',
        reference: 'Explore Run Clubs',
        siteSection: 'Sports',
    },
];

/** @deprecated Legacy sizes — still render on existing sections */
export const LEGACY_CARD_SIZE_VALUES = ['mini', 'default'];

export function getCardSizeProps(cardSize) {
    switch (cardSize) {
        case 'trending':
            // Ongoing Events style — centered snap carousel on mobile
            return { tallCard: true, wideCard: false, miniCard: false, portraitCard: false, heroCard: false, alignStart: false };
        case 'hero':
            return { tallCard: false, wideCard: true, miniCard: false, portraitCard: false, heroCard: true, alignStart: false };
        case 'wide':
            // Weekend Plans style — normal left-to-right scroll (not centered)
            return { tallCard: false, wideCard: true, miniCard: false, portraitCard: false, heroCard: false, alignStart: true };
        case 'mini':
            return { tallCard: true, wideCard: false, miniCard: true, portraitCard: false, heroCard: false, alignStart: true };
        case 'explore':
        case 'runclub':
            // Explore Communities / Run Clubs — normal left-to-right scroll (not centered)
            return { tallCard: false, wideCard: false, miniCard: false, portraitCard: true, heroCard: false, alignStart: true };
        default:
            return { tallCard: false, wideCard: false, miniCard: false, portraitCard: false, heroCard: false, alignStart: true };
    }
}

export function getCardSizeLabel(cardSize) {
    return CARD_SIZE_OPTIONS.find((o) => o.value === cardSize)?.label
        || (cardSize === 'mini' ? 'Mini narrow' : cardSize === 'default' ? 'Standard carousel' : cardSize);
}

export function getCardSizeShortLabel(cardSize) {
    return CARD_SIZE_OPTIONS.find((o) => o.value === cardSize)?.shortLabel
        || (cardSize === 'mini' ? 'Mini' : cardSize === 'default' ? 'Standard' : cardSize);
}

