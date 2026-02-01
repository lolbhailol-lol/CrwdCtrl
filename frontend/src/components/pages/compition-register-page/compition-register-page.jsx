import React, { useState, useEffect } from 'react';
import Sidebar from '../../Sidebar';
import Navbar from '../../Navbar';
import Footer from '../../Footer';
import ProfileSidebar from '../../ProfileSidebar';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, CheckCircle, Upload, X, Calendar, MapPin, Trophy, Users } from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import CrwdCtrlLogin from '../login';
import CrwdCtrlRegister from '../register';
import { getRealCompetitions } from '../../../data/real-data/competitionDataService.js';
import paymentQRImage from '../../../assets/payment-qr/image.png';

function CompetitionRegisterPage() {
    const { isDark } = useDarkMode();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // Competition options
    const competitionOptions = [
        // { id: 'insync', name: 'InSync (Group Dance)', isGroup: true, minParticipants: 6, maxParticipants: 16 },
        { id: 'headbang', name: 'Head Bang (Band Wars)', isGroup: true, minParticipants: 4, maxParticipants: 16 },
        { id: 'dastak', name: 'Dastak (Street Play)', isGroup: true, minParticipants: 4, maxParticipants: 20 },
        { id: 'innerflame', name: 'Inner Flame (Solo Dance)', isGroup: false },
        { id: 'humming', name: 'Humming (Solo Singing)', isGroup: false },
        { id: 'platform', name: 'Platform (Open Mic)', isGroup: false },
        { id: 'artmaestro', name: 'Art Maestro (Fine Arts)', isGroup: false },
        // { id: 'boxfootball', name: 'Box Football', isGroup: true, minParticipants: 6, maxParticipants: 8 },
        // { id: 'boxcricket', name: 'Box Cricket', isGroup: true, minParticipants: 7, maxParticipants: 7 },
        // { id: 'badmintonsolo', name: 'Badminton (Singles)', isGroup: false },
        // { id: 'badmintonduo', name: 'Badminton (Doubles)', isGroup: true, minParticipants: 2, maxParticipants: 2 }
    ];

    // Get competition data from navigation state
    const passedCompetition = location.state?.competition;
    const passedEventData = location.state?.eventData;
    const passedFestName = location.state?.festName;

    // Determine fest name and get appropriate competitions
    const festName = passedCompetition?.fest || passedCompetition?.festival ||
        passedEventData?.festival_name || passedFestName || 'AAROHAN';

    // Get fest-specific competition data
    const competitions = getRealCompetitions(festName);
    const inSyncCompetition = competitions.find(comp => comp.id === 'comp_001');

    // Get pre-selected competition name from passed data
    const getPreselectedCompetition = () => {
        const competitionTitle = passedCompetition?.title || passedEventData?.title;

        // Map competition titles to form options
        if (competitionTitle?.toLowerCase().includes('inner flame')) {
            return 'Inner Flame (Solo Dance)';
        }
        // if (competitionTitle?.toLowerCase().includes('insync')) {
        //     return 'InSync (Group Dance)';
        // }
        if (competitionTitle?.toLowerCase().includes('head bang')) {
            return 'Head Bang (Band Wars)';
        }
        if (competitionTitle?.toLowerCase().includes('dastak')) {
            return 'Dastak (Street Play)';
        }
        if (competitionTitle?.toLowerCase().includes('humming')) {
            return 'Humming (Solo Singing)';
        }
        if (competitionTitle?.toLowerCase().includes('platform')) {
            return 'Platform (Open Mic)';
        }
        if (competitionTitle?.toLowerCase().includes('art maestro')) {
            return 'Art Maestro (Fine Arts)';
        }

        return ''; // Default to empty if no match
    };

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        instagramId: '',
        contactNumber: '',
        email: '',
        dateOfBirth: '',
        competitionName: getPreselectedCompetition(),
        numberOfParticipants: '',
        city: '',
        collegeName: '',
        paymentMode: '',
        paymentScreenshot: null,
        transactionId: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [filePreview, setFilePreview] = useState(null);
    // Multi-step form (same flow as main fest registration): Step 1 = details, Step 2 = payment
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 2;

    // Get selected competition details
    const getSelectedCompetition = () => {
        return competitionOptions.find(comp => comp.name === formData.competitionName);
    };

    // Check for login modal parameter
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

    // ✅ CRITICAL FIX: Auto-close login/register modal when user becomes authenticated
    // This is essential for phone login which uses redirect-based authentication
    useEffect(() => {
        if (isAuthenticated && showLogin) {
            console.log('✅ User authenticated, closing login modal in competition-register-page');
            setShowLogin(false);
            setSearchParams({});
        }
        if (isAuthenticated && showRegister) {
            console.log('✅ User authenticated, closing register modal in competition-register-page');
            setShowRegister(false);
        }
    }, [isAuthenticated, showLogin, showRegister, setSearchParams]);

    // Handle login modal close
    const handleCloseLogin = () => {
        setShowLogin(false);
        setSearchParams({});
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

        // If competition is changed, clear numberOfParticipants for solo competitions
        if (name === 'competitionName') {
            const selectedComp = competitionOptions.find(comp => comp.name === value);
            setFormData(prev => ({
                ...prev,
                [name]: value,
                numberOfParticipants: selectedComp?.isGroup ? prev.numberOfParticipants : ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    // Handle file upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];

        if (file) {
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                setErrors(prev => ({
                    ...prev,
                    paymentScreenshot: 'File size must be less than 10MB'
                }));
                return;
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                setErrors(prev => ({
                    ...prev,
                    paymentScreenshot: 'Only JPEG, PNG, JPG, and GIF files are allowed'
                }));
                return;
            }

            setFormData(prev => ({
                ...prev,
                paymentScreenshot: file
            }));

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setFilePreview(e.target.result);
            };
            reader.readAsDataURL(file);

            // Clear error
            if (errors.paymentScreenshot) {
                setErrors(prev => ({
                    ...prev,
                    paymentScreenshot: ''
                }));
            }
        }
    };

    // Remove uploaded file
    const removeFile = () => {
        setFormData(prev => ({
            ...prev,
            paymentScreenshot: null
        }));
        setFilePreview(null);
        document.getElementById('paymentScreenshot').value = '';
    };

    // Validate Step 1 only (details – same fields as main registration step 1)
    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.instagramId.trim()) newErrors.instagramId = 'Instagram ID is required';
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
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.competitionName) newErrors.competitionName = 'Please select a competition';
        const selectedCompetition = getSelectedCompetition();
        if (selectedCompetition?.isGroup) {
            if (!formData.numberOfParticipants.trim()) {
                newErrors.numberOfParticipants = `Number of participants is required for ${selectedCompetition.name}`;
            } else if (isNaN(formData.numberOfParticipants) ||
                formData.numberOfParticipants < selectedCompetition.minParticipants ||
                formData.numberOfParticipants > selectedCompetition.maxParticipants) {
                newErrors.numberOfParticipants = `Team size must be between ${selectedCompetition.minParticipants}-${selectedCompetition.maxParticipants} members for ${selectedCompetition.name}`;
            }
        }
        if (!formData.city.trim()) newErrors.city = 'City is required';
        if (!formData.collegeName.trim()) newErrors.collegeName = 'College/Organization name is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Validate full form (all fields including payment – used on Step 2 submit)
    const validateFormFull = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.instagramId.trim()) newErrors.instagramId = 'Instagram ID is required';
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
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.competitionName) newErrors.competitionName = 'Please select a competition';
        const selectedCompetition = getSelectedCompetition();
        if (selectedCompetition?.isGroup) {
            if (!formData.numberOfParticipants.trim()) {
                newErrors.numberOfParticipants = `Number of participants is required for ${selectedCompetition.name}`;
            } else if (isNaN(formData.numberOfParticipants) ||
                formData.numberOfParticipants < selectedCompetition.minParticipants ||
                formData.numberOfParticipants > selectedCompetition.maxParticipants) {
                newErrors.numberOfParticipants = `Team size must be between ${selectedCompetition.minParticipants}-${selectedCompetition.maxParticipants} members for ${selectedCompetition.name}`;
            }
        }
        if (!formData.city.trim()) newErrors.city = 'City is required';
        if (!formData.collegeName.trim()) newErrors.collegeName = 'College/Organization name is required';
        if (!formData.paymentMode) newErrors.paymentMode = 'Please select a payment mode';
        if (!formData.paymentScreenshot) newErrors.paymentScreenshot = 'Payment screenshot is required';
        if (!formData.transactionId.trim()) newErrors.transactionId = 'Transaction ID is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission (multi-step: Step 1 → Next to payment; Step 2 → submit)
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (currentStep === 1) {
            if (!validateStep1()) return;
            setCurrentStep(2);
            return;
        }

        if (!validateFormFull()) return;

        setIsSubmitting(true);

        try {
            // Create FormData for file upload
            const submitData = new FormData();

            // Append all form data
            Object.keys(formData).forEach(key => {
                if (key === 'paymentScreenshot' && formData[key]) {
                    submitData.append(key, formData[key]);
                } else if (key !== 'paymentScreenshot') {
                    submitData.append(key, formData[key]);
                }
            });

            // Get API base URL from environment or use default
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
            
            // Get competition ID from the selected competition
            const selectedComp = competitionOptions.find(comp => comp.name === formData.competitionName);
            const competitionId = selectedComp?.id || formData.competitionName;
            
            // Construct proper endpoint URL
            const fullURL = `${API_BASE_URL}/registrations/competitions/${competitionId}/register`;

            console.log('🔧 Environment VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
            console.log('🔧 Final API_BASE_URL:', API_BASE_URL);
            console.log('🏆 Competition ID:', competitionId);
            console.log('🚀 Submitting to:', fullURL);
            console.log('📝 Form data being sent:', Array.from(submitData.entries()));

            // Call the backend API
            const response = await fetch(fullURL, {
                method: 'POST',
                body: submitData,
                // Don't set Content-Type header - let the browser set it for FormData
            });

            console.log('📡 Response received:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error Details:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText,
                    url: fullURL
                });
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Registration successful:', result);

            // Show success message with registration details
            setShowSuccess(true);

            // Store registration details for display
            if (result.data && result.data.registrationId) {
                console.log('📋 Registration ID:', result.data.registrationId);
                // You can store this in state if you want to display it in the success message
            }

            // Reset form and step after success
            setTimeout(() => {
                setShowSuccess(false);
                setCurrentStep(1);
                setFormData({
                    name: '',
                    instagramId: '',
                    contactNumber: '',
                    email: '',
                    dateOfBirth: '',
                    competitionName: 'InSync (Group Dance)', // Keep InSync selected
                    numberOfParticipants: '',
                    city: '',
                    collegeName: '',
                    paymentMode: '',
                    paymentScreenshot: null,
                    transactionId: ''
                });
                setFilePreview(null);
                const fileInput = document.getElementById('paymentScreenshot');
                const desktopFileInput = document.getElementById('paymentScreenshotDesktop');
                if (fileInput) fileInput.value = '';
                if (desktopFileInput) desktopFileInput.value = '';
            }, 5000);

        } catch (error) {
            console.error('❌ Full Error Details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            let userMessage = 'Failed to submit registration. Please try again.';

            // Handle different types of errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                userMessage = 'Network connection failed. Please check if the backend server is running on port 8080.';
            } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                userMessage = 'Cannot connect to server. Please ensure the backend is running and try again.';
            } else if (error.message.includes('CORS')) {
                userMessage = 'Cross-origin request blocked. Please check CORS configuration.';
            }

            // Show error message to user
            setErrors(prev => ({
                ...prev,
                general: userMessage
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle form reset (reset step to 1)
    const handleReset = () => {
        setCurrentStep(1);
        setFormData({
            name: '',
            instagramId: '',
            contactNumber: '',
            email: '',
            dateOfBirth: '',
            competitionName: '',
            numberOfParticipants: '',
            city: '',
            collegeName: '',
            paymentMode: '',
            paymentScreenshot: null,
            transactionId: ''
        });
        setErrors({});
        setFilePreview(null);
        const fileInput = document.getElementById('paymentScreenshot');
        const desktopFileInput = document.getElementById('paymentScreenshotDesktop');
        if (fileInput) fileInput.value = '';
        if (desktopFileInput) desktopFileInput.value = '';
    };

    return (
        <div className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'}`}>
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <Sidebar />
            </div>

            <div className={`flex flex-1 flex-col transition-all duration-300 ${isProfileOpen ? 'blur-sm' : ''}`}>
                {/* Navbar - Hidden on mobile, visible on desktop */}
                <div className="hidden md:block">
                    <Navbar isProfileOpen={isProfileOpen} setIsProfileOpen={setIsProfileOpen} />
                </div>

                {/* Back Navigation */}
                <main className="flex-1">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
                        <button
                            onClick={() => navigate(-1)}
                            className={`flex items-center space-x-2 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition mb-4`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
                        <div className={`max-w-4xl mx-auto rounded-xl shadow-lg p-6 sm:p-8 ${isDark ? 'bg-[#1B1C1E]' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <h1 className={`text-2xl sm:text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {formData.competitionName ? `${formData.competitionName} Registration` : 'Competition Registration'}
                                </h1>
                                <p className={`text-sm sm:text-base mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {formData.competitionName ? `Register for ${formData.competitionName}` : 'Please select a competition to register'}
                                </p>
                                {formData.competitionName && (
                                    <p className={`text-sm sm:text-base font-medium ${isDark ? 'text-[#00C2CB]' : 'text-[#00C2CB]'}`}>
                                        Fill in your details below to complete your registration
                                    </p>
                                )}
                            </div>



                            {/* Error Message */}
                            {errors.general && (
                                <div className={`mb-6 p-4 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                    <div className="flex items-center space-x-2">
                                        <X className="w-5 h-5" />
                                        <span className="font-medium">Error!</span>
                                    </div>
                                    <p className="mt-1 text-sm">{errors.general}</p>
                                </div>
                            )}

                            {/* Success Message */}
                            {showSuccess && (
                                <div className={`mb-6 p-6 rounded-lg border ${isDark ? 'bg-green-900/20 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                    <div className="flex items-center space-x-2 mb-3">
                                        <CheckCircle className="w-6 h-6" />
                                        <span className="font-bold text-lg">Registration Successful!</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">✅ Your competition registration has been submitted successfully</p>
                                        <p className="text-sm">📧 A confirmation email has been sent to your registered email address</p>
                                        <p className="text-sm">🔍 Our team will review your registration and payment details within 24-48 hours</p>
                                        <p className="text-sm">📱 Please check your email for your registration ID and next steps</p>
                                    </div>
                                </div>
                            )}                            {/* Multi-step progress (same as main registration) */}
                            <div className={`mb-6 rounded-lg border p-4 ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Step {currentStep} of {totalSteps}
                                    </span>
                                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {currentStep === 1 ? 'Your details' : 'Payment'}
                                    </span>
                                </div>
                                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${currentStep === 1 ? 'bg-[#0ECCEE]' : 'bg-[#053780]'}`}
                                        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                                    />
                                </div>
                                <div className="flex gap-4 mt-2">
                                    <div className={`flex items-center gap-2 ${currentStep >= 1 ? (isDark ? 'text-[#0ECCEE]' : 'text-[#053780]') : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium">{currentStep > 1 ? '✓' : '1'}</span>
                                        <span className="text-xs">Details</span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${currentStep >= 2 ? (isDark ? 'text-[#0ECCEE]' : 'text-[#053780]') : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium">{currentStep > 2 ? '✓' : '2'}</span>
                                        <span className="text-xs">Payment</span>
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit}>
                                {/* Mobile and Tablet View - Stack vertically */}
                                <div className="block lg:hidden space-y-6">
                                    {/* Step 1: Details */}
                                    {currentStep === 1 && (
                                    <>
                                    {/* Name */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Enter your full name"
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                } ${errors.name ? 'border-red-500' : ''}`}
                                        />
                                        {errors.name && (
                                            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                                        )}
                                    </div>

                                    {/* Instagram ID */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Instagram ID <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="instagramId"
                                            value={formData.instagramId}
                                            onChange={handleInputChange}
                                            placeholder="@your_instagram_id"
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                } ${errors.instagramId ? 'border-red-500' : ''}`}
                                        />
                                        {errors.instagramId && (
                                            <p className="mt-1 text-sm text-red-500">{errors.instagramId}</p>
                                        )}
                                    </div>

                                    {/* Contact Number and Email */}
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
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.contactNumber ? 'border-red-500' : ''}`}
                                            />
                                            {errors.contactNumber && (
                                                <p className="mt-1 text-sm text-red-500">{errors.contactNumber}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Email ID <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="your.email@example.com"
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.email ? 'border-red-500' : ''}`}
                                            />
                                            {errors.email && (
                                                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Date of Birth */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Date of Birth <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            name="dateOfBirth"
                                            value={formData.dateOfBirth}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 text-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-900'
                                                } ${errors.dateOfBirth ? 'border-red-500' : ''}`}
                                        />
                                        {errors.dateOfBirth && (
                                            <p className="mt-1 text-sm text-red-500">{errors.dateOfBirth}</p>
                                        )}
                                    </div>

                                    {/* Name of Competition */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Name of Competition <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="competitionName"
                                            value={formData.competitionName}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 text-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-900'
                                                } ${errors.competitionName ? 'border-red-500' : ''}`}
                                        >
                                            <option value="">Select a competition</option>
                                            {competitionOptions.map((competition) => (
                                                <option key={competition.id} value={competition.name}>
                                                    {competition.name}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.competitionName && (
                                            <p className="mt-1 text-sm text-red-500">{errors.competitionName}</p>
                                        )}
                                    </div>

                                    {/* Number of Participants - Only for Group Competitions */}
                                    {getSelectedCompetition()?.isGroup && (
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Number of Participants (Only in the Case of Group Competitions) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                name="numberOfParticipants"
                                                value={formData.numberOfParticipants}
                                                onChange={handleInputChange}
                                                placeholder={`Enter number of participants (${getSelectedCompetition()?.minParticipants}-${getSelectedCompetition()?.maxParticipants} members)`}
                                                min={getSelectedCompetition()?.minParticipants}
                                                max={getSelectedCompetition()?.maxParticipants}
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.numberOfParticipants ? 'border-red-500' : ''}`}
                                            />
                                            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                Team size must be between {getSelectedCompetition()?.minParticipants}-{getSelectedCompetition()?.maxParticipants} members for {getSelectedCompetition()?.name}
                                            </p>
                                            {errors.numberOfParticipants && (
                                                <p className="mt-1 text-sm text-red-500">{errors.numberOfParticipants}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* City and College Name */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                City <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                                placeholder="Enter your city"
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.city ? 'border-red-500' : ''}`}
                                            />
                                            {errors.city && (
                                                <p className="mt-1 text-sm text-red-500">{errors.city}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                College / Organization Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="collegeName"
                                                value={formData.collegeName}
                                                onChange={handleInputChange}
                                                placeholder="Enter college or organization name"
                                                className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.collegeName ? 'border-red-500' : ''}`}
                                            />
                                            {errors.collegeName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.collegeName}</p>
                                            )}
                                        </div>
                                    </div>
                                    </>
                                    )}

                                    {/* Step 2: Payment (same as main registration payment step) */}
                                    {currentStep === 2 && (
                                    <>
                                    {/* Payment Mode */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Payment Mode <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="paymentMode"
                                            value={formData.paymentMode}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 text-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-900'
                                                } ${errors.paymentMode ? 'border-red-500' : ''}`}
                                        >
                                            <option value="">Select payment mode</option>
                                            <option value="PhonePe">PhonePe</option>
                                            <option value="GPay">GPay</option>
                                            <option value="Paytm">Paytm</option>
                                        </select>
                                        {errors.paymentMode && (
                                            <p className="mt-1 text-sm text-red-500">{errors.paymentMode}</p>
                                        )}
                                    </div>

                                    {/* Payment QR Code */}
                                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#2A2B2D] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                        <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Scan QR Code to Pay
                                        </h4>
                                        <div className="flex justify-center">
                                            <img
                                                src={paymentQRImage}
                                                alt="Payment QR Code"
                                                className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg border"
                                            />
                                        </div>
                                        <p className={`text-xs text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Scan this QR code with your preferred payment app and upload the screenshot below
                                        </p>
                                    </div>

                                    {/* Payment Screenshot */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Payment Screenshot <span className="text-red-500">*</span>
                                        </label>
                                        <div className={`relative border-2 border-dashed rounded-lg p-6 ${isDark ? 'border-gray-600' : 'border-gray-300'} ${errors.paymentScreenshot ? 'border-red-500' : ''}`}>
                                            {!filePreview ? (
                                                <div className="text-center">
                                                    <Upload className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                                                    <div className="mt-4">
                                                        <label htmlFor="paymentScreenshot" className={`cursor-pointer rounded-md font-medium ${isDark ? 'text-[#00C2CB]' : 'text-[#00C2CB]'} hover:underline`}>
                                                            <span>Upload a file</span>
                                                            <input
                                                                id="paymentScreenshot"
                                                                name="paymentScreenshot"
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handleFileUpload}
                                                                className="sr-only"
                                                            />
                                                        </label>
                                                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PNG, JPG, GIF up to 10MB</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <img
                                                        src={filePreview}
                                                        alt="Payment Screenshot Preview"
                                                        className="max-w-full h-32 object-contain mx-auto rounded"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={removeFile}
                                                        className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    <p className={`text-xs text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {formData.paymentScreenshot.name}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        {errors.paymentScreenshot && (
                                            <p className="mt-1 text-sm text-red-500">{errors.paymentScreenshot}</p>
                                        )}
                                    </div>

                                    {/* Transaction ID */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                            Transaction ID <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="transactionId"
                                            value={formData.transactionId}
                                            onChange={handleInputChange}
                                            placeholder="Enter transaction ID"
                                            className={`w-full px-4 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                } ${errors.transactionId ? 'border-red-500' : ''}`}
                                        />
                                        {errors.transactionId && (
                                            <p className="mt-1 text-sm text-red-500">{errors.transactionId}</p>
                                        )}
                                    </div>
                                    </>
                                    )}
                                </div>

                                {/* Desktop View - Two columns (Step 1: details; Step 2: payment) */}
                                <div className="hidden lg:block">
                                    {currentStep === 1 && (
                                    <div className="grid lg:grid-cols-2 lg:gap-8">
                                    {/* Left Column */}
                                    <div className="space-y-6">
                                        {/* Name */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                placeholder="Enter your full name"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.name ? 'border-red-500' : ''}`}
                                            />
                                            {errors.name && (
                                                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                                            )}
                                        </div>

                                        {/* Instagram ID */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Instagram ID <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="instagramId"
                                                value={formData.instagramId}
                                                onChange={handleInputChange}
                                                placeholder="@your_instagram_id"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.instagramId ? 'border-red-500' : ''}`}
                                            />
                                            {errors.instagramId && (
                                                <p className="mt-1 text-sm text-red-500">{errors.instagramId}</p>
                                            )}
                                        </div>

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
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
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
                                                Email ID <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="your.email@example.com"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.email ? 'border-red-500' : ''}`}
                                            />
                                            {errors.email && (
                                                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                                            )}
                                        </div>

                                        {/* Date of Birth */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Date of Birth <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                name="dateOfBirth"
                                                value={formData.dateOfBirth}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 text-white'
                                                    : 'bg-gray-50 border-gray-200 text-gray-900'
                                                    } ${errors.dateOfBirth ? 'border-red-500' : ''}`}
                                            />
                                            {errors.dateOfBirth && (
                                                <p className="mt-1 text-sm text-red-500">{errors.dateOfBirth}</p>
                                            )}
                                        </div>

                                        {/* Competition Name */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Name of Competition <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                name="competitionName"
                                                value={formData.competitionName}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 text-white'
                                                    : 'bg-gray-50 border-gray-200 text-gray-900'
                                                    } ${errors.competitionName ? 'border-red-500' : ''}`}
                                            >
                                                <option value="">Select a competition</option>
                                                {competitionOptions.map((competition) => (
                                                    <option key={competition.id} value={competition.name}>
                                                        {competition.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.competitionName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.competitionName}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-6">
                                        {/* Number of Participants - Only for Group Competitions */}
                                        {getSelectedCompetition()?.isGroup && (
                                            <div>
                                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                    Number of Participants (Only in the Case of Group Competitions) <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    name="numberOfParticipants"
                                                    value={formData.numberOfParticipants}
                                                    onChange={handleInputChange}
                                                    placeholder={`Enter number of participants (${getSelectedCompetition()?.minParticipants}-${getSelectedCompetition()?.maxParticipants} members)`}
                                                    min={getSelectedCompetition()?.minParticipants}
                                                    max={getSelectedCompetition()?.maxParticipants}
                                                    className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                        ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                        : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                        } ${errors.numberOfParticipants ? 'border-red-500' : ''}`}
                                                />
                                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    Team size must be between {getSelectedCompetition()?.minParticipants}-{getSelectedCompetition()?.maxParticipants} members for {getSelectedCompetition()?.name}
                                                </p>
                                                {errors.numberOfParticipants && (
                                                    <p className="mt-1 text-sm text-red-500">{errors.numberOfParticipants}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* City */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                City <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                                placeholder="Enter your city"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.city ? 'border-red-500' : ''}`}
                                            />
                                            {errors.city && (
                                                <p className="mt-1 text-sm text-red-500">{errors.city}</p>
                                            )}
                                        </div>

                                        {/* College Name */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                College / Organization Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="collegeName"
                                                value={formData.collegeName}
                                                onChange={handleInputChange}
                                                placeholder="Enter college or organization name"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.collegeName ? 'border-red-500' : ''}`}
                                            />
                                            {errors.collegeName && (
                                                <p className="mt-1 text-sm text-red-500">{errors.collegeName}</p>
                                            )}
                                        </div>
                                    </div>
                                    </div>
                                    )}

                                    {/* Desktop Step 2: Payment (same as main registration payment step) */}
                                    {currentStep === 2 && (
                                    <div className="grid lg:grid-cols-2 lg:gap-8">
                                        <div className="space-y-6 lg:col-span-2">
                                        {/* Payment Mode */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Payment Mode <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                name="paymentMode"
                                                value={formData.paymentMode}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 text-white'
                                                    : 'bg-gray-50 border-gray-200 text-gray-900'
                                                    } ${errors.paymentMode ? 'border-red-500' : ''}`}
                                            >
                                                <option value="">Select payment mode</option>
                                                <option value="PhonePe">PhonePe</option>
                                                <option value="GPay">GPay</option>
                                                <option value="Paytm">Paytm</option>
                                            </select>
                                            {errors.paymentMode && (
                                                <p className="mt-1 text-sm text-red-500">{errors.paymentMode}</p>
                                            )}
                                        </div>

                                        {/* Payment QR Code */}
                                        <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#2A2B2D] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                            <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Scan QR Code to Pay
                                            </h4>
                                            <div className="flex justify-center">
                                                <img
                                                    src={paymentQRImage}
                                                    alt="Payment QR Code"
                                                    className="w-56 h-56 object-contain rounded-lg border"
                                                />
                                            </div>
                                            <p className={`text-xs text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                Scan this QR code with your preferred payment app and upload the screenshot below
                                                <div className='text-sm py-1 font-bold text-gray-700'>Tanupawar709@okhdfcbank</div>
                                            </p>
                                        </div>

                                        {/* Payment Screenshot */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Payment Screenshot <span className="text-red-500">*</span>
                                            </label>
                                            <div className={`relative border-2 border-dashed rounded-lg p-6 ${isDark ? 'border-gray-600' : 'border-gray-300'} ${errors.paymentScreenshot ? 'border-red-500' : ''}`}>
                                                {!filePreview ? (
                                                    <div className="text-center">
                                                        <Upload className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                                                        <div className="mt-4">
                                                            <label htmlFor="paymentScreenshotDesktop" className={`cursor-pointer rounded-md font-medium ${isDark ? 'text-[#00C2CB]' : 'text-[#00C2CB]'} hover:underline`}>
                                                                <span>Upload a file</span>
                                                                <input
                                                                    id="paymentScreenshotDesktop"
                                                                    name="paymentScreenshot"
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={handleFileUpload}
                                                                    className="sr-only"
                                                                />
                                                            </label>
                                                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PNG, JPG, GIF up to 10MB</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <img
                                                            src={filePreview}
                                                            alt="Payment Screenshot Preview"
                                                            className="max-w-full h-32 object-contain mx-auto rounded"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={removeFile}
                                                            className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                        <p className={`text-xs text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            {formData.paymentScreenshot.name}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            {errors.paymentScreenshot && (
                                                <p className="mt-1 text-sm text-red-500">{errors.paymentScreenshot}</p>
                                            )}
                                        </div>

                                        {/* Transaction ID */}
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                Transaction ID <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="transactionId"
                                                value={formData.transactionId}
                                                onChange={handleInputChange}
                                                placeholder="Enter transaction ID"
                                                className={`w-full px-4 py-3 rounded-lg border text-base transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                                    ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white'
                                                    : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900'
                                                    } ${errors.transactionId ? 'border-red-500' : ''}`}
                                            />
                                            {errors.transactionId && (
                                                <p className="mt-1 text-sm text-red-500">{errors.transactionId}</p>
                                            )}
                                        </div>
                                        </div>
                                    </div>
                                    )}
                                </div>

                                
                                {/* Buttons (multi-step: same as main registration) */}
                                <div className="flex flex-col sm:flex-row gap-4 pt-6 lg:col-span-2">
                                    {currentStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            disabled={isSubmitting}
                                            className={`sm:flex-initial px-6 py-3 rounded-lg font-semibold border transition-colors duration-200 ${isDark
                                                ? 'border-gray-600 text-gray-300 hover:bg-gray-700 focus:ring-gray-500'
                                                : 'border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-400'
                                                } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            Previous Step
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 bg-gradient-to-r from-[#053780] to-[#0ECCEE] text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {currentStep === 1
                                            ? 'Next: Payment'
                                            : isSubmitting
                                                ? 'Submitting...'
                                                : formData.competitionName
                                                    ? `Register for ${formData.competitionName}`
                                                    : 'Submit Registration'}
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

                <Footer />
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

export default CompetitionRegisterPage;
