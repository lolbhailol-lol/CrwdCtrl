import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { openCashfreeCheckout, buildVerifiedPaymentFields, classifyCheckoutError } from '../../utils/useCashfree';
import PaymentErrorModal from '../../components/PaymentErrorModal';
import {
    getPendingPayment,
    clearPendingPayment,
    isTrekPaymentPending,
    shouldResumePendingPayment,
} from '../../utils/deepLinks';
import {
    goToBookings,
    verifyPaymentWithRetry,
} from '../../utils/paymentNavigation';
import {
    applyRegistrationDraft,
    clearRegistrationDraft,
    competitionRegDraftKey,
    loadRegistrationDraft,
    saveRegistrationDraft,
    scrollFieldIntoView,
} from '../../utils/registrationDraft';
import { parseTicketPrice } from '../../utils/platformFee';
import {
    hasUsableAuthToken,
    resolveAuthToken,
} from '../../utils/authToken';
import { useRegistrationSuccessPopup } from '../../hooks/useSuccessPopup';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
import { fetchPaymentQuote } from '../../services/api/payment.api';
import { API_BASE_URL } from '../../services/api/client';

function getInitialCompetitionRegistrationUi(pathname, search) {
    const currentPath = `${pathname}${search}`;
    const resumingPayment = shouldResumePendingPayment(
        getPendingPayment(),
        currentPath,
        search,
    );
    return { completingPayment: resumingPayment };
}

export default function CompetitionRegistration() {
    const { competitionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const paymentResumeRef = useRef(false);
    const handleSubmitRef = useRef(null);
    const retryCheckoutRef = useRef(null);
    const draftKey = competitionRegDraftKey(competitionId);
    const initialUi = getInitialCompetitionRegistrationUi(location.pathname, location.search);
    const {
        isAuthenticated,
        isLoading: authLoading,
        token,
        firebaseUser,
        isAuthProcessing,
        isRedirectProcessing,
    } = useAuth();

    const [competition, setCompetition] = useState(null);
    const [priceBreakdown, setPriceBreakdown] = useState(null);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submissionProgress, setSubmissionProgress] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [success, setSuccess] = useState(false);
    const [registrationId, setRegistrationId] = useState(null);
    const [completingPayment, setCompletingPayment] = useState(initialUi.completingPayment);
    const [uploadingFiles, setUploadingFiles] = useState({});
    // ✅ NEW: Multi-step form state
    const [currentStep, setCurrentStep] = useState(1);
    const [stepData, setStepData] = useState({});
    const [completedSteps, setCompletedSteps] = useState(new Set());
    // Cashfree verified payment fields (populated after successful checkout)
    const [paymentFields, setPaymentFields] = useState(null);
    const [paymentReceiptUrl] = useState('');
    const [transactionId] = useState('');
    const [paymentResumeError, setPaymentResumeError] = useState('');
    // True once we've waited long enough for Firebase -> backend JWT sync to finish
    const [authSyncExpired, setAuthSyncExpired] = useState(false);
    const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });

    useEffect(() => {
        if (!firebaseUser || resolveAuthToken(token)) {
            setAuthSyncExpired(false);
            return;
        }
        const timer = setTimeout(() => setAuthSyncExpired(true), 5000);
        return () => clearTimeout(timer);
    }, [firebaseUser, token]);

    useRegistrationSuccessPopup(success, {
        name: competition?.name,
        link: registrationId ? `/qr-ticket/${registrationId}` : '/booking',
        paid: Boolean(paymentFields),
    });

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

    const fetchPaymentQuoteForRegistration = useCallback(
        (payload) => fetchPaymentQuote(payload, token),
        [token],
    );

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
            console.log('🏆 Competition data for registration:', {
                name: data.name,
                registrationType: data.registrationType,
                status: data.registration?.status,
                formType: data.registration?.formType,
                steps: data.registration?.steps?.length || 0,
                schemaFields: data.registration?.formSchema?.length || 0,
            });
            
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
                        // Check if there's an accidental defaultValue that contains wrong data (like "Pune" for date fields)
                        if (field.defaultValue) {
                            console.warn(`⚠️ BGMI: Field "${field.label}" (${fieldId}) has defaultValue: "${field.defaultValue}", type: ${field.type}`);
                        }
                        initialData[fieldId] = field.type === 'checkbox' ? [] : '';
                    }
                });
            }
            const draft = loadRegistrationDraft(competitionRegDraftKey(competitionId));
            setFormData({ ...initialData, ...(draft?.formData || {}) });

            // ✅ CRITICAL FIX: Initialize stepData with the same structure for multi-step forms
            if (isMultiStepForm(data.registration)) {
                console.log('🔄 Initializing stepData for multi-step form - initializing ALL steps');
                const allStepsData = {};

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

                if (draft?.stepData) {
                    for (const [step, fields] of Object.entries(draft.stepData)) {
                        allStepsData[step] = { ...(allStepsData[step] || {}), ...fields };
                    }
                }

                console.log('📊 Initialized stepData for all steps:', allStepsData);
                setStepData(allStepsData);
            }

            if (draft?.currentStep) setCurrentStep(draft.currentStep);
            if (draft?.completedSteps?.length) setCompletedSteps(new Set(draft.completedSteps));
            
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
                hasUsableToken: hasUsableAuthToken(token),
            });

            if (authLoading || isAuthProcessing || isRedirectProcessing) {
                console.log('⏳ CompReg: Auth still loading, waiting...');
                return;
            }

            const usableToken = resolveAuthToken(token);

            if (!usableToken) {
                // Give the Firebase -> backend JWT sync a bounded window, then fall back to login
                if (firebaseUser && !authSyncExpired) {
                    console.log('⏳ CompReg: Firebase user present — waiting for backend session sync...');
                    return;
                }
                console.log('❌ CompReg: No usable auth token, redirecting to login');
                setError('Please log in to register for competitions');
                setLoading(false);
                setCompletingPayment(false);
                sessionStorage.setItem('auth_redirect_url', window.location.pathname + window.location.search);
                setTimeout(() => navigate('/login', { replace: true }), 2000);
                return;
            }

            console.log('✅ CompReg: Usable auth token confirmed, proceeding');
            fetchCompetitionDetails();
        };

        initializeRegistration();
    }, [competitionId, authLoading, token, firebaseUser, authSyncExpired, isAuthProcessing, isRedirectProcessing, navigate, fetchCompetitionDetails]);

    useEffect(() => {
        if (loading || !competition) return;

        const fee = parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
        if (fee <= 0) {
            setPriceBreakdown(null);
            return;
        }

        if (!resolveAuthToken(token) || isAuthProcessing) return;

        let cancelled = false;
        (async () => {
            try {
                const quote = await fetchPaymentQuoteForRegistration({ competitionId: competition._id });
                if (!cancelled) setPriceBreakdown(quote);
            } catch (err) {
                if (cancelled) return;
                const msg = err?.message || '';
                if (!msg.includes('token') && !msg.includes('401') && !msg.includes('Unauthorized')) {
                    console.warn('CompReg: payment quote failed:', msg);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [competition, competitionId, token, loading, isAuthProcessing, fetchPaymentQuoteForRegistration]);

    const completePayOnlyRegistration = useCallback(async (verifiedFields, submitToken) => {
        const regRes = await fetch(`${API_BASE_URL}/registrations/competitions/${competitionId}/pay-and-register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${submitToken}`,
            },
            body: JSON.stringify({
                payment_order_id: verifiedFields.payment_order_id,
                payment_id: verifiedFields.payment_id,
            }),
        });
        if (!regRes.ok) {
            const errData = await regRes.json().catch(() => ({}));
            throw new Error(errData.error || errData.message || 'Registration failed after payment.');
        }
        const regData = await regRes.json().catch(() => ({}));
        const regId = regData._id || regData.registration?._id || regData.registrationId;
        if (regId) setRegistrationId(regId);
        clearRegistrationDraft(draftKey);
        setSuccess(true);
    }, [competitionId, draftKey]);

    // Resume after Cashfree redirect — verify payment, then auto-complete registration
    useEffect(() => {
        if (paymentResumeRef.current || authLoading || isAuthProcessing || isRedirectProcessing) return;
        if (loading || !competition) return;

        const pending = getPendingPayment();
        if (!pending?.orderId || isTrekPaymentPending(pending)) return;

        const currentPath = location.pathname + location.search;
        if (!shouldResumePendingPayment(pending, currentPath, location.search)) return;

        paymentResumeRef.current = true;
        setCompletingPayment(true);
        setPaymentResumeError('');
        setSubmissionProgress('Verifying payment...');
        setError('');
        setNotice('');

        (async () => {
            try {
                const submitToken = resolveAuthToken(token) || localStorage.getItem('crwdctrl_token');
                if (!submitToken) {
                    throw new Error('Please log in to complete your registration.');
                }

                const { ok, data: verifyData } = await verifyPaymentWithRetry(
                    API_BASE_URL,
                    pending.orderId,
                    { token: submitToken },
                );
                if (!ok || !verifyData?.verified) {
                    throw new Error(verifyData?.message || 'Payment could not be verified.');
                }

                const verifiedFields = buildVerifiedPaymentFields(verifyData, pending.orderId);
                setPaymentFields(verifiedFields);

                const draft = loadRegistrationDraft(draftKey);
                const hasDraftAnswers = draft && (
                    Object.keys(draft.formData || {}).length > 0
                    || Object.keys(draft.stepData || {}).length > 0
                );

                if (hasDraftAnswers) {
                    applyRegistrationDraft(draft, {
                        setFormData,
                        setStepData,
                        setCurrentStep,
                        setCompletedSteps,
                    });
                    setSubmissionProgress('Submitting your registration...');
                    await handleSubmitRef.current?.(
                        { preventDefault: () => {} },
                        { paidResume: true, verifiedPaymentOverride: verifiedFields, draft },
                    );
                    return;
                }

                setSubmissionProgress('Completing registration...');
                clearPendingPayment();
                await completePayOnlyRegistration(verifiedFields, submitToken);
                clearCashfreeReturnParams();
                setCompletingPayment(false);
            } catch (err) {
                clearPendingPayment();
                setPaymentResumeError(err.message || 'Could not complete registration after payment.');
                setError(err.message || 'Could not complete registration after payment.');
            } finally {
                setSubmissionProgress('');
            }
        })();
    }, [
        authLoading,
        isAuthProcessing,
        isRedirectProcessing,
        loading,
        competition,
        location.pathname,
        location.search,
        token,
        competitionId,
        draftKey,
        completePayOnlyRegistration,
    ]);

    const clearCashfreeReturnParams = () => {
        try {
            const params = new URLSearchParams(location.search);
            ['order_id', 'order_token', 'cf_payment_id', 'payment_id'].forEach((key) => params.delete(key));
            const nextSearch = params.toString();
            navigate(
                { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
                { replace: true },
            );
        } catch {
            /* ignore */
        }
    };

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
        return competition?.registration?.formType === 'MULTI_STEP' && competition?.registration?.steps?.length > 0;
    };

    const getCurrentStepFields = () => {
        if (!isMultiStepFormActive()) {
            return competition?.registration?.formSchema || [];
        }
        const step = competition.registration.steps.find(s => s.stepNumber === currentStep);
        return step?.fields || [];
    };

    const getTotalSteps = () => {
        if (!isMultiStepFormActive()) return 1;
        return competition.registration.steps.length;
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

    const buildFormDataFromDraft = (draft) => {
        if (!draft) return null;
        const merged = { ...(draft.formData || {}) };
        if (draft.stepData && typeof draft.stepData === 'object') {
            Object.values(draft.stepData).forEach((fields) => {
                if (fields && typeof fields === 'object') {
                    Object.assign(merged, fields);
                }
            });
        }
        return merged;
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
                        onFocus={scrollFieldIntoView}
                        placeholder={placeholder}
                        required={required}
                        autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'on'}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#1D1E20] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base transition-colors placeholder-gray-500"
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        value={value}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        onFocus={scrollFieldIntoView}
                        placeholder={placeholder}
                        required={required}
                        rows={4}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#1D1E20] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white resize-none text-sm sm:text-base"
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
                        onFocus={scrollFieldIntoView}
                        required={required}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#1D1E20] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base transition-colors placeholder-gray-500"
                    />
                );
            }

            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        onFocus={scrollFieldIntoView}
                        required={required}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#1D1E20] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base transition-colors placeholder-gray-500"
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
                                    className="w-4 h-4 text-[#0ECCEE] bg-[#1D1E20] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
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
                                    className="w-4 h-4 text-[#0ECCEE] bg-[#1D1E20] border-gray-700 rounded focus:ring-[#0ECCEE] focus:ring-2"
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

    const handleSubmit = async (e, options = {}) => {
        e?.preventDefault?.();
        const {
            paidResume = false,
            verifiedPaymentOverride = null,
            draft = null,
        } = options;
        console.log('🚀 Starting competition registration submission...');
        
        // ✅ PERFORMANCE: Prevent double submission
        if (submitting) {
            console.log('⚠️ Submission already in progress, ignoring duplicate request');
            return;
        }

        // ✅ NEW: For multi-step forms, validate current step first and move to next
        if (!paidResume && isMultiStepFormActive()) {
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
            
            const allFormData = draft ? buildFormDataFromDraft(draft) : getAllFormData();
            
            if (!paidResume) {
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
            }

            // Cashfree: If competition has a fee, open checkout now
            const feeAmount = priceBreakdown?.ticketPrice || parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
            let verifiedPaymentFields = verifiedPaymentOverride || paymentFields; // may already be set from a prior attempt

            if (feeAmount > 0 && !verifiedPaymentFields && !paidResume) {
                setSubmissionProgress('Opening payment gateway...');

                const submitToken = token || localStorage.getItem('crwdctrl_token');

                const orderRes = await fetch(`${API_BASE_URL}/payment/order`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${submitToken}`,
                    },
                    body: JSON.stringify({
                        competitionId: competition._id,
                    }),
                });

                if (!orderRes.ok) {
                    const orderErr = await orderRes.json().catch(() => ({}));
                    throw new Error(orderErr.message || 'Failed to create payment order. Please try again.');
                }

                const orderData = await orderRes.json();

                let checkoutResult;
                try {
                    checkoutResult = await openCashfreeCheckout({
                        paymentSessionId: orderData.paymentSessionId,
                        orderId: orderData.orderId,
                        returnPath: window.location.pathname + window.location.search,
                        cashfreeMode: orderData.cashfreeMode,
                    });
                } catch (checkoutErr) {
                    const { kind, message } = classifyCheckoutError(checkoutErr);
                    setCompletingPayment(false);
                    setSubmitting(false);
                    setSubmissionProgress('');
                    if (kind !== 'cancelled') {
                        retryCheckoutRef.current = () => handleSubmit();
                        setPaymentModal({ open: true, message, orderId: orderData.orderId });
                    }
                    return;
                }

                if (checkoutResult?.redirectDeferred) {
                    saveRegistrationDraft(draftKey, {
                        formData: getAllFormData(),
                        stepData,
                        currentStep,
                        completedSteps,
                    });
                    setSubmitting(false);
                    setCompletingPayment(true);
                    setSubmissionProgress('Complete payment in the gateway. You will return here automatically.');
                    return;
                }

                setCompletingPayment(true);
                setSubmissionProgress('Verifying payment...');

                const { ok, data: verifyData } = await verifyPaymentWithRetry(
                    API_BASE_URL,
                    orderData.orderId,
                    { token: submitToken },
                );
                if (!ok || !verifyData?.verified) {
                    throw new Error(verifyData?.message || 'Payment verification failed. Please contact support.');
                }

                verifiedPaymentFields = buildVerifiedPaymentFields(verifyData, orderData.orderId);
                setPaymentFields(verifiedPaymentFields);
                console.log('✅ Cashfree payment verified, proceeding with registration');
            } else if (feeAmount === 0) {
                // Free competition — validate old QR-based payment fields if QR is configured
                const totalSteps = getTotalSteps();
                const hasPaymentQR = competition.registration.qrCode;
                const isOnPaymentStep = isMultiStepFormActive() && hasPaymentQR && currentStep === totalSteps;

                if (isOnPaymentStep) {
                    if (!paymentReceiptUrl) {
                        throw new Error('Payment receipt is required. Please upload your payment proof after scanning the QR code.');
                    }
                    if (!transactionId.trim()) {
                        throw new Error('Transaction ID is required. Please enter your payment reference number.');
                    }
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

            // Attach verified Cashfree payment fields if payment was made
            if (verifiedPaymentFields) {
                submissionFormData.append('payment_order_id', verifiedPaymentFields.payment_order_id);
                submissionFormData.append('payment_id', verifiedPaymentFields.payment_id);
                console.log('💳 Cashfree payment fields appended to submission');
            }

            // Legacy QR-based payment fields (only used when feeAmount === 0 but QR is configured)
            if (!verifiedPaymentFields) {
                if (transactionId && transactionId.trim()) {
                    submissionFormData.append('transactionId', transactionId.trim());
                }
                if (paymentReceiptUrl) {
                    submissionFormData.append('paymentReceiptUrl', paymentReceiptUrl);
                }
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

            // ✅ FIX: Ensure we have a valid token before submission
            const submitToken = token || localStorage.getItem('crwdctrl_token');
            console.log('🔑 Auth token check for form submission:', {
                hasContextToken: !!token,
                hasStorageToken: !!localStorage.getItem('crwdctrl_token'),
                finalToken: submitToken ? submitToken.substring(0, 20) + '...' : 'NONE',
                tokenLength: submitToken?.length
            });
            
            if (!submitToken) {
                throw new Error('Authentication required. Please log in again to submit your registration.');
            }

            const response = await fetch(`${API_BASE_URL}/registrations/competitions/${competitionId}/custom`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${submitToken}`,
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

            const regId = result._id || result.registration?._id || result.registrationId;
            if (regId) setRegistrationId(regId);
            setCompletingPayment(false);
            setSuccess(true);
            clearRegistrationDraft(draftKey);
            if (paidResume) {
                clearPendingPayment();
                setPaymentResumeError('');
                clearCashfreeReturnParams();
            }

        } catch (err) {
            if (paidResume) {
                setPaymentResumeError(err.message || 'Registration failed after payment.');
            } else {
                setCompletingPayment(false);
            }
            console.error('❌ Registration error:', err);
            
            // Enhanced error handling
            if (!paidResume && (err.message.includes('Authentication') || err.message.includes('401'))) {
                setError('Your session has expired. Please log in again.');
                // Clear invalid tokens
                localStorage.removeItem('crwdctrl_token');
                localStorage.removeItem('crwdctrl_user');
                // Save current URL for redirect after login
                sessionStorage.setItem('auth_redirect_url', window.location.pathname + window.location.search);
                setTimeout(() => navigate('/login', { replace: true }), 2000);
            } else if (!paidResume && (err.message.includes('not configured') || err.message.includes('form field'))) {
                setError('❌ This competition\'s registration form is not properly configured. Please contact the organizer to set up the registration form.');
            } else if (!paidResume && err.message.includes('required')) {
                setError(err.message); // Field validation errors
            } else if (!paidResume && (err.message.includes('Failed to fetch') || err.message.includes('Network'))) {
                setError('Network error. Please check your internet connection and try again.');
            } else if (!paidResume && err.name === 'AbortError') {
                setError('Request timeout. Please check your internet connection and try again.');
            } else if (!paidResume) {
                setError(err.message || 'An unexpected error occurred. Please try again.');
            }
        } finally {
            setSubmitting(false);
            setSubmissionProgress('');
        }
    };

    handleSubmitRef.current = handleSubmit;

    if (completingPayment && !success) {
        return (
            <div className="min-h-screen bg-[#111213] flex flex-col items-center justify-center px-4">
                {paymentResumeError ? (
                    <div className="text-center max-w-md">
                        <p className="text-sm text-red-300 mb-6">{paymentResumeError}</p>
                        <button
                            type="button"
                            onClick={() => { setPaymentResumeError(''); setCompletingPayment(false); }}
                            className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                        >
                            Back to registration form
                        </button>
                    </div>
                ) : (
                    <>
                        <Loader className="w-8 h-8 animate-spin text-[#0ECCEE] mb-4" />
                        <p className="text-sm text-gray-300 text-center">
                            {submissionProgress || 'Completing your registration...'}
                        </p>
                    </>
                )}
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#111213] flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-6 bg-[#1D1E20] rounded-xl">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">Registration Submitted</h1>
                    <p className="text-sm text-gray-300 mb-2">
                        Event:{' '}
                        <span className="font-semibold text-white">
                            {competition?.name}
                        </span>
                    </p>
                    {paymentFields ? (
                        <p className="text-sm text-green-400 mb-3">
                            Payment confirmed via Cashfree. You are registered!
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-yellow-300 mb-1">
                                Status: Verification Pending
                            </p>
                            <p className="text-xs text-gray-400 mb-3">
                                Our team will verify your payment within 24–48 hours and update your registration status.
                            </p>
                        </>
                    )}
                    <p className="text-xs text-gray-500 mb-4">
                        Download your ticket or view all bookings whenever you&apos;re ready.
                    </p>
                    {registrationId && (
                        <button
                            type="button"
                            onClick={() => navigate(`/qr-ticket/${registrationId}`, { state: { refreshBookings: true } })}
                            className="w-full px-4 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors mb-2"
                        >
                            Download Ticket
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => goToBookings(navigate)}
                        className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors mb-2 ${
                            registrationId
                                ? 'bg-transparent border border-gray-700 text-gray-200 hover:bg-gray-800'
                                : 'bg-[#0ECCEE] text-black hover:bg-[#0ECCEE]/80'
                        }`}
                    >
                        View My Bookings
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full px-4 py-2 bg-transparent border border-gray-700 text-gray-200 rounded-lg text-sm hover:bg-gray-800"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    const hasStoredSession = hasUsableAuthToken(token);
    const waitingOnAuth = !hasStoredSession && (
        authLoading || isAuthProcessing || isRedirectProcessing || (!!firebaseUser && !authSyncExpired)
    );

    if ((loading || waitingOnAuth) && !success && !completingPayment) {
        return (
            <div className="min-h-screen bg-[#111213] flex items-center justify-center">
                <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    if (error && !competition) {
        return (
            <div className="min-h-screen bg-[#111213] flex items-center justify-center px-4">
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

    // Main registration form
    return (
        <div className="min-h-screen bg-[#111213] px-4 py-6 pb-24 sm:pb-8">
            <PaymentErrorModal
                open={paymentModal.open}
                message={paymentModal.message}
                orderId={paymentModal.orderId}
                onClose={() => setPaymentModal({ open: false, message: '', orderId: '' })}
                onRetry={() => {
                    setPaymentModal({ open: false, message: '', orderId: '' });
                    retryCheckoutRef.current?.();
                }}
            />
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white leading-tight">
                            Register for {competition?.name}
                        </h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            {competition?.name} - Competition Registration
                        </p>
                    </div>
                </div>

                {notice && (
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 text-green-400 mb-4 text-sm">
                        {notice}
                    </div>
                )}
                {error && (
                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Registration Form */}
                <div className="bg-[#1D1E20] rounded-2xl p-4 sm:p-6 border border-gray-700/40">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Step Progress */}
                        {isMultiStepFormActive() && (
                            <div className="mb-2">
                                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400 mb-2">
                                    <span>Step {currentStep} of {getTotalSteps()}</span>
                                    <span className="font-medium text-white">
                                        {currentStep <= (competition.registration.steps?.length || 0)
                                            ? competition.registration.steps?.find(s => s.stepNumber === currentStep)?.stepTitle || `Step ${currentStep}`
                                            : 'Payment'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-1.5 mb-4">
                                    <div
                                        className="bg-[#0ECCEE] h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${(currentStep / getTotalSteps()) * 100}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                    {competition.registration.steps?.map((step) => (
                                        <div key={step.stepNumber} className="flex flex-col items-center flex-1 min-w-0">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                                step.stepNumber === currentStep
                                                    ? 'bg-[#0ECCEE] text-black'
                                                    : completedSteps.has(step.stepNumber)
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-600 text-gray-400'
                                            }`}>
                                                {completedSteps.has(step.stepNumber) ? '✓' : step.stepNumber}
                                            </div>
                                            <span className={`text-[10px] mt-1 text-center truncate w-full ${step.stepNumber === currentStep ? 'text-white font-medium' : 'text-gray-500'}`}>
                                                {step.stepTitle}
                                            </span>
                                        </div>
                                    ))}
                                    {competition.registration.qrCode && (
                                        <div className="flex flex-col items-center flex-1 min-w-0">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                                currentStep > (competition.registration.steps?.length || 0)
                                                    ? 'bg-[#0ECCEE] text-black'
                                                    : 'bg-gray-600 text-gray-400'
                                            }`}>
                                                💳
                                            </div>
                                            <span className={`text-[10px] mt-1 text-center truncate w-full ${currentStep > (competition.registration.steps?.length || 0) ? 'text-white font-medium' : 'text-gray-500'}`}>
                                                Payment
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Current Step Title */}
                        {isMultiStepFormActive() && (
                            <div className="pt-2">
                                {currentStep <= (competition.registration.steps?.length || 0) ? (
                                    <>
                                        {competition.registration.steps?.find(s => s.stepNumber === currentStep)?.stepDescription && (
                                            <p className="text-sm text-gray-400 mb-3">
                                                {competition.registration.steps.find(s => s.stepNumber === currentStep).stepDescription}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400 mb-3">
                                        Complete your payment to finalize registration
                                    </p>
                                )}
                            </div>
                        )}

                {/* Fee box — shown before payment */}
                {!paymentFields && priceBreakdown && (
                    <div className="rounded-xl p-4 border bg-[#111213] border-[#0ECCEE]/30 mb-4">
                        <p className="text-sm font-semibold text-white mb-2">Payment Breakdown</p>
                        <div className="space-y-1.5 text-sm text-gray-300">
                            <div className="flex justify-between gap-4">
                                <span>Ticket Price</span>
                                <span>₹{priceBreakdown.ticketPrice}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-gray-400">
                                <span>Platform Fee</span>
                                <span>₹{priceBreakdown.platformFee}</span>
                            </div>
                            <div className="flex justify-between gap-4 pt-2.5 mt-1 border-t border-gray-700 font-bold text-base text-[#0ECCEE]">
                                <span>Amount Payable</span>
                                <span>₹{priceBreakdown.totalAmount}</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Includes all charges · Secure payment via Cashfree</p>
                    </div>
                )}

                {/* Payment confirmed notice — shown after Cashfree payment is verified */}
                {paymentFields && (
                    <div className="rounded-xl p-3 border bg-green-900/15 border-green-700/40 flex items-center gap-3 mb-4">
                        <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-green-400">Payment Confirmed</p>
                            <p className="text-xs text-gray-400 mt-0.5">Tap Confirm Booking to finish.</p>
                        </div>
                    </div>
                )}

                {/* Form Fields */}
                <div className="bg-[#111213] rounded-xl p-4 sm:p-5 mb-6 border border-gray-700/50">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pb-2.5 border-b border-gray-700/70">
                        {isMultiStepFormActive() ? `Step ${currentStep}` : 'Registration Details'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getCurrentStepFields().map((field) => {
                            const fieldId = generateFieldId(field);
                            const isFullWidth = field.type === 'textarea' || field.type === 'file' ||
                                               field.type === 'image' || field.type === 'checkbox' || field.type === 'radio';
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

                        {/* Submit / Next Button */}
                        <div className="flex gap-3 pt-2 pb-8 md:pb-4">
                            <button
                                type="button"
                                onClick={isMultiStepFormActive() && currentStep > 1 ? handleStepBack : () => navigate(-1)}
                                className="px-4 sm:px-6 py-3 rounded-xl border border-gray-700 text-white hover:bg-gray-800/60 transition-colors text-sm sm:text-base font-medium"
                                disabled={submitting}
                            >
                                {isMultiStepFormActive() && currentStep > 1 ? 'Previous Step' : 'Cancel'}
                            </button>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base shadow-lg shadow-[#0ECCEE]/10"
                            >
                                {submitting ? (
                                    <>
                                        <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                                        <span>{submissionProgress || 'Processing...'}</span>
                                    </>
                                ) : isMultiStepFormActive() && currentStep < getTotalSteps() ? (
                                    'Next Step'
                                ) : priceBreakdown && !paymentFields ? (
                                    `Pay ₹${Number(priceBreakdown.totalAmount).toLocaleString('en-IN')} & Book`
                                ) : (
                                    'Confirm Booking'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
