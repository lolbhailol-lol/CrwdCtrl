import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import ProfileSidebar from '../../components/ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, handleApiError } from '../../services/api/auth.api';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import ProfileAvatarUpload from '../../components/ProfileAvatarUpload';

function EditProfile() {
    const { isDark } = useDarkMode();
    const { user, token, updateUser, isAuthenticated, isLoading, isAuthProcessing } = useAuth();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [isEditingPhone, setIsEditingPhone] = useState(false);

    // Check for login modal parameter
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

    // Redirect to login if not authenticated (but only after auth is fully initialized)
    useEffect(() => {
        if (!isAuthenticated && !isLoading && !isAuthProcessing) {
            setShowLogin(true);
        }
    }, [isAuthenticated, isLoading, isAuthProcessing]);

    // Handle login modal close
    const handleCloseLogin = () => {
        setShowLogin(false);
        setSearchParams({}); // Clear URL parameters
        if (!isAuthenticated) {
            navigate('/');
        }
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

    // Initialize form data from user context
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phoneNumber: '',
        college: '',
        gender: 'Male',
        dateOfBirth: ''
    });

    // Load user data into form when component mounts or user changes
    useEffect(() => {
        console.log('Loading user data in edit-profile:', user);

        if (user) {
            // Split name into first and last name for display purposes
            const nameParts = user.name ? user.name.split(' ') : [''];
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const newFormData = {
                name: user.name || '',
                firstName: firstName,
                lastName: lastName,
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                college: user.college || '',
                gender: user.gender || 'Male',
                dateOfBirth: user.dateOfBirth || ''
            };

            console.log('Setting form data:', newFormData);
            setFormData(newFormData);

            // Log social auth user info for debugging
            if (user.provider) {
                console.log('Social auth user loaded:', {
                    provider: user.provider,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    profilePic: user.profilePic
                });
            }
        } else {
            console.log('No user data available, checking localStorage...');
            // Try to load from localStorage backup if user data is not available
            try {
                const backupData = localStorage.getItem('crwdctrl_user_profile_backup');
                if (backupData) {
                    const parsedData = JSON.parse(backupData);
                    const nameParts = parsedData.name ? parsedData.name.split(' ') : [''];
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';

                    setFormData({
                        name: parsedData.name || '',
                        firstName: firstName,
                        lastName: lastName,
                        email: parsedData.email || '',
                        phoneNumber: parsedData.phoneNumber || '',
                        college: parsedData.college || '',
                        gender: parsedData.gender || 'Male',
                        dateOfBirth: parsedData.dateOfBirth || ''
                    });

                    console.log('Loaded profile data from local backup');
                }
            } catch (error) {
                console.error('Failed to load backup profile data:', error);
            }
        }
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Handle phone number input - only allow digits and limit to 10
        if (name === 'phoneNumber') {
            const digitsOnly = value.replace(/\D/g, ''); // Remove non-digits
            if (digitsOnly.length <= 10) {
                setFormData(prev => ({
                    ...prev,
                    [name]: digitsOnly
                }));
            }
            // Don't update if trying to enter more than 10 digits
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear errors when user starts typing
        if (error) {
            setError('');
        }
        if (success) {
            setSuccess('');
        }

        // Update the full name when first or last name changes
        if (name === 'firstName' || name === 'lastName') {
            const firstName = name === 'firstName' ? value : formData.firstName;
            const lastName = name === 'lastName' ? value : formData.lastName;
            const fullName = `${firstName} ${lastName}`.trim();

            setFormData(prev => ({
                ...prev,
                name: fullName,
                [name]: value
            }));
        }
    };

    const handleGenderSelect = (gender) => {
        setFormData(prev => ({
            ...prev,
            gender
        }));
    };

    // Validate form data
    const validateForm = () => {
        // Clear previous errors
        setError('');

        // Validate name (required)
        if (!formData.name || formData.name.trim().length === 0) {
            setError('Full name is required');
            return false;
        }

        if (formData.name.trim().length < 2) {
            setError('Name must be at least 2 characters long');
            return false;
        }

        // At least one contact method required
        if (!formData.email && !formData.phoneNumber) {
            setError('Either email or phone number is required');
            return false;
        }

        // Validate email format if provided
        if (formData.email && formData.email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email.trim())) {
                setError('Please provide a valid email address (e.g., user@example.com)');
                return false;
            }
        }

        // Validate phone number format if provided
        if (formData.phoneNumber && formData.phoneNumber.trim()) {
            const digitsOnly = formData.phoneNumber.replace(/\D/g, '');

            if (digitsOnly.length !== 10) {
                setError('Phone number must be exactly 10 digits');
                return false;
            }
        }

        // Validate college name if provided
        if (formData.college && formData.college.trim().length > 0 && formData.college.trim().length < 3) {
            setError('College name must be at least 3 characters long');
            return false;
        }

        // Validate date of birth if provided
        if (formData.dateOfBirth && formData.dateOfBirth.trim()) {
            const birthDate = new Date(formData.dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (isNaN(birthDate.getTime())) {
                setError('Please provide a valid date of birth');
                return false;
            }

            if (birthDate > today) {
                setError('Date of birth cannot be in the future');
                return false;
            }

            if (age > 100) {
                setError('Please provide a valid date of birth');
                return false;
            }
        }

        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setIsUpdating(true);
        setError('');
        setSuccess('');

        const updateData = {
            name: formData.name.trim(),
            college: formData.college?.trim() || '',
            gender: formData.gender || 'Male',
            dateOfBirth: formData.dateOfBirth?.trim() || '',
        };

        try {
            if (formData.email !== undefined) {
                updateData.email = formData.email.trim();
            }
            if (formData.phoneNumber !== undefined) {
                updateData.phoneNumber = formData.phoneNumber.trim();
            }

            console.log('Saving profile data:', updateData);

            // Call API to update profile
            const response = await authAPI.updateProfile(token, updateData);

            if (response.success) {
                // Update user context with new data
                updateUser(response.data.user);

                // Also save to localStorage as backup
                const userData = response.data.user;
                localStorage.setItem('crwdctrl_user_profile', JSON.stringify(userData));

                setSuccess('Profile updated and saved successfully!');

                // Navigate back after showing success message
                setTimeout(() => {
                    navigate(-1);
                }, 2000);
            } else {
                setError(response.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            const errorMessage = handleApiError(error);
            setError(errorMessage || 'An error occurred while saving your profile');

            // Try to save locally as fallback
            try {
                const localData = {
                    ...user,
                    ...updateData,
                    lastModified: new Date().toISOString()
                };
                localStorage.setItem('crwdctrl_user_profile_backup', JSON.stringify(localData));
                console.log('Profile saved locally as backup');
            } catch (localError) {
                console.error('Failed to save profile locally:', localError);
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // Show login modal if not authenticated
    if (!isAuthenticated && showLogin) {
        return (
            <div className="fixed inset-0 z-50">
                <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
            </div>
        );
    }

    // Show loading if user data is not yet available
    if (!user) {
        // Check localStorage manually for debugging
        const storedUser = localStorage.getItem('crwdctrl_user');
        const storedToken = localStorage.getItem('crwdctrl_token');

        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="text-sm text-gray-500 mb-4">Loading profile data...</p>

                {/* Debug info */}
                {import.meta.env.DEV && (
                    <div className="text-xs text-gray-400 mb-4 max-w-md text-center">
                        <p>Stored User: {storedUser ? 'Found' : 'Not found'}</p>
                        <p>Stored Token: {storedToken ? 'Found' : 'Not found'}</p>
                        {storedUser && (
                            <pre className="mt-2 bg-gray-800 p-2 rounded text-left overflow-auto max-h-32">
                                {JSON.stringify(JSON.parse(storedUser), null, 2)}
                            </pre>
                        )}
                    </div>
                )}

                <button
                    onClick={() => window.location.reload()}
                    className="text-blue-600 hover:text-blue-700 text-sm underline"
                >
                    Refresh if data doesn't load
                </button>
            </div>
        );
    }

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex transition-colors duration-300">
            <div className={`flex flex-1 flex-col transition-all duration-300 ${isProfileOpen ? 'blur-sm' : ''}`}>

                {/* Back Navigation */}
                <main className="flex-1">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
                        <button
                            onClick={() => navigate(-1)}
                            className={`flex items-center space-x-2 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition mb-4`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </button>
                    </div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
                        {/* Desktop View */}
                        <div className={`hidden lg:block max-w-4xl mx-auto rounded-lg shadow-sm p-8 ${isDark ? 'bg-[#161718]' : 'bg-gray-100'}`}>
                            {/* Profile Section */}
                            <div className="flex items-center gap-4 mb-8">
                                <ProfileAvatarUpload
                                    isDark={isDark}
                                    sizeClass="w-20 h-20"
                                    initialClass="text-3xl"
                                    guestIconClass="w-10 h-10"
                                    cameraBtnClass="w-7 h-7"
                                    className="items-start!"
                                    onSuccess={() => setSuccess('Profile picture updated!')}
                                />
                                <div>
                                    <div className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {user.name || 'User'}
                                        {user.provider && (
                                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                {user.provider}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {user.role || 'student'}
                                        {user.college && ` â€¢ ${user.college}`}
                                        {user.email && (
                                            <div className="mt-1">{user.email}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Account Details Title */}
                            <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-8`}>Account Details</h2>



                            {/* Error and Success Messages */}
                            {error && (
                                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-red-600 text-sm">{error}</span>
                                </div>
                            )}

                            {success && (
                                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'}`}>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <span className="text-green-600 text-sm">{success}</span>
                                </div>
                            )}

                            {/* Form Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* First Name */}
                                <div>
                                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                        First name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        placeholder="Enter first name"
                                        value={formData.firstName || ''}
                                        onChange={handleInputChange}
                                        disabled={isUpdating}
                                        className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            E-mail address {!formData.phoneNumber && <span className="text-red-500">*</span>}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingEmail(!isEditingEmail)}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                            disabled={isUpdating}
                                        >
                                            {isEditingEmail ? 'Cancel' : 'Edit'}
                                        </button>
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Enter email address"
                                        value={formData.email || ''}
                                        onChange={handleInputChange}
                                        disabled={!isEditingEmail || isLoading}
                                        className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isEditingEmail || isLoading ? 'cursor-not-allowed' : ''} ${isDark
                                            ? !isEditingEmail || isLoading
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : !isEditingEmail || isLoading
                                                ? 'bg-gray-50 border-gray-300 text-gray-500'
                                                : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* Last Name */}
                                <div>
                                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                        Last name
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        placeholder="Enter last name"
                                        value={formData.lastName || ''}
                                        onChange={handleInputChange}
                                        disabled={isUpdating}
                                        className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* Mobile Number */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Mobile no. {!formData.email && <span className="text-red-500">*</span>}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingPhone(!isEditingPhone)}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                            disabled={isUpdating}
                                        >
                                            {isEditingPhone ? 'Cancel' : 'Edit'}
                                        </button>
                                    </div>
                                    {user?.provider && !formData.phoneNumber && (
                                        <div className={`mb-2 p-2 rounded text-xs ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                            ðŸ“± Add your mobile number to receive notifications and updates
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        name="phoneNumber"
                                        placeholder={user?.provider ? "Add your mobile number (optional)" : "Enter 10-digit phone number"}
                                        value={formData.phoneNumber || ''}
                                        onChange={handleInputChange}
                                        disabled={!isEditingPhone || isLoading}
                                        maxLength={10}
                                        pattern="[0-9]{10}"
                                        className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isEditingPhone || isLoading ? 'cursor-not-allowed' : ''} ${isDark
                                            ? !isEditingPhone || isLoading
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : !isEditingPhone || isLoading
                                                ? 'bg-gray-50 border-gray-300 text-gray-500'
                                                : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>
                            </div>

                            {/* College Section */}
                            <div className="mt-6">
                                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                    College/Institution
                                </label>
                                <input
                                    type="text"
                                    name="college"
                                    placeholder="Enter college or institution name"
                                    value={formData.college || ''}
                                    onChange={handleInputChange}
                                    disabled={isUpdating}
                                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                        }`}
                                />
                            </div>

                            {/* Date of Birth Section */}
                            <div className="mt-6">
                                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                    Date of Birth
                                </label>
                                <input
                                    type="date"
                                    name="dateOfBirth"
                                    value={formData.dateOfBirth || ''}
                                    onChange={handleInputChange}
                                    disabled={isUpdating}
                                    max={new Date().toISOString().split('T')[0]}
                                    placeholder="dd-mm-yyyy"
                                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-700'
                                        }`}
                                />
                                {formData.dateOfBirth && (
                                    <div className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Selected: {new Date(formData.dateOfBirth).toLocaleDateString('en-GB')}
                                    </div>
                                )}
                            </div>

                            {/* Gender Section */}
                            <div className="mt-8">
                                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                                    Gender
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleGenderSelect('Male')}
                                        disabled={isUpdating}
                                        className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${formData.gender === 'Male'
                                            ? isDark
                                                ? 'bg-gray-600 text-white border border-gray-500'
                                                : 'bg-gray-200 text-gray-900 border border-gray-300'
                                            : isDark
                                                ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Male
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleGenderSelect('Female')}
                                        disabled={isUpdating}
                                        className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${formData.gender === 'Female'
                                            ? isDark
                                                ? 'bg-gray-600 text-white border border-gray-500'
                                                : 'bg-gray-200 text-gray-900 border border-gray-300'
                                            : isDark
                                                ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Female
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleGenderSelect('Others')}
                                        disabled={isUpdating}
                                        className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${formData.gender === 'Others'
                                            ? isDark
                                                ? 'bg-gray-600 text-white border border-gray-500'
                                                : 'bg-gray-200 text-gray-900 border border-gray-300'
                                            : isDark
                                                ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Others
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-8 flex gap-4 justify-end">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    disabled={isUpdating}
                                    className={`px-6 py-3 rounded-md text-sm font-medium transition-colors border ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isUpdating}
                                    className={`px-6 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 ${isUpdating ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isUpdating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>

                        {/* Mobile View */}
                        <div className={`lg:hidden rounded-lg shadow-sm p-4 ${isDark ? 'bg-[#161718]' : 'bg-gray-100'}`}>
                            {/* Mobile Profile Section */}
                            <div className="flex flex-col items-center text-center mb-6">
                                <ProfileAvatarUpload
                                    isDark={isDark}
                                    sizeClass="w-24 h-24"
                                    initialClass="text-3xl"
                                    guestIconClass="w-12 h-12"
                                    className="mb-4"
                                    onSuccess={() => setSuccess('Profile picture updated!')}
                                />
                                <div className={`text-xl font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>
                                    {user.name || 'User'}
                                    {user.provider && (
                                        <div className={`mt-1 px-2 py-1 text-xs rounded-full inline-block ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                            Signed in with {user.provider}
                                        </div>
                                    )}
                                </div>
                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {user.role || 'student'}
                                    {user.college && ` â€¢ ${user.college}`}
                                    {user.email && (
                                        <div className="mt-1">{user.email}</div>
                                    )}
                                </div>
                            </div>

                            {/* Account Details Title */}
                            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-6 text-center`}>Account Details</h2>

                            {/* Mobile Error and Success Messages */}
                            {error && (
                                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                                    <span className="text-red-600 text-sm">{error}</span>
                                </div>
                            )}

                            {success && (
                                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'}`}>
                                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                                    <span className="text-green-600 text-sm">{success}</span>
                                </div>
                            )}

                            {/* Mobile Form - Single Column */}
                            <div className="space-y-4">
                                {/* First Name */}
                                <div>
                                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                        First name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        placeholder="Enter first name"
                                        value={formData.firstName || ''}
                                        onChange={handleInputChange}
                                        disabled={isUpdating}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* Last Name */}
                                <div>
                                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                        Last name
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        placeholder="Enter last name"
                                        value={formData.lastName || ''}
                                        onChange={handleInputChange}
                                        disabled={isUpdating}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            E-mail address {!formData.phoneNumber && <span className="text-red-500">*</span>}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingEmail(!isEditingEmail)}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                            disabled={isUpdating}
                                        >
                                            {isEditingEmail ? 'Cancel' : 'Edit'}
                                        </button>
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Enter email address"
                                        value={formData.email || ''}
                                        onChange={handleInputChange}
                                        disabled={!isEditingEmail || isLoading}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isEditingEmail || isLoading ? 'cursor-not-allowed' : ''} ${isDark
                                            ? !isEditingEmail || isLoading
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : !isEditingEmail || isLoading
                                                ? 'bg-gray-50 border-gray-300 text-gray-500'
                                                : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* Mobile Number */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Mobile no. {!formData.email && <span className="text-red-500">*</span>}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingPhone(!isEditingPhone)}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                            disabled={isUpdating}
                                        >
                                            {isEditingPhone ? 'Cancel' : 'Edit'}
                                        </button>
                                    </div>
                                    {user?.provider && !formData.phoneNumber && (
                                        <div className={`mb-2 p-2 rounded text-xs ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                            ðŸ“± Add your mobile number to receive notifications and updates
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        name="phoneNumber"
                                        placeholder={user?.provider ? "Add your mobile number (optional)" : "Enter 10-digit phone number"}
                                        value={formData.phoneNumber || ''}
                                        onChange={handleInputChange}
                                        disabled={!isEditingPhone || isLoading}
                                        maxLength={10}
                                        pattern="[0-9]{10}"
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isEditingPhone || isLoading ? 'cursor-not-allowed' : ''} ${isDark
                                            ? !isEditingPhone || isLoading
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : !isEditingPhone || isLoading
                                                ? 'bg-gray-50 border-gray-300 text-gray-500'
                                                : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* College Section */}
                                <div>
                                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                        College/Institution
                                    </label>
                                    <input
                                        type="text"
                                        name="college"
                                        placeholder="Enter college or institution name"
                                        value={formData.college || ''}
                                        onChange={handleInputChange}
                                        disabled={isUpdating}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
                                            }`}
                                    />
                                </div>

                                {/* Date of Birth Section */}
                                <div>
                                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        value={formData.dateOfBirth || ''}
                                        onChange={handleInputChange}
                                        disabled={isUpdating}
                                        max={new Date().toISOString().split('T')[0]}
                                        placeholder="dd-mm-yyyy"
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white'
                                            : 'bg-white border-gray-300 text-gray-700'
                                            }`}
                                    />
                                    {formData.dateOfBirth && (
                                        <div className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                            Selected: {new Date(formData.dateOfBirth).toLocaleDateString('en-GB')}
                                        </div>
                                    )}
                                </div>

                                {/* Gender Section */}
                                <div>
                                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                                        Gender
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleGenderSelect('Male')}
                                            disabled={isUpdating}
                                            className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${formData.gender === 'Male'
                                                ? isDark
                                                    ? 'bg-gray-600 text-white border border-gray-500'
                                                    : 'bg-gray-200 text-gray-900 border border-gray-300'
                                                : isDark
                                                    ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            Male
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleGenderSelect('Female')}
                                            disabled={isUpdating}
                                            className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${formData.gender === 'Female'
                                                ? isDark
                                                    ? 'bg-gray-600 text-white border border-gray-500'
                                                    : 'bg-gray-200 text-gray-900 border border-gray-300'
                                                : isDark
                                                    ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            Female
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleGenderSelect('Others')}
                                            disabled={isUpdating}
                                            className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${formData.gender === 'Others'
                                                ? isDark
                                                    ? 'bg-gray-600 text-white border border-gray-500'
                                                    : 'bg-gray-200 text-gray-900 border border-gray-300'
                                                : isDark
                                                    ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            Others
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Action Buttons */}
                            <div className="mt-8 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isUpdating}
                                    className={`w-full px-6 py-4 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 ${isUpdating ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isUpdating ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    disabled={isUpdating}
                                    className={`w-full px-6 py-4 rounded-lg text-base font-medium transition-colors border ${isUpdating ? 'cursor-not-allowed opacity-50' : ''} ${isDark
                                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    Cancel
                                </button>
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

export default EditProfile;
