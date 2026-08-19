import React from 'react';
import { useDarkMode } from '../../context/DarkModeContext';
import { ArrowLeft, CheckCircle2, Shield, Users, Globe, FileText, Scale, AlertCircle } from 'lucide-react';
import { useInAppBack } from '../../hooks/useInAppBack';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';

export default function TermsAndConditions() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const termsData = {
        last_updated: "2025-11-01",
        introduction: {
            description: "These Terms govern the access and use of the Crwdctrl website, platform and services.",
            agreement_required: true,
            review_recommendation: true,
            conflict_resolution: "If any conflict arises between these Terms and other platform terms, these Terms will prevail."
        },
        about: {
            platform_description: "A digital platform facilitating interactions among students, fest organizers, and sponsors.",
            purpose: [
                "Fest discovery",
                "Event listings",
                "Registration management",
                "Sponsorship connections"
            ],
            role_limitation: "Crwdctrl is not a host or organizer of events."
        },
        eligibility: {
            requirements: [
                "User must be legally capable of entering binding agreements.",
                "User must provide accurate information.",
                "Use must comply with applicable laws."
            ]
        },
        user_accounts: {
            collected_information: [
                "Name",
                "Email",
                "Mobile number",
                "Platform activity data (pages visited, links clicked, frequency of usage)"
            ],
            responsibilities: [
                "Maintain accuracy of details",
                "Maintain account security",
                "Responsibility for all activities on the account"
            ],
            platform_rights: [
                "Terminate accounts",
                "Edit or remove content",
                "Cancel orders"
            ]
        },
        event_listings: {
            description: "Organizers may list events and share event details.",
            disclaimer: "Crwdctrl does not guarantee accuracy, reliability, or completeness of event listings.",
            user_responsibility: "Users must verify event details independently.",
            organizer_responsibility: [
                "Ensure accuracy of provided content",
                "Compliance with applicable laws",
                "Responsibility for disputes, cancellations, delays or issues"
            ]
        },
        intellectual_property: {
            ownership: "All platform content belongs to Crwdctrl unless stated otherwise.",
            restrictions: "Users may not reproduce or modify platform content without consent.",
            organizer_content_license: "Non-exclusive license granted to Crwdctrl to display and promote uploaded content."
        },
        third_party_links: {
            disclaimer: "Crwdctrl is not responsible for content or policies of third-party sites."
        },
        limitation_of_liability: {
            summary: "Crwdctrl is a discovery platform and not liable for event-related issues, cancellations, fraud, or disputes."
        },
        intellectual_property_notice: {
            rights: "All IP including logos, designs, images, videos, text belong to Crwdctrl.",
            prohibition: "Unauthorized use or distribution of content is prohibited."
        },
        indemnification: {
            user_agreement: "Users agree to indemnify Crwdctrl for misuse, violations, or infringement of rights."
        },
        governing_law: {
            jurisdiction: "Pune, Maharashtra",
            applicable_law: "Laws of India"
        }
    };

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300">
            <Seo
                title="Terms & Conditions"
                description="Read the Terms & Conditions governing access to and use of the CrwdCtrl website, platform and services."
                canonical="/terms-and-conditions"
                jsonLd={[
                    webPageSchema({ name: 'CrwdCtrl Terms & Conditions', url: '/terms-and-conditions' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Terms & Conditions', path: '/terms-and-conditions' },
                    ]),
                ]}
            />
            {/* Header */}
            <div className={`crwdctrl-sticky-header ${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border-b`}>
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-center relative">
                        <button
                            onClick={goBack}
                            className={`lg:hidden absolute left-0 p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition-colors`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <h1 className="text-xl font-bold">Terms and Conditions</h1>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Last updated: {termsData.last_updated}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Introduction */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-6 h-6 text-blue-500" />
                        <h2 className="text-lg font-semibold">Introduction</h2>
                    </div>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                        {termsData.introduction.description}
                    </p>
                    <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                        <p className={`${isDark ? 'text-blue-300' : 'text-blue-800'} text-sm`}>
                            {termsData.introduction.conflict_resolution}
                        </p>
                    </div>
                </div>

                {/* About Platform */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Globe className="w-6 h-6 text-green-500" />
                        <h2 className="text-lg font-semibold">About Crwdctrl</h2>
                    </div>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                        {termsData.about.platform_description}
                    </p>

                    <h3 className="font-medium mb-3">Platform Purpose:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {termsData.about.purpose.map((purpose, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {purpose}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className={`${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <span className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                                Important Note:
                            </span>
                        </div>
                        <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                            {termsData.about.role_limitation}
                        </p>
                    </div>
                </div>

                {/* Eligibility */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-6 h-6 text-purple-500" />
                        <h2 className="text-lg font-semibold">Eligibility Requirements</h2>
                    </div>
                    <div className="space-y-3">
                        {termsData.eligibility.requirements.map((requirement, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                                <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {requirement}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* User Accounts */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="w-6 h-6 text-indigo-500" />
                        <h2 className="text-lg font-semibold">User Accounts</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Information Collected */}
                        <div>
                            <h3 className="font-medium mb-3 text-indigo-500">Information We Collect:</h3>
                            <div className="space-y-2">
                                {termsData.user_accounts.collected_information.map((info, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {info}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* User Responsibilities */}
                        <div>
                            <h3 className="font-medium mb-3 text-blue-500">Your Responsibilities:</h3>
                            <div className="space-y-2">
                                {termsData.user_accounts.responsibilities.map((responsibility, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {responsibility}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Platform Rights */}
                        <div>
                            <h3 className="font-medium mb-3 text-red-500">Platform Rights:</h3>
                            <div className="space-y-2">
                                {termsData.user_accounts.platform_rights.map((right, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {right}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Event Listings */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <FileText className="w-6 h-6 text-orange-500" />
                        <h2 className="text-lg font-semibold">Event Listings</h2>
                    </div>

                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                        {termsData.event_listings.description}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-medium mb-3">Platform Disclaimer:</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                                {termsData.event_listings.disclaimer}
                            </p>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <strong>Your Responsibility:</strong> {termsData.event_listings.user_responsibility}
                            </p>
                        </div>

                        <div>
                            <h3 className="font-medium mb-3">Organizer Responsibilities:</h3>
                            <div className="space-y-2">
                                {termsData.event_listings.organizer_responsibility.map((responsibility, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {responsibility}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Intellectual Property */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Scale className="w-6 h-6 text-teal-500" />
                        <h2 className="text-lg font-semibold">Intellectual Property</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium mb-2">Platform Content Ownership:</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {termsData.intellectual_property.ownership}
                            </p>
                        </div>

                        <div>
                            <h3 className="font-medium mb-2">Usage Restrictions:</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {termsData.intellectual_property.restrictions}
                            </p>
                        </div>

                        <div>
                            <h3 className="font-medium mb-2">Content License:</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {termsData.intellectual_property.organizer_content_license}
                            </p>
                        </div>

                        <div className={`${isDark ? 'bg-teal-900/20 border-teal-800' : 'bg-teal-50 border-teal-200'} border rounded-lg p-4 mt-4`}>
                            <h4 className={`font-medium mb-2 ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                                Intellectual Property Notice:
                            </h4>
                            <p className={`text-sm mb-2 ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                                {termsData.intellectual_property_notice.rights}
                            </p>
                            <p className={`text-sm ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                                {termsData.intellectual_property_notice.prohibition}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Legal Terms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Third Party Links */}
                    <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                        <h3 className="font-semibold mb-3">Third Party Links</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {termsData.third_party_links.disclaimer}
                        </p>
                    </div>

                    {/* Limitation of Liability */}
                    <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                        <h3 className="font-semibold mb-3">Limitation of Liability</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {termsData.limitation_of_liability.summary}
                        </p>
                    </div>

                    {/* Indemnification */}
                    <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                        <h3 className="font-semibold mb-3">Indemnification</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {termsData.indemnification.user_agreement}
                        </p>
                    </div>

                    {/* Governing Law */}
                    <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
                        <h3 className="font-semibold mb-3">Governing Law</h3>
                        <div className="space-y-2">
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <strong>Jurisdiction:</strong> {termsData.governing_law.jurisdiction}
                            </p>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <strong>Applicable Law:</strong> {termsData.governing_law.applicable_law}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6 text-center`}>
                    <h3 className={`font-semibold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                        Questions About These Terms?
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                        If you have any questions about these Terms and Conditions, please contact us through our platform or reach out to our support team.
                    </p>
                </div>
            </div>
        </div>
    );
}