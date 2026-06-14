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
            return { tallCard: true, wideCard: false, miniCard: false, portraitCard: false, heroCard: false };
        case 'hero':
            return { tallCard: false, wideCard: true, miniCard: false, portraitCard: false, heroCard: true };
        case 'wide':
            return { tallCard: false, wideCard: true, miniCard: false, portraitCard: false, heroCard: false };
        case 'mini':
            return { tallCard: true, wideCard: false, miniCard: true, portraitCard: false, heroCard: false };
        case 'explore':
        case 'runclub': {
            return { tallCard: false, wideCard: false, miniCard: false, portraitCard: true, heroCard: false };
        }
        default:
            return { tallCard: false, wideCard: false, miniCard: false, portraitCard: false, heroCard: false };
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

