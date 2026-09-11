/** Community detail page hero — matches ImmersiveHero height="396px" on ~393px mobile width */
export const COMMUNITY_PAGE_HERO = {
    width: 393,
    height: 396,
    aspectId: 'communityBanner',
    preset: 'communityBanner',
    label: 'Community page banner',
    shortLabel: '393 × 396',
};

export function communityPageHeroAspectRatio() {
    return COMMUNITY_PAGE_HERO.width / COMMUNITY_PAGE_HERO.height;
}
