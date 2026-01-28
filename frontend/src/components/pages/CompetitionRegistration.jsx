import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function CompetitionRegistration() {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, apiCall, isLoading: authLoading, user, token } = useAuth();
    
    const [competition, setCompetition] = useState(null);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submissionProgress, setSubmissionProgress] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState({});

    useEffect(() => {
        const initializeRegistration = async () => {
            // Wait for auth context to fully load
            if (authLoading) {
                return;
            }

            // Check authentication with fallback to localStorage
            const localToken = localStorage.getItem('crwdctrl_token');
            
            if (!isAuthenticated && !localToken) {
                setError('Please log in to register for competitions');
                setTimeout(() => navigate('/login'), 2000);
                return;
            }

            // If we have a local token but context isn't authenticated yet, give it more time
            if (!isAuthenticated && localToken) {
                setTimeout(() => {
                    proceedWithRegistration();
                }, 1000);
                return;
            }

            // User is authenticated, proceed with registration
            proceedWithRegistration();
        };

        const proceedWithRegistration = () => {
            fetchCompetitionDetails();
        };

        initializeRegistration();
    }, [competitionId, isAuthenticated, authLoading, navigate, token]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Helper function to generate consistent field IDs
    const generateFieldId = (field) => {
        // Priority 1: use fieldName directly (this is what backend expects)
        if (field.fieldName) return field.fieldName;
        // Priority 2: use field.id directly (without field_ prefix)
        if (field.id) return field.id;
        // Priority 3: generate from label as fallback
        if (field.label) {
            // More robust label sanitization
            return `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
        }
        return 'unknown_field';
    };

    const fetchCompetitionDetails = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/fests/competitions/${competitionId}/public`);
            if (!response.ok) {
                throw new Error('Failed to fetch competition details');
            }
            const data = await response.json();
            console.log('🏆 Competition data for registration:', data);
            console.log('🔧 Registration type:', data.registrationType);
            console.log('📝 Registration status:', data.registration?.status);
            console.log('🎯 QR Code:', data.registration?.qrCode);
            console.log('💬 QR Code Message:', data.registration?.qrCodeMessage);
            console.log('📋 Full registration object:', data.registration);
            console.log('🔄 Form type:', data.registration?.formType);
            console.log('📊 Steps count:', data.registration?.steps?.length || 0);
            console.log('📋 Direct schema count:', data.registration?.formSchema?.length || 0);
            
            setCompetition(data);
            
            // Check if competition has custom internal form registration
            if (data.registrationType !== 'custom' || 
                data.registration?.status !== 'internal_form') {
                setError('This competition does not have internal form registration enabled');
                return;
            }

            // Initialize form data with empty values using stable field IDs
            const initialData = {};
            
            // ✅ CRITICAL: Support both single-step and multi-step forms
            const formSchema = getFormSchema(data.registration);
            console.log(`📝 Form schema: ${formSchema.length} fields (${isMultiStepForm(data.registration) ? 'multi-step' : 'single-step'})`);
            
            if (formSchema.length > 0) {
                formSchema.forEach(field => {
                    const fieldId = generateFieldId(field);
                    // Initialize file/image fields as null, others as empty string/array
                    if (field.type === 'file' || field.type === 'image') {
                        initialData[fieldId] = null;
                    } else {
                        initialData[fieldId] = field.type === 'checkbox' ? [] : '';
                    }
                });
            }
            setFormData(initialData);
            
        } catch (err) {
            console.error('Error fetching competition:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ✅ HELPER: Get form schema (supports both single-step and multi-step forms)
    const getFormSchema = (registrationData) => {
        if (registrationData?.formType === 'MULTI_STEP' && registrationData.steps) {
            // For multi-step forms, flatten all fields from all steps
            return registrationData.steps.flatMap(step => step.fields || []);
        } else if (registrationData?.formSchema) {
            // For single-step forms, use the direct formSchema
            return registrationData.formSchema;
        }
        return [];
    };

    // ✅ HELPER: Check if form is multi-step
    const isMultiStepForm = (registrationData) => {
        return registrationData?.formType === 'MULTI_STEP' && registrationData?.steps?.length > 0;
    };

    const handleInputChange = (fieldId, value, fieldType = 'text') => {
        console.log(`📝 Setting form field: ${fieldId} = ${value} (type: ${fieldType})`);
        
        setFormData(prev => {
            if (fieldType === 'checkbox') {
                const currentValues = prev[fieldId] || [];
                const updatedValues = currentValues.includes(value)
                    ? currentValues.filter(v => v !== value)
                    : [...currentValues, value];

                const newData = {
                    ...prev,
                    [fieldId]: updatedValues
                };
                console.log(`📋 Updated form data (checkbox):`, newData);
                return newData;
            }

            const newData = {
                ...prev,
                [fieldId]: value
            };
            console.log(`📋 Updated form data:`, newData);
            return newData;
        });
    };

    const handleFileUpload = async (file, fieldId) => {
        if (!file) return;

        console.log('📁 Starting file upload for field:', fieldId, 'File:', file.name);

        setUploadingFiles(prev => ({
            ...prev,
            [fieldId]: true
        }));

        try {
            // ✅ PERFORMANCE: Quick validation first
            const maxSize = 10 * 1024 * 1024; // 10MB in bytes
            if (file.size > maxSize) {
                setError(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`);
                return;
            }

            // Validate file type for images
            if (fieldId.includes('image')) {
                if (!file.type.startsWith('image/')) {
                    setError('Please select a valid image file');
                    return;
                }
            }

            // ✅ PERFORMANCE: Compress images if they're large
            let processedFile = file;
            if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) { // 2MB threshold
                console.log('🗜️ Compressing large image:', file.name);
                try {
                    processedFile = await compressImage(file);
                    console.log('✅ Image compressed:', {
                        original: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
                        compressed: `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`,
                        reduction: `${(((file.size - processedFile.size) / file.size) * 100).toFixed(1)}%`
                    });
                } catch (compressionError) {
                    console.warn('⚠️ Image compression failed, using original:', compressionError);
                    processedFile = file;
                }
            }

            const formDataUpload = new FormData();
            formDataUpload.append('files', processedFile);
            formDataUpload.append('folder', `crwdctrl/competitions/${competitionId}/registrations`);

            console.log(`📤 Processing ${processedFile.name} (${(processedFile.size / 1024 / 1024).toFixed(2)}MB)...`);
            const uploadStartTime = Date.now();

            const response = await fetch(`${API_BASE_URL}/registrations/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('crwdctrl_token')}`,
                },
                body: formDataUpload,
            });

            if (!response.ok) throw new Error('File upload failed');

            const data = await response.json();
            const uploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(1);
            console.log(`✅ File uploaded in ${uploadTime}s:`, data);
            
            const fileUrl = data.urls?.[0]?.url;
            console.log('🔗 Extracted file URL:', fileUrl);
            console.log('🏷️ Setting for field ID:', fieldId);
            
            if (fileUrl) {
                console.log('✅ Setting file URL in form data');
                handleInputChange(fieldId, fileUrl);
                console.log('📋 Form data after file upload:', formData);
            } else {
                console.error('❌ No file URL in response');
                setError('File upload failed: No URL returned');
            }
            
        } catch (err) {
            console.error('❌ File upload error:', err);
            setError(`File upload failed: ${err.message}`);
        } finally {
            setUploadingFiles(prev => ({
                ...prev,
                [fieldId]: false
            }));
        }
    };

    // ✅ PERFORMANCE: Image compression function
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions (max 1920x1080)
                const maxWidth = 1920;
                const maxHeight = 1080;
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: file.type,
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            reject(new Error('Compression failed'));
                        }
                    },
                    file.type,
                    0.8 // 80% quality
                );
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    };

    const renderField = (field) => {
        // Use consistent field ID generation
        const fieldId = generateFieldId(field);
        const { type, required, options, placeholder } = field;
        const value = formData[fieldId] || ''; // Use stable fieldId
        const isUploading = uploadingFiles[fieldId]; // Use stable fieldId

        switch (type) {
            case 'text':
            case 'email':
            case 'tel':
            case 'number':
                return (
                    <input
                        type={type}
                        value={value}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        placeholder={placeholder}
                        required={required}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base"
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        value={value}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        placeholder={placeholder}
                        required={required}
                        rows={4}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white resize-none text-sm sm:text-base"
                    />
                );

            case 'date':
                return (
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        required={required}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base"
                    />
                );

            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        required={required}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base"
                    >
                        <option value="">{placeholder || 'Select an option'}</option>
                        {options?.map((option, idx) => (
                            <option key={idx} value={option}>{option}</option>
                        ))}
                    </select>
                );

            case 'radio':
                return (
                    <div className="space-y-2">
                        {options?.map((option, idx) => (
                            <label key={idx} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name={fieldId} // Use stable fieldId
                                    value={option}
                                    checked={value === option}
                                    onChange={(e) => handleInputChange(fieldId, e.target.value)}
                                    required={required}
                                    className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                                />
                                <span className="text-white">{option}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'checkbox':
                return (
                    <div className="space-y-2">
                        {options?.map((option, idx) => (
                            <label key={idx} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    value={option}
                                    checked={(value || []).includes(option)}
                                    onChange={(e) => handleInputChange(fieldId, option, 'checkbox')}
                                    className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 rounded focus:ring-[#0ECCEE] focus:ring-2"
                                />
                                <span className="text-white">{option}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'file':
            case 'image':
                return (
                    <div className="space-y-2">
                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
                            <input
                                type="file"
                                accept={type === 'image' ? 'image/*' : '*'}
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        // Validate file size (10MB limit)
                                        const maxSize = 10 * 1024 * 1024; // 10MB
                                        if (file.size > maxSize) {
                                            setError('File size must be less than 10MB');
                                            e.target.value = ''; // Clear the input
                                            return;
                                        }
                                        
                                        // Validate file type for images
                                        if (type === 'image' && !file.type.startsWith('image/')) {
                                            setError('Please select a valid image file');
                                            e.target.value = ''; // Clear the input
                                            return;
                                        }
                                        
                                        handleFileUpload(file, fieldId);
                                    }
                                }}
                                className="hidden"
                                id={`file-${fieldId}`} // Use stable fieldId
                                disabled={isUploading}
                            />
                            <label
                                htmlFor={`file-${fieldId}`}
                                className={`cursor-pointer flex flex-col items-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader className="w-8 h-8 animate-spin text-[#0ECCEE]" />
                                        <span className="text-sm text-blue-400">
                                            Processing file...
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 text-gray-400" />
                                        <span className="text-sm text-gray-400">
                                            {`Click to upload ${type === 'image' ? 'image' : 'file'}`}
                                        </span>
                                        {type === 'image' && (
                                            <span className="text-xs text-gray-500">
                                                Large images will be compressed automatically
                                            </span>
                                        )}
                                    </>
                                )}
                            </label>
                        </div>
                        
                        {value && (
                            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                <span className="text-sm text-green-400">✓ File uploaded successfully</span>
                                <button
                                    type="button"
                                    onClick={() => handleInputChange(fieldId, '')}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('🚀 Starting competition registration submission...');
        
        // ✅ PERFORMANCE: Prevent double submission
        if (submitting) {
            console.log('⚠️ Submission already in progress, ignoring duplicate request');
            return;
        }
        
        setSubmitting(true);
        setError('');
        setSubmissionProgress('Validating form fields...');

        try {
            // ✅ CRITICAL: Support both single-step and multi-step forms for validation
            const formSchema = getFormSchema(competition.registration);
            console.log(`📝 Validation schema: ${formSchema.length} fields (${isMultiStepForm(competition.registration) ? 'multi-step' : 'single-step'})`);
            
            // Validate required fields
            const requiredFields = formSchema.filter(field => field.required) || [];
            console.log('🔍 Validating required fields:', requiredFields.map(f => f.label));
            console.log('📋 Current form data:', formData);
            
            for (const field of requiredFields) {
                const fieldId = generateFieldId(field);
                const fieldValue = formData[fieldId];
                
                console.log(`🔍 Validating field "${field.label}" (${fieldId}):`, {
                    value: fieldValue,
                    hasValue: !!fieldValue,
                    isArray: Array.isArray(fieldValue),
                    arrayLength: Array.isArray(fieldValue) ? fieldValue.length : 'N/A'
                });
                
                if (!fieldValue || 
                    (Array.isArray(fieldValue) && fieldValue.length === 0) ||
                    (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
                    console.error(`❌ Required field missing: ${field.label} (${fieldId})`);
                    throw new Error(`${field.label} is required`);
                }
            }

            setSubmissionProgress('Preparing registration data...');
            const registrationData = {
                responses: formData,
                userInfo: {
                    userId: user.id,
                    name: user.name,
                    email: user.email
                }
            };

            console.log('📊 Registration summary:', {
                totalFields: Object.keys(formData).length,
                requiredFields: requiredFields.length,
                userId: user.id
            });

            setSubmissionProgress('Submitting registration...');
            const startTime = Date.now();

            const response = await fetch(`${API_BASE_URL}/registrations/competitions/${competitionId}/custom`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crwdctrl_token')}`,
                },
                body: JSON.stringify(registrationData),
            });

            const submitTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`📡 Registration response received in ${submitTime}s:`, { 
                status: response.status, 
                ok: response.ok 
            });

            if (!response.ok) {
                let errorMessage = 'Registration failed';
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                    console.error('❌ Backend error details:', errorData);
                    
                    // Handle specific error cases
                    if (response.status === 401) {
                        errorMessage = 'Authentication failed. Please log in again.';
                    } else if (response.status === 400 && errorData.error?.includes('registration')) {
                        errorMessage = `Registration error: ${errorData.error}`;
                    }
                } catch (parseError) {
                    console.error('❌ Could not parse error response:', parseError);
                    if (response.status === 401) {
                        errorMessage = 'Authentication failed. Please log in again.';
                    } else if (response.status === 400) {
                        errorMessage = 'Invalid registration data. Please check your form and try again.';
                    } else if (response.status >= 500) {
                        errorMessage = 'Server error. Please try again in a few moments.';
                    }
                }
                
                throw new Error(errorMessage);
            }

            setSubmissionProgress('Registration completed successfully!');
            const result = await response.json();
            console.log('✅ Registration successful:', result);
            
            setSuccess(true);
            setTimeout(() => {
                navigate(`/competitions-view-details/${competitionId}`);
            }, 2000);

        } catch (err) {
            console.error('❌ Registration error:', err);
            
            // Enhanced error handling
            if (err.message.includes('Authentication') || err.message.includes('401')) {
                setError('Your session has expired. Please log in again.');
                // Clear invalid tokens
                localStorage.removeItem('crwdctrl_token');
                localStorage.removeItem('crwdctrl_user');
                setTimeout(() => navigate('/login'), 2000);
            } else if (err.message.includes('required')) {
                setError(err.message); // Field validation errors
            } else if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
                setError('Network error. Please check your internet connection and try again.');
            } else {
                setError(err.message || 'An unexpected error occurred. Please try again.');
            }
        } finally {
            setSubmitting(false);
            setSubmissionProgress('');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
                <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    if (error && !competition) {
        return (
            <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-white mb-3">Competition Not Found</h1>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-[#0ECCEE] text-black rounded-lg hover:bg-[#0ECCEE]/80"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-6">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">Registration Successful!</h1>
                    <p className="text-gray-400 mb-4">
                        Thank you for registering for <span className="text-white font-medium">{competition?.name}</span>
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                        You will receive a confirmation email shortly with your registration details.
                    </p>
                    <button
                        onClick={() => navigate(`/competitions-view-details/${competitionId}`)}
                        className="px-6 py-2.5 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
                    >
                        Back to Competition
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1B1C1E] py-2 sm:py-4 pb-40 sm:pb-32 md:pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0 mt-1"
                    >
                        <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-tight">
                            Register for {competition?.name}
                        </h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            {competition?.name} - Competition Registration
                        </p>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Registration Form */}
                <div className="bg-[#2A2B2D] rounded-xl p-4 sm:p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* QR Code Section */}
                        {(competition?.registration?.qrCode && competition.registration.qrCode.trim() !== '') && (
                            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 sm:p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                                        <span className="text-white text-xs font-bold">QR</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-blue-300 mb-1">
                                            {competition.registration.qrCodeMessage || 'QR Code'}
                                        </h3>
                                        <div className="flex justify-center">
                                            <img 
                                                src={competition.registration.qrCode} 
                                                alt="QR Code" 
                                                className="w-32 h-32 object-cover rounded-lg border border-blue-700"
                                                onError={(e) => {
                                                    console.error('QR Code image failed to load:', competition.registration.qrCode);
                                                    e.target.style.display = 'none';
                                                }}
                                                onLoad={() => {
                                                    console.log('QR Code image loaded successfully:', competition.registration.qrCode);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Form Fields - Organized in a grid for better layout */}
                        <div className="bg-[#1B1C1E] rounded-lg p-3 sm:p-4">
                            <h3 className="text-base font-semibold text-white mb-3 border-b border-gray-700 pb-2">Registration Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                {(() => {
                                    // ✅ CRITICAL: Support both single-step and multi-step forms for rendering
                                    const formSchema = getFormSchema(competition?.registration);
                                    
                                    return formSchema.map((field) => {
                                        const fieldId = generateFieldId(field);
                                        const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image' || 
                                                           field.type === 'checkbox' || field.type === 'radio';
                                        
                                        return (
                                            <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                                                <label className="block text-sm font-medium text-white mb-1.5">
                                                    {field.label}
                                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                                </label>
                                                {renderField(field)}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="px-4 sm:px-6 py-2.5 rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition-colors text-sm sm:text-base"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 px-4 sm:px-6 py-2.5 rounded-lg bg-[#0ECCEE] text-black font-semibold hover:bg-[#0ECCEE]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 text-sm sm:text-base"
                            >
                                {submitting ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                                            <span className="hidden sm:inline">{submissionProgress || 'Submitting...'}</span>
                                            <span className="sm:hidden">Submitting...</span>
                                        </div>
                                        
                                        {/* Progress indicator */}
                                        {submissionProgress && (
                                            <div className="w-full mt-1">
                                                <div className="bg-gray-700 rounded-full h-1.5">
                                                    <div 
                                                        className="bg-black h-1.5 rounded-full transition-all duration-500 ease-out"
                                                        style={{
                                                            width: submissionProgress.includes('Validating') ? '25%' :
                                                                   submissionProgress.includes('Preparing') ? '50%' :
                                                                   submissionProgress.includes('Submitting') ? '75%' :
                                                                   submissionProgress.includes('completed') ? '100%' : '10%'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    'Submit Registration'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}