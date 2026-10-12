import React from 'react';
import { useDarkMode } from '../../context/DarkModeContext';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useInAppBack } from '../../hooks/useInAppBack';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import { openExternalUrl } from '../../utils/externalLink';
import {
    LEGAL_EMAIL,
    LEGAL_NAME,
    LEGAL_OPERATOR_LINE,
    LEGAL_PHONE_DISPLAY,
    LEGAL_PHONE_TEL,
    WEBSITE_URL,
    LEGAL_JURISDICTION,
} from '../../constants/legalEntity';

export default function ContactUsDesktop() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const contactDescription =
        'Get in touch with the CrwdCtrl team. Contact us for support, partnerships, listing your fest or event, or any questions about the platform.';

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 ${
            isDark ? 'bg-[#04060A] text-white' : 'bg-gray-50 text-gray-900'
        }`}>
            <Seo
                title="Contact Us — CrwdCtrl"
                description={contactDescription}
                canonical="/contact-us"
                jsonLd={[
                    webPageSchema({ name: 'Contact CrwdCtrl', description: contactDescription, url: '/contact-us' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Contact Us', path: '/contact-us' },
                    ]),
                ]}
            />

            {/* Top Page Header */}
            <div className={`w-full border-b py-6 ${isDark ? 'bg-[#070A13] border-gray-800/80' : 'bg-white border-gray-200'}`}>
                <div className="max-w-4xl mx-auto px-4 relative flex items-center justify-center">
                    <button
                        onClick={goBack}
                        aria-label="Go back"
                        className={`lg:hidden absolute left-4 p-2 rounded-xl transition-colors ${
                            isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="text-center">
                        <h1 className={`text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Contact Us
                        </h1>
                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Get in touch with our team
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

                {/* Hero Speech Bubble Card */}
                <div className={`relative rounded-2xl border p-8 sm:p-10 text-center overflow-hidden transition-all shadow-xl ${
                    isDark
                        ? 'bg-gradient-to-br from-[#0B1028] via-[#0E122A] to-[#0A0C1E] border-blue-500/20'
                        : 'bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-purple-50/80 border-blue-200/80 shadow-sm'
                }`}>
                    {/* Ambient Glow */}
                    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full" />

                    {/* Centered Speech Bubble Icon */}
                    <div className="flex justify-center mb-5 relative z-10">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-inner ${
                            isDark
                                ? 'bg-[#142044] border-blue-500/40 text-[#007BFF]'
                                : 'bg-blue-100 border-blue-300 text-[#007BFF]'
                        }`}>
                            <MessageSquare className="w-6 h-6 fill-current stroke-current" />
                        </div>
                    </div>

                    <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 relative z-10 ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        We'd Love to Hear from You!
                    </h2>
                    <p className={`max-w-xl mx-auto text-sm sm:text-base leading-relaxed relative z-10 ${
                        isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                        Have questions, suggestions, or need assistance? Our team is here to help you make the most of your CrwdCtrl experience.
                    </p>
                </div>

                {/* Legal / Business Information Card */}
                <div className={`rounded-2xl border p-6 sm:p-8 transition-all ${
                    isDark
                        ? 'bg-[#0B0E17] border-gray-800/90 shadow-lg'
                        : 'bg-white border-gray-200/90 shadow-sm'
                }`}>
                    <h3 className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        Legal / Business Information
                    </h3>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {LEGAL_OPERATOR_LINE}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm sm:text-base font-normal">
                        <div>
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Legal name: </span>
                            <strong className={isDark ? 'text-white' : 'text-gray-900'}>{LEGAL_NAME}</strong>
                        </div>

                        <div>
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Email: </span>
                            <a
                                href={`mailto:${LEGAL_EMAIL}`}
                                className="text-[#007BFF] hover:underline font-medium break-all"
                            >
                                {LEGAL_EMAIL}
                            </a>
                        </div>

                        <div>
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Phone: </span>
                            <a
                                href={`tel:${LEGAL_PHONE_TEL}`}
                                className="text-[#007BFF] hover:underline font-medium"
                            >
                                {LEGAL_PHONE_DISPLAY}
                            </a>
                        </div>

                        <div>
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Website: </span>
                            <a
                                href={WEBSITE_URL}
                                onClick={(e) => {
                                    e.preventDefault();
                                    openExternalUrl(WEBSITE_URL);
                                }}
                                className="text-[#007BFF] hover:underline font-medium break-all"
                            >
                                {WEBSITE_URL}
                            </a>
                        </div>

                        <div className="sm:col-span-2">
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Location: </span>
                            <strong className={isDark ? 'text-white' : 'text-gray-900'}>{LEGAL_JURISDICTION}</strong>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}