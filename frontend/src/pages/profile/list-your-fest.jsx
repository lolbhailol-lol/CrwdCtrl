import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/layout/Navbar';
import ProfileSidebar from '../../components/layout/ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useInAppBack } from '../../hooks/useInAppBack';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';

const LIST_FEST_DESCRIPTION =
    'List your college fest, competition, trek or event on CrwdCtrl. Reach thousands of students, manage registrations, and grow your audience for free.';

function ListYourFest() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // Form state
    const [formData, setFormData] = useState({
        festName: '',
        collegeName: '',
        festType: '',
        organizerName: '',
        position: '',
        contactNumber: '',
        email: '',
        festDescription: '',
        message: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

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

    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        if (!formData.festName.trim()) {
            newErrors.festName = 'Fest name is required';
        }

        if (!formData.collegeName.trim()) {
            newErrors.collegeName = 'College name is required';
        }

        if (!formData.festType) {
            newErrors.festType = 'Please select a fest type';
        }

        if (!formData.organizerName.trim()) {
            newErrors.organizerName = 'Organizer name is required';
        }

        if (!formData.position.trim()) {
            newErrors.position = 'Position/Role is required';
        }

        if (!formData.contactNumber.trim()) {
            newErrors.contactNumber = 'Contact number is required';
        } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.contactNumber.replace(/\s/g, ''))) {
            newErrors.contactNumber = 'Please enter a valid contact number';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Show success message
            setShowSuccess(true);

            // Reset form after success
            setTimeout(() => {
                setShowSuccess(false);
                setFormData({
                    festName: '',
                    collegeName: '',
                    festType: '',
                    organizerName: '',
                    position: '',
                    contactNumber: '',
                    email: '',
                    festDescription: '',
                    message: ''
                });
            }, 3000);

        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle form reset
    const handleReset = () => {
        setFormData({
            festName: '',
            collegeName: '',
            festType: '',
            organizerName: '',
            position: '',
            contactNumber: '',
            email: '',
            festDescription: '',
            message: ''
        });
        setErrors({});
    };

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex transition-colors duration-300">
            <Seo
                title="List Your Fest or Event"
                description={LIST_FEST_DESCRIPTION}
                canonical="/list-your-fest"
                keywords="list your fest, list event, organizer, host fest, promote college fest"
                jsonLd={[
                    webPageSchema({ name: 'List Your Fest on CrwdCtrl', description: LIST_FEST_DESCRIPTION, url: '/list-your-fest' }),
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'List Your Fest', path: '/list-your-fest' },
                    ]),
                ]}
            />
            <div className={`flex flex-1 flex-col transition-all duration-300 ${isProfileOpen ? 'blur-sm' : ''}`}>

                {/* Back Navigation */}
                <main className="flex-1">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
                        <button
                            onClick={goBack}
                            className={`flex items-center space-x-2 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition mb-4`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
                        <div className={`max-w-4xl mx-auto rounded-xl shadow-lg p-6 sm:p-8 ${isDark ? 'bg-[#111213]' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <h1 className={`text-2xl sm:text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    College Fest Registration
                                </h1>
                                <p className={`text-sm sm:text-base mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Fill out the form below to list your college festival and reach thousands of students
                                </p>
                                <p className={`text-sm sm:text-base font-medium ${isDark ? 'text-[#00C2CB]' : 'text-[#00C2CB]'}`}>
                                    Join CrwdCtrl and showcase your college fest to thousands of students across India. Let's make your event unforgettable!
                                </p>
                            </div>

                            {/* Success Message */}
                            {showSuccess && (
                                <div className={`mb-6 p-4 rounded-lg border ${isDark ? 'bg-green-900/20 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                    <div className="flex items-center space-x-2">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="font-medium">Success!</span>
                                    </div>
                                    <p className="mt-1 text-sm">Your fest registration has been submitted successfully. We'll review it and get back to you soon.</p>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSubmit}>
                                {/* Mobile and Tablet View - Stack vertically */}
                                <div className="block lg:hidden space-y-6">
                                    {/* Row 1: Fest Name + College Name */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Fest Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="festName"
                                                value={formData.festName}
                                                onChange={handleInputChange}
                                                placeholder="Enter fest name"
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.festName ? 'border-red-500' : ''}`}
                                            />
                                            {errors.festName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.festName}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                College Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="collegeName"
                                                value={formData.collegeName}
                                                onChange={handleInputChange}
                                                placeholder="Enter college name"
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.collegeName ? 'border-red-500' : ''}`}
                                            />
                                            {errors.collegeName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.collegeName}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Fest Type */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Fest Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="festType"
                                            value={formData.festType}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#1D1E20] border-gray-700 text-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-900'
                                                } ${errors.festType ? 'border-red-500' : ''}`}
                                        >
                                            <option value="">Select fest type</option>
                                            <option value="cultural">Cultural</option>
                                            <option value="technical">Technical</option>
                                            <option value="sports">Sports</option>
                                            <option value="others">Others</option>
                                        </select>
                                        {errors.festType && (
                                            <p className="mt-1 text-sm text-red-500">{errors.festType}</p>
                                        )}
                                    </div>

                                    {/* Organizer Name */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Organizer's Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="organizerName"
                                            value={formData.organizerName}
                                            onChange={handleInputChange}
                                            placeholder="Enter organizer's full name"
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                } ${errors.organizerName ? 'border-red-500' : ''}`}
                                        />
                                        {errors.organizerName && (
                                            <p className="mt-1 text-sm text-red-500">{errors.organizerName}</p>
                                        )}
                                    </div>

                                    {/* Position */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Position / Role <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="position"
                                            value={formData.position}
                                            onChange={handleInputChange}
                                            placeholder="e.g., Event Coordinator, President, Secretary"
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                } ${errors.position ? 'border-red-500' : ''}`}
                                        />
                                        {errors.position && (
                                            <p className="mt-1 text-sm text-red-500">{errors.position}</p>
                                        )}
                                    </div>

                                    {/* Row 2: Contact Number + Email */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Contact Number <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                name="contactNumber"
                                                value={formData.contactNumber}
                                                onChange={handleInputChange}
                                                placeholder="+91 9876543210"
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.contactNumber ? 'border-red-500' : ''}`}
                                            />
                                            {errors.contactNumber && (
                                                <p className="mt-1 text-sm text-red-500">{errors.contactNumber}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Email <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="organizer@college.edu"
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.email ? 'border-red-500' : ''}`}
                                            />
                                            {errors.email && (
                                                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Fest Description */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Fest Description <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
                                        </label>
                                        <textarea
                                            name="festDescription"
                                            value={formData.festDescription}
                                            onChange={handleInputChange}
                                            rows="4"
                                            placeholder="Describe your fest, events, highlights, and what makes it special..."
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${isDark
                                                ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                }`}
                                        />
                                    </div>

                                    {/* Message */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Message / Query <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
                                        </label>
                                        <textarea
                                            name="message"
                                            value={formData.message}
                                            onChange={handleInputChange}
                                            rows="3"
                                            placeholder="Any additional information, questions, or special requirements..."
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${isDark
                                                ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                }`}
                                        />
                                    </div>
                                </div>

                                {/* Desktop View - Two columns (left and right) */}
                                <div className="hidden lg:grid lg:grid-cols-2 lg:gap-8">
                                    {/* Left Column */}
                                    <div className="space-y-6">
                                        {/* Fest Name */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Fest Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="festName"
                                                value={formData.festName}
                                                onChange={handleInputChange}
                                                placeholder="Enter fest name"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.festName ? 'border-red-500' : ''}`}
                                            />
                                            {errors.festName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.festName}</p>
                                            )}
                                        </div>

                                        {/* College Name */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                College Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="collegeName"
                                                value={formData.collegeName}
                                                onChange={handleInputChange}
                                                placeholder="Enter college name"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.collegeName ? 'border-red-500' : ''}`}
                                            />
                                            {errors.collegeName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.collegeName}</p>
                                            )}
                                        </div>

                                        {/* Fest Type */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Fest Type <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                name="festType"
                                                value={formData.festType}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 text-white'
                                                    : 'bg-gray-50 border-gray-200 text-gray-900'
                                                    } ${errors.festType ? 'border-red-500' : ''}`}
                                            >
                                                <option value="">Select fest type</option>
                                                <option value="cultural">Cultural</option>
                                                <option value="technical">Technical</option>
                                                <option value="sports">Sports</option>
                                                <option value="others">Others</option>
                                            </select>
                                            {errors.festType && (
                                                <p className="mt-1 text-sm text-red-500">{errors.festType}</p>
                                            )}
                                        </div>

                                        {/* Organizer Name */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Organizer's Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="organizerName"
                                                value={formData.organizerName}
                                                onChange={handleInputChange}
                                                placeholder="Enter organizer's full name"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.organizerName ? 'border-red-500' : ''}`}
                                            />
                                            {errors.organizerName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.organizerName}</p>
                                            )}
                                        </div>

                                        {/* Position */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Position / Role <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="position"
                                                value={formData.position}
                                                onChange={handleInputChange}
                                                placeholder="e.g., Event Coordinator, President, Secretary"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.position ? 'border-red-500' : ''}`}
                                            />
                                            {errors.position && (
                                                <p className="mt-1 text-sm text-red-500">{errors.position}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-6">
                                        {/* Contact Number */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Contact Number <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                name="contactNumber"
                                                value={formData.contactNumber}
                                                onChange={handleInputChange}
                                                placeholder="+91 9876543210"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.contactNumber ? 'border-red-500' : ''}`}
                                            />
                                            {errors.contactNumber && (
                                                <p className="mt-1 text-sm text-red-500">{errors.contactNumber}</p>
                                            )}
                                        </div>

                                        {/* Email */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Email <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="organizer@college.edu"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.email ? 'border-red-500' : ''}`}
                                            />
                                            {errors.email && (
                                                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                                            )}
                                        </div>

                                        {/* Fest Description */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Fest Description <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
                                            </label>
                                            <textarea
                                                name="festDescription"
                                                value={formData.festDescription}
                                                onChange={handleInputChange}
                                                rows="4"
                                                placeholder="Describe your fest, events, highlights, and what makes it special..."
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    }`}
                                            />
                                        </div>

                                        {/* Message */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Message / Query <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
                                            </label>
                                            <textarea
                                                name="message"
                                                value={formData.message}
                                                onChange={handleInputChange}
                                                rows="3"
                                                placeholder="Any additional information, questions, or special requirements..."
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${isDark
                                                    ? 'bg-[#1D1E20] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4 pt-4 lg:col-span-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 bg-linear-to-r from-[#053780] to-[#0ECCEE] text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        disabled={isSubmitting}
                                        className={`flex-1 sm:flex-initial px-6 py-3 rounded-lg font-semibold border transition-colors duration-200 ${isDark
                                            ? 'border-gray-600 text-gray-300 hover:bg-gray-700 focus:ring-gray-500'
                                            : 'border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-400'
                                            } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        Clear Form
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>

            {/* Profile Sidebar Overlay */}
            {isProfileOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                        onClick={() => setIsProfileOpen(false)}
                    />
                    <ProfileSidebar
                        isOpen={isProfileOpen}
                        onClose={() => setIsProfileOpen(false)}
                        onShowLogin={() => setShowLogin(true)}
                        onShowRegister={() => setShowRegister(true)}
                    />
                </>
            )}

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

export default ListYourFest;
