import React from 'react';
import { Link } from 'react-router-dom';
import { useInAppBack } from '../../hooks/useInAppBack';
import { useDarkMode } from '../../context/DarkModeContext';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import {
    LEGAL_EMAIL,
    LEGAL_NAME,
    LEGAL_OPERATOR_LINE,
    LEGAL_PHONE_DISPLAY,
    LEGAL_PHONE_TEL,
    WEBSITE_URL,
    LEGAL_JURISDICTION,
    LEGAL_POLICY_LINKS
} from '../../constants/legalEntity';
import {
    ArrowLeft,
    IndianRupee,
    Calendar,
    Trophy,
    Mountain,
    Theater,
    Users,
    Ticket,
    CheckCircle2,
    Sparkles,
    ArrowRight,
    Building2,
    ShieldCheck
} from 'lucide-react';

const SERVICES_CATALOG = [
    {
        icon: Calendar,
        title: 'College Fest Discovery & Schedules',
        description: 'Comprehensive directory of cultural, technical, management, and sports fests from colleges across India with verified dates and guidelines.',
        pricing: '100% Free for Students',
        pricingBadge: 'Free Tier',
        category: 'Discovery'
    },
    {
        icon: Trophy,
        title: 'Competition & Tournament Registrations',
        description: 'Single and team entry registrations for collegiate battles including Battle of Bands, Hackathons, Dance Trophies, Cricket, and RoboWars.',
        pricing: 'Organizer-defined in ₹ (INR); shown before checkout',
        pricingBadge: 'Per Team / Entry',
        category: 'Competitions'
    },
    {
        icon: Ticket,
        title: 'Fest All-Access & Pro-Night Passes',
        description: 'Official digital QR entry passes for campus access, celebrity concerts, DJ nights, and multi-day festival packages.',
        pricing: 'Organizer-defined in ₹ (INR); shown before checkout',
        pricingBadge: 'Entry Passes',
        category: 'Ticketing'
    },
    {
        icon: Mountain,
        title: 'Guided Treks & Outdoor Expeditions',
        description: 'Curated mountain treks, summit night hikes, waterfall trails, and camping journeys organized by certified outdoor clubs.',
        pricing: 'Per-person fee in ₹ (INR); total shown before checkout',
        pricingBadge: 'Per Expedition',
        category: 'Outdoor'
    },
    {
        icon: Theater,
        title: 'Campus Shows, Plays & Live Concerts',
        description: 'Reserved seating and gate passes for college drama society plays, stand-up comedy shows, workshops, and music festivals.',
        pricing: 'Ticket price in ₹ (INR) per show',
        pricingBadge: 'Live Events',
        category: 'Entertainment'
    },
    {
        icon: Users,
        title: 'Run Clubs & Community Sports Meets',
        description: 'Timed 5K/10K community runs, social athletics, and inter-university meetups with digital check-ins and finisher bibs.',
        pricing: 'Free or listed entry fee in ₹ (INR)',
        pricingBadge: 'Community',
        category: 'Sports & Run'
    }
];

const PRICING_BREAKDOWN = [
    { item: 'Free Fest / Competition Entry', ticket: '₹0', fee: '₹0', total: '₹0' },
    { item: 'Inter-College Hackathon / Solo Dance (Sample)', ticket: '₹500', fee: '₹15', total: '₹515' },
    { item: 'Multi-Day Cultural Fest Pass (Sample)', ticket: '₹1,000', fee: '₹30', total: '₹1,030' },
    { item: 'Sahyadri Guided Trek — 2 Participants (Sample)', ticket: '₹2,400', fee: '₹72', total: '₹2,472' }
];

export default function ProductsAndServices() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const pageDescription =
        'Explore the full products, digital services, and transparent INR (₹) pricing catalog offered by CrwdCtrl for campus fests, competitions, treks, and tickets.';

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Products, Services & Pricing Catalog — CrwdCtrl"
                description={pageDescription}
                canonical="/products-and-services"
                jsonLd={[
                    webPageSchema({ name: 'CrwdCtrl Products & Services', description: pageDescription, url: '/products-and-services' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Products & Services', path: '/products-and-services' },
                    ]),
                ]}
            />

            {/* Sticky Glass Top Header */}
            <header className={`crwdctrl-sticky-header backdrop-blur-xl border-b transition-colors duration-300 z-50 ${
                isDark ? 'bg-[#04060A]/90 border-gray-800/80' : 'bg-white/90 border-gray-200/80'
            }`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={goBack}
                            aria-label="Go Back"
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-blue-500 font-bold text-sm leading-none">&gt;</span>
                            <span className="text-xs font-semibold tracking-wide uppercase text-blue-500">
                                Products &amp; Services
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
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16 sm:space-y-20">

                {/* 1. HERO SECTION */}
                <section className="space-y-6 pt-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase border bg-blue-500/10 text-blue-500 border-blue-500/30">
                        <IndianRupee className="w-3.5 h-3.5" />
                        <span>Transparent INR (₹) Pricing | Campus Digital Catalog</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        Products, services &amp; pricing. <br />
                        <span className="bg-linear-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Engineered for campus culture.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {LEGAL_OPERATOR_LINE} Every event ticket, competition slot, and experience pass on CrwdCtrl is clearly priced and billed exclusively in Indian Rupees (INR / ₹) with zero surprise fees.
                    </p>

                    {/* Meta Pillars Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Currency Anchor</div>
                            <div className="font-bold mt-0.5 text-blue-500">Indian Rupee (INR / ₹)</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Discovery Portal</div>
                            <div className="font-bold mt-0.5 text-emerald-500">100% Free to Browse</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Platform Fee</div>
                            <div className="font-bold mt-0.5 text-cyan-500">3% (Pre-Checkout Shown)</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Payment Rails</div>
                            <div className="font-bold mt-0.5">UPI, Cards &amp; NetBanking</div>
                        </div>
                    </div>
                </section>

                {/* 2. SERVICES CATALOG GRID */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>01. Solutions &amp; Offerings</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            What We Offer Across Campuses
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SERVICES_CATALOG.map((item, idx) => {
                            const IconComponent = item.icon;
                            return (
                                <div
                                    key={idx}
                                    className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between group transition-all duration-300 ${
                                        isDark
                                            ? 'bg-[#0B0F19] border-gray-800/90 hover:border-blue-500/50 hover:shadow-[0_0_25px_rgba(14,204,238,0.08)]'
                                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                <IconComponent className="w-5 h-5" />
                                            </div>
                                            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                                                {item.pricingBadge}
                                            </span>
                                        </div>

                                        <h3 className="text-base font-bold mb-2 group-hover:text-blue-500 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className={`text-xs leading-relaxed mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {item.description}
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200/60 dark:border-gray-800/60 flex items-center justify-between">
                                        <div className="text-[11px] font-mono font-bold text-emerald-500">
                                            {item.pricing}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. TRANSPARENT PRICING BREAKDOWN TABLE */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>02. Fee Transparency</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Sample Pricing Breakdown (INR / ₹)
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-4 overflow-x-auto ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Actual event tickets are set by the respective college committees or club leads. CrwdCtrl applies a transparent platform convenience fee (3% of the ticket price, rounded up), shown upfront before payment confirmation.
                        </p>

                        <div className="overflow-x-auto pt-2">
                            <table className="w-full text-xs sm:text-sm text-left min-w-[500px]">
                                <thead>
                                    <tr className={`border-b text-xs font-mono uppercase tracking-wider ${
                                        isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'
                                    }`}>
                                        <th className="py-3 pr-4 font-bold">Event / Experience Type</th>
                                        <th className="py-3 px-4 font-bold">Ticket Base (₹)</th>
                                        <th className="py-3 px-4 font-bold">Platform Fee 3% (₹)</th>
                                        <th className="py-3 pl-4 font-bold text-blue-500">Final Charged Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDark ? 'divide-gray-800/80 text-gray-300' : 'divide-gray-100 text-gray-800'}`}>
                                    {PRICING_BREAKDOWN.map((row, idx) => (
                                        <tr key={idx} className="transition-colors hover:bg-blue-500/5">
                                            <td className="py-3.5 pr-4 font-medium">{row.item}</td>
                                            <td className="py-3.5 px-4 font-mono">{row.ticket}</td>
                                            <td className="py-3.5 px-4 font-mono text-gray-400">{row.fee}</td>
                                            <td className="py-3.5 pl-4 font-mono font-bold text-emerald-500">{row.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* 4. DISCOVER LIVE EVENTS BANNER */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className={`p-6 sm:p-8 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
                        isDark ? 'bg-gradient-to-br from-blue-950/20 via-[#0B0F19] to-transparent border-blue-500/30' : 'bg-gradient-to-br from-blue-50/80 via-white to-white border-blue-200 shadow-xs'
                    }`}>
                        <div className="space-y-2 max-w-xl">
                            <h3 className="text-xl font-bold">Browse Live Events &amp; Real-Time Prices</h3>
                            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                Check out live cultural fests, upcoming tournaments, and weekend community treks active right now on CrwdCtrl.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            <Link
                                to="/fests"
                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs"
                            >
                                Explore Fests
                            </Link>
                            <Link
                                to="/events"
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                    isDark ? 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                View Events &amp; Shows
                            </Link>
                            <Link
                                to="/contact-us"
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                    isDark ? 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                Contact Support
                            </Link>
                        </div>
                    </div>
                </section>

                {/* 5. LEGAL DIRECTORY INDEX */}
                <section className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-blue-500">
                                Policy Index &amp; Legal Framework
                            </div>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Official corporate policies governing the CrwdCtrl digital platform.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {LEGAL_POLICY_LINKS.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    link.to === '/products-and-services'
                                        ? 'bg-blue-600 text-white font-bold'
                                        : isDark
                                        ? 'bg-gray-800/80 text-gray-300 hover:bg-blue-600 hover:text-white'
                                        : 'bg-white text-gray-800 hover:bg-blue-600 hover:text-white border border-gray-200'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
