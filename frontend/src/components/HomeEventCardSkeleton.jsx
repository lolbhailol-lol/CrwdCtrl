import { useRef } from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import {
    HOME_CARD_GAP,
    getHomeCardFallbackWidth,
    useCenteredCarouselSidePad,
    useMeasuredCardWidth,
} from '../hooks/useHomeCarousel';
export const FEST_CARD_GAP = 12;
export const PORTRAIT_CARD_GAP = 16;
export const WIDE_CARD_GAP = 16;

function Shimmer({ className = '' }) {
    const { isDark } = useDarkMode();
    return (
        <div
            className={`skeleton-shimmer rounded-2xl ${
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

/* ── Home carousel cards ── */
export function HomeEventCardSkeleton({ tallCard = false, wideCard = false }) {
    const { isDark } = useDarkMode();
    const isTrendingCard = tallCard && !wideCard;
    const cardRadius = 'rounded-2xl';

    return (
        <div
            className={`shrink-0 overflow-hidden ${cardRadius}
                ${isTrendingCard ? 'pb-5' : 'pb-2.5'}
                ${wideCard ? 'card-carousel-wide' : 'card-carousel'}
                ${isDark ? 'bg-black' : 'bg-[#F2F4F7]'}`}
        >
            <div
                className={`relative w-full overflow-hidden ${
                    tallCard ? 'aspect-[11/10]' : 'aspect-[3/2]'
                }`}
            >
                <Shimmer className="absolute inset-0 rounded-none" />
                <Shimmer className="absolute right-3 top-3 size-8 rounded-full" />
            </div>

            <div className={`flex items-center justify-between ${isTrendingCard ? 'mt-4 gap-3.5 px-5' : 'mt-2 gap-2 px-2.5'}`}>
                <div className="min-w-0 flex-1">
                    <Shimmer className="h-4 w-[85%] rounded-md" />
                    <Shimmer className="mt-1 h-3 w-[60%] rounded-md" />
                </div>
                <Shimmer className="size-8 shrink-0 rounded-full" />
            </div>
        </div>
    );
}

export default function HomeCarouselCardsSkeleton({
    count = 2,
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

    return (
        <div
            ref={scrollRef}
            className={`overflow-x-auto scrollbar-hide ${className}`}
            style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
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
                    <div key={index} className="shrink-0 snap-center">
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
    const { isDark } = useDarkMode();

    return (
        <div
            className={`card-carousel-fest snap-start overflow-hidden rounded-2xl lg:rounded-3xl
                ${isDark ? 'bg-[#111213]' : 'bg-white shadow-md lg:shadow-lg'}`}
        >
            <div className="relative h-[190px] lg:h-[220px] overflow-hidden">
                <Shimmer className="absolute inset-0 rounded-none" />
                <Shimmer className="absolute right-3 top-3 size-9 rounded-full" />
            </div>
            <div className="space-y-2 px-3 pb-3 pt-3 lg:px-4 lg:pb-4 lg:pt-4">
                <div className="flex items-start justify-between gap-2">
                    <Shimmer className="h-4 w-[70%] rounded-md" />
                    <Shimmer className="size-7 shrink-0 rounded-lg" />
                </div>
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
    const { isDark } = useDarkMode();

    return (
        <div
            className={`card-carousel-fest snap-start overflow-hidden rounded-2xl shadow-sm
                ${isDark ? 'bg-[#111213]' : 'bg-white'}`}
        >
            <div className="relative h-[175px] w-full overflow-hidden">
                <Shimmer className="absolute inset-0 rounded-none" />
                <Shimmer className="absolute right-2.5 top-2.5 size-8 rounded-2xl" />
            </div>
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
    const { isDark } = useDarkMode();

    return (
        <div
            className={`flex overflow-hidden rounded-2xl shadow-sm
                ${isDark ? 'bg-[#111213]' : 'bg-white'}`}
        >
            <Shimmer className="size-40 shrink-0 rounded-none" />
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
        <div className="w-40 shrink-0">
            <div className="relative h-52 w-40 overflow-hidden rounded-2xl">
                <Shimmer className="absolute inset-0 rounded-2xl" />
                <Shimmer className="absolute right-2.5 top-2.5 size-6 rounded-full" />
            </div>
            <div className={`mt-2 ${withShare ? 'flex items-start justify-between gap-1' : ''}`}>
                <div className="min-w-0 flex-1">
                    <Shimmer className="h-4 w-[90%] rounded-md" />
                    <Shimmer className="mt-1 h-3.5 w-[70%] rounded-md" />
                </div>
                {withShare && <Shimmer className="mt-0.5 size-8 shrink-0 rounded-2xl" />}
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
    const { isDark } = useDarkMode();

    return (
        <div
            className={`w-80 shrink-0 overflow-hidden rounded-2xl
                ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}
        >
            <div className="relative h-56 w-80 overflow-hidden">
                <Shimmer className="absolute inset-0 rounded-none" />
                <Shimmer className="absolute right-3 top-3 size-6 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                    <Shimmer className="h-5 w-[80%] rounded-md" />
                    <Shimmer className="mt-1 h-4 w-[50%] rounded-md" />
                </div>
                <Shimmer className="ml-3 size-8 shrink-0 rounded-2xl" />
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
    const { isDark } = useDarkMode();

    return (
        <div
            className={`overflow-hidden rounded-2xl
                ${isDark ? 'bg-[#111213]' : 'bg-[#F5F6FA]'}`}
        >
            <div className="relative h-56 w-full overflow-hidden">
                <Shimmer className="absolute inset-0 rounded-none" />
                <Shimmer className="absolute right-2.5 top-2.5 size-6 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                    <Shimmer className="h-5 w-[75%] rounded-md" />
                    <Shimmer className="mt-1 h-4 w-[50%] rounded-md" />
                </div>
                <Shimmer className="ml-3 size-8 shrink-0 rounded-2xl" />
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
                <div className="mb-3 px-4">
                    <Shimmer className="h-6 w-36 rounded-md" />
                </div>
                <FeaturedFestCardsRowSkeleton count={2} />
            </section>
            <section className="px-4">
                <Shimmer className="mb-3 h-6 w-28 rounded-md" />
                <div className="space-y-3">
                    {Array.from({ length: listedCount }).map((_, index) => (
                        <FestListItemSkeleton key={index} />
                    ))}
                </div>
            </section>
        </>
    );
}
