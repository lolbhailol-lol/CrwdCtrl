import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useInAppBack } from '../../hooks/useInAppBack';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import {
    SUPPORT_EMAIL,
    LEGAL_PHONE_TEL,
    LEGAL_PHONE_DISPLAY,
} from '../../constants/legalEntity';
import { openWhatsApp } from '../../utils/whatsappDeepLink';
import {
    ArrowLeft,
    Search,
    Ticket,
    Trophy,
    Mountain,
    Building2,
    Compass,
    CreditCard,
    User,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Mail,
    MessageCircle,
    Phone,
    Copy,
    Check,
    Shield,
    FileText,
    Sparkles,
    ArrowRight,
    X,
    Layers,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';

const CATEGORIES = [
    { id: 'all', label: 'All Help Topics', icon: Layers },
    { id: 'tickets', label: 'Tickets & QR Passes', icon: Ticket },
    { id: 'fests', label: 'Fests & Competitions', icon: Trophy },
    { id: 'treks', label: 'Treks & Run Clubs', icon: Mountain },
    { id: 'organizers', label: 'For Organizers', icon: Building2 },
    { id: 'campushunt', label: 'Campus Hunt', icon: Compass },
    { id: 'payments', label: 'Payments & Refunds', icon: CreditCard },
    { id: 'account', label: 'Account & Security', icon: User },
];

const POPULAR_SEARCH_TAGS = [
    'Download QR Pass',
    'Team Registration',
    'List My Fest',
    'Refund Status',
    'Trek Inclusions',
    'Campus Hunt Leaderboard',
    'Payment Failed',
    'Gate Check-in',
];

const HELP_DATA = [
    // --- 1. TICKETS & QR PASSES ---
    {
        id: 't-1',
        category: 'tickets',
        question: 'Where can I find and download my digital QR Pass?',
        answer: 'You can instantly access all your registered fests, competitions, and trek passes in your profile under the "Bookings" or "My Registrations" tab. Every registration generates a verified dynamic QR code that you can show at the event entry gate.',
        action: { label: 'Go to My Passes', path: '/booking' },
    },
    {
        id: 't-2',
        category: 'tickets',
        question: 'What should I do if my payment was deducted but ticket is not showing?',
        answer: 'Banking gateways can occasionally take 2-5 minutes to confirm status with our server. First, refresh your Profile/Bookings page. If the pass still does not appear after 10 minutes, email us with your UPI Transaction ID / UTR or contact our WhatsApp support desk for instant verification.',
        action: { label: 'Contact Support Desk', path: '/contact-us' },
    },
    {
        id: 't-3',
        category: 'tickets',
        question: 'How does fast-track QR scanning work at event entry gates?',
        answer: 'Present your CrwdCtrl digital QR pass on your phone screen at the venue desk. The organizer or volunteer will scan your code using the CrwdCtrl Gate Scanner to grant instant entry. You do not need physical printouts unless specifically stated by the organizer.',
    },
    {
        id: 't-4',
        category: 'tickets',
        question: 'Can I transfer my pass or edit team member names after booking?',
        answer: 'For team competitions and fests, team leaders can request member name corrections before registrations close by reaching out to the respective fest committee listed on the fest page or contacting CrwdCtrl support.',
    },

    // --- 2. FESTS & COMPETITIONS ---
    {
        id: 'f-1',
        category: 'fests',
        question: 'How do I register for solo or team/squad competitions?',
        answer: 'Open the desired fest page, navigate to the "Competitions" tab, and select your event. Choose whether you are participating as a Solo participant or a Team (Duos, Trios, or Squads), enter your team name and teammate details, and proceed to confirm registration.',
        action: { label: 'Explore College Fests', path: '/fests' },
    },
    {
        id: 'f-2',
        category: 'fests',
        question: 'Can students from other colleges or universities participate?',
        answer: 'Yes! Most fests and national hackathons hosted on CrwdCtrl welcome students from all universities, engineering colleges, arts & science campuses across India. Check the specific eligibility guidelines on the competition details card.',
    },
    {
        id: 'f-3',
        category: 'fests',
        question: 'How do pro-night concert passes and celebrity night entries work?',
        answer: 'Fest passes that include celebrity concerts or DJ nights are provisioned as digital passes in your CrwdCtrl account. Some fests offer all-access passes while others have tiered VIP / General entry categories.',
        action: { label: 'Browse Cultural Fests', path: '/cultural-fest' },
    },
    {
        id: 'f-4',
        category: 'fests',
        question: 'Where can I find competition rulebooks, problem statements, and schedules?',
        answer: 'Each competition card includes detailed rules, round timelines, judging criteria, cash prize pool details, and committee coordinator contacts directly on its view page.',
    },

    // --- 3. TREKS & RUN CLUBS ---
    {
        id: 'tr-1',
        category: 'treks',
        question: 'How do I book a trek and choose my pickup / drop location?',
        answer: 'On any Trek page, review the difficulty level, altitude, total distance, and itinerary. When booking, select your preferred pickup point, meal preference (if available), and emergency contact number to complete your booking.',
        action: { label: 'Explore Treks & Trails', path: '/treks' },
    },
    {
        id: 'tr-2',
        category: 'treks',
        question: 'What is included in a trek booking and what should I pack?',
        answer: 'Trek inclusions usually cover trek leader guidance, first-aid assistance, forest permits, and breakfast/meals as specified on the trek details page. Packing recommendations (trekking shoes, rainwear, 2L water, powerbank) are detailed on each listing.',
    },
    {
        id: 'tr-3',
        category: 'treks',
        question: 'How do local Running Clubs and weekend fitness meetups work?',
        answer: 'CrwdCtrl connects you with running communities and marathon training groups. You can view upcoming 5K/10K run events, assemble at the scheduled start point, and track distance routes with fellow runners.',
        action: { label: 'Explore Sports & Runs', path: '/sports' },
    },

    // --- 4. FOR ORGANIZERS ---
    {
        id: 'o-1',
        category: 'organizers',
        question: 'How can college committees and student clubs list their fest on CrwdCtrl?',
        answer: 'College committees can list their college fest, tech hackathon, sports meet, or adventure trek by visiting the "List your fest" portal. The CrwdCtrl team verifies the listing and provides your organizer dashboard within 24 hours.',
        action: { label: 'List Your Fest Free', path: '/list-your-fest' },
    },
    {
        id: 'o-2',
        category: 'organizers',
        question: 'What tools and features are included in the Organizer Dashboard?',
        answer: 'Organizers receive a complete event management suite: live participant count analytics, dynamic QR scanner for fast gate entry, 1-click attendee data CSV export, custom coupon code management, and tier pricing controls.',
    },
    {
        id: 'o-3',
        category: 'organizers',
        question: 'How and when do organizers receive registration payouts?',
        answer: 'Revenues collected from paid event registrations are tracked in your organizer portal and disbursed directly to the college committee or organizer bank account with complete itemized billing statements.',
    },
    {
        id: 'o-4',
        category: 'organizers',
        question: 'Can organizers set maximum registration caps and promo discounts?',
        answer: 'Yes! You can configure participant limits for individual competitions (e.g. max 50 teams for RoboWars) and generate custom percentage or flat discount coupon codes.',
    },

    // --- 5. CAMPUS HUNT ---
    {
        id: 'ch-1',
        category: 'campushunt',
        question: 'What is Campus Hunt and how do I participate?',
        answer: 'Campus Hunt is CrwdCtrl’s interactive campus exploration game. When an active hunt is live at your fest or college, join with your squad or solo, solve riddles, locate hidden campus checkpoints, and scan QR markers.',
    },
    {
        id: 'ch-2',
        category: 'campushunt',
        question: 'How does clue validation and the live leaderboard work?',
        answer: 'Each solved clue unlocks the coordinates to the next checkpoint. Scanning the designated location code logs your completion timestamp and updates your position on the real-time leaderboard.',
    },

    // --- 6. PAYMENTS & REFUNDS ---
    {
        id: 'p-1',
        category: 'payments',
        question: 'What payment methods are supported on CrwdCtrl?',
        answer: 'We support all major Indian payment methods via secure RBI-compliant payment gateways: UPI (Google Pay, PhonePe, Paytm, BHIM), Debit & Credit Cards (Visa, MasterCard, RuPay), and Net Banking across 50+ Indian banks.',
    },
    {
        id: 'p-2',
        category: 'payments',
        question: 'What is the refund policy for cancelled or rescheduled events?',
        answer: 'If an event or trek is cancelled by the organizer, eligible ticket holders receive a full refund back to their original payment source per our Refund & Cancellation policy. For user-initiated cancellations, organizer terms apply.',
        action: { label: 'View Refund Policy', path: '/refunds-and-cancellations' },
    },
    {
        id: 'p-3',
        category: 'payments',
        question: 'How do I download my payment invoice or tax receipt?',
        answer: 'Every completed registration includes a downloadable digital receipt with GST details (if applicable), transaction reference ID, and organizer confirmation.',
        action: { label: 'Products & Pricing Info', path: '/products-and-services' },
    },

    // --- 7. ACCOUNT & SECURITY ---
    {
        id: 'a-1',
        category: 'account',
        question: 'How do I update my profile, college name, and contact details?',
        answer: 'Tap your Profile icon to access your personal dashboard. From there, you can update your display name, college institution, department, and phone number anytime.',
        action: { label: 'Open Profile Settings', path: '/profile' },
    },
    {
        id: 'a-2',
        category: 'account',
        question: 'How does CrwdCtrl protect my data and contact information?',
        answer: 'We follow stringent data protection practices. Your personal credentials and contact numbers are encrypted and only shared with verified organizers of events you explicitly register for.',
        action: { label: 'Read Privacy Policy', path: '/privacy-policy' },
    },
    {
        id: 'a-3',
        category: 'account',
        question: 'How can I request permanent deletion of my CrwdCtrl account?',
        answer: 'You can submit a permanent account and data deletion request at any time through our dedicated Delete Account portal or by writing to privacy@crwdctrl.in.',
        action: { label: 'Delete Account Request', path: '/delete-account' },
    },
];

const LEGAL_LINKS = [
    { label: 'Terms & Conditions', path: '/terms-and-conditions', desc: 'Rules & service usage guidelines' },
    { label: 'Privacy Policy', path: '/privacy-policy', desc: 'How we protect & handle your data' },
    { label: 'Refunds & Cancellations', path: '/refunds-and-cancellations', desc: 'Eligibility & settlement timeline' },
    { label: 'Shipping & Delivery', path: '/shipping-policy', desc: 'Digital pass delivery information' },
    { label: 'Products & Services', path: '/products-and-services', desc: 'Pricing & INR fee structure' },
    { label: 'Delete Account', path: '/delete-account', desc: 'Account & data deletion request' },
    { label: 'About Us', path: '/about', desc: 'Our mission & leadership team' },
    { label: 'Contact Us', path: '/contact-us', desc: 'Official helpline & office address' },
];

export default function HelpCenter() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const goBack = useInAppBack();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [expandedItem, setExpandedItem] = useState(null);
    const [copiedEmail, setCopiedEmail] = useState(false);

    const handleCopyEmail = () => {
        navigator.clipboard.writeText(SUPPORT_EMAIL);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
    };

    const handleWhatsAppSupport = () => {
        openWhatsApp(LEGAL_PHONE_TEL, 'Hi CrwdCtrl Support Team, I need assistance with my event/registration.');
    };

    const handleEmailSupport = () => {
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('CrwdCtrl Support & Assistance Request')}`;
    };

    // Filter help items based on search and selected category
    const filteredHelpItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return HELP_DATA.filter((item) => {
            const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
            if (!matchesCategory) return false;

            if (!query) return true;
            const textHaystack = `${item.question} ${item.answer} ${item.category}`.toLowerCase();
            return textHaystack.includes(query);
        });
    }, [searchQuery, selectedCategory]);

    const toggleExpand = (id) => {
        setExpandedItem((prev) => (prev === id ? null : id));
    };

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 ${
            isDark ? 'bg-[#030712] text-gray-100' : 'bg-slate-50/70 text-gray-900'
        }`}>
            <Seo
                title="Help Center — CrwdCtrl"
                description="Find instant solutions for ticket passes, QR entry, fest registrations, treks, organizer dashboards, payments, refunds, and support on CrwdCtrl."
                canonical="/help-center"
                jsonLd={[
                    webPageSchema({
                        name: 'CrwdCtrl Help Center',
                        description: 'Official Help and Support Center for CrwdCtrl.',
                        url: '/help-center',
                    }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Help Center', path: '/help-center' },
                    ]),
                ]}
            />

            {/* Mobile Header Bar */}
            <div className="lg:hidden sticky top-0 z-30 backdrop-blur-md border-b transition-colors duration-200 border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-[#070d1e]/80">
                <div className="flex items-center justify-between px-4 py-3.5">
                    <button
                        onClick={goBack}
                        className={`flex items-center space-x-2 px-2 py-1 rounded-lg transition-colors ${
                            isDark ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                        aria-label="Go Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-semibold text-base">Help Center</span>
                    </button>
                    <button
                        onClick={() => navigate('/faq')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                            isDark
                                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50'
                                : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100'
                        }`}
                    >
                        Full FAQs
                    </button>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
                {/* Desktop Back Navigation */}
                <div className="hidden lg:flex items-center justify-between mb-6">
                    <button
                        onClick={goBack}
                        className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl font-medium text-sm transition-all ${
                            isDark
                                ? 'text-gray-400 hover:text-white hover:bg-gray-800/70 border border-gray-800'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-white border border-gray-200 shadow-xs'
                        }`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                    <button
                        onClick={() => navigate('/faq')}
                        className={`inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                            isDark
                                ? 'bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border-cyan-500/30 text-cyan-300 hover:border-cyan-400/60'
                                : 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50 shadow-xs'
                        }`}
                    >
                        <HelpCircle className="w-4 h-4" />
                        <span>View All FAQs Directory</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                </div>

                {/* Hero & Search Banner */}
                <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-10 mb-8 border transition-all ${
                    isDark
                        ? 'bg-gradient-to-b from-[#0e172e] via-[#091124] to-[#040817] border-cyan-900/30 shadow-2xl shadow-cyan-950/30'
                        : 'bg-gradient-to-b from-cyan-50/70 via-blue-50/40 to-white border-cyan-100 shadow-xl shadow-cyan-900/5'
                }`}>
                    {/* Glowing background shapes */}
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-1/4 -mb-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase mb-4 border bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>CrwdCtrl Support & Knowledge Base</span>
                        </div>

                        <h1 className={`text-2xl sm:text-4xl font-extrabold tracking-tight mb-3 ${
                            isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                            How can we help you today?
                        </h1>
                        <p className={`text-sm sm:text-base font-normal max-w-xl mx-auto mb-6 ${
                            isDark ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                            Search answers for QR tickets, fest passes, organizer setup, payments, and event check-ins.
                        </p>

                        {/* Search Input Box */}
                        <div className="relative max-w-2xl mx-auto">
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
                                isDark ? 'text-cyan-400' : 'text-cyan-600'
                            }`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search queries (e.g., download ticket, list fest, refund, QR scan)..."
                                className={`w-full pl-12 pr-10 py-3.5 rounded-2xl text-sm sm:text-base border transition-all focus:outline-none focus:ring-2 ${
                                    isDark
                                        ? 'bg-[#050b18]/90 border-gray-700/80 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-cyan-500/30 shadow-inner'
                                        : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-cyan-500 focus:ring-cyan-500/20 shadow-md'
                                }`}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full ${
                                        isDark ? 'text-gray-400 hover:text-white bg-gray-800' : 'text-gray-500 hover:text-gray-900 bg-gray-100'
                                    }`}
                                    aria-label="Clear Search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Popular Quick Search Tags */}
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                Popular:
                            </span>
                            {POPULAR_SEARCH_TAGS.map((tag, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSearchQuery(tag)}
                                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                        searchQuery.toLowerCase() === tag.toLowerCase()
                                            ? 'bg-cyan-600 border-cyan-500 text-white font-medium'
                                            : isDark
                                            ? 'bg-gray-900/60 border-gray-800 text-gray-300 hover:border-cyan-500/50 hover:text-cyan-300'
                                            : 'bg-white/80 border-gray-200 text-gray-700 hover:border-cyan-400 hover:text-cyan-700 shadow-xs'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick Action Hub: Direct Entry Points */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Quick Assistance Hub
                        </h2>
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Instant 1-Click Access
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Action 1: My Passes */}
                        <div
                            onClick={() => navigate('/booking')}
                            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                isDark
                                    ? 'bg-gradient-to-br from-[#0c1427] to-[#080d1a] border-gray-800/90 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-950/30'
                                    : 'bg-white border-gray-200/90 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-900/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                                    <Ticket className="w-5 h-5" />
                                </div>
                                <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                                    isDark ? 'text-gray-500 group-hover:text-cyan-400' : 'text-gray-400 group-hover:text-cyan-600'
                                }`} />
                            </div>
                            <h3 className={`font-semibold text-base mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                My Passes & Tickets
                            </h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Access and download dynamic QR entry passes for registered fests & treks.
                            </p>
                        </div>

                        {/* Action 2: List Your Fest */}
                        <div
                            onClick={() => navigate('/list-your-fest')}
                            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                isDark
                                    ? 'bg-gradient-to-br from-[#0c1427] to-[#080d1a] border-gray-800/90 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-950/30'
                                    : 'bg-white border-gray-200/90 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-900/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                                    isDark ? 'text-gray-500 group-hover:text-purple-400' : 'text-gray-400 group-hover:text-purple-600'
                                }`} />
                            </div>
                            <h3 className={`font-semibold text-base mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                List Your Fest Free
                            </h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                College committees can publish fests, hackathons, and scan passes for free.
                            </p>
                        </div>

                        {/* Action 3: Treks & Runs */}
                        <div
                            onClick={() => navigate('/treks')}
                            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                isDark
                                    ? 'bg-gradient-to-br from-[#0c1427] to-[#080d1a] border-gray-800/90 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-950/30'
                                    : 'bg-white border-gray-200/90 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-900/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                    <Mountain className="w-5 h-5" />
                                </div>
                                <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                                    isDark ? 'text-gray-500 group-hover:text-emerald-400' : 'text-gray-400 group-hover:text-emerald-600'
                                }`} />
                            </div>
                            <h3 className={`font-semibold text-base mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Treks & Communities
                            </h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Discover sunrise peaks, weekend runs, trails, and group guidelines.
                            </p>
                        </div>

                        {/* Action 4: Full FAQ Directory */}
                        <div
                            onClick={() => navigate('/faq')}
                            className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                isDark
                                    ? 'bg-gradient-to-br from-[#0c1427] to-[#080d1a] border-gray-800/90 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-950/30'
                                    : 'bg-white border-gray-200/90 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-900/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                    <HelpCircle className="w-5 h-5" />
                                </div>
                                <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                                    isDark ? 'text-gray-500 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-blue-600'
                                }`} />
                            </div>
                            <h3 className={`font-semibold text-base mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Browse All FAQs
                            </h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Comprehensive 30+ question directory answering all platform rules.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Interactive Category Filter Pills */}
                <div className="mb-6">
                    <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-2 pt-1">
                        {CATEGORIES.map((cat) => {
                            const IconComponent = cat.icon;
                            const isActive = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                                        isActive
                                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20'
                                            : isDark
                                            ? 'bg-gray-900/80 border border-gray-800 text-gray-300 hover:bg-gray-850 hover:text-white hover:border-gray-700'
                                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-xs'
                                    }`}
                                >
                                    <IconComponent className="w-4 h-4" />
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Accordion Questions & Solutions List */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {selectedCategory === 'all'
                                ? 'Frequently Asked Questions & Guides'
                                : CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Help Topics'}
                        </h2>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                        }`}>
                            {filteredHelpItems.length} {filteredHelpItems.length === 1 ? 'Topic' : 'Topics'}
                        </span>
                    </div>

                    {filteredHelpItems.length > 0 ? (
                        <div className="space-y-3">
                            {filteredHelpItems.map((item) => {
                                const isOpen = expandedItem === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        className={`rounded-2xl border transition-all duration-200 ${
                                            isOpen
                                                ? isDark
                                                    ? 'bg-[#0a1224] border-cyan-500/50 shadow-md shadow-cyan-950/40'
                                                    : 'bg-white border-cyan-300 shadow-md shadow-cyan-900/5'
                                                : isDark
                                                ? 'bg-[#060c1a]/90 border-gray-800/80 hover:border-gray-700 hover:bg-[#091122]'
                                                : 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
                                        }`}
                                    >
                                        <button
                                            onClick={() => toggleExpand(item.id)}
                                            className="w-full flex items-start justify-between p-4 sm:p-5 text-left focus:outline-none"
                                            aria-expanded={isOpen}
                                        >
                                            <div className="flex items-start space-x-3 pr-4">
                                                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                                                    isOpen
                                                        ? 'bg-cyan-500/20 text-cyan-500 dark:text-cyan-400'
                                                        : isDark
                                                        ? 'bg-gray-800 text-gray-400'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    <HelpCircle className="w-4 h-4" />
                                                </div>
                                                <span className={`font-semibold text-sm sm:text-base leading-snug ${
                                                    isOpen
                                                        ? isDark
                                                            ? 'text-cyan-300'
                                                            : 'text-cyan-700'
                                                        : isDark
                                                        ? 'text-gray-100'
                                                        : 'text-gray-800'
                                                }`}>
                                                    {item.question}
                                                </span>
                                            </div>
                                            <div className={`p-1 rounded-lg shrink-0 transition-transform duration-200 ${
                                                isOpen
                                                    ? 'text-cyan-500 rotate-180'
                                                    : isDark
                                                    ? 'text-gray-400'
                                                    : 'text-gray-500'
                                            }`}>
                                                <ChevronDown className="w-5 h-5" />
                                            </div>
                                        </button>

                                        {isOpen && (
                                            <div className={`px-4 sm:px-5 pb-5 pt-1 text-sm border-t ${
                                                isDark ? 'border-gray-800/80 text-gray-300' : 'border-gray-100 text-gray-600'
                                            }`}>
                                                <p className="leading-relaxed mb-4">
                                                    {item.answer}
                                                </p>

                                                {item.action && (
                                                    <button
                                                        onClick={() => navigate(item.action.path)}
                                                        className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                                            isDark
                                                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                                                                : 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'
                                                        }`}
                                                    >
                                                        <span>{item.action.label}</span>
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={`text-center py-12 rounded-2xl border ${
                            isDark ? 'bg-[#070e1e] border-gray-800 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
                        }`}>
                            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-cyan-500/70" />
                            <h3 className={`font-semibold text-base mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                No help topics match "{searchQuery}"
                            </h3>
                            <p className="text-xs max-w-md mx-auto mb-4">
                                Try searching for "ticket", "refund", "fest", "organizer", or reach out to our team below.
                            </p>
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedCategory('all');
                                }}
                                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-700 transition"
                            >
                                Reset Search Filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Policies, Compliance & Legal Grid */}
                <div className={`p-6 sm:p-8 rounded-3xl border mb-10 transition-all ${
                    isDark
                        ? 'bg-gradient-to-br from-[#091024] to-[#040816] border-gray-800'
                        : 'bg-white border-gray-200/90 shadow-sm'
                }`}>
                    <div className="flex items-center space-x-2.5 mb-2">
                        <Shield className="w-5 h-5 text-cyan-500" />
                        <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Policies, Guidelines & Legal Directory
                        </h2>
                    </div>
                    <p className={`text-xs sm:text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Read our official platform terms, cancellation policies, privacy governance, and entity information.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {LEGAL_LINKS.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                                    isDark
                                        ? 'bg-[#050b18] border-gray-800 hover:border-cyan-500/50 hover:bg-[#0a1228]'
                                        : 'bg-slate-50 border-gray-200 hover:border-cyan-400 hover:bg-cyan-50/40'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {item.label}
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 text-cyan-500" />
                                </div>
                                <span className={`text-[11px] leading-tight ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {item.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Direct Support & Escalation Hub */}
                <div className={`relative overflow-hidden p-6 sm:p-8 rounded-3xl border ${
                    isDark
                        ? 'bg-gradient-to-r from-[#0b162e] via-[#091224] to-[#080e1e] border-cyan-500/30 shadow-xl'
                        : 'bg-gradient-to-r from-blue-50 via-cyan-50/60 to-slate-50 border-cyan-200 shadow-md'
                }`}>
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 text-cyan-500 mb-3">
                            <MessageCircle className="w-7 h-7" />
                        </div>
                        <h3 className={`text-xl sm:text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Still have questions? We're here to help!
                        </h3>
                        <p className={`text-xs sm:text-sm max-w-lg mx-auto mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Can't find what you are looking for? Contact our dedicated support team directly via WhatsApp or Email.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {/* WhatsApp Button */}
                            <button
                                onClick={handleWhatsAppSupport}
                                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all transform active:scale-95"
                            >
                                <MessageCircle className="w-4 h-4" />
                                <span>WhatsApp Support Desk</span>
                            </button>

                            {/* Email Button */}
                            <button
                                onClick={handleEmailSupport}
                                className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border transition-all ${
                                    isDark
                                        ? 'bg-gray-800/80 hover:bg-gray-800 text-white border-gray-700 hover:border-cyan-400'
                                        : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-300 hover:border-cyan-500 shadow-xs'
                                }`}
                            >
                                <Mail className="w-4 h-4 text-cyan-500" />
                                <span>Email: {SUPPORT_EMAIL}</span>
                            </button>

                            {/* Copy Email Button */}
                            <button
                                onClick={handleCopyEmail}
                                className={`inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                                    isDark
                                        ? 'bg-gray-900/90 text-gray-300 border-gray-800 hover:text-white'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                                }`}
                                title="Copy email address"
                            >
                                {copiedEmail ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        <span className="text-emerald-500">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        <span>Copy Email</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className={`mt-5 text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Helpline: <a href={`tel:${LEGAL_PHONE_TEL}`} className="underline hover:text-cyan-500">{LEGAL_PHONE_DISPLAY}</a> • Response time: Under 2 hours during event days
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
