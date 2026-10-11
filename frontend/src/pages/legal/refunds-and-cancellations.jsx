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
    RefreshCw,
    XCircle,
    Clock,
    Mail,
    Phone,
    ShieldAlert,
    CheckCircle2,
    IndianRupee,
    AlertTriangle,
    CreditCard,
    FileText,
    Building2,
    HelpCircle
} from 'lucide-react';

const REFUND_TIMELINE_STEPS = [
    {
        step: '01',
        title: 'Cancellation Notice / Request',
        description: 'Organizer announces official event cancellation or attendee submits cancellation before published cut-off.'
    },
    {
        step: '02',
        title: 'Desk Verification (2–3 Days)',
        description: 'CrwdCtrl dispatch verifies order ID, ticket validity, and organizer refund clearance.'
    },
    {
        step: '03',
        title: 'Cashfree Gateway Initiation',
        description: 'Payment partner Cashfree processes automated refund directly to your original payment mode (UPI, Debit/Credit Card, Net Banking).'
    },
    {
        step: '04',
        title: 'Bank Credit (7–10 Business Days)',
        description: 'Amount reflects in your bank statement. Bank or UPI app settlement speed depends on your issuing bank.'
    }
];

const NON_REFUNDABLE_ITEMS = [
    'No-show or failure to attend the campus fest without prior approved cancellation notice',
    'Disqualification due to university rule breaches, disciplinary action, or code of conduct violations',
    'Competitions or passes explicitly marked "Non-Refundable" on the event detail page',
    'Cancellation requests submitted after the organizer\'s stated refund window has closed',
    'Platform convenience service fee (3%) once ticket booking has been generated'
];

export default function RefundsAndCancellations() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const pageDescription =
        "Read CrwdCtrl's transparent refunds and cancellations policy for campus fests, competitions, sports tournaments, and ticket bookings.";

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Refunds & Cancellations Policy — CrwdCtrl"
                description={pageDescription}
                canonical="/refunds-and-cancellations"
                jsonLd={[
                    webPageSchema({ name: 'CrwdCtrl Refunds & Cancellations', description: pageDescription, url: '/refunds-and-cancellations' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Refunds & Cancellations', path: '/refunds-and-cancellations' },
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
                                Refunds &amp; Cancellations
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/contact-us"
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isDark
                                    ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700 text-gray-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 shadow-xs'
                            }`}
                        >
                            Request Refund
                        </Link>
                        <Link
                            to="/fests"
                            className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-bold bg-linear-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-xs transition-all"
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
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Consumer Protection &amp; Gateway Settlement</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        Clear, fair refunds. <br />
                        <span className="bg-linear-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Transparent cancellation terms.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        CrwdCtrl delivers a transparent financial framework. All payments and refunds are processed securely in Indian Rupees (INR / ₹) via RBI-regulated payment partners.
                    </p>

                    {/* Meta Pillars Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Currency</div>
                            <div className="font-bold mt-0.5 text-blue-500">INR (₹) Indian Rupee</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Processing SLA</div>
                            <div className="font-bold mt-0.5 text-emerald-500">7–10 Business Days</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Payment Partner</div>
                            <div className="font-bold mt-0.5 text-cyan-500">Cashfree Payments</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Desk Resolution</div>
                            <div className="font-bold mt-0.5">2–3 Days Response</div>
                        </div>
                    </div>
                </section>

                {/* 2. GENERAL REFUND POLICY */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <IndianRupee className="w-3.5 h-3.5" />
                            <span>01. General Framework</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Event Registrations &amp; Ticket Cancellations
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-5 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {LEGAL_OPERATOR_LINE} CrwdCtrl (operated at <a href={WEBSITE_URL} className="text-blue-500 font-bold underline">crwdctrl.in</a>) is a technological discovery and registration platform for campus fests, sports tournaments, hackathons, and outdoor communities.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className={`p-5 rounded-xl border ${
                                isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">
                                    Event Cancelled by College / Host
                                </h3>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    If an event is officially called off by the organizing committee, eligible ticket refunds are processed in full or as per the college secretariat's instructions. CrwdCtrl assists and facilitates direct payout reconciliation.
                                </p>
                            </div>

                            <div className={`p-5 rounded-xl border ${
                                isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-2">
                                    Attendee Self-Cancellation
                                </h3>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    If you decide to withdraw your registration, eligibility depends on the organizer's rulebook and timing. Many high-demand collegiate competitions become non-refundable once roster entries lock.
                                </p>
                            </div>
                        </div>

                        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                            isDark ? 'bg-blue-950/20 border-blue-900/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}>
                            <CreditCard className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed">
                                <span className="font-bold">Platform Convenience Fee: </span>
                                A small platform service fee (currently 3% of the ticket price, rounded up) is clearly displayed in INR before final checkout. This covers cloud scanning infrastructure and gateway processing.
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. REFUND TIMELINE STEPS */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5" />
                            <span>02. Processing Lifecycle</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            How Refund Settlement Works
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {REFUND_TIMELINE_STEPS.map((st) => (
                            <div
                                key={st.step}
                                className={`p-6 rounded-2xl border flex flex-col justify-between ${
                                    isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                                }`}
                            >
                                <div>
                                    <span className="text-xs font-mono font-black text-blue-500 mb-3 block">
                                        STEP {st.step}
                                    </span>
                                    <h3 className="font-bold text-sm mb-2">{st.title}</h3>
                                    <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {st.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. NON-REFUNDABLE CASES */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>03. Non-Refundable Scenarios</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Exceptions &amp; Ineligible Cases
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <div className="space-y-3">
                            {NON_REFUNDABLE_ITEMS.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm">
                                    <div className="p-1 rounded-md bg-red-500/10 text-red-500 shrink-0 mt-0.5">
                                        <XCircle className="w-4 h-4" />
                                    </div>
                                    <p className={`leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {item}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. REQUEST A REFUND (DIRECT ASSISTANCE DESK) */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Mail className="w-3.5 h-3.5" />
                            <span>04. Dispatch Desk</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            How to Initiate a Refund Request
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border flex flex-col md:flex-row items-start justify-between gap-6 ${
                        isDark ? 'bg-gradient-to-br from-blue-950/20 via-[#0B0F19] to-transparent border-blue-500/30' : 'bg-gradient-to-br from-blue-50/80 via-white to-white border-blue-200 shadow-xs'
                    }`}>
                        <div className="space-y-3 max-w-xl">
                            <h3 className="text-lg font-bold">Email Our Dispatch Team</h3>
                            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Send an email to <strong className="text-blue-500">{LEGAL_EMAIL}</strong> including your:
                            </p>
                            <ul className="text-xs space-y-1.5 text-gray-400 pl-4 list-disc">
                                <li>Registered Full Name &amp; Phone Number</li>
                                <li>Fest / Event Title &amp; Competition Category</li>
                                <li>Order ID or Cashfree Payment Reference ID</li>
                                <li>Reason for cancellation or screenshot of host notification</li>
                            </ul>
                        </div>

                        <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
                            <a
                                href={`mailto:${LEGAL_EMAIL}?subject=Refund%20Request%20-%20CrwdCtrl`}
                                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider text-center transition-all shadow-xs"
                            >
                                Email Refund Desk
                            </a>
                            <Link
                                to="/contact-us"
                                className={`px-5 py-3 rounded-xl border text-center font-bold text-xs uppercase tracking-wider transition-all ${
                                    isDark ? 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                Contact Form
                            </Link>
                        </div>
                    </div>
                </section>

                {/* 6. LEGAL DIRECTORY INDEX */}
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
                                    link.to === '/refunds-and-cancellations'
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
