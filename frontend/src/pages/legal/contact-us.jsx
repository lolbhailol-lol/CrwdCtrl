import React from 'react';
import { useDarkMode } from '../../context/DarkModeContext';
import { ArrowLeft, Mail, Phone, Globe, User, MapPin, Clock, MessageCircle, Send } from 'lucide-react';
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
    SUPPORT_EMAIL,
    WEBSITE_URL,
    LEGAL_JURISDICTION,
} from '../../constants/legalEntity';

export default function ContactUs() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();

    const contactData = {
        website: WEBSITE_URL,
        email: LEGAL_EMAIL,
        supportEmail: SUPPORT_EMAIL,
        phone_numbers: [
            {
                name: LEGAL_NAME,
                number: LEGAL_PHONE_DISPLAY,
            },
        ]
    };

    const handleEmailClick = () => {
        window.location.href = `mailto:${contactData.email}`;
    };

    const handlePhoneClick = (number) => {
        window.location.href = `tel:${number}`;
    };

    const handleWebsiteClick = () => {
        openExternalUrl(contactData.website);
    };

    const contactDescription =
        'Get in touch with the CrwdCtrl team. Contact us for support, partnerships, listing your fest or event, or any questions about the platform.';

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300">
            <Seo
                title="Contact Us"
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
                            <h1 className="text-xl font-bold">Contact Us</h1>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Get in touch with our team
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Hero Section */}
                <div className={`${isDark ? 'bg-linear-to-r from-blue-900/20 to-purple-900/20 border-gray-800' : 'bg-linear-to-r from-blue-50 to-purple-50 border-gray-200'} border rounded-lg p-6 mb-8`}>
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className={`p-3 rounded-full ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
                                <MessageCircle className="w-8 h-8 text-blue-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">We'd Love to Hear from You!</h2>
                        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} max-w-2xl mx-auto`}>
                            Have questions, suggestions, or need assistance? Our team is here to help you make the most of your CrwdCtrl experience.
                        </p>
                    </div>
                </div>

                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-8`}>
                    <h2 className="text-lg font-semibold mb-2">Legal / Business Information</h2>
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {LEGAL_OPERATOR_LINE}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <p><strong>Legal name:</strong> {LEGAL_NAME}</p>
                        <p>
                            <strong>Email:</strong>{' '}
                            <a href={`mailto:${LEGAL_EMAIL}`} className="text-blue-500 underline">{LEGAL_EMAIL}</a>
                        </p>
                        <p>
                            <strong>Phone:</strong>{' '}
                            <a href={`tel:${LEGAL_PHONE_TEL}`} className="text-blue-500 underline">{LEGAL_PHONE_DISPLAY}</a>
                        </p>
                        <p>
                            <strong>Website:</strong>{' '}
                            <a href={WEBSITE_URL} className="text-blue-500 underline">{WEBSITE_URL}</a>
                        </p>
                        <p><strong>Location:</strong> {LEGAL_JURISDICTION}</p>
                    </div>
                </div>

                {/* Contact Methods */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Website */}
                    <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 hover:shadow-lg transition-all duration-300 cursor-pointer`}
                        onClick={handleWebsiteClick}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-green-600/20' : 'bg-green-100'}`}>
                                <Globe className="w-5 h-5 text-green-500" />
                            </div>
                            <h3 className="font-semibold">Website</h3>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                            Visit our official website
                        </p>
                        <p className="text-blue-500 hover:text-blue-600 transition-colors font-medium">
                            {contactData.website}
                        </p>
                    </div>

                    {/* Email */}
                    <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 hover:shadow-lg transition-all duration-300 cursor-pointer`}
                        onClick={handleEmailClick}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-red-600/20' : 'bg-red-100'}`}>
                                <Mail className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="font-semibold">Email</h3>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                            Send us a detailed message
                        </p>
                        <p className="text-blue-500 hover:text-blue-600 transition-colors font-medium">
                            {contactData.email}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Support: {contactData.supportEmail}
                        </p>
                    </div>

                    {/* Business Hours */}
                    <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 md:col-span-2 lg:col-span-1`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                                <Clock className="w-5 h-5 text-purple-500" />
                            </div>
                            <h3 className="font-semibold">Response Time</h3>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                            We typically respond within
                        </p>
                        <p className="font-medium text-purple-500">24-48 hours</p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
                            Monday - Sunday
                        </p>
                    </div>
                </div>

                {/* Phone Contacts */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-8`}>
                    <div className="flex items-center gap-3 mb-6">
                        <Phone className="w-6 h-6 text-orange-500" />
                        <h2 className="text-lg font-semibold">Phone Support</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {contactData.phone_numbers.map((contact, index) => (
                            <div key={index}
                                className={`${isDark ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4 hover:shadow-md transition-all duration-300 cursor-pointer`}
                                onClick={() => handlePhoneClick(contact.number)}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-full ${isDark ? 'bg-orange-600/30' : 'bg-orange-200'}`}>
                                        <User className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <h3 className={`font-medium ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>
                                        {contact.name}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2 ml-9">
                                    <Phone className="w-4 h-4 text-orange-500" />
                                    <span className={`font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'} hover:text-orange-600 transition-colors`}>
                                        {contact.number}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4 mt-6`}>
                        <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                            <strong>Pro Tip:</strong> For faster resolution, please have your account details ready when calling.
                        </p>
                    </div>
                </div>

                {/* Contact Form Section */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-8`}>
                    <div className="flex items-center gap-3 mb-6">
                        <Send className="w-6 h-6 text-indigo-500" />
                        <h2 className="text-lg font-semibold">Quick Contact</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-medium mb-3">What can we help you with?</h3>
                            <div className="space-y-3">
                                {[
                                    "Account & Registration Issues",
                                    "Event Organization Support",
                                    "Technical Problems",
                                    "Payment & Billing Questions",
                                    "Feature Requests",
                                    "General Inquiries"
                                ].map((item, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-medium mb-3">Before you contact us</h3>
                            <div className="space-y-3">
                                {[
                                    "Check our FAQ section",
                                    "Try refreshing the page",
                                    "Clear your browser cache",
                                    "Have your account email ready",
                                    "Note any error messages",
                                    "Describe your issue in detail"
                                ].map((item, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Office Information */}
                <div className={`${isDark ? 'bg-linear-to-r from-gray-900 to-gray-800 border-gray-700' : 'bg-linear-to-r from-gray-100 to-gray-200 border-gray-300'} border rounded-lg p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <MapPin className="w-6 h-6 text-teal-500" />
                        <h3 className="font-semibold">CrwdCtrl</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h4 className={`font-medium mb-2 ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                                Company
                            </h4>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Your premier event management platform connecting organizers and participants.
                            </p>
                        </div>

                        <div>
                            <h4 className={`font-medium mb-2 ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                                Mission
                            </h4>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Simplifying event discovery, registration, and management for everyone.
                            </p>
                        </div>

                        <div>
                            <h4 className={`font-medium mb-2 ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                                Support
                            </h4>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Dedicated team available to help with your event needs.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}