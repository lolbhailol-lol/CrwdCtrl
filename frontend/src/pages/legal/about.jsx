import React from 'react';
import { useDarkMode } from '../../context/DarkModeContext';
import { ArrowLeft, Users, Target, Rocket, Globe, Heart, Star, Award, Zap, Shield } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Seo from '../../components/Seo';
import { breadcrumbSchema, faqSchema, webPageSchema } from '../../utils/seo';

const ABOUT_DESCRIPTION =
    "CrwdCtrl is India's platform for discovering, exploring and registering for college fests, competitions, treks, running clubs and events — all in one place.";

export default function About() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300">
            <Seo
                title="About CrwdCtrl"
                description={ABOUT_DESCRIPTION}
                canonical="/about"
                jsonLd={[
                    webPageSchema({ name: 'About CrwdCtrl', description: ABOUT_DESCRIPTION, url: '/about' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'About', path: '/about' },
                    ]),
                    faqSchema([
                        {
                            question: 'What is CrwdCtrl?',
                            answer: ABOUT_DESCRIPTION,
                        },
                        {
                            question: 'What can I find on CrwdCtrl?',
                            answer:
                                'You can find college fests (cultural, technical and sports), competitions, treks and adventure communities, running clubs, gym communities, and local events and meetups near you.',
                        },
                        {
                            question: 'Who is CrwdCtrl for?',
                            answer:
                                'CrwdCtrl is for students and young people looking to discover and join events, and for organizers who want to list their fests, competitions and activities and manage registrations.',
                        },
                    ]),
                ]}
            />
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
                            <h1 className="text-xl font-bold">About CrwdCtrl</h1>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Discover fests. Register. Participate.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Hero Section */}
                <div className={`${isDark ? 'bg-linear-to-br from-blue-900/30 to-cyan-900/20 border-blue-800' : 'bg-linear-to-br from-blue-50 to-cyan-50 border-blue-200'} border rounded-lg p-8 mb-6 text-center`}>
                    <h2 className="text-3xl font-bold mb-3">🎊 CrwdCtrl</h2>
                    <p className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'} max-w-2xl mx-auto`}>
                        India's platform for discovering, exploring, and registering for college fests, competitions, and events — all in one place.
                    </p>
                </div>

                {/* What We Do */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Target className="w-6 h-6 text-blue-500" />
                        <h2 className="text-lg font-semibold">What We Do</h2>
                    </div>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                        CrwdCtrl is a digital platform that connects students and participants with college fests, cultural events, technical competitions, and sports tournaments across India.
                    </p>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        We make it easy for students to discover exciting events, register for competitions, and stay updated — while helping fest organizers reach a wider audience and manage registrations seamlessly.
                    </p>
                </div>

                {/* Our Mission */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Rocket className="w-6 h-6 text-purple-500" />
                        <h2 className="text-lg font-semibold">Our Mission</h2>
                    </div>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        To simplify how students discover and participate in college events. We believe every student should have easy access to the vibrant world of college fests — no matter which college they're from.
                    </p>
                </div>

                {/* Features */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Zap className="w-6 h-6 text-yellow-500" />
                        <h2 className="text-lg font-semibold">What You Can Do</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { icon: <Globe className="w-5 h-5 text-blue-500" />, title: 'Discover Fests', desc: 'Browse cultural, technical, and sports fests from colleges across India' },
                            { icon: <Star className="w-5 h-5 text-yellow-500" />, title: 'Register for Competitions', desc: 'Sign up for individual competitions within fests with a few taps' },
                            { icon: <Heart className="w-5 h-5 text-red-500" />, title: 'Save Favorites', desc: "Bookmark fests and events you're interested in for quick access" },
                            { icon: <Award className="w-5 h-5 text-green-500" />, title: 'Track Registrations', desc: 'View your registration history and details in one place' },
                            { icon: <Users className="w-5 h-5 text-purple-500" />, title: 'For Organizers', desc: 'List your fest and manage registrations through our platform' },
                            { icon: <Shield className="w-5 h-5 text-cyan-500" />, title: 'Secure & Reliable', desc: 'Your data is protected with modern security practices' },
                        ].map((feature, index) => (
                            <div key={index} className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-lg p-4 flex gap-3`}>
                                <div className="shrink-0 mt-0.5">{feature.icon}</div>
                                <div>
                                    <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Who We Are */}
                <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border rounded-lg p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="w-6 h-6 text-green-500" />
                        <h2 className="text-lg font-semibold">Who We Are</h2>
                    </div>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                        CrwdCtrl is built by a team of college students who understand the excitement and chaos of fest season. We created this platform because we wanted a simpler way to find and participate in events.
                    </p>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Based in India, we're passionate about making the college experience more connected and accessible for everyone.
                    </p>
                </div>

                {/* Quick Links */}
                <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6`}>
                    <h3 className={`font-semibold mb-4 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                        Quick Links
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {[
                            { label: 'Contact Us', to: '/contact-us' },
                            { label: 'Terms & Conditions', to: '/terms-and-conditions' },
                            { label: 'Refunds & Cancellations', to: '/refunds-and-cancellations' },
                            { label: 'Products & Services', to: '/products-and-services' },
                            { label: 'Privacy Policy', to: '/privacy-policy' },
                        ].map((link, index) => (
                            <Link
                                key={index}
                                to={link.to}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                    ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-800/50'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                    <div className="mt-4">
                        <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            Website: <a href="https://www.crwdctrl.in" className="underline">www.crwdctrl.in</a>
                        </p>
                        <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            Email: <a href="mailto:Karan@crwdctrl.in" className="underline">Karan@crwdctrl.in</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
