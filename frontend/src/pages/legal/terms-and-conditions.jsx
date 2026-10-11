import React, { useState } from 'react';
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
    CheckCircle2,
    Shield,
    Users,
    Globe,
    FileText,
    Scale,
    AlertCircle,
    Building2,
    Lock,
    Search,
    X,
    ExternalLink,
    AlertTriangle,
    Ticket,
    Sparkles,
    Calendar,
    Phone,
    Mail
} from 'lucide-react';

const TERMS_SECTIONS = [
    { id: 'introduction', label: '1. Agreement & Scope' },
    { id: 'about', label: '2. About CrwdCtrl' },
    { id: 'eligibility', label: '3. Eligibility' },
    { id: 'accounts', label: '4. User Accounts' },
    { id: 'listings', label: '5. Event Listings' },
    { id: 'ip', label: '6. Intellectual Property' },
    { id: 'liability', label: '7. Disclaimers & Liability' },
    { id: 'governing-law', label: '8. Governing Law' }
];

export default function TermsAndConditions() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState('introduction');

    const termsData = {
        last_updated: '2026-08-20',
        introduction: {
            description: `${LEGAL_OPERATOR_LINE} These Terms and Conditions ("Terms") govern your access to and use of the CrwdCtrl website, mobile web platforms, event discovery services, ticketing passes, and related digital solutions.`,
            agreement_required: true,
            review_recommendation: true,
            conflict_resolution:
                'If any conflict arises between these Terms and specific event-level organizer terms, these Terms will prevail regarding the use and integrity of the CrwdCtrl technology platform.'
        },
        about: {
            platform_description:
                'CrwdCtrl is a dedicated digital discovery, registration, and ticketing infrastructure connecting college students, university fests, sports tournaments, hackathons, outdoor clubs, and brand partners.',
            purpose: [
                'Inter-college fest & competition discovery',
                'Verified event listings and real-time schedules',
                'Digital ticket pass generation and instant QR verification',
                'Sponsorship connections and organizer roster management'
            ],
            role_limitation:
                'CrwdCtrl operates solely as a technological facilitator and discovery infrastructure. CrwdCtrl is NOT the physical host, producer, or organizer of campus events listed by independent colleges, clubs, or organizers.'
        },
        eligibility: {
            requirements: [
                'Users must be legally capable of entering into binding agreements under the Indian Contract Act, 1872.',
                'Users must provide true, accurate, and current information when creating accounts or reserving passes.',
                'Participation in collegiate competitions may require valid student identification issued by an accredited institution.',
                'All activity on the platform must comply with applicable Indian and local state laws.'
            ]
        },
        user_accounts: {
            collected_information: [
                'Full Name',
                'Email Address',
                'Mobile Phone Number',
                'Campus / University Name',
                'Session activity and verified pass inventory'
            ],
            responsibilities: [
                'Maintain confidentiality of your account credentials and device access',
                'Assume responsibility for all transactions executed through your credentials',
                'Immediately inform CrwdCtrl dispatch of unauthorized account access or security breaches',
                'Refrain from ticket reselling, automated scraping, or pass scalping'
            ],
            platform_rights: [
                'Terminate or suspend accounts engaged in abusive conduct or pass scalping',
                'Edit or remove listings containing deceptive information or copyright violations',
                'Cancel fraudulent orders or void counterfeit entry tickets'
            ]
        },
        event_listings: {
            description:
                'Organizers and collegiate committees may publish event schedules, rules, prize pools, and registration requirements on CrwdCtrl.',
            disclaimer:
                'While CrwdCtrl strives to verify event listings, we do not guarantee the completeness, execution, punctuality, or physical security of events operated by third-party colleges.',
            user_responsibility:
                'Attendees must verify event venue details, eligibility rules, travel advisories, and schedule changes directly with the fest organizers.',
            organizer_responsibility: [
                'Maintain accuracy of schedules, rules, entry fees, and announced prize distributions',
                'Full compliance with safety, university campus regulations, and municipal permissions',
                'Direct responsibility for event conduct, participant disputes, postponements, or cancellations'
            ]
        },
        intellectual_property: {
            ownership:
                'All platform software, branding, UI designs, codebases, algorithms, and logos belong exclusively to CrwdCtrl.',
            restrictions:
                'Users may not reverse engineer, copy, scrape, distribute, or create derivative works from the CrwdCtrl software without prior written authorization.',
            organizer_content_license:
                'By uploading posters, logos, and competition materials, organizers grant CrwdCtrl a non-exclusive, royalty-free license to display, promote, and market the event across our platform and channels.'
        },
        third_party_links: {
            disclaimer:
                'CrwdCtrl may provide links to external campus portals, payment gateways, and social media pages. CrwdCtrl is not responsible for the content, security, or terms of third-party websites.'
        },
        limitation_of_liability: {
            summary:
                'To the maximum extent permitted by Indian law, CrwdCtrl, its founder, affiliates, and representatives shall not be liable for any indirect, incidental, or consequential damages resulting from event cancellations, personal injuries at campus venues, host misrepresentations, or payment delays outside our direct control.'
        },
        intellectual_property_notice: {
            rights:
                'CrwdCtrl logos, trademarks, wordmarks, graphics, and visual design assets are proprietary to KARAN BAPURAO JADHAV.',
            prohibition: 'Unauthorized reproduction, framing, or commercial exploitation is strictly prohibited.'
        },
        indemnification: {
            user_agreement:
                'You agree to indemnify, defend, and hold harmless CrwdCtrl, its proprietor, and operational partners against any claims, losses, or damages arising out of your violation of these Terms, unlawful conduct, or infringement of third-party rights.'
        },
        governing_law: {
            jurisdiction: 'Pune, Maharashtra, India',
            applicable_law: 'Laws of the Republic of India'
        }
    };

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="Terms and Conditions &amp; Platform Governance — CrwdCtrl"
                description="Read the official Terms and Conditions governing access to and use of CrwdCtrl campus discovery and ticketing services."
                canonical="/terms-and-conditions"
                jsonLd={[
                    webPageSchema({ name: 'CrwdCtrl Terms & Conditions', url: '/terms-and-conditions' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Terms & Conditions', path: '/terms-and-conditions' },
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
                                Terms &amp; Governance
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/privacy-policy"
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isDark
                                    ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700 text-gray-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 shadow-xs'
                            }`}
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            to="/contact-us"
                            className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-bold bg-linear-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-xs transition-all"
                        >
                            Help Desk
                        </Link>
                    </div>
                </div>

                {/* Sub-Header Section Jump Links */}
                <div className={`hidden lg:flex max-w-6xl mx-auto px-6 gap-5 text-xs font-medium tracking-wide border-t overflow-x-auto ${
                    isDark ? 'border-gray-800/60 text-gray-400' : 'border-gray-200/60 text-gray-600'
                }`}>
                    {TERMS_SECTIONS.map((sec) => (
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
                        <Scale className="w-3.5 h-3.5" />
                        <span>Platform User Agreement &amp; Operating Standards</span>
                    </div>

                    <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                        Clear, trusted rules. <br />
                        <span className="bg-linear-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Empowering campus communities.
                        </span>
                    </h1>

                    <p className={`text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        These Terms form a legally binding agreement between you and CrwdCtrl. They set the rules of fair engagement, pass validity, organizer duties, and our role as a technology discovery platform.
                    </p>

                    {/* Meta Pillars Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Last Updated</div>
                            <div className="font-bold mt-0.5">20 August 2026</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Platform Role</div>
                            <div className="font-bold mt-0.5 text-blue-500">Discovery &amp; Passes</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Governing Court</div>
                            <div className="font-bold mt-0.5 text-emerald-500">Pune, Maharashtra</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-200 shadow-xs'}`}>
                            <div className="text-gray-400 text-[10px] uppercase font-mono">Fair Use Policy</div>
                            <div className="font-bold mt-0.5 text-cyan-500">Zero Pass Scalping</div>
                        </div>
                    </div>

                    {/* Quick Search Within Terms */}
                    <div className="pt-2">
                        <div className={`relative max-w-md flex items-center rounded-xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800' : 'bg-white border-gray-300 shadow-xs'
                        }`}>
                            <Search className="w-4 h-4 ml-3.5 text-gray-400 shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search terms (e.g., liability, refund, organizer, age)..."
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
                    </div>
                </section>

                {/* 2. AGREEMENT & SCOPE */}
                <section id="introduction" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <span>01</span>
                            <span>Agreement to Terms</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Binding Contractual Agreement
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {termsData.introduction.description}
                        </p>

                        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                            isDark ? 'bg-blue-950/20 border-blue-900/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}>
                            <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed">
                                {termsData.introduction.conflict_resolution}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. ABOUT CRWDCTRL (ROLE LIMITATION) */}
                <section id="about" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Globe className="w-3.5 h-3.5" />
                            <span>02. Infrastructure Role</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Platform Purpose &amp; Role Limitation
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-6 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {termsData.about.platform_description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {termsData.about.purpose.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                </div>
                            ))}
                        </div>

                        {/* Critical Role Limitation Disclaimer Box */}
                        <div className={`p-5 rounded-xl border flex items-start gap-3.5 ${
                            isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}>
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-wider">Crucial Legal Distinction</h4>
                                <p className="text-xs leading-relaxed">
                                    {termsData.about.role_limitation}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. ELIGIBILITY */}
                <section id="eligibility" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Shield className="w-3.5 h-3.5" />
                            <span>03. User Qualifications</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Eligibility &amp; Capacity
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <div className="space-y-3">
                            {termsData.eligibility.requirements.map((req, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm">
                                    <div className="p-1 rounded-md bg-blue-500/10 text-blue-500 shrink-0 mt-0.5">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <p className={`leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {req}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. USER ACCOUNTS & CODE OF CONDUCT */}
                <section id="accounts" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Users className="w-3.5 h-3.5" />
                            <span>04. Account Governance</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            User Accounts &amp; Conduct Rules
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-6 rounded-2xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div className="text-xs font-mono font-bold text-blue-500 uppercase mb-3">
                                Attendee Responsibilities
                            </div>
                            <h3 className="font-bold text-base mb-3">Your Obligations</h3>
                            <ul className="space-y-2.5 text-xs text-gray-400">
                                {termsData.user_accounts.responsibilities.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className={`p-6 rounded-2xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <div className="text-xs font-mono font-bold text-indigo-500 uppercase mb-3">
                                CrwdCtrl Safeguards
                            </div>
                            <h3 className="font-bold text-base mb-3">Platform Authority</h3>
                            <ul className="space-y-2.5 text-xs text-gray-400">
                                {termsData.user_accounts.platform_rights.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 6. EVENT LISTINGS & ORGANIZER DUTIES */}
                <section id="listings" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Ticket className="w-3.5 h-3.5" />
                            <span>05. Listings &amp; Fest Hosts</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Event Listings &amp; Campus Fest Host Duties
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-6 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {termsData.event_listings.description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h3 className="text-xs font-mono font-bold uppercase text-blue-500">
                                    Organizer Mandatory Responsibilities:
                                </h3>
                                <div className="space-y-2">
                                    {termsData.event_listings.organizer_responsibility.map((resp, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{resp}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={`p-5 rounded-xl border ${
                                isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <h3 className="text-xs font-mono font-bold uppercase text-gray-400 mb-2">
                                    Attendee Verification Duty
                                </h3>
                                <p className={`text-xs leading-relaxed mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {termsData.event_listings.user_responsibility}
                                </p>
                                <p className="text-[11px] text-gray-400 italic">
                                    {termsData.event_listings.disclaimer}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 7. INTELLECTUAL PROPERTY */}
                <section id="ip" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <FileText className="w-3.5 h-3.5" />
                            <span>06. Intellectual Property</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Platform IP &amp; Content Licensing
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border space-y-4 ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {termsData.intellectual_property.ownership}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className={`p-4 rounded-xl border ${
                                isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <h4 className="text-xs font-bold uppercase text-blue-500 mb-1.5">Usage Restrictions</h4>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {termsData.intellectual_property.restrictions}
                                </p>
                            </div>

                            <div className={`p-4 rounded-xl border ${
                                isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <h4 className="text-xs font-bold uppercase text-indigo-500 mb-1.5">Organizer Content Grant</h4>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {termsData.intellectual_property.organizer_content_license}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 8. DISCLAIMERS & LIMITATION OF LIABILITY */}
                <section id="liability" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>07. Legal Disclaimers</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Limitation of Liability &amp; Indemnity
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-6 rounded-2xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <h3 className="font-bold text-base mb-2 text-amber-500">Limitation of Liability</h3>
                            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                {termsData.limitation_of_liability.summary}
                            </p>
                        </div>

                        <div className={`p-6 rounded-2xl border ${
                            isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                        }`}>
                            <h3 className="font-bold text-base mb-2 text-blue-500">User Indemnification</h3>
                            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                {termsData.indemnification.user_agreement}
                            </p>
                        </div>
                    </div>
                </section>

                {/* 9. GOVERNING LAW & JURISDICTION */}
                <section id="governing-law" className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Scale className="w-3.5 h-3.5" />
                            <span>08. Legal Jurisdiction</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Governing Law &amp; Dispute Forum
                        </h2>
                    </div>

                    <div className={`p-6 sm:p-8 rounded-2xl border ${
                        isDark ? 'bg-[#0B0F19] border-gray-800/90' : 'bg-white border-gray-200 shadow-xs'
                    }`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
                            <div className="space-y-2">
                                <div className="text-gray-400 text-xs uppercase font-mono">Applicable Statutes</div>
                                <div className="font-bold text-base">{termsData.governing_law.applicable_law}</div>
                                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    These Terms shall be interpreted and enforced strictly in accordance with the laws of India. Any legal disputes arising out of the platform shall fall under the exclusive jurisdiction of the competent courts in {termsData.governing_law.jurisdiction}.
                                </p>
                            </div>

                            <div className="space-y-3 pt-2 md:pt-0">
                                <div className="text-gray-400 text-xs uppercase font-mono">Official Operating Entity</div>
                                <div className="font-bold">{LEGAL_NAME}</div>
                                <div className="text-xs text-gray-400">{LEGAL_OPERATOR_LINE}</div>

                                <div className="flex items-center gap-2 pt-2">
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
                                    link.to === '/terms-and-conditions'
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