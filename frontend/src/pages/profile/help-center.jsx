import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/layout/Navbar';
import ProfileSidebar from '../../components/layout/ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { ArrowLeft, Search, MessageCircle, Book, Settings, Phone, Shield, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';

const HelpCenter = () => {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');

    const SUPPORT_EMAIL = 'crwdctrl.in@gmail.com';

    // Check for login modal parameter
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

    // Handle login modal close
    const handleCloseLogin = () => {
        setShowLogin(false);
        setSearchParams({}); // Clear URL parameters
    };

    // Handle register modal close
    const handleCloseRegister = () => {
        setShowRegister(false);
    };

    // Switch from login to register
    const handleSwitchToRegister = () => {
        setShowLogin(false);
        setShowRegister(true);
    };

    // Switch from register to login
    const handleSwitchToLogin = () => {
        setShowRegister(false);
        setShowLogin(true);
    };

    const helpTopics = [
        {
            icon: <Book className="w-6 h-6" />,
            title: "Getting Started",
            description: "Learn how to navigate and use CrwdCtrl platform",
            articles: 12
        },
        {
            icon: <MessageCircle className="w-6 h-6" />,
            title: "Event Registration",
            description: "How to register for events and manage your bookings",
            articles: 8
        },
        {
            icon: <Settings className="w-6 h-6" />,
            title: "Account Settings",
            description: "Manage your profile and account preferences",
            articles: 6
        },
        {
            icon: <Phone className="w-6 h-6" />,
            title: "Contact Support",
            description: "Get in touch with our support team",
            articles: 4
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: "Legal & Privacy",
            description: "Privacy policy, terms of service, about us, and legal information",
            isLegal: true,
            links: [
                { text: "Contact Us", path: "/contact-us" },
                { text: "Privacy Policy", path: "/privacy-policy" },
                { text: "Terms and Conditions", path: "/terms-and-conditions" },
                { text: "Refunds & Cancellations", path: "/refunds-and-cancellations" },
                { text: "Products & Services (INR pricing)", path: "/products-and-services" },
                { text: "Delete Account", path: "/delete-account" },
                { text: "About Us", path: "/about" }
            ]
        }
    ];

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredTopics = normalizedQuery
        ? helpTopics.filter((topic) => {
              const haystack = [
                  topic.title,
                  topic.description,
                  ...(topic.links?.map((l) => l.text) || []),
              ]
                  .join(' ')
                  .toLowerCase();
              return haystack.includes(normalizedQuery);
          })
        : helpTopics;

    const handleContactSupport = () => {
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('CrwdCtrl Support Request')}`;
    };

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex transition-colors duration-300">
            <Seo
                title="Help Center"
                description="Find answers to common questions about CrwdCtrl — getting started, registering for events, managing your account, payments, and contacting support."
                canonical="/help-center"
                jsonLd={[
                    webPageSchema({
                        name: 'CrwdCtrl Help Center',
                        description: 'Help and support for using CrwdCtrl.',
                        url: '/help-center',
                    }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Help Center', path: '/help-center' },
                    ]),
                ]}
            />
            <div className={`flex flex-1 flex-col transition-all duration-300 ${isProfileOpen ? 'blur-sm' : ''}`}>

                {/* Mobile Header with Back Button */}
                <div className="lg:hidden">
                    <div className="flex items-center justify-between p-4 border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => navigate(-1)}
                            className={`flex items-center space-x-2  ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-semibold text-lg text-black">Help Center</span>
                        </button>
                    </div>
                </div>

                {/* Desktop Back Navigation */}
                <main className="flex-1">
                    <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 pt-4">
                        <button
                            onClick={() => navigate(-1)}
                            className={`flex items-center space-x-2 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition mb-4`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 lg:pb-8">
                        <div className="max-w-4xl mx-auto">
                            {/* Header Section */}
                            <div className="text-center mb-6 lg:mb-8 pt-[calc(env(safe-area-inset-top)+1rem)] lg:pt-0">
                                <h1 className={`text-2xl lg:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-3 lg:mb-4`}>
                                    Help Center
                                </h1>
                                <p className={`text-base lg:text-lg ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-6 lg:mb-8 px-2 lg:px-0`}>
                                    Find answers to common questions and get support
                                </p>

                                {/* Search Bar */}
                                <div className="max-w-2xl mx-auto relative px-2 lg:px-0">
                                    <Search className={`absolute left-6 lg:left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search for help topics..."
                                        className={`w-full pl-12 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
                                            ? 'bg-black border-gray-700 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-700 placeholder-gray-500'
                                            }`}
                                    />
                                </div>
                            </div>

                            {/* Help Topics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8 px-2 lg:px-0">
                                {filteredTopics.map((topic, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 lg:p-6 rounded-lg border transition-all duration-200 ${topic.isLegal
                                                ? isDark
                                                    ? 'bg-blue-900/20 border-blue-800'
                                                    : 'bg-blue-50 border-blue-200'
                                                : isDark
                                                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750 cursor-pointer hover:shadow-lg'
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer hover:shadow-lg'
                                            }`}
                                    >
                                        <div className="flex items-start space-x-3 lg:space-x-4">
                                            <div className={`p-2 lg:p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                                                <div className="text-blue-600">
                                                    {topic.icon}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className={`text-base lg:text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1 lg:mb-2`}>
                                                    {topic.title}
                                                </h3>
                                                <p className={`text-xs lg:text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-1 lg:mb-2 leading-relaxed`}>
                                                    {topic.description}
                                                </p>

                                                {topic.isLegal ? (
                                                    <div className="space-y-2 mt-3">
                                                        {topic.links.map((link, linkIndex) => (
                                                            <button
                                                                key={linkIndex}
                                                                onClick={() => {
                                                                    navigate(link.path);
                                                                }}
                                                                className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                                                        ? 'bg-blue-800/50 text-blue-300 hover:bg-blue-800/70 hover:text-blue-200'
                                                                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                                                    }`}
                                                            >
                                                                {link.text}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {topic.articles} articles
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredTopics.length === 0 && (
                                    <div className={`md:col-span-2 text-center py-10 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        No help topics match "{searchQuery}". Try a different search or contact support below.
                                    </div>
                                )}
                            </div>

                            {/* Contact Section */}
                            <div className={`p-4 lg:p-6 rounded-lg border mx-2 lg:mx-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'}`}>
                                <div className="text-center">
                                    <h3 className={`text-base lg:text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                                        Still need help?
                                    </h3>
                                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-4 px-2 lg:px-0`}>
                                        Can't find what you're looking for? Our support team is here to help.
                                    </p>
                                    <button
                                        onClick={handleContactSupport}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
                                    >
                                        Contact Support
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Profile Sidebar */}
            <ProfileSidebar
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onShowLogin={() => setShowLogin(true)}
                onShowRegister={() => setShowRegister(true)}
            />

            {/* Login Modal */}
            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
                </div>
            )}

            {/* Register Modal */}
            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                </div>
            )}
        </div>
    );
}

export default HelpCenter;
