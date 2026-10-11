import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useInAppBack } from '../../hooks/useInAppBack';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import { openExternalUrl } from '../../utils/externalLink';
import {
    LEGAL_EMAIL,
    SUPPORT_EMAIL,
    LEGAL_NAME,
    LEGAL_OPERATOR_LINE,
    LEGAL_PHONE_DISPLAY,
    LEGAL_PHONE_TEL,
    WEBSITE_URL,
    LEGAL_JURISDICTION,
    LEGAL_POLICY_LINKS,
} from '../../constants/legalEntity';
import {
    ArrowLeft,
    Mail,
    Phone,
    MapPin,
    MessageSquare,
    Clock,
    Send,
    CheckCircle2,
    Copy,
    Check,
    ShieldCheck,
    Headphones,
    Sparkles,
    Ticket,
    Building2,
    HelpCircle,
    ChevronDown,
    ExternalLink
} from 'lucide-react';

const CONTACT_CHANNELS = [
    {
        id: 'support',
        title: 'Participant & Pass Support',
        subtitle: 'Questions regarding bookings, ticket QR passes, or payments',
        email: SUPPORT_EMAIL,
        icon: Ticket,
        badge: 'Priority 24h Desk',
        actionLabel: 'Email Support',
        accentColor: 'blue'
    },
    {
        id: 'partnerships',
        title: 'Campus Organizers & Fests',
        subtitle: 'Listing your college fest, tournament, or seeking sponsorship connect',
        email: LEGAL_EMAIL,
        icon: Building2,
        badge: 'Fast-Track Onboarding',
        actionLabel: 'Organizer Desk',
        accentColor: 'indigo'
    },
    {
        id: 'phone',
        title: 'Direct Helpline & WhatsApp',
        subtitle: 'Immediate technical support or emergency venue check-in issues',
        phone: LEGAL_PHONE_DISPLAY,
        tel: LEGAL_PHONE_TEL,
        icon: Phone,
        badge: 'Mon-Sat 10AM-7PM IST',
        actionLabel: 'Call / WhatsApp',
        accentColor: 'emerald'
    },
    {
        id: 'compliance',
        title: 'Legal & Grievance Officer',
        subtitle: 'KYC, policy inquiries, terms, or formal grievance escalation',
        email: LEGAL_EMAIL,
        icon: ShieldCheck,
        badge: 'Official Entity Office',
        actionLabel: 'Grievance Desk',
        accentColor: 'purple'
    }
];

const COMMON_FAQS = [
    {
        q: 'Where do I find my booked fest passes or tickets?',
        a: 'Your booked passes are accessible instantly under your profile "Passes" section and sent directly to your registered email with a verified entry QR code.'
    },
    {
        q: 'How can our college club or student committee list an event?',
        a: 'You can register as an Organizer via the "Host Event" portal or reach out directly to crwdctrl.work@gmail.com with your fest brochure and dates.'
    },
    {
        q: 'What is the refund timeline for cancelled events?',
        a: 'In case of official cancellation by the college or organizers, refunds are processed according to our policy within 5–7 business days to your original payment mode.'
    },
    {
        q: 'How fast does the CrwdCtrl dispatch team respond?',
        a: 'Our dispatch team aims to resolve standard inquiries within 12 to 24 hours. Emergency event day issues are monitored in real time.'
    }
];

const INQUIRY_TOPICS = [
    { id: 'pass_issue', label: 'Ticket / QR Pass' },
    { id: 'fest_hosting', label: 'Host a Fest' },
    { id: 'sponsorship', label: 'Brand & Sponsor' },
    { id: 'tech_bug', label: 'Bug / Technical' },
    { id: 'general', label: 'General Inquiry' }
];

export default function ContactUs() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const [copiedEmail, setCopiedEmail] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState('pass_issue');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: ''
    });
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    const contactDescription =
        'Get in touch with the CrwdCtrl dispatch team for participant pass support, college fest hosting, sponsor collaborations, and general assistance.';

    const handleCopy = (text, key) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedEmail(key);
            setTimeout(() => setCopiedEmail(null), 2200);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.message) return;

        // Construct mailto URL as reliable direct fallback while showing confirmation
        const topicLabel = INQUIRY_TOPICS.find((t) => t.id === selectedTopic)?.label || selectedTopic;
        const subject = encodeURIComponent(`[CrwdCtrl Inquiry: ${topicLabel}] from ${formData.name}`);
        const body = encodeURIComponent(
            `Name: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone || 'N/A'}\nTopic: ${topicLabel}\n\nMessage:\n${formData.message}`
        );

        // Open mail client
        window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, '_blank');
        setFormSubmitted(true);
    };

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Contact Us & Support Dispatch — CrwdCtrl"
                description={contactDescription}
                canonical="/contact-us"
                jsonLd={[
                    webPageSchema({ name: 'Contact CrwdCtrl Support', description: contactDescription, url: '/contact-us' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Contact Us', path: '/contact-us' },
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
                                Support &amp; Dispatch Hub
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/faq"
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isDark
                                    ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700 text-gray-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 shadow-xs'
                            }`}
                        >
                            Browse FAQs
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

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16 sm:space-y-24">

                {/* 1. HERO SECTION */}
                <section className="space-y-6 pt-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase border bg-blue-500/10 text-blue-500 border-blue-500/30">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span>Direct Dispatch Response &lt; 24h</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        We're here to help. <br />
                        <span className="bg-linear-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Connect with the CrwdCtrl team.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Whether you are a student attendee needing pass assistance, a college committee organizing an inter-college fest, or a brand exploring campus partnerships, our dedicated dispatch channels have you covered.
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 text-gray-400">
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            Operating Hours: Mon - Sat, 10:00 AM - 7:00 PM IST
                        </span>
                        <span className="hidden sm:inline text-gray-600">•</span>
                        <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            {LEGAL_JURISDICTION}
                        </span>
                    </div>
                </section>

                {/* 2. CHANNELS GRID (INTERACTIVE TILES) */}
                <section className="space-y-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <span>&gt;</span>
                            <span>Dedicated Channels</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Choose the Fastest Route for Your Query
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {CONTACT_CHANNELS.map((channel) => {
                            const IconComponent = channel.icon;
                            const isCopied = copiedEmail === channel.id;

                            return (
                                <div
                                    key={channel.id}
                                    className={`p-6 sm:p-7 rounded-2xl border transition-all duration-300 flex flex-col justify-between group ${
                                        isDark
                                            ? 'bg-[#0B0F19] border-gray-800/90 hover:border-blue-500/50 hover:shadow-[0_0_25px_rgba(14,204,238,0.08)]'
                                            : 'bg-white border-gray-200/90 hover:border-blue-400 hover:shadow-md'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`p-3 rounded-xl ${
                                                isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
                                            }`}>
                                                <IconComponent className="w-5 h-5" />
                                            </div>
                                            <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                                                isDark ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'
                                            }`}>
                                                {channel.badge}
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold tracking-tight mb-1.5 group-hover:text-blue-500 transition-colors">
                                            {channel.title}
                                        </h3>
                                        <p className={`text-xs sm:text-sm leading-relaxed mb-6 ${
                                            isDark ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                            {channel.subtitle}
                                        </p>
                                    </div>

                                    {/* Action row */}
                                    <div className="pt-4 border-t border-gray-200/60 dark:border-gray-800/60 flex items-center justify-between gap-3">
                                        {channel.email ? (
                                            <>
                                                <a
                                                    href={`mailto:${channel.email}`}
                                                    className="text-xs sm:text-sm font-bold text-blue-500 hover:underline truncate max-w-[200px] sm:max-w-[240px]"
                                                >
                                                    {channel.email}
                                                </a>

                                                <button
                                                    onClick={() => handleCopy(channel.email, channel.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                                        isCopied
                                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                                            : isDark
                                                            ? 'bg-gray-800/80 hover:bg-gray-800 text-gray-300 border-gray-700/80'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300/80'
                                                    }`}
                                                    title="Copy email to clipboard"
                                                >
                                                    {isCopied ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5" />
                                                            <span>Copied</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5" />
                                                            <span>Copy</span>
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <a
                                                    href={`tel:${channel.tel}`}
                                                    className="text-xs sm:text-sm font-bold text-emerald-500 hover:underline"
                                                >
                                                    {channel.phone}
                                                </a>

                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={`https://wa.me/${channel.phone.replace(/[^0-9]/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all inline-flex items-center gap-1"
                                                    >
                                                        <span>WhatsApp</span>
                                                    </a>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. INTERACTIVE DISPATCH FORM & BUSINESS PROFILE GRID */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Contact Form Card */}
                    <div className={`lg:col-span-7 rounded-2xl border p-6 sm:p-9 transition-all ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90 shadow-xl' : 'bg-white border-gray-200 shadow-sm'
                    }`}>
                        <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Message Dispatch Form</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                                Send us a Direct Message
                            </h2>
                            <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Fill out your query details and our team will get back to you with ticket resolution.
                            </p>
                        </div>

                        {formSubmitted ? (
                            <div className={`p-8 rounded-2xl border text-center space-y-4 ${
                                isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-emerald-50 border-emerald-200 text-gray-900'
                            }`}>
                                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold">Inquiry Dispatched!</h3>
                                <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Your email client has been opened with your inquiry details. Our support team has logged your dispatch category.
                                </p>
                                <div className="pt-2">
                                    <button
                                        onClick={() => {
                                            setFormSubmitted(false);
                                            setFormData({ name: '', email: '', phone: '', message: '' });
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all cursor-pointer"
                                    >
                                        Send Another Inquiry
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleFormSubmit} className="space-y-5">
                                {/* Topic Selectors */}
                                <div className="space-y-2">
                                    <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Select Inquiry Category:
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {INQUIRY_TOPICS.map((topic) => (
                                            <button
                                                key={topic.id}
                                                type="button"
                                                onClick={() => setSelectedTopic(topic.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                                    selectedTopic === topic.id
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                        : isDark
                                                        ? 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                                                        : 'bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300'
                                                }`}
                                            >
                                                {topic.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Your Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Rahul Sharma"
                                            className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                                                isDark
                                                    ? 'bg-[#050811] border-gray-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                    : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                            }`}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Email Address *
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="e.g. rahul@college.edu"
                                            className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                                                isDark
                                                    ? 'bg-[#050811] border-gray-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                    : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                            }`}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Phone / WhatsApp Number (Optional)
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="e.g. +91 9876543210"
                                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all ${
                                            isDark
                                                ? 'bg-[#050811] border-gray-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Your Message / Query *
                                        </label>
                                        <span className="text-[11px] text-gray-400">
                                            {formData.message.length}/1000
                                        </span>
                                    </div>
                                    <textarea
                                        required
                                        rows={4}
                                        maxLength={1000}
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        placeholder="Provide specific details about your query (event name, transaction ID, college name, etc.)..."
                                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all resize-none ${
                                            isDark
                                                ? 'bg-[#050811] border-gray-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-3 rounded-xl bg-linear-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                                >
                                    <Send className="w-4 h-4" />
                                    <span>Dispatch Inquiry to CrwdCtrl</span>
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Right: Legal Entity & Jurisdiction Information */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className={`rounded-2xl border p-6 sm:p-7 transition-all ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200'
                        }`}>
                            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest mb-3">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Entity &amp; Governance</span>
                            </div>

                            <h3 className="text-xl font-black tracking-tight mb-2">
                                Official Business Registry
                            </h3>
                            <p className={`text-xs leading-relaxed mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {LEGAL_OPERATOR_LINE}
                            </p>

                            <div className="space-y-3.5 text-xs">
                                <div className="flex items-start justify-between border-b border-gray-200/50 dark:border-gray-800/60 pb-2.5">
                                    <span className="text-gray-400">Legal Proprietor:</span>
                                    <span className="font-bold text-right">{LEGAL_NAME}</span>
                                </div>
                                <div className="flex items-start justify-between border-b border-gray-200/50 dark:border-gray-800/60 pb-2.5">
                                    <span className="text-gray-400">Jurisdiction &amp; Venue:</span>
                                    <span className="font-bold text-right">{LEGAL_JURISDICTION}</span>
                                </div>
                                <div className="flex items-start justify-between border-b border-gray-200/50 dark:border-gray-800/60 pb-2.5">
                                    <span className="text-gray-400">Official Portal:</span>
                                    <a
                                        href={WEBSITE_URL}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            openExternalUrl(WEBSITE_URL);
                                        }}
                                        className="font-bold text-blue-500 hover:underline inline-flex items-center gap-1"
                                    >
                                        <span>crwdctrl.in</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                                <div className="flex items-start justify-between">
                                    <span className="text-gray-400">Response SLA:</span>
                                    <span className="font-bold text-emerald-500">&lt; 24h Mon-Sat</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Help Center Direct Card */}
                        <div className={`rounded-2xl border p-6 transition-all ${
                            isDark
                                ? 'bg-gradient-to-br from-blue-900/20 via-indigo-900/10 to-transparent border-blue-500/30'
                                : 'bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border-blue-200'
                        }`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                                    <Headphones className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">Need Instant Answers?</h4>
                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Search our comprehensive student &amp; organizer documentation.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <Link
                                    to="/faq"
                                    className="flex-1 text-center py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all"
                                >
                                    Browse FAQs
                                </Link>
                                <Link
                                    to="/refunds-and-cancellations"
                                    className={`flex-1 text-center py-2 rounded-xl text-xs font-semibold border transition-all ${
                                        isDark
                                            ? 'bg-gray-900/80 border-gray-700 text-gray-200 hover:bg-gray-800'
                                            : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                                    }`}
                                >
                                    Refund Policy
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. EXPANDABLE FAQ ACCORDION */}
                <section className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Quick Resolution</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Frequently Asked Inquiries
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {COMMON_FAQS.map((faq, idx) => {
                            const isOpen = openFaqIndex === idx;
                            return (
                                <div
                                    key={idx}
                                    className={`rounded-2xl border transition-all overflow-hidden ${
                                        isDark
                                            ? 'bg-[#0B0F19] border-gray-800/80'
                                            : 'bg-white border-gray-200 shadow-xs'
                                    }`}
                                >
                                    <button
                                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                        className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                                    >
                                        <span className="text-sm sm:text-base font-bold tracking-tight">
                                            {faq.q}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-blue-500 shrink-0 transition-transform duration-300 ${
                                            isOpen ? 'rotate-180' : ''
                                        }`} />
                                    </button>

                                    {isOpen && (
                                        <div className={`px-5 pb-5 text-xs sm:text-sm leading-relaxed border-t pt-3 ${
                                            isDark ? 'text-gray-300 border-gray-800/60' : 'text-gray-600 border-gray-100'
                                        }`}>
                                            {faq.a}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 5. LEGAL POLICIES DIRECTORY INDEX */}
                <section className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-blue-500">
                                Policy Index &amp; Legal Framework
                            </div>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Official governance documents regulating CrwdCtrl platform operations.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {LEGAL_POLICY_LINKS.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    link.to === '/contact-us'
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