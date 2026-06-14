import React from 'react';
import { useDarkMode } from '../../context/DarkModeContext';
import { ArrowLeft, Shield, Eye, Database, Share2, Lock, Users, FileText, Globe, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();

    const privacyData = {
        last_updated: "2026-02-19",
        introduction: {
            purpose: "Explains how Crwdctrl collects, uses, stores, and protects user data.",
            scope: [
                "Websites",
                "Applications",
                "Online services"
            ],
            data_storage_location: "India",
            consent_required: true
        },
        information_collected: {
            personal_identifiers: [
                "Name",
                "Email",
                "Phone number",
                "Age",
                "Gender",
                "College/University",
                "Location/City"
            ],
            identity_data: [
                "ID proof",
                "Address proof"
            ],
            account_data: [
                "Username",
                "Encrypted password",
                "Profile picture",
                "User type"
            ],
            platform_activity: [
                "Events viewed or registered",
                "Fests followed",
                "Interactions",
                "Preferences",
                "Login history",
                "Device/browser data",
                "IP address",
                "Usage logs"
            ],
            uploaded_content: [
                "Event details",
                "Posters",
                "Images",
                "Media",
                "Messages",
                "Other voluntarily uploaded content"
            ],
            third_party_collection_note: "Data collected directly by partners will follow their privacy policies."
        },
        data_usage: {
            purposes: [
                "To provide and manage core services",
                "To send communications and notifications",
                "To improve user experience via recommendations",
                "To enhance security and prevent fraud",
                "For internal analytics and performance monitoring"
            ]
        },
        data_sharing: {
            internal_entities: "For registration or coordination",
            third_party_providers: [
                "Payment gateways",
                "Hosting providers",
                "Email/SMS services"
            ],
            business_partners: "Where needed to provide additional services",
            government_authorities: "When required by law or safety considerations"
        },
        data_security_and_retention: {
            measures: [
                "Technical + organizational security measures",
                "Secure servers",
                "Encryption where applicable"
            ],
            user_responsibility: "Maintain confidentiality of credentials",
            retention_policy: "Data retained as long as account is active or required by law"
        },
        user_rights: {
            rights_available: [
                "Access personal data",
                "Update or rectify data",
                "Request deletion",
                "Opt-out of marketing"
            ]
        },
        consent: {
            consent_implication: "Using the platform means consenting to data practices",
            withdrawal_conditions: [
                "Not retrospective",
                "May limit services"
            ]
        },
        advertising_and_cookies: {
            description: "We use Google AdSense to display advertisements on our platform. Google AdSense is a third-party advertising service provided by Google LLC.",
            cookies_usage: [
                "Google uses cookies to serve ads based on your prior visits to this website or other websites",
                "Google's use of advertising cookies enables it and its partners to serve ads based on your visit to CrwdCtrl and/or other sites on the Internet",
                "Third-party vendors, including Google, use cookies to serve ads based on your interests",
                "We may also use analytics cookies to understand how visitors interact with our platform"
            ],
            user_choices: [
                "You may opt out of personalized advertising by visiting Google Ads Settings (adssettings.google.com)",
                "You can opt out of third-party vendor cookies by visiting the Network Advertising Initiative opt-out page (optout.networkadvertising.org)",
                "You can manage cookie preferences through your browser settings",
                "Disabling cookies may affect your experience on certain parts of the platform"
            ],
            third_party_links: "Our platform may contain links to other websites. We are not responsible for the privacy practices of third-party sites."
        },
        contact: {
            website: "https://www.crwdctrl.in",
            email: "Karan@crwdctrl.in"
        }
    };

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300">
            {/* Header */}
            <div className={`crwdctrl-sticky-header ${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border-b`}>
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-center relative">
                        <button
                            onClick={() => navigate(-1)}
                            className={`lg:hidden absolute left-0 p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition-colors`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <h1 className="text-xl font-bold">Privacy Policy</h1>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Last updated: {privacyData.last_updated}
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
                        <Shield className="w-6 h-6 text-blue-500" />
                        <h2 className="text-lg font-semibold">Introduction</h2>
                    </div>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                        {privacyData.introduction.purpose}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-medium mb-3">Our Services Cover:</h3>
                            <div className="space-y-2">
                                {privacyData.introduction.scope.map((scope, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {scope}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                            <h4 className={`font-medium mb-2 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                Key Information:
                            </h4>
                            <div className="space-y-2 text-sm">
                                <p className={`${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                    <strong>Data Storage:</strong> {privacyData.introduction.data_storage_location}
                                </p>
                                <p className={`${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                    <strong>Consent:</strong> {privacyData.introduction.consent_required ? 'Required' : 'Not Required'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Information We Collect */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Database className="w-6 h-6 text-green-500" />
                        <h2 className="text-lg font-semibold">Information We Collect</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Personal Identifiers */}
                        <div className={`${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'} border rounded-lg p-4`}>
                            <h3 className={`font-medium mb-3 ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                                Personal Identifiers
                            </h3>
                            <div className="space-y-2">
                                {privacyData.information_collected.personal_identifiers.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Identity Data */}
                        <div className={`${isDark ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'} border rounded-lg p-4`}>
                            <h3 className={`font-medium mb-3 ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>
                                Identity Verification
                            </h3>
                            <div className="space-y-2">
                                {privacyData.information_collected.identity_data.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Account Data */}
                        <div className={`${isDark ? 'bg-indigo-900/20 border-indigo-800' : 'bg-indigo-50 border-indigo-200'} border rounded-lg p-4`}>
                            <h3 className={`font-medium mb-3 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                                Account Information
                            </h3>
                            <div className="space-y-2">
                                {privacyData.information_collected.account_data.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Platform Activity */}
                        <div className={`${isDark ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
                            <h3 className={`font-medium mb-3 ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>
                                Activity & Usage Data
                            </h3>
                            <div className="space-y-2">
                                {privacyData.information_collected.platform_activity.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Uploaded Content */}
                        <div className={`${isDark ? 'bg-teal-900/20 border-teal-800' : 'bg-teal-50 border-teal-200'} border rounded-lg p-4 lg:col-span-2 xl:col-span-1`}>
                            <h3 className={`font-medium mb-3 ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                                Content You Upload
                            </h3>
                            <div className="space-y-2">
                                {privacyData.information_collected.uploaded_content.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-teal-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={`${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4 mt-4`}>
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <span className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                                Third-Party Data Collection
                            </span>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                            {privacyData.information_collected.third_party_collection_note}
                        </p>
                    </div>
                </div>

                {/* How We Use Your Data */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Eye className="w-6 h-6 text-purple-500" />
                        <h2 className="text-lg font-semibold">How We Use Your Data</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {privacyData.data_usage.purposes.map((purpose, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                                <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {purpose}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data Sharing */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Share2 className="w-6 h-6 text-red-500" />
                        <h2 className="text-lg font-semibold">Data Sharing</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-medium mb-2 text-red-500">Internal Entities</h3>
                                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {privacyData.data_sharing.internal_entities}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-medium mb-2 text-orange-500">Business Partners</h3>
                                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {privacyData.data_sharing.business_partners}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-medium mb-2 text-yellow-500">Government Authorities</h3>
                                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {privacyData.data_sharing.government_authorities}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-medium mb-3 text-blue-500">Third-Party Service Providers</h3>
                            <div className="space-y-2">
                                {privacyData.data_sharing.third_party_providers.map((provider, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {provider}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Security & Retention */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Lock className="w-6 h-6 text-green-500" />
                        <h2 className="text-lg font-semibold">Data Security & Retention</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-medium mb-3">Security Measures</h3>
                            <div className="space-y-2">
                                {privacyData.data_security_and_retention.measures.map((measure, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <Shield className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {measure}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className={`${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'} border rounded-lg p-3 mt-4`}>
                                <p className={`text-sm ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                                    <strong>Your Responsibility:</strong> {privacyData.data_security_and_retention.user_responsibility}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-medium mb-3">Data Retention Policy</h3>
                            <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                                <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                    {privacyData.data_security_and_retention.retention_policy}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Your Rights */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="w-6 h-6 text-indigo-500" />
                        <h2 className="text-lg font-semibold">Your Rights</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {privacyData.user_rights.rights_available.map((right, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                                <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {right}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Advertising & Cookies */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Globe className="w-6 h-6 text-yellow-500" />
                        <h2 className="text-lg font-semibold">Advertising & Cookies</h2>
                    </div>

                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                        {privacyData.advertising_and_cookies.description}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-medium mb-3">How Cookies Are Used</h3>
                            <div className="space-y-2">
                                {privacyData.advertising_and_cookies.cookies_usage.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full shrink-0 mt-2"></div>
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-medium mb-3">Your Choices</h3>
                            <div className="space-y-2">
                                {privacyData.advertising_and_cookies.user_choices.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={`${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3 mt-4`}>
                        <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                            <strong>Third-Party Links:</strong> {privacyData.advertising_and_cookies.third_party_links}
                        </p>
                    </div>
                </div>

                {/* Consent */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <FileText className="w-6 h-6 text-orange-500" />
                        <h2 className="text-lg font-semibold">Consent</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium mb-2">Platform Usage</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {privacyData.consent.consent_implication}
                            </p>
                        </div>

                        <div>
                            <h3 className="font-medium mb-3">Consent Withdrawal</h3>
                            <div className="space-y-2">
                                {privacyData.consent.withdrawal_conditions.map((condition, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {condition}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Mail className="w-6 h-6 text-blue-500" />
                        <h3 className={`font-semibold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                            Contact Us
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className={`text-sm mb-2 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                If you have any questions about this Privacy Policy or how we handle your data, please contact us:
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-500" />
                                <a
                                    href={privacyData.contact.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-sm underline ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
                                >
                                    {privacyData.contact.website}
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-500" />
                                <a
                                    href={`mailto:${privacyData.contact.email}`}
                                    className={`text-sm underline ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
                                >
                                    {privacyData.contact.email}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}