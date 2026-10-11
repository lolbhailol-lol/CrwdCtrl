import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useInAppBack } from '../../hooks/useInAppBack';
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
    Shield,
    Eye,
    Database,
    Share2,
    Lock,
    Users,
    FileText,
    Globe,
    Mail,
    Phone,
    AlertCircle,
    CheckCircle2,
    Search,
    ExternalLink,
    Trash2,
    Sparkles,
    Calendar,
    Building2,
    Key,
    Activity,
    Layers,
    X
} from 'lucide-react';

const SECTIONS = [
    { id: 'overview', label: '1. Overview & Scope' },
    { id: 'collected', label: '2. Data Collected' },
    { id: 'usage', label: '3. Data Usage' },
    { id: 'sharing', label: '4. Third-Party Sharing' },
    { id: 'security', label: '5. Security & Storage' },
    { id: 'rights', label: '6. User Rights & Deletion' },
    { id: 'cookies', label: '7. Cookies & AdSense' },
    { id: 'contact', label: '8. Grievance & Office' }
];

export default function PrivacyPolicy() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState('overview');

    const privacyData = {
        last_updated: '2026-08-20',
        introduction: {
            purpose: `${LEGAL_OPERATOR_LINE} This Privacy Policy outlines our transparent practices regarding the collection, handling, storage, and protection of personal data across the CrwdCtrl discovery & ticketing platform.`,
            scope: [
                'Official Web Application (crwdctrl.in)',
                'CrwdCtrl Android & Progressive Web Apps',
                'Organizer Management & Ticket Scanner Services'
            ],
            data_storage_location: 'India (Secure Cloud Infrastructure)',
            consent_required: true
        },
        information_collected: {
            personal_identifiers: [
                'Full Name',
                'Email Address',
                'Mobile Phone Number',
                'Age & Date of Birth',
                'Gender',
                'College, University or Campus Affiliation',
                'City / Location'
            ],
            identity_data: [
                'Student ID Proof (where verified for campus discounts)',
                'Government ID / Address Proof (for verified fest organizers)'
            ],
            account_data: [
                'Username / Handle',
                'Salted & Encrypted Passwords',
                'Profile Picture / Avatar',
                'Account Role (Student, Organizer, Volunteer)'
            ],
            platform_activity: [
                'Events viewed, bookmarked, or registered',
                'Fests and sports meets followed',
                'Interactions with organizers & team rosters',
                'Login history and authentication session tokens',
                'Device type, OS, browser specifications, and IP address',
                'Access logs & pass validation telemetry'
            ],
            uploaded_content: [
                'Fest schedules, competition rules, and brochures',
                'Banners, event posters, and promotional media',
                'Direct communications and feedback messages'
            ],
            third_party_collection_note:
                'Data collected directly by external fest hosts or third-party payment gateways (e.g., Cashfree) is governed under their respective PCI-DSS compliant policies.'
        },
        data_usage: {
            purposes: [
                'Generating secure, verifiable digital QR passes and event tickets',
                'Authenticating users and maintaining campus community security',
                'Broadcasting event announcements, schedule shifts, and emergency alerts',
                'Delivering personalized fest, competition, and sports recommendations',
                'Preventing pass counterfeit, ticket scalping, and fraudulent registrations',
                'Maintaining platform performance and conducting internal analytics'
            ]
        },
        data_sharing: {
            internal_entities: 'Shared with authorized organizing committees of events you register for, specifically for gate check-in and attendance verification.',
            third_party_providers: [
                'PCI-DSS Certified Payment Gateways (for secure UPI/Card/Netbanking processing)',
                'High-reliability Cloud Infrastructure & CDN Hosting in India',
                'Transactional SMS & Email notification dispatch gateways'
            ],
            business_partners: 'Collegiate clubs and campus fest secretariats strictly for participant roster validation.',
            government_authorities: 'Only when mandated by applicable law, subpoena, or official emergency requests.'
        },
        data_security_and_retention: {
            measures: [
                'Industry standard TLS/HTTPS encryption in transit for all communications',
                'Cryptographically salted password hashing and token-based API authentication',
                'Role-based access control restricting participant data strictly to authorized staff',
                'Regular security audits and automated vulnerability inspections'
            ],
            user_responsibility: 'You are responsible for keeping your login credentials and device PIN secure.',
            retention_policy: 'Participant records are retained for as long as your account remains active or as required by Indian accounting & regulatory mandates.'
        },
        user_rights: {
            rights_available: [
                {
                    title: 'Right to Access & Portability',
                    desc: 'Request a copy of personal information linked to your CrwdCtrl account.'
                },
                {
                    title: 'Right to Rectification',
                    desc: 'Update or correct personal profile details at any time via your account settings.'
                },
                {
                    title: 'Right to Erasure (Account Deletion)',
                    desc: 'Request complete deletion of your profile, registrations, and stored records.'
                },
                {
                    title: 'Right to Opt-Out of Marketing',
                    desc: 'Manage notification preferences or unsubscribe from promotional emails.'
                }
            ]
        },
        advertising_and_cookies: {
            description:
                'CrwdCtrl uses Google AdSense and standard web cookies to deliver relevant promotions, monitor site reliability, and sustain free access for college students.',
            cookies_usage: [
                "Google uses cookies to serve ads based on your prior visits to this website or other websites on the Internet",
                "Google's use of advertising cookies enables it and its partners to serve ads based on your visit to CrwdCtrl and/or other sites",
                'Third-party vendors, including Google, use cookies to serve ads tailored to campus and youth interests',
                'We use strictly necessary session cookies to maintain your login state and active pass reservations'
            ],
            user_choices: [
                'You may opt out of personalized advertising by visiting Google Ads Settings (adssettings.google.com)',
                'You can opt out of third-party vendor cookies by visiting the Network Advertising Initiative (optout.networkadvertising.org)',
                'You can manage or disable cookie preferences at any time through your browser settings',
                'Disabling necessary session cookies may require you to re-authenticate on each session'
            ],
            third_party_links:
                'Our platform may contain links to external college portals and social networks. CrwdCtrl is not responsible for the privacy practices of external sites.'
        }
    };

    // Filter content if search query is active
    const filteredMatch = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();
        return {
            hasMatch: true,
            matchesOverview: privacyData.introduction.purpose.toLowerCase().includes(q),
            matchesCollected:
                privacyData.information_collected.personal_identifiers.some((i) => i.toLowerCase().includes(q)) ||
                privacyData.information_collected.identity_data.some((i) => i.toLowerCase().includes(q)),
            matchesUsage: privacyData.data_usage.purposes.some((p) => p.toLowerCase().includes(q)),
            matchesSharing: privacyData.data_sharing.third_party_providers.some((p) => p.toLowerCase().includes(q)),
            matchesSecurity: privacyData.data_security_and_retention.measures.some((m) => m.toLowerCase().includes(q)),
            matchesCookies: privacyData.advertising_and_cookies.description.toLowerCase().includes(q) ||
                privacyData.advertising_and_cookies.cookies_usage.some((c) => c.toLowerCase().includes(q))
        };
    }, [searchQuery, privacyData]);

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Privacy Policy & Data Architecture — CrwdCtrl"
                description="Learn how CrwdCtrl collects, protects, stores, and governs your campus identity and ticketing data under Indian DPDP and IT laws."
                canonical="/privacy-policy"
                jsonLd={[
                    webPageSchema({ name: 'CrwdCtrl Privacy Policy', url: '/privacy-policy' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Privacy Policy', path: '/privacy-policy' },
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
                                Privacy Architecture
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/terms-and-conditions"
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isDark
                                    ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700 text-gray-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 shadow-xs'
                            }`}
                        >
                            Terms of Service
                        </Link>
                        <Link
                            to="/contact-us"
                            className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-bold bg-linear-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-xs transition-all"
                        >
                            Contact Desk
                        </Link>
                    </div>
                </div>

                {/* Sub-Header Section Jump Links */}
                <div className={`hidden lg:flex max-w-6xl mx-auto px-6 gap-5 text-xs font-medium tracking-wide border-t overflow-x-auto ${
                    isDark ? 'border-gray-800/60 text-gray-400' : 'border-gray-200/60 text-gray-600'
                }`}>
                    {SECTIONS.map((sec) => (
                        <a
                            key={sec.id}
                            href={`#${sec.id}`}
                            onClick={() => setActiveSection(sec.id)}
                            className={`py-2.5 transition-colors whitespace-nowrap hover:text-blue-500 ${
                                activeSection === sec.id ? 'text-blue-500 font-bold' : ''
                            }`}
                        >
                            {sec.label}
                        </a>
                    ))}
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16 sm:space-y-20">

                {/* 1. HERO SECTION */}
                <section className="space-y-6 pt-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase border bg-blue-500/10 text-blue-500 border-blue-500/30">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Indian DPDP &amp; IT Act Compliant Framework</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        Your privacy is fundamental. <br />
                        <span className="bg-linear-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Transparent &amp; secure by design.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        At CrwdCtrl, we respect your digital autonomy. This policy provides complete visibility into what information is collected, how your event passes are processed, and the strict controls safeguarding your student records.
                    </p>

                    {/* Meta Info Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Last Updated</div>
                            <div className="font-bold mt-0.5">20 August 2026</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Data Location</div>
                            <div className="font-bold mt-0.5 text-blue-500">Secure Indian Cloud</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Encryption</div>
                            <div className="font-bold mt-0.5 text-emerald-500">TLS Transit &amp; Hashing</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">AdSense Cookies</div>
                            <div className="font-bold mt-0.5 text-cyan-500">Opt-Out Available</div>
                        </div>
                    </div>

                    {/* Quick Search Within Policy */}
                    <div className="pt-2">
                        <div className={`relative max-w-md flex items-center rounded-xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-300 shadow-xs'
                        }`}>
                            <Search className="w-4 h-4 ml-3.5 text-gray-400 shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search policy (e.g., cookies, deletion, payment, age)..."
                                className="w-full px-3 py-2.5 text-xs bg-transparent outline-none"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="p-1 mr-2 text-gray-400 hover:text-white"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {filteredMatch && (
                            <div className="flex items-center gap-2 text-xs text-blue-500 mt-2">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Showing matching policy sections for "{searchQuery}"</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* 2. OVERVIEW & SCOPE */}
                <section id="overview" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <span>01</span>
                            <span>Scope &amp; Operating Model</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Platform Scope &amp; Consent
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {privacyData.introduction.purpose}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-500">
                                    Our Ecosystem Covers:
                                </h3>
                                <div className="space-y-2">
                                    {privacyData.introduction.scope.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={`p-4 sm:p-5 rounded-xl border ${
                                isDark ? 'bg-blue-950/20 border-blue-900/50' : 'bg-blue-50/70 border-blue-200'
                            }`}>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">
                                    Jurisdiction &amp; Regulatory Anchor
                                </h4>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-200/80' : 'text-blue-900'}`}>
                                    Data processing is conducted strictly pursuant to the Digital Personal Data Protection Act, 2023 (DPDP) and Information Technology Act, 2000 of India. By registering or booking on CrwdCtrl, you provide lawful, explicit consent for pass facilitation.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. DATA COLLECTED (CATEGORY GRID) */}
                <section id="collected" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Database className="w-3.5 h-3.5" />
                            <span>02. Data Taxonomy</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Information We Collect
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Personal Identifiers */}
                        <div className={`p-6 rounded-2xl border flex flex-col justify-between ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div>
                                <div className="flex items-center gap-2 text-blue-500 mb-3">
                                    <Users className="w-4 h-4" />
                                    <span className="text-xs font-mono font-bold uppercase">Personal Identifiers</span>
                                </div>
                                <h3 className="font-bold text-base mb-3">Student &amp; Attendee Details</h3>
                                <ul className="space-y-2 text-xs text-gray-400">
                                    {privacyData.information_collected.personal_identifiers.map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Account & Security Data */}
                        <div className={`p-6 rounded-2xl border flex flex-col justify-between ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div>
                                <div className="flex items-center gap-2 text-indigo-500 mb-3">
                                    <Key className="w-4 h-4" />
                                    <span className="text-xs font-mono font-bold uppercase">Account Credentials</span>
                                </div>
                                <h3 className="font-bold text-base mb-3">Profile &amp; Credentials</h3>
                                <ul className="space-y-2 text-xs text-gray-400">
                                    {privacyData.information_collected.account_data.map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Telemetry & Activity */}
                        <div className={`p-6 rounded-2xl border flex flex-col justify-between ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div>
                                <div className="flex items-center gap-2 text-cyan-500 mb-3">
                                    <Activity className="w-4 h-4" />
                                    <span className="text-xs font-mono font-bold uppercase">Activity Logs</span>
                                </div>
                                <h3 className="font-bold text-base mb-3">Check-Ins &amp; Telemetry</h3>
                                <ul className="space-y-2 text-xs text-gray-400">
                                    {privacyData.information_collected.platform_activity.slice(0, 6).map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3 ${
                        isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed">
                            <span className="font-bold">Third-Party Gateway Processing Notice: </span>
                            CrwdCtrl does not store complete debit/credit card numbers or CVVs. All monetary transactions are processed through certified, RBI-regulated payment gateways (such as Cashfree Payments) adhering to PCI-DSS Level 1 compliance.
                        </div>
                    </div>
                </section>

                {/* 4. PURPOSE & USAGE */}
                <section id="usage" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Eye className="w-3.5 h-3.5" />
                            <span>03. Data Utilization</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            How We Use Your Information
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {privacyData.data_usage.purposes.map((purpose, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                                        isDark
                                            ? 'bg-gray-900/40 border-gray-800 hover:border-blue-500/40'
                                            : 'bg-gray-50/70 border-gray-200 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="p-1 rounded-md bg-blue-500/10 text-blue-500 shrink-0 mt-0.5">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <p className={`text-xs sm:text-sm font-medium leading-relaxed ${
                                        isDark ? 'text-gray-200' : 'text-gray-800'
                                    }`}>
                                        {purpose}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. DATA SHARING */}
                <section id="sharing" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Share2 className="w-3.5 h-3.5" />
                            <span>04. Transfer &amp; Disclosure</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Who We Share Data With
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={`p-6 rounded-2xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div className="text-xs font-mono font-bold text-blue-500 uppercase mb-2">
                                Event Organizers
                            </div>
                            <h3 className="font-bold text-base mb-2">Fest Secretariats</h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Verified college committees receive registered attendee lists for rapid gate authentication, security clearances, and badge dispatch.
                            </p>
                        </div>

                        <div className={`p-6 rounded-2xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div className="text-xs font-mono font-bold text-indigo-500 uppercase mb-2">
                                Infrastructure
                            </div>
                            <h3 className="font-bold text-base mb-2">Cloud &amp; Gateway Partners</h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Trusted service vendors for transactional messaging (SMS/Email), RBI-approved payment gateways, and resilient cloud storage in India.
                            </p>
                        </div>

                        <div className={`p-6 rounded-2xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div className="text-xs font-mono font-bold text-cyan-500 uppercase mb-2">
                                Statutory Orders
                            </div>
                            <h3 className="font-bold text-base mb-2">Law Enforcement</h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Information is disclosed strictly where mandated by valid legal court orders, government authorities, or to counter imminent safety threats.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 6. SECURITY & STORAGE */}
                <section id="security" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Lock className="w-3.5 h-3.5" />
                            <span>05. Data Protection</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Security Architecture &amp; Retention
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            {privacyData.data_security_and_retention.measures.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2.5">
                                    <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className={`text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {item}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isDark ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}>
                            <div className="text-xs">
                                <span className="font-bold">Data Retention Period: </span>
                                Records are retained throughout active account lifecycle and safely anonymized after account closure, subject to statutory audit rules.
                            </div>
                        </div>
                    </div>
                </section>

                {/* 7. USER RIGHTS & DELETION */}
                <section id="rights" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Users className="w-3.5 h-3.5" />
                            <span>06. Individual Autonomy</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Your Legal Rights &amp; Account Deletion
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {privacyData.user_rights.rights_available.map((right, idx) => (
                            <div
                                key={idx}
                                className={`p-6 rounded-2xl border ${
                                    isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                                }`}
                            >
                                <h3 className="font-bold text-base mb-2 text-blue-500">{right.title}</h3>
                                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {right.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Account Deletion Callout Card */}
                    <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isDark ? 'bg-red-950/20 border-red-900/40' : 'bg-red-50 border-red-200'
                    }`}>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase">
                                <Trash2 className="w-4 h-4" />
                                <span>Right to Erasure</span>
                            </div>
                            <h4 className="text-base font-bold">Want to permanently delete your CrwdCtrl account?</h4>
                            <p className={`text-xs max-w-xl ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                You can initiate a complete profile wipe, removing your identity, booked passes history, and communication preferences at any time.
                            </p>
                        </div>

                        <Link
                            to="/delete-account"
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all whitespace-nowrap self-start sm:self-center"
                        >
                            Delete Account Portal
                        </Link>
                    </div>
                </section>

                {/* 8. GOOGLE ADSENSE & COOKIES */}
                <section id="cookies" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Globe className="w-3.5 h-3.5" />
                            <span>07. Advertising &amp; Tracking</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Google AdSense &amp; Cookie Disclosure
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-6 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {privacyData.advertising_and_cookies.description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h3 className="text-xs font-mono font-bold uppercase text-amber-500">
                                    How Cookies &amp; AdSense Operate:
                                </h3>
                                <div className="space-y-2">
                                    {privacyData.advertising_and_cookies.cookies_usage.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-xs font-mono font-bold uppercase text-blue-500">
                                    Your Opt-Out Options:
                                </h3>
                                <div className="space-y-2">
                                    {privacyData.advertising_and_cookies.user_choices.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Direct Links for Opt-Out */}
                        <div className="pt-4 border-t border-gray-200/60 dark:border-gray-800/60 flex flex-wrap gap-3">
                            <a
                                href="https://adssettings.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all inline-flex items-center gap-1.5"
                            >
                                <span>Google Ads Settings</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <a
                                href="https://optout.networkadvertising.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all inline-flex items-center gap-1.5 ${
                                    isDark ? 'bg-gray-800/80 hover:bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
                                }`}
                            >
                                <span>Network Advertising Initiative Opt-Out</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                </section>

                {/* 9. GRIEVANCE OFFICER & OFFICIAL CONTACT */}
                <section id="contact" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>08. Grievance Redressal</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Grievance Officer &amp; Legal Notices
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-xs sm:text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Under the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, the official Grievance Officer details for CrwdCtrl are provided below:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                            <div className="space-y-2">
                                <div className="text-gray-400 text-xs uppercase font-mono">Grievance &amp; Compliance Officer</div>
                                <div className="font-bold text-base">{LEGAL_NAME}</div>
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {LEGAL_OPERATOR_LINE}
                                </div>
                                <div className="text-xs text-gray-400 pt-1">
                                    Jurisdiction: <span className="font-bold text-gray-200">{LEGAL_JURISDICTION}</span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2 md:pt-0">
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                                    <a href={`mailto:${LEGAL_EMAIL}`} className="text-blue-500 hover:underline font-bold">
                                        {LEGAL_EMAIL}
                                    </a>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <a href={`tel:${LEGAL_PHONE_TEL}`} className="text-emerald-500 hover:underline font-bold">
                                        {LEGAL_PHONE_DISPLAY}
                                    </a>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-cyan-500 shrink-0" />
                                    <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-bold">
                                        {WEBSITE_URL}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 10. LEGAL DIRECTORY INDEX */}
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
                                    link.to === '/privacy-policy'
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