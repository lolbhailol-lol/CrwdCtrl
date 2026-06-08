import { useDarkMode } from '../context/DarkModeContext';
import HomeCarouselCardsSkeleton, {
    HeroBannerSkeleton,
    FestCardsRowSkeleton,
    FestSubpageLoadingSkeleton,
    CompactPortraitCardsRowSkeleton,
    WideActivityCardsRowSkeleton,
} from './HomeEventCardSkeleton';

function Block({ className = '', isDark }) {
    return (
        <div
            className={`skeleton-shimmer rounded-2xl ${isDark ? 'skeleton-shimmer-dark' : 'skeleton-shimmer-light'} ${className}`}
        />
    );
}

function MobileHeaderSkeleton({ isDark }) {
    return (
        <div
            className={`mobile-header-inner lg:hidden rounded-b-[16px] px-4 pb-3 ${isDark ? 'bg-[#0D0E10]' : 'bg-[#F2F4F7]'}`}
        >
            <div className="mb-1 flex items-center justify-between">
                <Block isDark={isDark} className="h-16 w-28 rounded-xl" />
                <div className="flex gap-2">
                    <Block isDark={isDark} className="h-10 w-10 rounded-xl" />
                    <Block isDark={isDark} className="h-10 w-10 rounded-xl" />
                </div>
            </div>
            <Block isDark={isDark} className="mb-3.5 h-12 w-full rounded-full" />
            <div className="flex justify-between gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Block key={i} isDark={isDark} className="h-[72px] flex-1 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

function SectionHeadingSkeleton({ isDark, width = 'w-36', className = '' }) {
    return <Block isDark={isDark} className={`mb-4 h-6 ${width} ${className}`} />;
}

function HorizontalCardsSkeleton({ count = 2, tallCard = false, wideCard = false }) {
    return (
        <HomeCarouselCardsSkeleton
            count={count}
            tallCard={tallCard}
            wideCard={wideCard}
        />
    );
}

function SubcategoryGridSkeleton({ isDark }) {
    return (
        <div className="mb-6 grid grid-cols-3 gap-3 px-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 py-4">
                    <Block isDark={isDark} className="h-[85px] w-[96px] rounded-2xl" />
                    <Block isDark={isDark} className="h-3 w-14 rounded-full" />
                </div>
            ))}
        </div>
    );
}

function CategoryTilesSkeleton({ isDark }) {
    return <SubcategoryGridSkeleton isDark={isDark} />;
}

function DetailPageSkeleton({ isDark }) {
    return (
        <div className="px-4 pt-4">
            <Block isDark={isDark} className="mb-4 h-[220px] w-full rounded-2xl" />
            <Block isDark={isDark} className="mb-3 h-7 w-4/5" />
            <Block isDark={isDark} className="mb-6 h-5 w-1/2" />
            <div className="mb-6 flex gap-2">
                <Block isDark={isDark} className="h-8 w-24 rounded-full" />
                <Block isDark={isDark} className="h-8 w-24 rounded-full" />
            </div>
            <Block isDark={isDark} className="mb-3 h-4 w-full" />
            <Block isDark={isDark} className="mb-3 h-4 w-full" />
            <Block isDark={isDark} className="mb-3 h-4 w-5/6" />
            <Block isDark={isDark} className="h-4 w-2/3" />
        </div>
    );
}

function ListPageSkeleton({ isDark }) {
    return (
        <div className="space-y-4 px-4 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    <Block isDark={isDark} className="h-20 w-20 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2 pt-1">
                        <Block isDark={isDark} className="h-5 w-4/5" />
                        <Block isDark={isDark} className="h-4 w-3/5" />
                        <Block isDark={isDark} className="h-4 w-2/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProfilePageSkeleton({ isDark }) {
    return (
        <div className="px-4 pt-6">
            <div className="mb-8 flex flex-col items-center">
                <Block isDark={isDark} className="mb-4 h-24 w-24 rounded-full" />
                <Block isDark={isDark} className="mb-2 h-6 w-40" />
                <Block isDark={isDark} className="h-4 w-28" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Block key={i} isDark={isDark} className="h-14 w-full rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

function getSkeletonVariant(pathname) {
    if (pathname === '/') return 'home';
    if (
        pathname === '/fests' ||
        pathname.endsWith('-fest') ||
        pathname === '/sports' ||
        pathname === '/treks' ||
        pathname === '/theatre'
    ) {
        return 'category';
    }
    if (
        pathname.startsWith('/view-details') ||
        pathname.startsWith('/trek/') ||
        pathname.startsWith('/competitions-view-details') ||
        pathname.startsWith('/treks/community/')
    ) {
        return 'detail';
    }
    if (
        pathname === '/profile' ||
        pathname.startsWith('/edit-profile') ||
        pathname === '/booking' ||
        pathname === '/favorites' ||
        pathname === '/help-center' ||
        pathname === '/notifications' ||
        pathname === '/list-your-fest'
    ) {
        return 'profile';
    }
    return 'list';
}

export default function PageTransitionSkeleton({ pathname }) {
    const { isDark } = useDarkMode();
    const variant = getSkeletonVariant(pathname);

    return (
        <div
            className={`fixed inset-0 z-100000 overflow-y-auto overscroll-none ${
                isDark ? 'bg-[#161718]' : 'bg-white'
            }`}
            aria-hidden
            role="presentation"
        >
            {(variant === 'home' || variant === 'category') && (
                <MobileHeaderSkeleton isDark={isDark} />
            )}

            <div className="pb-8 pt-4 lg:pt-6">
                {variant === 'home' && (
                    <>
                        <HeroBannerSkeleton />
                        <div className="mb-6">
                            <SectionHeadingSkeleton isDark={isDark} width="w-32" className="px-4" />
                            <HorizontalCardsSkeleton count={2} tallCard />
                        </div>
                        <div className="mb-6">
                            <SectionHeadingSkeleton isDark={isDark} width="w-44" className="px-4" />
                            <HorizontalCardsSkeleton count={2} wideCard />
                        </div>
                    </>
                )}

                {variant === 'category' && pathname === '/fests' && (
                    <>
                        <HeroBannerSkeleton />
                        <div className="mb-6 px-4 lg:px-10">
                            <SectionHeadingSkeleton isDark={isDark} width="w-28" />
                            <CategoryTilesSkeleton isDark={isDark} />
                        </div>
                        <div className="mb-6 px-4 lg:px-10">
                            <SectionHeadingSkeleton isDark={isDark} width="w-36" />
                            <FestCardsRowSkeleton count={2} />
                        </div>
                        <div className="mb-6 px-4 lg:px-10">
                            <SectionHeadingSkeleton isDark={isDark} width="w-40" />
                            <FestCardsRowSkeleton count={2} />
                        </div>
                    </>
                )}

                {variant === 'category' && pathname === '/treks' && (
                    <>
                        <HeroBannerSkeleton className="mb-6 px-4" />
                        <div className="mb-6">
                            <SectionHeadingSkeleton isDark={isDark} width="w-52" className="px-4" />
                            <CompactPortraitCardsRowSkeleton count={3} />
                        </div>
                        <div className="mb-6">
                            <SectionHeadingSkeleton isDark={isDark} width="w-48" className="px-4" />
                            <WideActivityCardsRowSkeleton count={2} />
                        </div>
                        <div className="mb-6">
                            <SectionHeadingSkeleton isDark={isDark} width="w-40" className="px-4" />
                            <CompactPortraitCardsRowSkeleton count={3} />
                        </div>
                    </>
                )}

                {variant === 'category' && pathname === '/sports' && (
                    <>
                        <div className="mb-6">
                            <SectionHeadingSkeleton isDark={isDark} width="w-44" className="px-4" />
                            <WideActivityCardsRowSkeleton count={2} className="mx-auto px-4" />
                        </div>
                        <div className="mb-6">
                            <SectionHeadingSkeleton isDark={isDark} width="w-40" className="px-4" />
                            <CompactPortraitCardsRowSkeleton count={3} withShare={false} />
                        </div>
                    </>
                )}

                {variant === 'category' && pathname.endsWith('-fest') && (
                    <FestSubpageLoadingSkeleton listedCount={2} />
                )}

                {variant === 'category'
                    && pathname !== '/fests'
                    && pathname !== '/treks'
                    && pathname !== '/sports'
                    && !pathname.endsWith('-fest') && (
                    <>
                        <HeroBannerSkeleton />
                        <SectionHeadingSkeleton isDark={isDark} className="px-4" />
                        <CategoryTilesSkeleton isDark={isDark} />
                        <div className="mb-2 px-4">
                            <SectionHeadingSkeleton isDark={isDark} width="w-40" />
                        </div>
                        <FestCardsRowSkeleton count={2} className="px-4" />
                    </>
                )}

                {variant === 'detail' && <DetailPageSkeleton isDark={isDark} />}
                {variant === 'profile' && <ProfilePageSkeleton isDark={isDark} />}
                {variant === 'list' && <ListPageSkeleton isDark={isDark} />}
            </div>
        </div>
    );
}
