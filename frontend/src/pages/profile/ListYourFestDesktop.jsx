import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useInAppBack } from '../../hooks/useInAppBack';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import {
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Loader2
} from 'lucide-react';

const LIST_FEST_DESCRIPTION =
    'List your college fest, competition, trek or event on CrwdCtrl. Reach thousands of students, manage registrations, and grow your audience for free.';

export default function ListYourFestDesktop() {
    const { isDark } = useDarkMode();
    const goBack = useInAppBack();
    const [searchParams, setSearchParams] = useSearchParams();

    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);

    // Exact original form fields only
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

    const [touched, setTouched] = useState({});
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

    const handleCloseLogin = () => {
        setShowLogin(false);
        setSearchParams({});
    };

    // Field-level validator
    const validateField = (name, value) => {
        const val = typeof value === 'string' ? value.trim() : value;

        switch (name) {
            case 'festName':
                if (!val) return 'Fest name is required';
                if (val.length < 2) return 'Fest name must be at least 2 characters';
                return '';

            case 'collegeName':
                if (!val) return 'College name is required';
                if (val.length < 2) return 'Please enter valid college name';
                return '';

            case 'festType':
                if (!val) return 'Please select a fest type';
                return '';

            case 'organizerName':
                if (!val) return "Organizer's name is required";
                if (val.length < 2) return 'Please enter your full name';
                return '';

            case 'position':
                if (!val) return 'Position / Role is required';
                return '';

            case 'contactNumber': {
                if (!val) return 'Contact number is required';
                const digits = val.replace(/\D/g, '');
                if (digits.length < 10 || digits.length > 13) {
                    return 'Enter a valid 10-digit mobile number';
                }
                return '';
            }

            case 'email':
                if (!val) return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    return 'Please enter a valid email address';
                }
                return '';

            default:
                return '';
        }
    };

    const validateForm = () => {
        const requiredFields = ['festName', 'collegeName', 'festType', 'organizerName', 'position', 'contactNumber', 'email'];
        const newErrors = {};
        const allTouched = {};

        requiredFields.forEach((field) => {
            allTouched[field] = true;
            const err = validateField(field, formData[field]);
            if (err) newErrors[field] = err;
        });

        setTouched((prev) => ({ ...prev, ...allTouched }));
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        if (touched[name]) {
            const err = validateField(name, value);
            setErrors((prev) => ({ ...prev, [name]: err }));
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched((prev) => ({ ...prev, [name]: true }));
        const err = validateField(name, value);
        setErrors((prev) => ({ ...prev, [name]: err }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Simulate dispatch
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setShowSuccess(true);

            // Auto-scroll to top of card for clear confirmation
            window.scrollTo({ top: 80, behavior: 'smooth' });
        } catch (err) {
            console.error('Error submitting form:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

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
        setTouched({});
        setErrors({});
        setShowSuccess(false);
    };

    return (
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 font-sans ${
            isDark ? 'bg-[#04060A] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
        }`}>
            <Seo
                title="College Fest Registration — CrwdCtrl"
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

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                {/* Back Button */}
                <div className="mb-6">
                    <button
                        onClick={goBack}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                            isDark
                                ? 'text-gray-400 hover:text-white hover:bg-white/5'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                </div>

                {/* Form Card */}
                <div className={`rounded-2xl sm:rounded-3xl border p-6 sm:p-10 transition-all ${
                    isDark
                        ? 'bg-[#0B0F19] border-gray-800/90 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
                        : 'bg-white border-gray-200 shadow-sm'
                }`}>
                    {/* Header */}
                    <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            College Fest Registration
                        </h1>
                        <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Fill out the form below to list your college festival and reach thousands of students
                        </p>
                        <p className="text-xs sm:text-sm font-semibold bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent pt-0.5">
                            Join CrwdCtrl and showcase your college fest to thousands of students across India. Let's make your event unforgettable!
                        </p>
                    </div>

                    {/* Success Message Banner */}
                    {showSuccess && (
                        <div className={`mb-8 p-5 rounded-2xl border flex items-start gap-3.5 transition-all ${
                            isDark
                                ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}>
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold">Registration Submitted Successfully!</h3>
                                <p className="text-xs leading-relaxed opacity-90">
                                    Thank you for registering <strong className="font-semibold">{formData.festName || 'your fest'}</strong>. Our team will review the details and reach out on your provided contact number within 24 hours.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* The Clean Form */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">

                            {/* ================= LEFT COLUMN ================= */}
                            <div className="space-y-5">
                                {/* Fest Name */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Fest Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="festName"
                                        value={formData.festName}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        placeholder="Enter fest name"
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none transition-all ${
                                            touched.festName && errors.festName
                                                ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                                : isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                    {touched.festName && errors.festName && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{errors.festName}</span>
                                        </p>
                                    )}
                                </div>

                                {/* College Name */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        College Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="collegeName"
                                        value={formData.collegeName}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        placeholder="Enter college name"
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none transition-all ${
                                            touched.collegeName && errors.collegeName
                                                ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                                : isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                    {touched.collegeName && errors.collegeName && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{errors.collegeName}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Fest Type */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Fest Type <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="festType"
                                        value={formData.festType}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none transition-all cursor-pointer ${
                                            touched.festType && errors.festType
                                                ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                                : isDark
                                                ? 'bg-[#050811] border-gray-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    >
                                        <option value="">Select fest type</option>
                                        <option value="cultural">Cultural</option>
                                        <option value="technical">Technical</option>
                                        <option value="sports">Sports</option>
                                        <option value="others">Others</option>
                                    </select>
                                    {touched.festType && errors.festType && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{errors.festType}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Organizer's Name */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Organizer's Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="organizerName"
                                        value={formData.organizerName}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        placeholder="Enter organizer's full name"
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none transition-all ${
                                            touched.organizerName && errors.organizerName
                                                ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                                : isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                    {touched.organizerName && errors.organizerName && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{errors.organizerName}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Position / Role */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Position / Role <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="position"
                                        value={formData.position}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        placeholder="e.g., Event Coordinator, President, Secretary"
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none transition-all ${
                                            touched.position && errors.position
                                                ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                                : isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                    {touched.position && errors.position && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{errors.position}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ================= RIGHT COLUMN ================= */}
                            <div className="space-y-5">
                                {/* Contact Number */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Contact Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="contactNumber"
                                        value={formData.contactNumber}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        placeholder="+91 9876543210"
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none transition-all ${
                                            touched.contactNumber && errors.contactNumber
                                                ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                                : isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                    {touched.contactNumber && errors.contactNumber && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{errors.contactNumber}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur}
                                        placeholder="organizer@college.edu"
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none transition-all ${
                                            touched.email && errors.email
                                                ? 'border-red-500 bg-red-500/5 focus:ring-1 focus:ring-red-500'
                                                : isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                    {touched.email && errors.email && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{errors.email}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Fest Description */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Fest Description <span className={`text-[11px] font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
                                    </label>
                                    <textarea
                                        name="festDescription"
                                        value={formData.festDescription}
                                        onChange={handleInputChange}
                                        rows={4}
                                        placeholder="Describe your fest, events, highlights, and what makes it special..."
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none resize-none transition-all ${
                                            isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                </div>

                                {/* Message / Query */}
                                <div className="space-y-1.5">
                                    <label className={`block text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Message / Query <span className={`text-[11px] font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
                                    </label>
                                    <textarea
                                        name="message"
                                        value={formData.message}
                                        onChange={handleInputChange}
                                        rows={3}
                                        placeholder="Any additional information, questions, or special requirements..."
                                        className={`w-full px-4 py-2.5 sm:py-3 rounded-xl text-sm border outline-none resize-none transition-all ${
                                            isDark
                                                ? 'bg-[#050811] border-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200/50 dark:border-gray-800/60">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-linear-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:opacity-95 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Submitting Registration...</span>
                                    </>
                                ) : (
                                    <span>Submit Registration</span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={isSubmitting}
                                className={`px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all cursor-pointer ${
                                    isDark
                                        ? 'bg-gray-900/60 border-gray-800 text-gray-300 hover:bg-gray-800'
                                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                Clear Form
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Login / Register Modals */}
            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin
                        onClose={handleCloseLogin}
                        onSwitchToRegister={() => {
                            setShowLogin(false);
                            setShowRegister(true);
                        }}
                    />
                </div>
            )}

            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister
                        onClose={() => setShowRegister(false)}
                        onSwitchToLogin={() => {
                            setShowRegister(false);
                            setShowLogin(true);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
