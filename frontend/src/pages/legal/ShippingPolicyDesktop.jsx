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
    Truck,
    Smartphone,
    Mail,
    QrCode,
    Zap,
    CheckCircle2,
    Clock,
    AlertCircle,
    Building2,
    Ticket,
    HelpCircle
} from 'lucide-react';

const DIGITAL_DISPATCH_PILLARS = [
    {
        icon: Zap,
        title: 'Instant Sub-Second Issuance',
        description: 'Immediately following verified payment, your digital entry pass and unique QR code are generated in your CrwdCtrl account.'
    },
    {
        icon: Mail,
        title: 'Email Confirmation Dispatch',
        description: 'A backup copy of your booking receipt and ticket summary is sent to your registered email address within seconds.'
    },
    {
        icon: QrCode,
        title: 'Offline-Ready Gate QR',
        description: 'Your pass contains a cryptographically signed QR code readable by venue volunteers within 200ms, even during weak campus network conditions.'
    },
    {
        icon: Smartphone,
        title: 'Permanent Profile Wallet',
        description: 'All past, active, and upcoming passes remain accessible anytime under your user profile "Passes" section.'
    }
];

export default function ShippingPolicyDesktop() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const pageDescription =
        'CrwdCtrl digital dispatch policy. All ticket passes, competition entries, and receipts are delivered electronically. No physical parcels or shipping fees apply.';

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Shipping & Digital Dispatch Policy — CrwdCtrl"
                description={pageDescription}
                canonical="/shipping-policy"
                jsonLd={[
                    webPageSchema({ name: 'CrwdCtrl Shipping & Delivery Policy', description: pageDescription, url: '/shipping-policy' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Shipping Policy', path: '/shipping-policy' },
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
                                Digital Dispatch Policy
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
                        <Zap className="w-3.5 h-3.5" />
                        <span>100% Instant Digital Dispatch | Zero Physical Parcels</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        Instant digital passes. <br />
                        <span className="bg-linear-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Zero physical shipping delays.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        CrwdCtrl operates strictly as an electronic ticketing, competition registration, and event discovery platform. We do not dispatch physical products, parcels, or paper tickets.
                    </p>

                    {/* Meta Info Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Delivery Format</div>
                            <div className="font-bold mt-0.5 text-blue-500">Digital QR Pass &amp; PDF</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Delivery Speed</div>
                            <div className="font-bold mt-0.5 text-emerald-500">Instant (Sub-Second)</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Shipping Fee</div>
                            <div className="font-bold mt-0.5 text-cyan-500">₹0 (Free Dispatch)</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Physical Courier</div>
                            <div className="font-bold mt-0.5">Not Applicable</div>
                        </div>
                    </div>
                </section>

                {/* 2. NO PHYSICAL SHIPPING CLARIFICATION */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Truck className="w-3.5 h-3.5" />
                            <span>01. Physical Shipping Scope</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Exclusion of Physical Courier Services
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {LEGAL_OPERATOR_LINE} CrwdCtrl (<a href={WEBSITE_URL} className="text-blue-500 font-bold underline">crwdctrl.in</a>) does not sell, package, or ship any tangible merchandise, physical goods, or physical tickets.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className={`p-5 rounded-xl border ${
                                isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">
                                    No Physical Addresses Required
                                </h3>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    You will never be asked for postal addresses, pin codes, or courier tracking during checkout on CrwdCtrl. All items are delivered to your digital device.
                                </p>
                            </div>

                            <div className={`p-5 rounded-xl border ${
                                isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-2">
                                    Zero Shipping Charges
                                </h3>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    There are no shipping costs, courier partner charges, handling fees, or customs duties associated with any transaction made on our platform.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. DIGITAL DISPATCH ARCHITECTURE */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>02. Electronic Delivery</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            How Your Pass is Dispatched
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {DIGITAL_DISPATCH_PILLARS.map((pillar, idx) => {
                            const IconComponent = pillar.icon;
                            return (
                                <div
                                    key={idx}
                                    className={`p-6 rounded-2xl border flex flex-col justify-between ${
                                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                                    }`}
                                >
                                    <div>
                                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 w-fit mb-4">
                                            <IconComponent className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-base font-bold mb-2">{pillar.title}</h3>
                                        <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {pillar.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 4. DISPATCH QUESTIONS & SUPPORT DESK */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>03. Assistance</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Didn't Receive Your Pass?
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-6 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <div className="space-y-2 max-w-xl">
                            <h3 className="text-base font-bold">Fast Pass Recovery</h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                If your email confirmation didn't arrive, check your spam/promotions folder or log into your account to view your pass QR immediately. For payment deductions without pass generation, email us with your transaction reference.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Link
                                to="/contact-us"
                                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all text-center whitespace-nowrap shadow-xs"
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
                                    link.to === '/shipping-policy'
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
