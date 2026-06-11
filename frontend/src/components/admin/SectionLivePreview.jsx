import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Calendar, ExternalLink, Heart, Home, MapPin, Sparkles, User } from 'lucide-react';
import AppLogo from '../AppLogo';
import HeroSearchBar from '../HeroSearchBar';
import HeroBanner from '../HeroBanner';
import HomeCategoryBar from '../HomeCategoryBar';
import HomeCarouselSection from '../HomeCarouselSection';
import { TRENDING_CARD_GAP } from '../../hooks/useHomeCarousel';
import { createFallbackImage } from '../../utils/fallbackImageGenerator';
import { buildHomeCarouselItems } from '../../utils/homeCarouselItems';
import { getCardSizeProps, getCardSizeShortLabel } from '../../utils/homeCardSize';
import { mapHomeCarouselDisplayItems } from '../../utils/mapHomeCarouselDisplayItems';
import { TARGET_PAGE_OPTIONS } from '../../utils/pageSections';
import CulturalIcon from '../../assets/mobile-icons/cul.svg';
import TechIcon from '../../assets/mobile-icons/techhh.svg';
import SportsIcon from '../../assets/mobile-icons/spor.svg';

const MAX_FRAME_WIDTH = 300;

function getHeroBannerHeight(deviceWidth) {
    const minH = 176;
    const maxH = 280;
    const vwBased = deviceWidth * 0.36;
    return Math.round(Math.min(maxH, Math.max(minH, vwBased)));
}

function getPreviewCssVars(width) {
    const heroH = getHeroBannerHeight(width);
    return {
        '--page-gutter': `${Math.max(12, Math.round(width * 0.036))}px`,
        '--card-carousel': `${Math.min(300, Math.round(width * 0.78))}px`,
        '--card-carousel-sm': `${Math.min(220, Math.round(width * 0.62))}px`,
        '--card-carousel-wide': `${Math.min(384, Math.round(width * 0.84))}px`,
        '--card-portrait-w': `${Math.min(160, Math.round(width * 0.42))}px`,
        '--hero-banner-h': `${heroH}px`,
        '--hero-banner-min-h': `${heroH}px`,
        '--hero-banner-max-h': `${heroH}px`,
        '--preview-logo-size': `${Math.round(width * 0.09)}px`,
        '--preview-cat-icon-w': `${Math.round(width * 0.19)}px`,
        '--preview-cat-icon-h': `${Math.round(width * 0.205)}px`,
        '--preview-search-h': '40px',
    };
}

const IOS_FRAME = {
    platform: 'ios',
    frameRadius: '2.75rem',
    screenRadius: '2.25rem',
    bezel: '#1a1a1c',
    bezelBorder: 'rgba(255,255,255,0.12)',
    padding: 10,
};

const ANDROID_FRAME = {
    platform: 'android',
    frameRadius: '2rem',
    screenRadius: '1.25rem',
    bezel: '#252628',
    bezelBorder: 'rgba(255,255,255,0.1)',
    padding: 8,
};

/** Viewport sizes match Chrome DevTools device presets (CSS px). */
const IOS_DEVICES = [
    { id: 'iphone-se', label: 'iPhone SE', width: 375, viewportHeight: 667, notch: 'none' },
    { id: 'iphone-14', label: 'iPhone 14', width: 390, viewportHeight: 844, notch: 'notch' },
    { id: 'iphone-15-pro', label: 'iPhone 15 Pro', width: 393, viewportHeight: 852, notch: 'island' },
    { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, viewportHeight: 932, notch: 'island' },
    { id: 'iphone-14-plus', label: 'iPhone 14 Plus', width: 428, viewportHeight: 926, notch: 'notch' },
];

const ANDROID_DEVICES = [
    { id: 'galaxy-s23', label: 'Galaxy S23', width: 360, viewportHeight: 780 },
    { id: 'pixel-7', label: 'Pixel 7', width: 412, viewportHeight: 915 },
    { id: 'pixel-8', label: 'Pixel 8', width: 412, viewportHeight: 915 },
    { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra', width: 412, viewportHeight: 915 },
    { id: 'galaxy-a54', label: 'Galaxy A54', width: 384, viewportHeight: 854 },
];

const PREVIEW_NAV_ITEMS = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'favorites', icon: Heart, label: 'Favourite' },
    { id: 'booking', icon: Calendar, label: 'Bookings' },
    { id: 'profile', icon: User, label: 'Profile' },
];

function buildDevice(preset, frame) {
    const rawW = preset.width + frame.padding * 2;
    const scale = Math.min(0.72, MAX_FRAME_WIDTH / rawW);
    return {
        ...frame,
        ...preset,
        scale,
        displayHeight: 640,
    };
}

function getIosDevices() {
    return IOS_DEVICES.map((d) => buildDevice(d, IOS_FRAME));
}

function getAndroidDevices() {
    return ANDROID_DEVICES.map((d) => buildDevice(d, ANDROID_FRAME));
}

const DEMO_PALETTES = [
    { bg: '#0ECCEE', text: 'Neon Fest' },
    { bg: '#6366f1', text: 'Campus Night' },
    { bg: '#ec4899', text: 'Weekend Run' },
    { bg: '#f59e0b', text: 'Open Mic' },
];

const PAGE_CONTEXT = {
    home: {
        route: '/',
        pageClass: '',
        activeCategory: null,
        before: [{ title: 'Trending Now', cardSize: 'trending', slug: 'trending', live: true }],
        after: [{ title: 'Happening near you', cardSize: 'wide', slug: 'happening', live: true }],
        showHero: true,
        showFestSubcats: false,
    },
    fests: {
        route: '/fests',
        pageClass: 'fests-page',
        activeCategory: 'fests',
        before: [{ title: 'Ongoing Events', cardSize: 'wide' }],
        after: [{ title: 'Upcoming Events', cardSize: 'wide' }],
        showHero: true,
        showFestSubcats: true,
    },
    'cultural-fest': {
        route: '/cultural-fest',
        pageClass: 'fests-page',
        activeCategory: 'fests',
        before: [{ title: 'Cultural Fests', cardSize: 'default' }],
        after: [],
        showHero: false,
        showFestSubcats: false,
    },
    'tech-fest': {
        route: '/tech-fest',
        pageClass: 'fests-page',
        activeCategory: 'fests',
        before: [{ title: 'Tech Fests', cardSize: 'default' }],
        after: [],
        showHero: false,
        showFestSubcats: false,
    },
    'sports-fest': {
        route: '/sports-fest',
        pageClass: 'fests-page',
        activeCategory: 'fests',
        before: [{ title: 'Sports Fests', cardSize: 'default' }],
        after: [],
        showHero: false,
        showFestSubcats: false,
    },
    treks: {
        route: '/treks',
        pageClass: '',
        activeCategory: 'treks',
        before: [
            { title: 'Explore the Communities', cardSize: 'explore', live: true },
            { title: 'Upcoming Weekend Plans', cardSize: 'wide', live: true },
        ],
        after: [{ title: 'Beginner Friendly', cardSize: 'explore', live: true }],
        showHero: true,
        showFestSubcats: false,
    },
    sports: {
        route: '/sports',
        pageClass: '',
        activeCategory: 'sports',
        before: [{ title: 'Upcoming Activities', cardSize: 'wide', slug: 'happening', live: true }],
        after: [{ title: 'Explore Run Clubs', cardSize: 'runclub', live: true }],
        showHero: true,
        showFestSubcats: false,
    },
    theatre: {
        route: '/theatre',
        pageClass: '',
        activeCategory: 'theatre',
        before: [{ title: 'This Weekend', cardSize: 'explore' }],
        after: [],
        showHero: true,
        showFestSubcats: false,
    },
};

const FEST_SUBCATS = [
    { label: 'CULTURAL', icon: CulturalIcon },
    { label: 'TECH', icon: TechIcon },
    { label: 'SPORTS', icon: SportsIcon },
];

function toPreviewItem(raw, index, palette) {
    const title = raw.title || raw.festName || raw.trekName || raw.name || palette.text;
    const subtitle = raw.subtitle || raw.collegeName || raw.city || raw.basedIn || 'CrwdCtrl';
    const image = raw.image || raw.coverImage || raw.images?.[0]
        || createFallbackImage(400, 300, palette.bg, title.slice(0, 14));
    return {
        id: raw._id || raw.id || `demo-${index}`,
        title,
        subtitle,
        image,
    };
}

function buildDemoItems(targetPage) {
    const labels = {
        home: ['Trending Fest', 'College Carnival', 'City Meetup'],
        fests: ['Tech Summit', 'Cultural Night', 'Sports League'],
        'cultural-fest': ['Rangoli Fest', 'Dance Battle', 'Drama Night'],
        'tech-fest': ['Hackathon', 'Robo Wars', 'Code Sprint'],
        'sports-fest': ['Cricket Cup', 'Football Fest', 'Athletics Day'],
        treks: ['Himalayan Trek', 'Forest Trail', 'Sunrise Hike'],
        sports: ['5K Morning Run', 'Cycling Club', 'Yoga Session'],
        theatre: ['Stand-up Night', 'Play Premiere', 'Open Stage'],
    };
    const names = labels[targetPage] || labels.home;
    return names.map((name, i) => toPreviewItem(
        { title: name, subtitle: 'Sample content' },
        i,
        DEMO_PALETTES[i % DEMO_PALETTES.length],
    ));
}

function buildPreviewItems(targetPage, fests, treks, comms, sports) {
    let pool = [];
    if (targetPage === 'treks') pool = [...treks, ...comms];
    else if (targetPage === 'sports') pool = sports;
    else if (['home', 'fests', 'cultural-fest', 'tech-fest', 'sports-fest', 'theatre'].includes(targetPage)) {
        pool = fests;
    } else {
        pool = [...fests, ...treks, ...comms];
    }

    const usable = pool.filter((item) => item && (item.title || item.festName || item.trekName || item.name));
    if (usable.length >= 2) {
        return usable.slice(0, 3).map((item, i) => toPreviewItem(item, i, DEMO_PALETTES[i % DEMO_PALETTES.length]));
    }
    return buildDemoItems(targetPage);
}

function buildHeroEvents(fests) {
    const pool = fests.filter((f) => f.heroImage || f.coverImage || f.image || f.galleryImages?.[0]);
    const source = pool.length ? pool : fests;
    return source.slice(0, 3).map((f) => ({
        id: f._id || f.id,
        image: f.heroImage || f.coverImage || f.image || f.galleryImages?.[0]
            || createFallbackImage(560, 280, '#0ECCEE', (f.festName || f.title || 'Event').slice(0, 12)),
        title: f.festName || f.title || f.name || 'Featured Event',
        dateTime: f.festDate || f.date || 'This weekend',
        status: f.status || 'ongoing',
    }));
}

function buildLiveCarouselItems(block, targetPage, fests, treks, comms, sports) {
    if (block.slug && targetPage === 'home') {
        const raw = buildHomeCarouselItems(fests, treks, comms, block.slug, sports);
        const mapped = mapHomeCarouselDisplayItems(raw);
        if (mapped.length) return mapped;
    }
    return buildPreviewItems(targetPage, fests, treks, comms, sports);
}

function ContextCarousel({
    block,
    targetPage,
    fests,
    treks,
    comms,
    sports,
    isDark,
    dimmed = false,
}) {
    const props = getCardSizeProps(block.cardSize);
    const items = useMemo(
        () => buildLiveCarouselItems(block, targetPage, fests, treks, comms, sports),
        [block, targetPage, fests, treks, comms, sports],
    );

    return (
        <div className={dimmed ? 'pointer-events-none select-none opacity-40' : ''}>
            <HomeCarouselSection
                title={block.title}
                items={items}
                isDark={isDark}
                tallCard={props.tallCard}
                wideCard={props.wideCard}
                miniCard={props.miniCard}
                portraitCard={props.portraitCard}
                heroCard={props.heroCard}
                cardGap={block.cardSize === 'trending' ? TRENDING_CARD_GAP : undefined}
                onItemClick={() => {}}
            />
        </div>
    );
}

function PreviewBottomNav({ activeId = 'home' }) {
    return (
        <div
            className="pointer-events-none select-none w-full px-2.5 pb-2 pt-1"
            style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
        >
            <div
                className="bottom-nav-pill w-full max-w-none mx-0 rounded-[1.875rem] overflow-hidden"
                style={{ backgroundColor: '#0A0A0A' }}
            >
                <div className="bottom-nav-pill__inner py-2.5 px-2">
                    {PREVIEW_NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const active = activeId === item.id;
                        return (
                            <div
                                key={item.id}
                                className="bottom-nav-item flex items-center justify-center min-h-[2.75rem]"
                                style={{ color: active ? '#00C2CB' : '#e5e7eb' }}
                            >
                                <span className="bottom-nav-item__icon crisp-icon-svg">
                                    <Icon size={24} strokeWidth={2} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function resolvePreviewNavActive(targetPage) {
    if (targetPage === 'home') return 'home';
    return null;
}

function FestSubcategoryRow({ isDark }) {
    return (
        <div className="px-(--page-gutter) mb-4 pointer-events-none select-none opacity-45 scale-95 origin-top">
            <h2 className={`home-section-heading text-lg mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Categories
            </h2>
            <div className="grid grid-cols-3 gap-2">
                {FEST_SUBCATS.map((cat) => (
                    <div key={cat.label} className="flex flex-col items-center gap-1 pt-1 pb-2">
                        <img src={cat.icon} alt={cat.label} className="w-14 h-auto" draggable={false} />
                        <span className={`text-[9px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {cat.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function IOSStatusBar({ notch = 'island' }) {
    return (
        <div className="relative z-30 flex items-center justify-between px-6 pt-2.5 pb-1 text-[11px] font-semibold text-white pointer-events-none select-none">
            <span>9:41</span>
            {notch === 'island' && (
                <div className="absolute left-1/2 top-2 -translate-x-1/2 w-[84px] h-[22px] rounded-full bg-black border border-white/10" />
            )}
            {notch === 'notch' && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[120px] h-[28px] rounded-b-2xl bg-black border border-t-0 border-white/10" />
            )}
            <div className="flex items-center gap-1">
                <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" className="opacity-90">
                    <rect x="0" y="6" width="3" height="4" rx="0.5" />
                    <rect x="4.5" y="4" width="3" height="6" rx="0.5" />
                    <rect x="9" y="2" width="3" height="8" rx="0.5" />
                    <rect x="13.5" y="0" width="2.5" height="10" rx="0.5" />
                </svg>
                <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor" className="opacity-90">
                    <path d="M7 2.5C8.8 2.5 10.4 3.2 11.5 4.4L12.7 3.2C11.3 1.7 9.3 0.8 7 0.8C4.7 0.8 2.7 1.7 1.3 3.2L2.5 4.4C3.6 3.2 5.2 2.5 7 2.5Z" />
                    <path d="M7 5.5C8.1 5.5 9.1 5.9 9.8 6.6L11 5.4C9.9 4.3 8.5 3.7 7 3.7C5.5 3.7 4.1 4.3 3 5.4L4.2 6.6C4.9 5.9 5.9 5.5 7 5.5Z" />
                    <circle cx="7" cy="8.5" r="1.2" />
                </svg>
                <div className="flex items-center gap-0.5">
                    <div className="w-[20px] h-[9px] rounded-[2px] border border-white/80 p-[1px]">
                        <div className="h-full w-[70%] rounded-[1px] bg-white" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function AndroidStatusBar() {
    return (
        <div className="relative z-30 flex items-center justify-between px-4 pt-2 pb-1 text-[10px] font-medium text-white/90 pointer-events-none select-none">
            <span>9:41</span>
            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#0a0a0a] ring-1 ring-white/15" />
            <div className="flex items-center gap-1.5 opacity-90">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
                    <path d="M7 2.5C8.8 2.5 10.4 3.2 11.5 4.4L12.7 3.2C11.3 1.7 9.3 0.8 7 0.8C4.7 0.8 2.7 1.7 1.3 3.2L2.5 4.4C3.6 3.2 5.2 2.5 7 2.5Z" />
                    <circle cx="7" cy="8.5" r="1.2" />
                </svg>
                <div className="w-[18px] h-[8px] rounded-[2px] border border-white/70 p-px">
                    <div className="h-full w-3/4 rounded-[1px] bg-white" />
                </div>
            </div>
        </div>
    );
}

function getPlacementHint(targetPage, existingCount) {
    const hints = {
        home: 'After Happening Near You',
        fests: 'After Upcoming Events',
        treks: 'After Beginner Friendly',
        sports: 'After Explore Run Clubs',
        theatre: 'After page content',
    };
    const base = hints[targetPage] || 'At bottom of page';
    if (existingCount > 0) {
        return `${base} · below ${existingCount} existing section${existingCount !== 1 ? 's' : ''}`;
    }
    return base;
}

function ExistingSectionPreview({ section, targetPage, fests, treks, comms, sports, isDark }) {
    const props = getCardSizeProps(section.cardSize);
    const items = useMemo(
        () => buildPreviewItems(targetPage, fests, treks, comms, sports),
        [targetPage, fests, treks, comms, sports],
    );

    return (
        <div className="pointer-events-none select-none opacity-45">
            <HomeCarouselSection
                title={section.title}
                items={items.slice(0, 2)}
                isDark={isDark}
                tallCard={props.tallCard}
                wideCard={props.wideCard}
                miniCard={props.miniCard}
                portraitCard={props.portraitCard}
                heroCard={props.heroCard}
                onItemClick={() => {}}
            />
        </div>
    );
}

function DeviceFrame({ device, children, bottomNav, scrollRef }) {
    const isIOS = device.platform === 'ios';
    const statusH = isIOS ? 36 : 28;
    const navH = 72;
    const screenH = device.displayHeight;
    const frameW = device.width + device.padding * 2;
    const frameH = screenH + statusH + navH + device.padding * 2;
    const scaledW = frameW * device.scale;
    const scaledH = frameH * device.scale;

    return (
        <div className="flex justify-center w-full">
            <div
                className="relative shrink-0"
                style={{ width: scaledW, height: scaledH }}
            >
                <div
                    className="absolute top-0 left-1/2 shadow-2xl shadow-black/60"
                    style={{
                        width: frameW,
                        height: frameH,
                        transform: `translateX(-50%) scale(${device.scale})`,
                        transformOrigin: 'top center',
                    }}
                >
                    <div
                        className="h-full"
                        style={{
                            background: device.bezel,
                            borderRadius: device.frameRadius,
                            border: `1px solid ${device.bezelBorder}`,
                            padding: device.padding,
                        }}
                    >
                        <div
                            className="relative flex flex-col overflow-hidden bg-black"
                            style={{
                                borderRadius: device.screenRadius,
                                height: screenH + statusH + navH,
                            }}
                        >
                            {isIOS ? <IOSStatusBar notch={device.notch || 'island'} /> : <AndroidStatusBar />}

                            <div
                                className="relative flex-1 min-h-0 flex flex-col bg-[#161718]"
                                style={{ width: device.width }}
                            >
                                <div
                                    ref={scrollRef}
                                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide"
                                >
                                    {children}
                                    <div className="h-20 shrink-0" aria-hidden />
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 z-30 bg-linear-to-t from-[#161718] via-[#161718] to-transparent pt-4">
                                    {bottomNav}
                                </div>
                            </div>

                            {isIOS ? (
                                <div className="absolute bottom-1 left-0 right-0 flex justify-center pointer-events-none z-40">
                                    <div className="w-28 h-1 rounded-full bg-white/35" />
                                </div>
                            ) : (
                                <div className="absolute bottom-0.5 left-0 right-0 flex justify-center pointer-events-none z-40">
                                    <div className="w-24 h-1 rounded-full bg-white/25" />
                                </div>
                            )}
                        </div>
                    </div>

                    {isIOS && (
                        <>
                            <div className="absolute -left-[2px] top-[88px] w-[3px] h-7 rounded-l-sm bg-[#333]" />
                            <div className="absolute -left-[2px] top-[130px] w-[3px] h-12 rounded-l-sm bg-[#333]" />
                            <div className="absolute -left-[2px] top-[178px] w-[3px] h-12 rounded-l-sm bg-[#333]" />
                            <div className="absolute -right-[2px] top-[120px] w-[3px] h-16 rounded-r-sm bg-[#333]" />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function InspectToolbar({
    device,
    platform,
    onPlatformChange,
    devices,
    onDeviceChange,
    route,
    page,
}) {
    return (
        <div className="flex flex-col gap-2 mb-3 w-full">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-white">Device preview</p>
                {page?.route && (
                    <a
                        href={page.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0ECCEE] hover:text-[#5ee0f7]"
                    >
                        Open live <ExternalLink size={10} />
                    </a>
                )}
            </div>

            <div className="rounded-lg border border-white/10 bg-[#292a2d] p-1.5 space-y-1.5">
                {/* Platform toggle — iOS / Android */}
                <div className="flex gap-1">
                    {[
                        { id: 'ios', label: 'iOS' },
                        { id: 'android', label: 'Android' },
                    ].map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => onPlatformChange(p.id)}
                            className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
                                platform === p.id
                                    ? 'bg-[#0ECCEE] text-black'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Device model picker */}
                <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                    {devices.map((d) => {
                        const active = device.id === d.id;
                        return (
                            <button
                                key={d.id}
                                type="button"
                                onClick={() => onDeviceChange(d.id)}
                                title={`${d.width} × ${d.viewportHeight}`}
                                className={`shrink-0 rounded-md px-2.5 py-1 text-[9px] font-semibold whitespace-nowrap transition-colors ${
                                    active
                                        ? 'bg-[#3c4043] text-white ring-1 ring-white/15'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                {d.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between px-1 pt-0.5 border-t border-white/6">
                    <span className="text-[9px] font-mono text-gray-500 truncate">
                        crwdctrl.com{route}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500 shrink-0 ml-2">
                        {device.width} × {device.viewportHeight} · {Math.round(device.scale * 100)}%
                    </span>
                </div>
            </div>
        </div>
    );
}

function WebsitePreviewContent({
    title,
    cardSize,
    targetPage,
    fests,
    treks,
    comms,
    sports,
    existingSections = [],
    deviceWidth = 390,
    scrollRef,
}) {
    const isDark = true;
    const ctx = PAGE_CONTEXT[targetPage] || PAGE_CONTEXT.home;
    const cardProps = getCardSizeProps(cardSize);
    const displayTitle = title.trim() || 'Section title';

    const items = useMemo(
        () => buildPreviewItems(targetPage, fests, treks, comms, sports),
        [targetPage, fests, treks, comms, sports],
    );

    const heroEvents = useMemo(() => {
        const events = buildHeroEvents(fests);
        if (events.length) return events;
        return [{
            id: 'demo-hero',
            image: createFallbackImage(560, 280, '#0ECCEE', 'CrwdCtrl'),
            title: 'Featured on CrwdCtrl',
            dateTime: 'This weekend',
        }];
    }, [fests]);

    const pageExistingSections = useMemo(
        () => existingSections
            .filter((s) => (s.targetPage || 'home') === targetPage && s.enabled !== false)
            .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999)),
        [existingSections, targetPage],
    );

    const newSectionRef = useRef(null);
    const placementHint = getPlacementHint(targetPage, pageExistingSections.length);
    const previewVars = getPreviewCssVars(deviceWidth);

    useEffect(() => {
        const el = newSectionRef.current;
        const scroller = scrollRef?.current;
        if (!el || !scroller) return;
        const t = setTimeout(() => {
            const top = el.offsetTop - scroller.clientHeight * 0.28;
            scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 120);
        return () => clearTimeout(t);
    }, [title, cardSize, targetPage, pageExistingSections.length, scrollRef]);

    return (
        <div
            className={`crwdctrl-page dark preview-device-scope ${ctx.pageClass} bg-[#161718] text-white`}
            style={previewVars}
        >
            <header className="preview-chrome-header mobile-header-shell rounded-b-[14px] overflow-hidden bg-[#0D0E10] pointer-events-none select-none sticky top-0 z-20">
                <div className="mobile-header-inner rounded-b-[14px] px-(--page-gutter) bg-[#0D0E10]">
                    <div className="flex items-center justify-between py-1">
                        <AppLogo className="pointer-events-none" />
                        <div className="mobile-header-actions flex items-center">
                            <span className="text-white/80"><MapPin /></span>
                            <span className="relative text-white/80">
                                <Bell />
                                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                            </span>
                        </div>
                    </div>
                    <div className="pb-1">
                        <HeroSearchBar value="" readOnly isDark placeholder="search college, fest" />
                    </div>
                    <div className="pb-0.5">
                        <HomeCategoryBar isDark activeCategory={ctx.activeCategory} noPadding />
                    </div>
                </div>
            </header>

            <main className="pb-3">
                {ctx.showHero && (
                    <div className="pointer-events-none select-none">
                        <HeroBanner events={heroEvents} onEventClick={() => {}} className="preview-hero-banner" />
                    </div>
                )}

                {ctx.showFestSubcats && <FestSubcategoryRow isDark={isDark} />}

                {ctx.before.map((block) => (
                    <ContextCarousel
                        key={block.title}
                        block={block}
                        targetPage={targetPage}
                        fests={fests}
                        treks={treks}
                        comms={comms}
                        sports={sports}
                        isDark={isDark}
                        dimmed={!block.live}
                    />
                ))}

                {ctx.after.map((block) => (
                    <ContextCarousel
                        key={block.title}
                        block={block}
                        targetPage={targetPage}
                        fests={fests}
                        treks={treks}
                        comms={comms}
                        sports={sports}
                        isDark={isDark}
                        dimmed={!block.live}
                    />
                ))}

                {pageExistingSections.map((section) => (
                    <ExistingSectionPreview
                        key={section._id}
                        section={section}
                        targetPage={targetPage}
                        fests={fests}
                        treks={treks}
                        comms={comms}
                        sports={sports}
                        isDark={isDark}
                    />
                ))}

                <div ref={newSectionRef} className="relative scroll-mt-4">
                    <div className="absolute -top-3 left-3 z-20 flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#0ECCEE] px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black shadow-md w-fit">
                            <Sparkles size={8} /> New section adds here
                        </span>
                        <span className="text-[8px] text-[#0ECCEE]/80 px-1">{placementHint}</span>
                    </div>
                    <div className="rounded-2xl ring-2 ring-[#0ECCEE] ring-offset-2 ring-offset-[#161718] bg-[#161718]/95">
                        <HomeCarouselSection
                            title={displayTitle}
                            items={items}
                            isDark={isDark}
                            tallCard={cardProps.tallCard}
                            wideCard={cardProps.wideCard}
                            miniCard={cardProps.miniCard}
                            portraitCard={cardProps.portraitCard}
                            heroCard={cardProps.heroCard}
                            onItemClick={() => {}}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

function PreviewMeta({ cardSize, targetPage, page, usingRealContent, placementHint }) {
    return (
        <div className="mt-2 w-full space-y-1.5">
            <p className="text-[10px] text-center text-[#0ECCEE]/90 font-medium">{placementHint}</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-medium text-gray-400">
                    {getCardSizeShortLabel(cardSize)}
                </span>
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-medium text-gray-400">
                    {page?.label || targetPage}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    usingRealContent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                    {usingRealContent ? 'Your content' : 'Sample content'}
                </span>
            </div>
        </div>
    );
}

export default function SectionLivePreview(props) {
    const scrollRef = useRef(null);
    const [platform, setPlatform] = useState('ios');
    const [iosDeviceId, setIosDeviceId] = useState('iphone-15-pro');
    const [androidDeviceId, setAndroidDeviceId] = useState('pixel-7');

    const iosDevices = useMemo(() => getIosDevices(), []);
    const androidDevices = useMemo(() => getAndroidDevices(), []);

    const devices = platform === 'ios' ? iosDevices : androidDevices;
    const activeId = platform === 'ios' ? iosDeviceId : androidDeviceId;
    const device = devices.find((d) => d.id === activeId) || devices[0];

    const page = TARGET_PAGE_OPTIONS.find((p) => p.value === props.targetPage);
    const route = PAGE_CONTEXT[props.targetPage]?.route || page?.route || '/';

    const usingRealContent = useMemo(() => {
        const pool = props.targetPage === 'treks' ? props.treks : props.targetPage === 'sports' ? props.sports : props.fests;
        return pool?.filter((item) => item?.title || item?.festName || item?.trekName || item?.name).length >= 2;
    }, [props.targetPage, props.fests, props.treks, props.sports]);

    const navActiveId = resolvePreviewNavActive(props.targetPage);
    const existingOnPage = useMemo(
        () => (props.existingSections || []).filter((s) => (s.targetPage || 'home') === props.targetPage),
        [props.existingSections, props.targetPage],
    );
    const placementHint = getPlacementHint(props.targetPage, existingOnPage.length);

    const handlePlatformChange = (next) => {
        setPlatform(next);
    };

    const handleDeviceChange = (id) => {
        if (platform === 'ios') setIosDeviceId(id);
        else setAndroidDeviceId(id);
    };

    return (
        <div className="flex flex-col items-center w-full">
            <InspectToolbar
                device={device}
                platform={platform}
                onPlatformChange={handlePlatformChange}
                devices={devices}
                onDeviceChange={handleDeviceChange}
                route={route}
                page={page}
            />

            <DeviceFrame
                device={device}
                scrollRef={scrollRef}
                bottomNav={<PreviewBottomNav activeId={navActiveId} />}
            >
                <WebsitePreviewContent
                    {...props}
                    deviceWidth={device.width}
                    scrollRef={scrollRef}
                />
            </DeviceFrame>

            <PreviewMeta
                cardSize={props.cardSize}
                targetPage={props.targetPage}
                page={page}
                usingRealContent={usingRealContent}
                placementHint={placementHint}
            />
        </div>
    );
}
