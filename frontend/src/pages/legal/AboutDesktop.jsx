import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../../context/DarkModeContext';
import {
    ArrowLeft,
    MapPin,
    Mail,
    Phone,
    ShieldCheck,
    QrCode,
    Compass,
    Ticket,
    Building2,
    ArrowRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInAppBack } from '../../hooks/useInAppBack';
import Seo from '../../components/Seo';
import FaqSection from '../../components/FaqSection';
import { breadcrumbSchema, faqSchema, webPageSchema } from '../../utils/seo';
import { ABOUT_FAQ } from '../../constants/faqs';
import {
    LEGAL_EMAIL,
    LEGAL_NAME,
    LEGAL_OPERATOR_LINE,
    LEGAL_PHONE_DISPLAY,
    LEGAL_PHONE_TEL,
    LEGAL_POLICY_LINKS,
    LEGAL_JURISDICTION,
    WEBSITE_URL
} from '../../constants/legalEntity';
import { fetchRawPublicFests, prefetchFestDetail } from '../../services/api/fests.api';
import { readFestsCache, writeFestsCache } from '../../utils/festsSessionCache';
import { pickBestCardImage } from '../../utils/coverImages';
import { festPath } from '../../utils/slugRoutes';

const ABOUT_DESCRIPTION =
    "CrwdCtrl is a dedicated digital platform to discover, explore, participate in, and host college fests, competitions, sports tournaments, hackathons, and treks.";

// Curated flagship past events
const CURATED_PAST_EVENTS = [
    {
        _id: 'fest-revels-24',
        festName: 'Revels National Cultural Fest',
        collegeName: 'MIT Manipal',
        city: 'Manipal',
        festType: 'cultural',
        festDate: 'March 2024',
        footfall: 'Inter-College Fest',
        prizePool: '₹6.5L Pool',
        image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
        edition: 'CULTURAL FEST',
        summary: '40+ Inter-college battles spanning music, theatre, choreography and star concerts.',
        tags: ['Pro-Night', 'Battle of Bands', 'Choreography', 'Drama'],
        status: 'lastyearhit'
    },
    {
        _id: 'fest-innovatex-24',
        festName: 'MindSpark & InnovateX Hackathon',
        collegeName: 'COEP Technological University',
        city: 'Pune',
        festType: 'technical',
        festDate: 'October 2024',
        footfall: '150+ Teams',
        prizePool: '₹3.5L Cash',
        image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
        edition: '36H HACKATHON',
        summary: '36-hour rapid product innovation sprint covering AI, Robotics, and Web3 architectures.',
        tags: ['36h Hackathon', 'RoboWars', 'AI Showcase', 'Web3'],
        status: 'lastyearhit'
    },
    {
        _id: 'fest-spardha-sports',
        festName: 'Spardha Sports Carnival',
        collegeName: 'IIT (BHU) Varanasi',
        city: 'Varanasi',
        festType: 'sports',
        festDate: 'November 2024',
        footfall: 'Sports Tournament',
        prizePool: '14 Trophies',
        image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
        edition: 'SPORTS CARNIVAL',
        summary: 'Inter-university athletic meet across track, football, basketball, and cricket.',
        tags: ['Athletics', 'Football 7s', 'Basketball', 'Cricket'],
        status: 'lastyearhit'
    },
    {
        _id: 'fest-pulse-carnival',
        festName: 'Pulse Socio-Cultural Fest',
        collegeName: 'AIIMS Campus',
        city: 'New Delhi',
        festType: 'cultural',
        festDate: 'September 2024',
        footfall: '5-Day Festival',
        prizePool: '₹5.0L Prizes',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
        edition: 'SOCIO-CULTURAL',
        summary: 'Multi-day student festival featuring star concerts, fine arts, and literary debates.',
        tags: ['Live Concert', 'Fine Arts', 'Fashion Show', 'Debate'],
        status: 'lastyearhit'
    },
    {
        _id: 'trek-sahyadri-odyssey',
        festName: 'Sahyadri Summit & Night Trek',
        collegeName: 'Harishchandragad Base',
        city: 'Maharashtra',
        festType: 'treks',
        festDate: 'December 2024',
        footfall: 'Expedition Group',
        prizePool: 'Summit Medals',
        image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=80',
        edition: 'NIGHT TREK',
        summary: 'Guided mountain expedition with certified leaders, safety gear, and sunrise views.',
        tags: ['Night Trek', 'Cliff Camping', 'Bonfire', 'Stargazing'],
        status: 'lastyearhit'
    },
    {
        _id: 'run-city-stride-10k',
        festName: 'CityStride Coastal 10K & 5K Run',
        collegeName: 'Marine Drive Run Club',
        city: 'Mumbai',
        festType: 'sports',
        festDate: 'January 2024',
        footfall: 'Community Run',
        prizePool: 'RFID Bibs & Medals',
        image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
        edition: 'CITY RUN',
        summary: 'Coastal morning run with timing chips, hydration stations, and recovery zones.',
        tags: ['RFID Timing', 'Hydration Zones', 'Finisher Medal', '5K & 10K'],
        status: 'lastyearhit'
    }
];

const SECTION_INDEX_NAV = [
    { label: 'Overview', href: '#overview' },
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'Event Archive', href: '#archive' },
    { label: 'Operating Model', href: '#operating-model' },
    { label: 'Governance & Trust', href: '#governance' },
];

const COMPANY_PILLARS = [
    {
        tag: 'DISCOVERY ENGINE',
        title: 'Centralized Campus Event Discovery',
        description: 'A single verified directory replacing fragmented social media stories and lost flyers. Students find upcoming cultural fests, technical competitions, sports tournaments, and outdoor activities with real-time rules, prize pools, and schedules.',
        icon: Compass,
    },
    {
        tag: 'PASS & TICKETING',
        title: 'Frictionless Digital Passes',
        description: 'Eliminating cumbersome multi-page forms. Participants store their profile once and generate secure, digital QR entry passes for individual competitions or general entry in seconds.',
        icon: Ticket,
    },
    {
        tag: 'GATE OPERATIONS',
        title: 'Sub-Second Volunteer Scanning',
        description: 'Engineered for high-density campus environments. Our offline-capable mobile scanner enables volunteer teams to authenticate attendee passes within 200 milliseconds, eliminating long entry queues.',
        icon: QrCode,
    },
    {
        tag: 'COMMUNITY & HOSTING',
        title: 'Self-Serve Hosting for Any College',
        description: 'Empowering student committees, fest secretariats, and club leads to list events, track team registrations, broadcast live updates, and manage event operations with zero technological overhead.',
        icon: Building2,
    }
];

const CATEGORIES = [
    { id: 'all', label: 'All Archive' },
    { id: 'cultural', label: 'Cultural Fests' },
    { id: 'technical', label: 'Tech & Hackathons' },
    { id: 'sports', label: 'Sports Meets' },
    { id: 'treks', label: 'Treks & Outdoor' }
];

export default function AboutDesktop() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [liveFests, setLiveFests] = useState(() => readFestsCache() || []);

    useEffect(() => {
        let isMounted = true;
        async function loadRealData() {
            try {
                const list = await fetchRawPublicFests({ limit: 120 });
                if (isMounted && Array.isArray(list) && list.length > 0) {
                    setLiveFests(list);
                    writeFestsCache(list);
                }
            } catch (err) {
                console.warn('Could not load dynamic fest cache for About page:', err);
            }
        }
        loadRealData();
        return () => {
            isMounted = false;
        };
    }, []);

    // Combine live backend records with curated past events
    const allEventsList = useMemo(() => {
        if (!liveFests || liveFests.length === 0) {
            return CURATED_PAST_EVENTS;
        }

        const mappedLive = liveFests.map((fest) => {
            const img = pickBestCardImage(fest, 'wide') || fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
            const compCount = Array.isArray(fest.competitions) ? fest.competitions.length : 0;
            return {
                _id: fest._id || fest.id,
                festName: fest.festName || fest.title || 'Campus Fest',
                collegeName: fest.collegeName || 'Campus Venue',
                city: fest.city || fest.location || 'College Campus',
                festType: fest.festType || 'cultural',
                festDate: fest.festDate || fest.date || 'Upcoming',
                footfall: compCount > 0 ? `${compCount} Competitions` : (fest.status === 'lastyearhit' ? 'Past Edition' : 'Live Event'),
                prizePool: fest.prizePool ? `Prize: ${fest.prizePool}` : (fest.entryFee ? `Entry: ₹${fest.entryFee}` : 'Free Entry'),
                image: img || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
                edition: fest.festType ? `${fest.festType.toUpperCase()} EVENT` : 'CAMPUS EVENT',
                summary: fest.description || fest.tagline || 'Explore official competitions, schedules and entry passes on CrwdCtrl.',
                tags: [fest.festType || 'Fest', fest.city || 'Campus', ...(compCount ? [`${compCount} Events`] : [])],
                status: fest.status || 'upcoming',
                originalFest: fest
            };
        });

        const seenIds = new Set(mappedLive.map((e) => e._id));
        const extraHits = CURATED_PAST_EVENTS.filter((e) => !seenIds.has(e._id));
        return [...mappedLive, ...extraHits];
    }, [liveFests]);

    // Filter events
    const filteredEvents = useMemo(() => {
        if (selectedCategory === 'all') return allEventsList.slice(0, 9);
        return allEventsList.filter((e) => e.festType === selectedCategory).slice(0, 9);
    }, [allEventsList, selectedCategory]);

    const handleEventCardClick = (event) => {
        if (event.originalFest) {
            prefetchFestDetail(event.originalFest);
            navigate(festPath(event.originalFest));
        } else {
            navigate('/fests');
        }
    };

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${isDark ? 'bg-[#000000] text-gray-100' : 'bg-[#f8fafc] text-gray-900'}`}>
            <Seo
                title="About CrwdCtrl — The Digital Infrastructure for Campus Events"
                description={ABOUT_DESCRIPTION}
                canonical="/about"
                jsonLd={[
                    webPageSchema({ name: 'About CrwdCtrl', description: ABOUT_DESCRIPTION, url: '/about' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'About', path: '/about' },
                    ]),
                    faqSchema(ABOUT_FAQ),
                ]}
            />

            {/* CrwdCtrl Sticky Top Navigation */}
            <header className={`crwdctrl-sticky-header backdrop-blur-xl border-b transition-colors duration-300 z-50 ${isDark ? 'bg-[#000000]/90 border-gray-800/80' : 'bg-white/90 border-gray-200/80'}`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={goBack}
                            aria-label="Go Back"
                            className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-blue-500 font-bold text-sm leading-none">&gt;</span>
                            <span className="text-xs font-semibold tracking-wide uppercase text-blue-500">
                                CrwdCtrl Index
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/fests"
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-linear-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-xs transition-all"
                        >
                            Explore Fests
                        </Link>
                    </div>
                </div>

                {/* Sub-Header Section Jump Links */}
                <div className={`hidden md:flex max-w-6xl mx-auto px-6 gap-6 text-xs font-medium tracking-wide border-t ${isDark ? 'border-gray-800/60 text-gray-400' : 'border-gray-200/60 text-gray-600'}`}>
                    {SECTION_INDEX_NAV.map((nav, idx) => (
                        <a
                            key={idx}
                            href={nav.href}
                            className="py-2.5 transition-colors hover:text-blue-500"
                        >
                            {nav.label}
                        </a>
                    ))}
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-20 sm:space-y-28">

                {/* 1. HERO (HIGH-CONTRAST PURPOSE STATEMENT IN CRWDCTRL PALETTE) */}
                <section id="overview" className="space-y-6 pt-2">
                    <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                        <span>&gt;</span>
                        <span>About Our Platform</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        Connecting campus energy. <br />
                        <span className="bg-linear-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Reinventing event discovery & participation.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        CrwdCtrl delivers the digital foundation for college fests, competitions, hackathons, sports tournaments, and youth outdoor communities — enabling frictionless discovery, 1-tap passes, and sub-second gate access.
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => navigate('/fests')}
                            className="px-5 py-3 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                            <span>Browse Live Events</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => navigate('/events')}
                            className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all cursor-pointer ${isDark ? 'bg-gray-900/60 border-gray-800 hover:bg-gray-800 text-gray-200' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-900 shadow-xs'}`}
                        >
                            <span>Discover Clubs & Treks</span>
                        </button>
                    </div>
                </section>

                {/* 2. CAPABILITIES GRID (CRWDCTRL BLUE/CYAN THEME) */}
                <section id="capabilities" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                                <span>&gt;</span>
                                <span>What We Do</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                                End-to-End Event Infrastructure
                            </h2>
                        </div>
                        <p className={`text-xs sm:text-sm max-w-md ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Four core capabilities empowering participants, student organizing committees, and club leaders.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {COMPANY_PILLARS.map((pillar, idx) => {
                            const IconC = pillar.icon;
                            return (
                                <div
                                    key={idx}
                                    className={`p-6 sm:p-7 rounded-2xl border transition-all flex flex-col justify-between ${isDark
                                        ? 'bg-[#0f1422] border-gray-800/90 hover:border-blue-500/50'
                                        : 'bg-white border-gray-200 hover:border-blue-300 shadow-xs'
                                        }`}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-mono font-bold text-blue-500 tracking-wider uppercase">
                                                {pillar.tag}
                                            </span>
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                                <IconC className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold tracking-tight">
                                            {pillar.title}
                                        </h3>
                                        <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {pillar.description}
                                        </p>
                                    </div>

                                    <div className="pt-4 mt-4 border-t border-gray-200/50 dark:border-gray-800/80 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-blue-500">
                                        <span>Explore Capabilities</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. LANDMARK EVENTS & PORTFOLIO */}
                <section id="archive" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                                <span>&gt;</span>
                                <span>Event Portfolio</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                                Landmark Editions & Highlights
                            </h2>
                        </div>

                        {/* Category filter tabs */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedCategory === cat.id
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : isDark
                                            ? 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cards Grid with CrwdCtrl Styling */}
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                    >
                        <AnimatePresence>
                            {filteredEvents.map((event) => (
                                <motion.div
                                    layout
                                    key={event._id}
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    transition={{ duration: 0.2 }}
                                    onClick={() => handleEventCardClick(event)}
                                    className={`group rounded-2xl overflow-hidden border flex flex-col justify-between transition-all duration-200 hover:shadow-lg cursor-pointer ${isDark
                                        ? 'bg-[#0f1422] border-gray-800/90 hover:border-blue-500/50'
                                        : 'bg-white border-gray-200 hover:border-blue-300 shadow-xs'
                                        }`}
                                >
                                    <div>
                                        {/* Image Frame */}
                                        <div className="relative h-44 w-full overflow-hidden bg-gray-950">
                                            <img
                                                src={event.image}
                                                alt={event.festName}
                                                loading="lazy"
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />

                                            <div className="absolute top-2.5 left-2.5">
                                                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white">
                                                    {event.edition}
                                                </span>
                                            </div>

                                            <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                                                <div className="text-[11px] font-medium text-blue-300">{event.festDate}</div>
                                                <h3 className="text-sm sm:text-base font-bold truncate leading-tight mt-0.5">
                                                    {event.festName}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Content Block */}
                                        <div className="p-4 space-y-2.5">
                                            <div className="flex items-center gap-1.5 text-xs text-blue-500 font-bold truncate">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">{event.collegeName} • {event.city}</span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-gray-500/10 font-bold">
                                                <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{event.footfall}</span>
                                                <span className="text-blue-500">{event.prizePool}</span>
                                            </div>

                                            <p className={`text-xs leading-relaxed line-clamp-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {event.summary}
                                            </p>

                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                                {event.tags.slice(0, 3).map((tag, tIdx) => (
                                                    <span
                                                        key={tIdx}
                                                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${isDark
                                                            ? 'bg-gray-800/80 text-gray-300 border border-gray-700/60'
                                                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                            }`}
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Link */}
                                    <div className="p-4 pt-2 border-t border-gray-200/50 dark:border-gray-800/80 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-blue-500">
                                        <span>View Event Details</span>
                                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </section>

                {/* 4. OPERATING MODEL (3 SIMPLE STEPS) */}
                <section id="operating-model" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <span>&gt;</span>
                            <span>Operating Model</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Built for Organizers & Participants Alike
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${isDark ? 'bg-[#0f1422] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <div className="text-xl font-bold text-blue-500">01.</div>
                                <h3 className="text-base font-bold">Discover Without Noise</h3>
                                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    No chaotic WhatsApp forwards or missed deadlines. Explore cultural nights, hackathons, sports championships, and outdoor expeditions in one clean place.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="text-xl font-bold text-blue-500">02.</div>
                                <h3 className="text-base font-bold">One-Tap Pass Generation</h3>
                                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Carry a single verifiable digital pass on your phone with instant confirmation and real-time round notifications.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="text-xl font-bold text-blue-500">03.</div>
                                <h3 className="text-base font-bold">Rapid Gate Verification</h3>
                                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Volunteer scanner app works smoothly even in crowded festival grounds with weak network to authenticate passes in milliseconds.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. CORPORATE GOVERNANCE & TRUST DIRECTORY */}
                <section id="governance" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <span>&gt;</span>
                            <span>Governance & Trust</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Legal Entity, Compliance & Contact Desk
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${isDark ? 'bg-[#0f1422] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            <div className="lg:col-span-7 space-y-4">
                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>Verified Entity Compliance</span>
                                </div>
                                <h3 className="text-lg font-bold">Legal Entity & Operator Line</h3>
                                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {LEGAL_OPERATOR_LINE} Operating strictly under Indian digital commerce and consumer protection standards.
                                </p>
                                <div className="text-xs text-gray-400">
                                    Legal Name: <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>{LEGAL_NAME}</span> • Jurisdiction: <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>{LEGAL_JURISDICTION}</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <a
                                        href={`mailto:${LEGAL_EMAIL}`}
                                        className={`p-3 rounded-xl border flex items-center gap-3 text-xs transition-all ${isDark ? 'bg-gray-900/60 border-gray-800 hover:border-blue-500 text-gray-200' : 'bg-gray-50 border-gray-200 hover:border-blue-400 text-gray-900'}`}
                                    >
                                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                                            <Mail className="w-4 h-4 shrink-0" />
                                        </div>
                                        <div className="truncate">
                                            <div className="text-[10px] text-gray-400 uppercase">Support Email</div>
                                            <div className="truncate font-bold">{LEGAL_EMAIL}</div>
                                        </div>
                                    </a>

                                    <a
                                        href={`tel:${LEGAL_PHONE_TEL}`}
                                        className={`p-3 rounded-xl border flex items-center gap-3 text-xs transition-all ${isDark ? 'bg-gray-900/60 border-gray-800 hover:border-blue-500 text-gray-200' : 'bg-gray-50 border-gray-200 hover:border-blue-400 text-gray-900'}`}
                                    >
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                            <Phone className="w-4 h-4 shrink-0" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-400 uppercase">Helpline Telephone</div>
                                            <div className="font-bold">{LEGAL_PHONE_DISPLAY}</div>
                                        </div>
                                    </a>
                                </div>
                            </div>

                            {/* Corporate Policy Directory */}
                            <div className={`lg:col-span-5 p-5 rounded-xl border space-y-3 ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-bold uppercase tracking-wider text-blue-500">
                                    Policy Index & Compliance
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {LEGAL_POLICY_LINKS.map((link) => (
                                        <Link
                                            key={link.to}
                                            to={link.to}
                                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${isDark
                                                ? 'bg-gray-800/80 text-gray-300 hover:bg-blue-600 hover:text-white'
                                                : 'bg-white text-gray-800 hover:bg-blue-600 hover:text-white border border-gray-200'
                                                }`}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>
                                <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-200/50 dark:border-gray-800/60">
                                    Official Portal: <a href={WEBSITE_URL} className="text-blue-500 underline font-bold">crwdctrl.in</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. FAQ ACCORDION */}
                <section className="pt-6 border-t border-gray-200 dark:border-gray-800">
                    <FaqSection items={ABOUT_FAQ} className="px-0" />
                </section>
            </main>
        </div>
    );
}
