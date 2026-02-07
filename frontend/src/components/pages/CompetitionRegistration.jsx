import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function CompetitionRegistration() {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading, token, isAuthProcessing, isRedirectProcessing } = useAuth();
    
    const [competition, setCompetition] = useState(null);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submissionProgress, setSubmissionProgress] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState({});
    // ✅ NEW: Multi-step form state
    const [currentStep, setCurrentStep] = useState(1);
    const [stepData, setStepData] = useState({});
    const [completedSteps, setCompletedSteps] = useState(new Set());
    // ✅ NEW: Payment info state
    const [paymentReceipt, setPaymentReceipt] = useState(null);
    const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('');
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [receiptError, setReceiptError] = useState('');
    const [transactionId, setTransactionId] = useState('');

    // Helper function to generate consistent field IDs
    const generateFieldId = (field) => {
        // Priority 1: use fieldName directly (this is what backend expects)
        if (field.fieldName) {
            console.log(`🔑 Using fieldName for "${field.label}":`, field.fieldName);
            return field.fieldName;
        }
        // Priority 2: use field.id directly (without field_ prefix)
        if (field.id) {
            console.log(`🔑 Using id for "${field.label}":`, field.id);
            return field.id;
        }
        // Priority 3: generate from label as fallback (if label exists)
        if (field.label) {
            // More robust label sanitization - match backend logic
            // Remove 'field_' prefix if it already exists to avoid duplication
            let labelToSanitize = field.label;
            if (labelToSanitize.startsWith('field_')) {
                labelToSanitize = labelToSanitize.substring(6); // Remove 'field_' prefix
            }
            const sanitized = `field_${labelToSanitize.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
            console.log(`🔑 Generated ID for "${field.label}":`, sanitized);
            return sanitized;
        }
        console.warn(`🔑 No ID could be generated for field:`, field);
        return 'unknown_field';
    };

    // ✅ DEFINE fetchCompetitionDetails BEFORE useEffect that uses it
    const fetchCompetitionDetails = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/fests/competitions/${competitionId}/public`, {
                credentials: 'omit', // ✅ iOS/Safari fix - no credentials for public API
                headers: { 'Accept': 'application/json' }
            });
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
            console.log('📋 BGMI DEBUG - Form schema details:', formSchema.map(f => ({ label: f.label, type: f.type, id: f.id, fieldName: f.fieldName, defaultValue: f.defaultValue })));
            console.log('📋 BGMI DEBUG - Full formSchema:', formSchema);
            
            if (formSchema.length > 0) {
                formSchema.forEach(field => {
                    const fieldId = generateFieldId(field);
                    // Initialize file/image fields as null, others as empty string/array
                    if (field.type === 'file' || field.type === 'image') {
                        initialData[fieldId] = null;
                    } else {
                        // Check if there's an accidental defaultValue that contains wrong data (like "Pune" for date fields)
                        if (field.defaultValue) {
                            console.warn(`⚠️ BGMI: Field "${field.label}" (${fieldId}) has defaultValue: "${field.defaultValue}", type: ${field.type}`);
                        }
                        initialData[fieldId] = field.type === 'checkbox' ? [] : '';
                    }
                });
            }
            setFormData(initialData);
            
            // ✅ CRITICAL FIX: Initialize stepData with the same structure for multi-step forms
            if (isMultiStepForm(data.registration)) {
                console.log('🔄 Initializing stepData for multi-step form - initializing ALL steps');
                const allStepsData = {};
                
                // Initialize each step with its own field data
                data.registration.steps.forEach(step => {
                    const stepFields = step.fields || [];
                    const stepInitialData = {};
                    
                    stepFields.forEach(field => {
                        const fieldId = generateFieldId(field);
                        if (field.type === 'file' || field.type === 'image') {
                            stepInitialData[fieldId] = null;
                        } else {
                            stepInitialData[fieldId] = field.type === 'checkbox' ? [] : '';
                        }
                    });
                    
                    allStepsData[step.stepNumber] = stepInitialData;
                });
                
                console.log('📊 Initialized stepData for all steps:', allStepsData);
                setStepData(allStepsData);
            }
            
        } catch (err) {
            console.error('Error fetching competition:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [competitionId]);

    // ✅ MAIN: Initialize registration and fetch competition details
    useEffect(() => {
        const initializeRegistration = async () => {
            console.log('🔄 CompReg: Initializing registration...', {
                authLoading, isAuthenticated, isAuthProcessing, isRedirectProcessing,
                hasToken: !!token,
                hasLocalToken: !!localStorage.getItem('crwdctrl_token')
            });

            // ✅ CRITICAL: Wait for ALL auth processes to finish
            if (authLoading || isAuthProcessing || isRedirectProcessing) {
                console.log('⏳ CompReg: Auth still loading, waiting...');
                return;
            }

            // ✅ FIX: Check AuthContext FIRST, then fallback to localStorage
            const localToken = localStorage.getItem('crwdctrl_token');
            const hasAuth = isAuthenticated || !!token || !!localToken;
            
            if (!hasAuth) {
                console.log('❌ CompReg: No authentication data found, redirecting to login');
                setError('Please log in to register for competitions');
                sessionStorage.setItem('auth_redirect_url', window.location.pathname + window.location.search);
                setTimeout(() => navigate('/login', { replace: true }), 2000);
                return;
            }

            // User is authenticated, proceed with registration
            console.log('✅ CompReg: Authentication confirmed, proceeding');
            proceedWithRegistration();
        };

        const proceedWithRegistration = () => {
            fetchCompetitionDetails();
        };

        initializeRegistration();
    }, [competitionId, isAuthenticated, authLoading, isAuthProcessing, isRedirectProcessing, navigate, token, fetchCompetitionDetails]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

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

    // ✅ NEW: Multi-step form helper functions
    const isMultiStepFormActive = () => {
        const isMulti = competition?.registration?.formType === 'MULTI_STEP' && competition?.registration?.steps?.length > 0;
        console.log('🔍 isMultiStepFormActive check:', {
            formType: competition?.registration?.formType,
            stepsLength: competition?.registration?.steps?.length,
            result: isMulti
        });
        return isMulti;
    };

    const getCurrentStepFields = () => {
        if (!isMultiStepFormActive()) {
            return competition?.registration?.formSchema || [];
        }
        
        // ✅ NEW: If this is the payment step (last step with QR), return empty fields
        const baseSteps = competition.registration.steps.length;
        const isPaymentStep = competition.registration.qrCode && currentStep > baseSteps;
        
        if (isPaymentStep) {
            return []; // Payment step has no form fields
        }
        
        const step = competition.registration.steps.find(s => s.stepNumber === currentStep);
        return step?.fields || [];
    };

    const getTotalSteps = () => {
        if (!isMultiStepFormActive()) return 1;
        
        // ✅ NEW: Add +1 for dedicated payment step if QR is configured
        const baseSteps = competition.registration.steps.length;
        const hasPaymentStep = competition.registration.qrCode;
        
        return hasPaymentStep ? baseSteps + 1 : baseSteps;
    };

    const getCurrentStepData = () => {
        if (!isMultiStepFormActive()) {
            return formData;
        }
        return stepData[currentStep] || {};
    };

    const validateCurrentStep = () => {
        const currentFields = getCurrentStepFields();
        const currentData = getCurrentStepData();
        
        if (currentFields.length === 0) {
            // No fields to validate, skip validation for this step
            return true;
        }
        for (const field of currentFields) {
            if (field.required) {
                const fieldId = generateFieldId(field);
                const value = currentData[fieldId];
                
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    setError(`Please fill in the required field: ${field.label}`);
                    return false;
                }
            }
        }

        return true;
    };

    const handleStepNext = () => {
        if (!validateCurrentStep()) {
            return;
        }
        
        // Save current step data
        if (isMultiStepFormActive()) {
            setStepData(prev => ({
                ...prev,
                [currentStep]: getCurrentStepData()
            }));
            setCompletedSteps(prev => new Set([...prev, currentStep]));
        }
        
        if (currentStep < getTotalSteps()) {
            setCurrentStep(prev => prev + 1);
            setError(''); // Clear any errors
        }
    };

    const handleStepBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
            setError(''); // Clear any errors
        }
    };

    const _handleStepFieldChange = (fieldId, value) => {
        if (isMultiStepFormActive()) {
            setStepData(prev => ({
                ...prev,
                [currentStep]: {
                    ...prev[currentStep],
                    [fieldId]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [fieldId]: value
            }));
        }
    };

    const getAllFormData = () => {
        if (!isMultiStepFormActive()) {
            return formData;
        }
        
        // Combine all step data - THIS IS CRITICAL FOR MULTI-STEP FORMS
        const allData = {};
        
        // First, merge all completed steps
        Object.entries(stepData).forEach(([, stepFormData]) => {
            Object.assign(allData, stepFormData);
        });
        
        // Then, include current step data (in case it hasn't been saved yet)
        const currentStepData = getCurrentStepData();
        Object.assign(allData, currentStepData);
        
        return allData;
    };

    const handleInputChange = (fieldId, value, fieldType = 'text') => {
        console.log('🎯 handleInputChange CALLED:', { fieldId, value, fieldType, isMultiStep: isMultiStepFormActive() });
        console.log(`📝 Setting form field: ${fieldId} = ${value} (type: ${fieldType})`);
        
        if (isMultiStepFormActive()) {
            // For multi-step forms, use step-specific data handling
            setStepData(prev => ({
                ...prev,
                [currentStep]: {
                    ...prev[currentStep],
                    [fieldId]: fieldType === 'checkbox' ? 
                        ((prev[currentStep]?.[fieldId] || []).includes(value)
                            ? (prev[currentStep]?.[fieldId] || []).filter(v => v !== value)
                            : [...(prev[currentStep]?.[fieldId] || []), value])
                        : value
                }
            }));
        } else {
            // For single-step forms, use formData directly
            setFormData(prev => {
                if (fieldType === 'checkbox') {
                    const currentValues = prev[fieldId] || [];
                    const updatedValues = currentValues.includes(value)
                        ? currentValues.filter(v => v !== value)
                        : [...currentValues, value];

                    return {
                        ...prev,
                        [fieldId]: updatedValues
                    };
                }

                return {
                    ...prev,
                    [fieldId]: value
                };
            });
        }
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

            // ✅ PERFORMANCE FIX: Store file immediately without uploading
            // Upload will happen during form submission to avoid blocking UI
            const fileInfo = { 
                uploaded: true, 
                fileName: processedFile.name,
                fileSize: processedFile.size,
                fileType: processedFile.type,
                ready: true // Mark as ready for submission
            };
            
            if (isMultiStepFormActive()) {
                // For multi-step forms, use step-specific data handling
                setStepData(prev => ({
                    ...prev,
                    [currentStep]: {
                        ...prev[currentStep],
                        [`${fieldId}_file`]: processedFile, // Store actual file
                        [fieldId]: fileInfo
                    }
                }));
            } else {
                // For single-step forms, use formData directly
                setFormData(prev => ({
                    ...prev,
                    [`${fieldId}_file`]: processedFile, // Store actual file
                    [fieldId]: fileInfo
                }));
            }
            
            console.log('✅ File prepared for upload:', fieldId, '- Will upload during form submission');
        } catch (err) {
            console.error('❌ File validation error:', err);
            setError(err.message || 'Failed to validate file');
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

    // ✅ NEW: Payment receipt upload function
    const handlePaymentReceiptUpload = async (file) => {
        if (!file) return;

        console.log('💳 Starting payment receipt upload:', file.name);
        setUploadingReceipt(true);
        setReceiptError('');

        try {
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                throw new Error('Please upload a valid image (JPG, PNG) or PDF file');
            }

            // Validate file size (5MB limit)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                throw new Error('File size must be less than 5MB');
            }

            // Compress image if it's an image file
            let processedFile = file;
            if (file.type.startsWith('image/')) {
                try {
                    processedFile = await compressImage(file);
                    console.log('🗜️ Receipt image compressed');
                } catch (compressionError) {
                    console.warn('⚠️ Image compression failed, using original:', compressionError);
                    processedFile = file;
                }
            }

            // Upload to backend
            const formData = new FormData();
            formData.append('image', processedFile);

            const response = await fetch(`${API_BASE_URL}/users/upload/image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('crwdctrl_token')}`
                },
                body: formData,
                credentials: 'include',
                mode: 'cors'
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
                }
                throw new Error(errorData.message || 'Failed to upload receipt');
            }

            const result = await response.json();
            const uploadedUrl = result.url || result.imageUrl;

            if (!uploadedUrl) {
                throw new Error('Upload successful but no URL returned');
            }

            setPaymentReceiptUrl(uploadedUrl);
            setPaymentReceipt(processedFile);
            console.log('✅ Payment receipt uploaded successfully');

        } catch (error) {
            console.error('❌ Payment receipt upload error:', error);
            setReceiptError(error.message || 'Failed to upload payment receipt');
        } finally {
            setUploadingReceipt(false);
        }
    };

    const renderField = (field) => {
        // Use consistent field ID generation
        const fieldId = generateFieldId(field);
        const { type, required, options, placeholder } = field;
        
        console.log(`🎨 renderField called for: ${field.label} (${fieldId}, type: ${type})`);
        
        // Get value from appropriate location based on form type
        let value;
        if (isMultiStepFormActive()) {
            value = getCurrentStepData()[fieldId] || '';
        } else {
            value = formData[fieldId] || '';
        }
        
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

            case 'date': {
                // Validate and sanitize date value - only allow YYYY-MM-DD format
                let sanitizedValue = value;
                if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    console.warn(`⚠️ Invalid date value for field "${field.label}": "${value}", resetting to empty`);
                    sanitizedValue = '';
                }
                return (
                    <input
                        type="date"
                        value={sanitizedValue}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        required={required}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base"
                    />
                );
            }

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
                                    onChange={() => handleInputChange(fieldId, option, 'checkbox')}
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
                                data-field-id={fieldId}
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

        // ✅ NEW: For multi-step forms, validate current step first and move to next
        if (isMultiStepFormActive()) {
            const currentFields = getCurrentStepFields();
            const currentData = getCurrentStepData();
            
            // Validate current step
            for (const field of currentFields) {
                if (field.required) {
                    const fieldId = generateFieldId(field);
                    const value = currentData[fieldId];
                    if (field.type === 'file' || field.type === 'image') {
                        if (!value || !value.ready) {
                            setError(`${field.label} is required - please upload a file`);
                            return;
                        }
                    } else if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
                        setError(`${field.label} is required`);
                        return;
                    }
                }
            }

            // If not on final step, move to next step instead of submitting
            if (currentStep < getTotalSteps()) {
                handleStepNext();
                return;
            }
        }
        
        setSubmitting(true);
        setError('');
        setSubmissionProgress('Validating form fields...');

        try {
            // ✅ CRITICAL: Support both single-step and multi-step forms for validation
            const formSchema = getFormSchema(competition.registration);
            console.log(`📝 Validation schema: ${formSchema.length} fields (${isMultiStepForm(competition.registration) ? 'multi-step' : 'single-step'})`);
            
            // Get all form data (combine all steps if multi-step)
            const allFormData = getAllFormData();
            
            // Validate required fields
            const requiredFields = formSchema.filter(field => field.required) || [];
            console.log('🔍 Validating required fields:', requiredFields.map(f => ({ label: f.label, id: generateFieldId(f) })));
            console.log('📋 Current form data keys:', Object.keys(allFormData));
            
            for (const field of requiredFields) {
                const fieldId = generateFieldId(field);
                const fieldValue = allFormData[fieldId];
                
                if (field.type === 'file' || field.type === 'image') {
                    if (!fieldValue || !fieldValue.ready || !allFormData[`${fieldId}_file`]) {
                        console.error(`❌ Required file missing: ${field.label} (${fieldId})`);
                        throw new Error(`${field.label} is required - please upload a file`);
                    }
                } else if (!fieldValue || 
                    (Array.isArray(fieldValue) && fieldValue.length === 0) ||
                    (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
                    console.error(`❌ Required field missing: ${field.label} (${fieldId})`);
                    throw new Error(`${field.label} is required`);
                }
            }

            // ✅ NEW: Validate payment receipt only on the final payment step
            const totalSteps = getTotalSteps();
            const hasPaymentQR = competition.registration.qrCode;
            const isOnPaymentStep = isMultiStepFormActive() && hasPaymentQR && currentStep === totalSteps;
            
            console.log('💳 Payment validation check:', {
                hasPaymentQR,
                totalSteps,
                currentStep,
                isOnPaymentStep,
                hasPaymentReceiptUrl: !!paymentReceiptUrl,
                hasTransactionId: !!transactionId.trim()
            });
            
            // Only require payment receipt and transaction ID on the final payment step
            if (isOnPaymentStep) {
                if (!paymentReceiptUrl) {
                    throw new Error('Payment receipt is required. Please upload your payment proof after scanning the QR code.');
                }
                if (!transactionId.trim()) {
                    throw new Error('Transaction ID is required. Please enter your payment reference number.');
                }
            }

            setSubmissionProgress('Preparing form data...');
            // ✅ MATCHING FEST FORM: Use FormData for proper file handling
            const submissionFormData = new FormData();
            const textResponses = {};
            let totalFileSize = 0;
            let fileCount = 0;

            // Process form fields with consistent field naming
            console.log('🔍 PROCESSING FIELDS - Starting:', {
                formSchemaLength: formSchema.length,
                allFormDataKeys: Object.keys(allFormData),
                allFormDataFull: allFormData,
                isMultiStep: isMultiStepFormActive(),
                fileFieldsInSchema: formSchema.filter(f => f.type === 'file' || f.type === 'image').map(f => ({
                    label: f.label,
                    fieldId: generateFieldId(f),
                    lookingFor: `${generateFieldId(f)}_file`
                }))
            });
            
            formSchema.forEach(field => {
                const fieldId = generateFieldId(field);
                const value = allFormData[fieldId];
                const backendFieldName = generateFieldId(field);
                
                console.log('🔍 PROCESSING FIELD:', {
                    label: field.label,
                    fieldId,
                    fieldType: field.type,
                    value: typeof value === 'string' ? value.substring(0, 100) : value,
                    hasValue: !!value,
                    allFormDataKeys: Object.keys(allFormData)
                });
                
                if (field.type === 'file' || field.type === 'image') {
                    // Add file to FormData if it exists
                    const fileData = allFormData[`${fieldId}_file`];
                    
                    console.log('🔍 FILE DEBUG:', {
                        fieldId,
                        fieldLabel: field.label,
                        hasFileData: !!fileData,
                        fileDataType: typeof fileData,
                        isFile: fileData instanceof File,
                        isBlob: fileData instanceof Blob,
                        fileDataSize: fileData?.size || 'N/A',
                        fileDataName: fileData?.name || 'N/A'
                    });
                    
                    if (fileData && fileData.size > 0) {
                        submissionFormData.append(backendFieldName, fileData);
                        const fileSizeInMB = (fileData.size / 1024 / 1024).toFixed(2);
                        totalFileSize += fileData.size;
                        fileCount++;
                        console.log('📁 Added file to form data:', {
                            fieldName: backendFieldName,
                            fileName: fileData.name,
                            fileSize: `${fileSizeInMB}MB`,
                            actualSize: fileData.size,
                            totalFileSize: `${(totalFileSize / 1024 / 1024).toFixed(2)}MB`
                        });
                    }
                } else {
                    // Add text data to responses object
                    textResponses[backendFieldName] = value ?? '';
                    console.log('📝 Added text response:', backendFieldName, '=', typeof value === 'string' ? value.substring(0, 50) : value);
                }
            });

            console.log('📋 Final textResponses object:', textResponses);
            console.log('📋 Final textResponses keys:', Object.keys(textResponses));

            // Add text responses as JSON
            submissionFormData.append('responses', JSON.stringify(textResponses));
            console.log('✅ Appended responses to FormData');

            // ✅ MATCHING FEST FORM: Add transaction ID
            if (transactionId && transactionId.trim()) {
                submissionFormData.append('transactionId', transactionId.trim());
                console.log('💳 Added transaction ID to submission:', transactionId);
            }

            // ✅ MATCHING FEST FORM: Add payment receipt URL if uploaded
            if (paymentReceiptUrl) {
                submissionFormData.append('paymentReceiptUrl', paymentReceiptUrl);
                console.log('💳 Added payment receipt URL to submission:', paymentReceiptUrl);
            }

            // ✅ PERFORMANCE: Show file submission progress
            if (fileCount > 0) {
                setSubmissionProgress(`Submitting ${fileCount} file(s) (${(totalFileSize / 1024 / 1024).toFixed(2)}MB)...`);
            } else {
                setSubmissionProgress('Submitting registration...');
            }

            // ✅ PERFORMANCE: Pre-validate file sizes
            const maxTotalSize = 50 * 1024 * 1024; // 50MB total limit
            if (totalFileSize > maxTotalSize) {
                throw new Error(`Total file size (${(totalFileSize / 1024 / 1024).toFixed(2)}MB) exceeds limit of 50MB. Please reduce file sizes.`);
            }

            console.log('📊 Submission summary:', {
                textFields: Object.keys(textResponses).length,
                fileFields: fileCount,
                totalFileSize: `${(totalFileSize / 1024 / 1024).toFixed(2)}MB`,
                hasPaymentInfo: !!paymentReceiptUrl
            });

            setSubmissionProgress('Submitting registration to server... (instant response)');
            const startTime = Date.now();

            // ✅ MATCHING FEST FORM: Dynamic timeout based on file size
            const baseTimeout = 120000; // 120 seconds
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`⏱️ Aborting request after ${(baseTimeout / 1000).toFixed(0)}s timeout`);
                controller.abort();
            }, baseTimeout);

            console.log(`⏱️ Request timeout: ${(baseTimeout / 1000).toFixed(0)}s`);
            console.log('🌐 Making fetch request to:', `${API_BASE_URL}/registrations/competitions/${competitionId}/custom`);

            const response = await fetch(`${API_BASE_URL}/registrations/competitions/${competitionId}/custom`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('crwdctrl_token')}`,
                    // Don't set Content-Type for FormData - browser will set it with boundary
                },
                body: submissionFormData,
                signal: controller.signal,
                credentials: 'include',
                mode: 'cors'
            });

            clearTimeout(timeoutId);
            const submitTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`📡 Registration response received in ${submitTime}s:`, { 
                status: response.status, 
                ok: response.ok,
                contentType: response.headers.get('content-type')
            });

            if (!response.ok) {
                let errorMessage = 'Registration failed';
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                    console.error('❌ Backend error details:', errorData);
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
            // ✅ FIXED: Redirect to registered events page (same as fest registration)
            setTimeout(() => {
                navigate('/registered-fest');
            }, 2000);

        } catch (err) {
            console.error('❌ Registration error:', err);
            
            // Enhanced error handling
            if (err.message.includes('Authentication') || err.message.includes('401')) {
                setError('Your session has expired. Please log in again.');
                // Clear invalid tokens
                localStorage.removeItem('crwdctrl_token');
                localStorage.removeItem('crwdctrl_user');
                // Save current URL for redirect after login
                sessionStorage.setItem('auth_redirect_url', window.location.pathname + window.location.search);
                setTimeout(() => navigate('/login', { replace: true }), 2000);
            } else if (err.message.includes('not configured') || err.message.includes('form field')) {
                setError('❌ This competition\'s registration form is not properly configured. Please contact the organizer to set up the registration form.');
            } else if (err.message.includes('required')) {
                setError(err.message); // Field validation errors
            } else if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
                setError('Network error. Please check your internet connection and try again.');
            } else if (err.name === 'AbortError') {
                setError('Request timeout. Please check your internet connection and try again.');
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
        <div className="min-h-screen bg-[#1B1C1E] py-2 sm:py-4 pb-24 md:pb-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
                        {/* DEBUG: Check if multi-step form is active */}
                        {console.log('📋 Render check - isMultiStepFormActive():', isMultiStepFormActive(), 'competition:', competition?.registration?.formType)}
                        
{/* ✅ NEW: Multi-Step Form Progress - Matching Fest Model */}
                {isMultiStepFormActive() && (
                    <div className="bg-[#1B1C1E] rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-white">Progress</h3>
                            <div className="text-right">
                                <span className="text-xs text-gray-400">Step {currentStep} of {getTotalSteps()}</span>
                            </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                            <div 
                                className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(currentStep / getTotalSteps()) * 100}%` }}
                            ></div>
                        </div>
                        
                        {/* Step Indicators */}
                        <div className="flex justify-between">
                            {/* Regular form steps */}
                            {competition.registration.steps && competition.registration.steps.map((step) => (
                                <div key={step.stepNumber} className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                        step.stepNumber === currentStep 
                                            ? 'bg-[#0ECCEE] text-black' 
                                            : completedSteps.has(step.stepNumber)
                                                ? 'bg-green-600 text-white'
                                                : 'bg-gray-600 text-gray-300'
                                    }`}>
                                        {completedSteps.has(step.stepNumber) ? '✓' : step.stepNumber}
                                    </div>
                                    <span className="text-xs text-gray-400 mt-1 text-center max-w-16 truncate">
                                        {step.stepTitle}
                                    </span>
                                </div>
                            ))}
                            
                            {/* Payment step indicator (if QR is configured) */}
                            {competition.registration.qrCode && (
                                <div className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                        currentStep > (competition.registration.steps ? competition.registration.steps.length : 0)
                                            ? 'bg-[#0ECCEE] text-black' 
                                            : completedSteps.has((competition.registration.steps ? competition.registration.steps.length : 0) + 1)
                                                ? 'bg-green-600 text-white'
                                                : 'bg-gray-600 text-gray-300'
                                    }`}>
                                        {completedSteps.has((competition.registration.steps ? competition.registration.steps.length : 0) + 1) ? '✓' : '💳'}
                                    </div>
                                    <span className="text-xs text-gray-400 mt-1 text-center max-w-16">
                                        Payment
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ✅ NEW: Current Step Title and Description */}
                {isMultiStepFormActive() && (
                    <div className="bg-[#1B1C1E] rounded-lg p-4 mb-4">
                        {/* Step title and description */}
                        {currentStep <= (competition.registration.steps ? competition.registration.steps.length : 0) ? (
                            // Regular form step
                            <>
                                <h3 className="text-lg font-semibold text-white mb-2">
                                    {competition.registration.steps && competition.registration.steps.find(s => s.stepNumber === currentStep)?.stepTitle}
                                </h3>
                                {competition.registration.steps && competition.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription && (
                                    <p className="text-sm text-gray-400 mb-4">
                                        {competition.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription}
                                    </p>
                                )}
                            </>
                        ) : (
                            // Payment step
                            <>
                                <h3 className="text-lg font-semibold text-white mb-2">
                                    Payment
                                </h3>
                                <p className="text-sm text-gray-400 mb-4">
                                    Complete your payment to finalize your registration
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* ✅ NEW: QR Code Section (only on final payment step) */}
                {isMultiStepFormActive() && competition.registration.qrCode && currentStep === getTotalSteps() && (
                    <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                                <span className="text-white text-xs font-bold">QR</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-blue-300 mb-3">
                                    {competition.registration.qrCodeMessage || 'Scan QR Code to Pay'}
                                </h3>
                                <div className="flex justify-center">
                                    <img 
                                        src={competition.registration.qrCode} 
                                        alt="Payment QR Code" 
                                        className="w-40 h-40 object-cover rounded-lg border border-blue-700"
                                        onError={(e) => {
                                            console.error('QR Code image failed to load');
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ Payment Section for SINGLE-STEP forms with QR */}
                {!isMultiStepFormActive() && competition.registration.qrCode && (
                    <div className="bg-[#1B1C1E] rounded-lg p-4 mb-6 border border-gray-700">
                        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            Payment Information
                        </h4>
                        
                        {/* QR Code Display */}
                        <div className="mb-4">
                            <h5 className="text-sm font-medium text-white mb-3">Payment QR Code</h5>
                            <div className="flex justify-center">
                                <img 
                                    src={competition.registration.qrCode} 
                                    alt="Payment QR Code" 
                                    className="w-40 h-40 object-cover rounded-lg border border-gray-600"
                                    onError={(e) => {
                                        console.error('QR Code image failed to load');
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Payment Instructions */}
                        {competition.registration.qrCodeMessage && (
                            <div className="mb-4 p-3 bg-gray-800/50 rounded border border-gray-700">
                                <p className="text-sm text-gray-300">{competition.registration.qrCodeMessage}</p>
                            </div>
                        )}

                        {/* Transaction ID */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-white mb-2">
                                Transaction ID <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value)}
                                placeholder="Enter transaction ID (UPI ref, bank ref, etc.)"
                                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#0ECCEE]"
                            />
                            <p className="text-xs text-gray-400 mt-1">This helps us verify your payment</p>
                        </div>

                        {/* Payment Receipt Upload */}
                        {!paymentReceiptUrl ? (
                            <div className="mb-4 space-y-3">
                                <label className="block text-sm font-semibold text-white mb-2">
                                    Upload Payment Receipt <span className="text-red-400">*</span>
                                </label>
                                <div className="flex items-center justify-center w-full">
                                    <label 
                                        htmlFor="payment-receipt-upload" 
                                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                                            uploadingReceipt 
                                                ? 'border-blue-400 bg-blue-900/20' 
                                                : 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-800/70'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            {uploadingReceipt ? (
                                                <>
                                                    <Loader className="w-8 h-8 mb-2 text-blue-400 animate-spin" />
                                                    <p className="text-sm text-blue-400">Uploading receipt...</p>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                                    <p className="mb-2 text-sm text-gray-300">
                                                        <span className="font-semibold">Click to upload</span> payment receipt
                                                    </p>
                                                    <p className="text-xs text-gray-400">PNG, JPG or PDF (Max 5MB)</p>
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            id="payment-receipt-upload" 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/jpeg,image/jpg,image/png,application/pdf"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) handlePaymentReceiptUpload(file);
                                            }}
                                            disabled={uploadingReceipt}
                                        />
                                    </label>
                                </div>
                                {receiptError && (
                                    <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-2">
                                        {receiptError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="mb-4">
                                <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm text-green-400 font-medium">Payment receipt uploaded</p>
                                        <p className="text-xs text-gray-400 mt-1">{paymentReceipt?.name}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentReceiptUrl('');
                                            setPaymentReceipt(null);
                                            setReceiptError('');
                                        }}
                                        className="text-gray-400 hover:text-white text-sm underline"
                                    >
                                        Change
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ✅ Payment Section for MULTI-STEP forms (final payment step) */}
                {isMultiStepFormActive() && competition.registration.qrCode && currentStep === getTotalSteps() && (
                    <div className="bg-[#1B1C1E] rounded-lg p-4 mb-6 border border-gray-700">
                        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            Upload Payment Receipt <span className="text-red-400">*</span>
                        </h4>
                        
                        {!paymentReceiptUrl ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-center w-full">
                                    <label 
                                        htmlFor="payment-receipt-upload" 
                                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                                            uploadingReceipt 
                                                ? 'border-blue-400 bg-blue-900/20' 
                                                : 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-800/70'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            {uploadingReceipt ? (
                                                <>
                                                    <Loader className="w-8 h-8 mb-2 text-blue-400 animate-spin" />
                                                    <p className="text-sm text-blue-400">Uploading receipt...</p>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                                    <p className="mb-2 text-sm text-gray-300">
                                                        <span className="font-semibold">Click to upload</span> payment receipt
                                                    </p>
                                                    <p className="text-xs text-gray-400">PNG, JPG or PDF (Max 5MB)</p>
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            id="payment-receipt-upload" 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/jpeg,image/jpg,image/png,application/pdf"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) handlePaymentReceiptUpload(file);
                                            }}
                                            disabled={uploadingReceipt}
                                        />
                                    </label>
                                </div>
                                
                                {receiptError && (
                                    <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-2">
                                        {receiptError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm text-green-400 font-medium">Payment receipt uploaded</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {paymentReceipt?.name}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentReceiptUrl('');
                                            setPaymentReceipt(null);
                                            setReceiptError('');
                                        }}
                                        className="text-gray-400 hover:text-white text-sm underline"
                                    >
                                        Change
                                    </button>
                                </div>
                                
                                {paymentReceipt?.type.startsWith('image/') && (
                                    <div className="flex justify-center">
                                        <img 
                                            src={paymentReceiptUrl} 
                                            alt="Payment receipt" 
                                            className="max-w-full max-h-32 object-contain rounded-lg border border-gray-600"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Transaction ID Input - Always visible */}
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <label className="block text-sm font-semibold text-white mb-2">
                                Transaction ID <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value)}
                                placeholder="Enter transaction ID (UPI ref, bank ref, etc.)"
                                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#0ECCEE]"
                            />
                            <p className="text-xs text-gray-400 mt-1">This helps us verify your payment</p>
                        </div>

                    </div>
                )}

                {/* ✅ NEW: Form Fields Section */}
                {(() => {
                    const currentFields = getCurrentStepFields();
                    
                    // Don't show fields section for payment step
                    if (isMultiStepFormActive() && competition.registration.qrCode && currentStep === getTotalSteps()) {
                        return null;
                    }
                    
                    return (
                        <div className="bg-[#1B1C1E] rounded-lg p-4 mb-6">
                            <h3 className="text-base font-semibold text-white mb-4 border-b border-gray-700 pb-3">
                                {isMultiStepFormActive() ? `Step ${currentStep}` : 'Registration Details'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentFields.map((field) => {
                                    const fieldId = generateFieldId(field);
                                    const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image' || 
                                                       field.type === 'checkbox' || field.type === 'radio';
                                    
                                    return (
                                        <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                                            <label className="block text-sm font-medium text-white mb-2">
                                                {field.label}
                                                {field.required && <span className="text-red-400 ml-1">*</span>}
                                            </label>
                                            {renderField(field)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                        {/* Submit Button */}
                        <div className="flex gap-3 pt-2 pb-8 md:pb-4">
                            {/* Back Button */}
                            <button
                                type="button"
                                onClick={isMultiStepFormActive() && currentStep > 1 ? handleStepBack : () => navigate(-1)}
                                className="px-4 sm:px-6 py-2.5 rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition-colors text-sm sm:text-base"
                                disabled={submitting}
                            >
                                {isMultiStepFormActive() && currentStep > 1 ? 'Previous Step' : 'Cancel'}
                            </button>
                            
                            {/* Next/Submit Button */}
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
                                ) : (() => {
                                    if (isMultiStepFormActive() && currentStep < getTotalSteps()) {
                                        // Check if next step is payment step
                                        const nextStepIsPayment = competition.registration.qrCode && currentStep === (competition.registration.steps?.length || 0);
                                        return nextStepIsPayment ? 'Continue to Payment' : 'Next Step';
                                    }
                                    
                                    // Final step
                                    const isPaymentStep = isMultiStepFormActive() && competition.registration.qrCode && currentStep > (competition.registration.steps?.length || 0);
                                    return isPaymentStep ? 'Complete Payment & Registration' : 'Submit Registration';
                                })()}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}