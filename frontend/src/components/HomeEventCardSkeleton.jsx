import { useEffect, useRef } from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import {
    HOME_CARD_GAP,
    getHomeCardFallbackWidth,
    useCenteredCarouselSidePad,
    useMeasuredCardWidth,
    scrollCarouselToSlide,
} from '../hooks/useHomeCarousel';
export const FEST_CARD_GAP = 12;
export const PORTRAIT_CARD_GAP = 16;
export const WIDE_CARD_GAP = 16;
/** Center card + peek on both sides — matches live home carousel */
export const CENTERED_SKELETON_COUNT = 3;

function Shimmer({ className = '' }) {
    const { isDark } = useDarkMode();
    return (
        <div
            className={`skeleton-shimmer block ${
                isDark ? 'skeleton-shimmer-dark' : 'skeleton-shimmer-light'
            } ${className}`}
        />
    );
}

function CardsRow({ count, gap, className = '', children }) {
    return (
        <div
            className={`flex w-max overflow-x-auto pb-1 scrollbar-hide ${className}`}
            style={{ gap }}
        >
            {Array.from({ length: count }).map((_, index) => children(index))}
        </div>
    );
}

function getSkeletonWidthClass({ wideCard, miniCard, portraitCard }) {
    if (portraitCard) return 'card-portrait';
    if (wideCard) return 'card-carousel-wide';
    if (miniCard) return 'card-carousel-sm';
    return 'card-carousel';
}

/* ── Home carousel cards ── */
export function HomeEventCardSkeleton({ tallCard = false, wideCard = false, miniCard = false, portraitCard = false, heroCard = false }) {
    const isTrendingCard = tallCard && !wideCard && !miniCard && !portraitCard && !heroCard;
    const widthClass = getSkeletonWidthClass({ wideCard, miniCard, portraitCard });

    if (portraitCard) {
        return (
            <div className={`skeleton-card ${widthClass} shrink-0`}>
                <Shimmer className="card-portrait-image w-full rounded-2xl" />
                <div className="mt-2 w-full min-w-0 max-w-[var(--card-portrait-w)] space-y-1.5">
                    <Shimmer className="h-3.5 w-3/4 rounded-md" />
                    <Shimmer className="h-3 w-1/2 rounded-md" />
                </div>
            </div>
        );
    }

    const imageAspect = heroCard ? 'aspect-[2/1]' : tallCard ? 'aspect-[11/10]' : 'aspect-[3/2]';
    const textPad = isTrendingCard ? 'px-5 pt-4' : 'px-2.5 pt-2.5';

    return (
        <div className={`skeleton-card ${widthClass} shrink-0 overflow-hidden rounded-2xl ${isTrendingCard ? 'pb-5' : 'pb-2.5'}`}>
            <Shimmer className={`w-full ${imageAspect} rounded-t-2xl`} />
            <div className={`${textPad} space-y-2`}>
                <Shimmer className="h-4 w-[85%] rounded-md" />
                <Shimmer className="h-3 w-[60%] rounded-md" />
            </div>
        </div>
    );
}

export default function HomeCarouselCardsSkeleton({
    count = CENTERED_SKELETON_COUNT,
    tallCard = false,
    wideCard = false,
    className = '',
}) {
    const scrollRef = useRef(null);
    const trackRef = useRef(null);
    const fallbackWidth = getHomeCardFallbackWidth(wideCard);
    const cardWidth = useMeasuredCardWidth(trackRef, count, fallbackWidth);
    const sidePad = useCenteredCarouselSidePad(scrollRef, cardWidth);
    const sidePadding = sidePad > 0
        ? `${sidePad}px`
        : `calc(50% - ${cardWidth / 2}px)`;

    useEffect(() => {
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || count < 2) return;

        const centerIndex = Math.floor(count / 2);
        const slide = trackEl.children[centerIndex];
        if (slide) scrollCarouselToSlide(el, slide);
    }, [cardWidth, sidePad, count]);

    return (
        <div
            ref={scrollRef}
            className={`home-carousel-scroll overflow-x-auto scrollbar-hide ${className}`}
            style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorX: 'contain',
                paddingInline: sidePadding,
                scrollPaddingInline: sidePadding,
            }}
        >
            <div
                ref={trackRef}
                className="flex w-max pb-1"
                style={{ gap: HOME_CARD_GAP }}
            >
                {Array.from({ length: count }).map((_, index) => (
                    <div key={index} className="carousel-slide shrink-0 snap-center">
                        <HomeEventCardSkeleton
                            tallCard={tallCard}
                            wideCard={wideCard}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Hero banner ── */
export function HeroBannerSkeleton({ className = 'px-6 lg:px-12 mb-6' }) {
    return (
        <div className={className}>
            <Shimmer className="hero-banner-height w-full rounded-2xl lg:h-[17.5rem] lg:rounded-3xl" />
        </div>
    );
}

/* ── Fests page horizontal card ── */
export function FestCardSkeleton() {
    return (
        <div className="skeleton-card card-carousel-fest snap-start shrink-0 overflow-hidden rounded-2xl lg:rounded-3xl">
            <Shimmer className="fest-card-image w-full rounded-none" />
            <div className="space-y-2 px-3 pb-3 pt-3 lg:px-4 lg:pb-4 lg:pt-4">
                <Shimmer className="h-4 w-[70%] rounded-md" />
                <Shimmer className="h-3 w-[55%] rounded-md" />
                <Shimmer className="mt-3 h-10 w-full rounded-xl" />
            </div>
        </div>
    );
}

export function FestCardsRowSkeleton({ count = 2, className = '' }) {
    return (
        <CardsRow count={count} gap={FEST_CARD_GAP} className={className}>
            {(index) => <FestCardSkeleton key={index} />}
        </CardsRow>
    );
}

/* ── Cultural / tech / sports fest featured card ── */
export function FeaturedFestCardSkeleton() {
    return (
        <div className="skeleton-card card-carousel-fest snap-start shrink-0 overflow-hidden rounded-2xl">
            <Shimmer className="fest-card-image w-full rounded-none" />
            <div className="space-y-2 px-4 pb-4 pt-3">
                <Shimmer className="h-5 w-[80%] rounded-md" />
                <Shimmer className="h-4 w-[60%] rounded-md" />
                <Shimmer className="mt-3 h-11 w-full rounded-2xl" />
            </div>
        </div>
    );
}

export function FeaturedFestCardsRowSkeleton({ count = 2, className = 'pl-4' }) {
    return (
        <CardsRow count={count} gap={PORTRAIT_CARD_GAP} className={className}>
            {(index) => <FeaturedFestCardSkeleton key={index} />}
        </CardsRow>
    );
}

export function FestListItemSkeleton() {
    return (
        <div className="skeleton-card flex overflow-hidden rounded-2xl">
            <Shimmer className="list-card-thumb shrink-0 rounded-none" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4 py-3">
                <Shimmer className="h-5 w-[75%] rounded-md" />
                <Shimmer className="h-4 w-[55%] rounded-md" />
                <Shimmer className="mt-1 h-4 w-[40%] rounded-md" />
            </div>
        </div>
    );
}

/* ── Community / beginner / run-club portrait card ── */
export function CompactPortraitCardSkeleton({ withShare = true }) {
    return (
        <div className="skeleton-card card-portrait shrink-0">
            <Shimmer className="card-portrait-image w-full rounded-2xl" />
            <div className={`mt-2 ${withShare ? 'flex items-start justify-between gap-1' : ''}`}>
                <div className="min-w-0 flex-1 space-y-1.5">
                    <Shimmer className="h-4 w-[90%] rounded-md" />
                    <Shimmer className="h-3.5 w-[70%] rounded-md" />
                </div>
                {withShare && <Shimmer className="mt-0.5 size-4 shrink-0 rounded-sm" />}
            </div>
        </div>
    );
}

export function CompactPortraitCardsRowSkeleton({
    count = 3,
    withShare = true,
    className = 'px-4',
}) {
    return (
        <CardsRow count={count} gap={PORTRAIT_CARD_GAP} className={className}>
            {(index) => (
                <CompactPortraitCardSkeleton key={index} withShare={withShare} />
            )}
        </CardsRow>
    );
}

/* ── Weekend plans / sports activity card ── */
export function WideActivityCardSkeleton() {
    return (
        <div className="skeleton-card card-wide shrink-0 overflow-hidden rounded-2xl">
            <Shimmer className="card-wide-image w-full rounded-none" />
            <div className="space-y-2 px-4 py-3">
                <Shimmer className="h-5 w-[80%] rounded-md" />
                <Shimmer className="h-4 w-[50%] rounded-md" />
            </div>
        </div>
    );
}

export function WideActivityCardsRowSkeleton({ count = 2, className = 'px-4' }) {
    return (
        <CardsRow count={count} gap={WIDE_CARD_GAP} className={className}>
            {(index) => <WideActivityCardSkeleton key={index} />}
        </CardsRow>
    );
}

/* ── Trek category list card ── */
export function TrekListItemSkeleton() {
    return (
        <div className="skeleton-card overflow-hidden rounded-2xl">
            <Shimmer className="card-wide-image w-full rounded-none" />
            <div className="space-y-2 px-4 py-3">
                <Shimmer className="h-5 w-[75%] rounded-md" />
                <Shimmer className="h-4 w-[50%] rounded-md" />
            </div>
        </div>
    );
}

export function TrekListSkeleton({ count = 3, className = 'space-y-4' }) {
    return (
        <div className={className}>
            {Array.from({ length: count }).map((_, index) => (
                <TrekListItemSkeleton key={index} />
            ))}
        </div>
    );
}

/* ── Fest sub-page loading block ── */
export function FestSubpageLoadingSkeleton({ listedCount = 2 }) {
    return (
        <>
            <section className="mb-6">
                <FeaturedFestCardsRowSkeleton count={2} />
            </section>
            <section className="px-4">
                <div className="space-y-3">
                    {Array.from({ length: listedCount }).map((_, index) => (
                        <FestListItemSkeleton key={index} />
                    ))}
                </div>
            </section>
        </>
    );
}

/* ── My Bookings page ── */
export function BookingCardSkeleton() {
    return (
        <div className="skeleton-card rounded-2xl p-3 sm:p-4 h-40 flex flex-col">
            <div className="flex gap-3 sm:gap-4 min-h-0 flex-1">
                <Shimmer className="size-20 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 pt-2 space-y-2">
                    <Shimmer className="h-4 w-full rounded-md" />
                    <Shimmer className="h-3 w-2/3 rounded-md" />
                </div>
            </div>
            <div className="flex gap-2 mt-3">
                <Shimmer className="flex-1 h-11 rounded-2xl" />
                <Shimmer className="flex-1 h-11 rounded-2xl" />
            </div>
        </div>
    );
}

export function BookingsPageLoadingSkeleton({ isDark, cardCount = 3 }) {
    return (
        <div className={`min-h-screen pb-24 lg:pb-8 transition-colors ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
            <main className="px-4 pt-4 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-md lg:max-w-2xl overflow-hidden rounded-2xl">
                    <div className={`px-4 pt-4 ${isDark ? 'bg-[#111213]' : 'bg-white'}`}>
                        <div className="pb-8">
                            <Shimmer className="h-8 w-40 rounded-md" />
                        </div>
                        <div className="flex items-end gap-6 px-2">
                            <Shimmer className="h-11 min-w-32 rounded-t-2xl" />
                            <Shimmer className="h-11 min-w-32 rounded-t-2xl" />
                        </div>
                    </div>
                    <div
                        className={`px-2.5 py-6 sm:px-4 min-h-[420px] rounded-tr-2xl rounded-bl-2xl rounded-br-2xl ${
                            isDark ? 'bg-[#161718]' : 'bg-white'
                        }`}
                    >
                        <div className="space-y-4">
                            {Array.from({ length: cardCount }).map((_, index) => (
                                <BookingCardSkeleton key={index} />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

/* ── Favourites page ── */
export function FavoriteGridCardSkeleton() {
    return (
        <div className="skeleton-card rounded-3xl overflow-hidden">
            <Shimmer className="aspect-[4/5] w-full rounded-none" />
            <div className="px-3.5 py-3.5 space-y-2">
                <Shimmer className="h-4 w-[85%] rounded-md" />
                <Shimmer className="h-3 w-[60%] rounded-md" />
            </div>
        </div>
    );
}

export function FavoritesPageLoadingSkeleton({ isDark, cardCount = 6 }) {
    return (
        <div className={`min-h-screen pb-24 lg:pb-8 transition-colors ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>
            <main className="px-4 pt-4 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-md lg:max-w-6xl">
                    <div className="px-4 pt-4">
                        <div className="flex items-start justify-between gap-3 pb-8">
                            <Shimmer className="h-8 w-36 rounded-md" />
                            <div className="flex items-center gap-2 shrink-0">
                                <Shimmer className="size-10 rounded-full" />
                                <Shimmer className="size-10 rounded-full" />
                            </div>
                        </div>
                    </div>
                    <div className="px-2.5 py-6 sm:px-4 min-h-[420px]">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 sm:gap-4">
                            {Array.from({ length: cardCount }).map((_, index) => (
                                <FavoriteGridCardSkeleton key={index} />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
