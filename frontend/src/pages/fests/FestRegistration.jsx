import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNotifications } from '../../context/NotificationsContext';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
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
  clearRegistrationDraft,
  festRegDraftKey,
  loadRegistrationDraft,
  saveRegistrationDraft,
  scrollFieldIntoView,
  applyRegistrationDraft,
} from '../../utils/registrationDraft';
import { useRegistrationSuccessPopup } from '../../hooks/useSuccessPopup';
import { finalizeCompetitionAfterPayment } from '../../utils/competitionPaymentComplete';
import {
  clearStoredAuthSession,
  getBearerAuthHeaders,
  hasUsableAuthToken,
  resolveAuthToken,
} from '../../utils/authToken';
import { parseTicketPrice } from '../../utils/platformFee';
import { fetchPaymentQuote as fetchPaymentQuoteApi } from '../../services/api/payment.api';
import { API_BASE_URL } from '../../services/api/client';

function getInitialFestRegistrationUi(pathname, search) {
  const currentPath = `${pathname}${search}`;
  const resumingPayment = shouldResumePendingPayment(
    getPendingPayment(),
    currentPath,
    search,
  );
  return { completingPayment: resumingPayment };
}

export default function FestRegistration() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const paymentResumeRef = useRef(false);
  const competitionPaymentResumeRef = useRef(false);
  const handleSubmitRef = useRef(null);
  const competitionId = searchParams.get('competition');
  const initialUi = getInitialFestRegistrationUi(location.pathname, location.search);
  const {
    isAuthenticated,
    isLoading: authLoading,
    token: authToken,
    firebaseUser,
    isAuthProcessing,
    isRedirectProcessing,
  } = useAuth();
  const { refreshNotifications } = useNotifications();

  const { isDark } = useDarkMode();
  
  const [fest, setFest] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState('');
  const [error, setError] = useState('');
  const [notice] = useState('');
  const [success, setSuccess] = useState(false);
  const [completingPayment, setCompletingPayment] = useState(initialUi.completingPayment);
  const [registrationId, setRegistrationId] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState({});
  // Cashfree verified payment fields
  const [paymentFields, setPaymentFields] = useState(null);
  // ✅ NEW: Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [stepData, setStepData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  // Cashfree direct payment state
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });
  const retryCheckoutRef = useRef(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  // True once we've waited long enough for Firebase -> backend JWT sync to finish
  const [authSyncExpired, setAuthSyncExpired] = useState(false);
  const [paymentResumeError, setPaymentResumeError] = useState('');

  useEffect(() => {
    if (!firebaseUser || resolveAuthToken(authToken)) {
      setAuthSyncExpired(false);
      return;
    }
    const timer = setTimeout(() => setAuthSyncExpired(true), 5000);
    return () => clearTimeout(timer);
  }, [firebaseUser, authToken]);

  const isCompetitionRegistration = !!competitionId;
  const draftKey = festRegDraftKey(festId, competitionId);
  const registrationDisplayName = isCompetitionRegistration ? competition?.name : fest?.festName;

  useRegistrationSuccessPopup(success, {
    name: registrationDisplayName,
    link: registrationId ? `/qr-ticket/${registrationId}` : '/booking',
    paid: Boolean(paymentFields),
  });

  const restoreRegistrationDraft = () => {
    const draft = loadRegistrationDraft(draftKey);
    if (!draft) return;
    if (draft.formData && Object.keys(draft.formData).length > 0) {
      setFormData((prev) => ({ ...prev, ...draft.formData }));
    }
    if (draft.stepData && Object.keys(draft.stepData).length > 0) {
      setStepData((prev) => {
        const merged = { ...prev };
        for (const [step, fields] of Object.entries(draft.stepData)) {
          merged[step] = { ...(merged[step] || {}), ...fields };
        }
        return merged;
      });
    }
    if (draft.currentStep) setCurrentStep(draft.currentStep);
    if (draft.completedSteps?.length) setCompletedSteps(new Set(draft.completedSteps));
  };

  const handleCloseLogin = () => setShowLogin(false);
  const handleCloseRegister = () => setShowRegister(false);
  const handleSwitchToRegister = () => {
    setShowLogin(false);
    setShowRegister(true);
  };
  const handleSwitchToLogin = () => {
    setShowRegister(false);
    setShowLogin(true);
  };

  useEffect(() => {
    if (isAuthenticated && showLogin) setShowLogin(false);
    if (isAuthenticated && showRegister) setShowRegister(false);
  }, [isAuthenticated, showLogin, showRegister]);

  // Resume fest pay-and-register after Cashfree redirect checkout
  useEffect(() => {
    if (paymentResumeRef.current || authLoading || isAuthProcessing || isRedirectProcessing) return;
    if (isCompetitionRegistration || !fest || !(fest.feeAmount > 0)) return;

    const pending = getPendingPayment();
    if (!pending?.orderId || isTrekPaymentPending(pending)) return;

    const currentPath = location.pathname + location.search;
    if (!shouldResumePendingPayment(pending, currentPath, location.search)) return;

    paymentResumeRef.current = true;
    setCompletingPayment(true);
    setPaymentLoading(true);
    setPaymentError('');
    setSubmissionProgress('Verifying payment...');

    (async () => {
      try {
        const token = resolveAuthToken(authToken);
        if (!token) {
          clearStoredAuthSession();
          setCompletingPayment(false);
          setShowLogin(true);
          setPaymentError('Please log in to complete your registration.');
          return;
        }

        const { ok, data: verifyData } = await verifyPaymentWithRetry(
          API_BASE_URL,
          pending.orderId,
          { token },
        );
        if (!ok || !verifyData?.verified) {
          throw new Error(verifyData?.message || 'Payment could not be verified.');
        }

        const regRes = await fetch(`${API_BASE_URL}/registrations/fests/${festId}/pay-and-register`, {
          method: 'POST',
          headers: getBearerAuthHeaders(authToken),
          body: JSON.stringify({ payment_order_id: pending.orderId }),
        });
        if (!regRes.ok) {
          const errData = await regRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Registration failed after payment. Please contact support.');
        }

        clearPendingPayment();
        const regData = await regRes.json().catch(() => ({}));
        const regId = regData._id || regData.registration?._id || regData.registrationId;
        setRegistrationId(regId);
        setCompletingPayment(false);
        setSuccess(true);
        refreshNotifications();
        clearRegistrationDraft(draftKey);
        clearCashfreeReturnParams();
      } catch (err) {
        clearPendingPayment();
        setCompletingPayment(false);
        setPaymentError(err.message || 'Could not complete registration after payment.');
      } finally {
        setPaymentLoading(false);
        setSubmissionProgress('');
      }
    })();
  }, [
    loading,
    authLoading,
    fest,
    festId,
    isCompetitionRegistration,
    location.pathname,
    location.search,
    authToken,
    navigate,
    refreshNotifications,
  ]);

  // Resume competition registration after Cashfree redirect checkout
  useEffect(() => {
    if (competitionPaymentResumeRef.current || authLoading || isAuthProcessing || isRedirectProcessing) return;
    if (!isCompetitionRegistration || !competitionId) return;
    if (loading || !competition || !fest) return;

    const pending = getPendingPayment();
    if (!pending?.orderId || isTrekPaymentPending(pending)) return;

    const currentPath = location.pathname + location.search;
    if (!shouldResumePendingPayment(pending, currentPath, location.search)) return;

    competitionPaymentResumeRef.current = true;
    setCompletingPayment(true);
    setPaymentResumeError('');
    setSubmissionProgress('Verifying payment...');
    setPaymentError('');
    setError('');

    (async () => {
      try {
        const submitToken = resolveAuthToken(authToken) || localStorage.getItem('crwdctrl_token');
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
        }

        setSubmissionProgress(hasDraftAnswers
          ? 'Submitting your registration...'
          : 'Completing registration...');

        const { regId } = await finalizeCompetitionAfterPayment({
          competitionId,
          verifiedFields,
          token: submitToken,
          draft,
          tryFormSubmit: hasDraftAnswers
            ? async () => {
                const result = await handleSubmitRef.current?.(
                  { preventDefault: () => {} },
                  { paidResume: true, verifiedPaymentOverride: verifiedFields, draft },
                );
                return result?.regId || null;
              }
            : null,
        });

        if (regId) setRegistrationId(regId);
        clearRegistrationDraft(draftKey);
        clearPendingPayment();
        clearCashfreeReturnParams();
        setCompletingPayment(false);
        setSuccess(true);
        refreshNotifications();
      } catch (err) {
        setPaymentResumeError(err.message || 'Could not complete registration after payment.');
        setPaymentError(err.message || 'Could not complete registration after payment.');
      } finally {
        setSubmissionProgress('');
      }
    })();
  }, [
    authLoading,
    isAuthProcessing,
    isRedirectProcessing,
    isCompetitionRegistration,
    competitionId,
    competition,
    fest,
    loading,
    location.pathname,
    location.search,
    authToken,
    draftKey,
    navigate,
    refreshNotifications,
  ]);

  useEffect(() => {
    const initializeRegistration = async () => {
      console.log('🔄 Initializing registration...', { 
        authLoading, 
        isAuthenticated, 
        isAuthProcessing,
        isRedirectProcessing,
        hasToken: !!authToken,
        hasLocalToken: !!localStorage.getItem('crwdctrl_token'),
        hasLocalUser: !!localStorage.getItem('crwdctrl_user')
      });

      // ✅ CRITICAL: Wait for ALL auth processes to finish before making decisions
      // authLoading = initial load, isAuthProcessing = Firebase restoring session, isRedirectProcessing = OAuth redirect
      if (authLoading || isAuthProcessing || isRedirectProcessing) {
        console.log('⏳ Auth still loading, waiting...', { authLoading, isAuthProcessing, isRedirectProcessing });
        return;
      }

      const currentPath = `${location.pathname}${location.search}`;
      const pendingPayment = getPendingPayment();
      const resumingPayment = pendingPayment
        && shouldResumePendingPayment(pendingPayment, currentPath, location.search);

      const usableToken = resolveAuthToken(authToken);

      if (resumingPayment) {
        if (!usableToken) {
          if (firebaseUser && !authSyncExpired) {
            console.log('⏳ Payment return — waiting for session sync...');
            return;
          }
          setLoading(false);
          return;
        }
        console.log('✅ Payment return — loading registration details');
        proceedWithRegistration();
        return;
      }

      if (!usableToken) {
        // Give the Firebase -> backend JWT sync a bounded window, then fall back to login
        if (firebaseUser && !authSyncExpired) {
          console.log('⏳ Firebase user present — waiting for backend session sync...');
          return;
        }
        console.log('❌ No usable auth token, showing login modal');
        setError('Please log in to register for events');
        setShowLogin(true);
        setLoading(false);
        return;
      }

      console.log('✅ Usable auth token confirmed, proceeding with registration');
      proceedWithRegistration();
    };

    const proceedWithRegistration = () => {
      console.log('🚀 Proceeding with registration fetch...', { isCompetitionRegistration });
      if (isCompetitionRegistration) {
        fetchCompetitionAndFestDetails();
      } else {
        fetchFestDetails();
      }
    };

    initializeRegistration();
     
  }, [festId, competitionId, authLoading, authToken, firebaseUser, authSyncExpired, isAuthProcessing, isRedirectProcessing, location.pathname, location.search]);

  useEffect(() => {
    if (loading || !fest) return;

    const competitionBaseFee = competition
      ? parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee)
      : 0;

    let pricingPayload = null;
    if (isCompetitionRegistration && competitionBaseFee > 0) {
      pricingPayload = { competitionId: competition?._id || competitionId };
    } else if ((fest.feeAmount || 0) > 0) {
      pricingPayload = { festId: fest._id || festId };
    }

    if (!pricingPayload) {
      setPriceBreakdown(null);
      return;
    }

    if (!resolveAuthToken(authToken) || isAuthProcessing) return;

    let cancelled = false;
    (async () => {
      try {
        const quote = await fetchPaymentQuoteApi(pricingPayload, authToken);
        if (!cancelled) setPriceBreakdown(quote);
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || '';
        if (msg.includes('token') || msg.includes('401') || msg.includes('Unauthorized')) {
          if (!firebaseUser) {
            setShowLogin(true);
            setError('Please log in to register for events');
          }
        } else {
          console.warn('Payment quote failed:', msg);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [
    fest,
    competition,
    festId,
    competitionId,
    isCompetitionRegistration,
    authToken,
    loading,
    isAuthProcessing,
    firebaseUser,
  ]);

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
      // More robust label sanitization - avoid duplicate 'field_' prefix
      let labelToSanitize = field.label;
      if (labelToSanitize.startsWith('field_')) {
        labelToSanitize = labelToSanitize.substring(6); // Remove 'field_' prefix
      }
      return `field_${labelToSanitize.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
    }
    return 'unknown_field';
  };

  // ✅ NEW: Multi-step form helper functions
  const isMultiStepForm = () => {
    return fest?.registration?.formType === 'MULTI_STEP' && fest?.registration?.steps?.length > 0;
  };

  const getCurrentStepFields = () => {
    if (!isMultiStepForm()) {
      return fest?.registration?.formSchema || [];
    }
    
    
    const step = fest.registration.steps.find(s => s.stepNumber === currentStep);
    return step?.fields || [];
  };

  const getTotalSteps = () => {
    if (!isMultiStepForm()) return 1;
    
    return fest.registration.steps.length;
  };

  const getCurrentStepData = () => {
    if (!isMultiStepForm()) {
      return formData;
    }
    return stepData[currentStep] || {};
  };

  const validateCurrentStep = () => {
    const currentFields = getCurrentStepFields();
    const currentData = getCurrentStepData();
    
    console.log('🔍 DEBUG - validateCurrentStep:', {
      currentFields: currentFields.map(f => ({ label: f.label, required: f.required, fieldName: f.fieldName })),
      currentData,
      currentStep
    });
    
    if (currentFields.length === 0) {
      // No fields to validate, skip validation for this step
      return true;
    }
    for (const field of currentFields) {
      if (field.required) {
        const fieldId = generateFieldId(field);
        const value = currentData[fieldId];
        console.log('🔍 Validating required field:', { fieldId, value, hasValue: !!value });
        
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          setError(`Please fill in the required field: ${field.label}`);
          console.log('❌ Validation failed for field:', field.label);
          return false;
        }
      }
    }

    console.log('✅ Step validation passed');
    return true;
  };

  const handleStepNext = () => {
    console.log('🔍 DEBUG - handleStepNext called:', {
      currentStep,
      totalSteps: getTotalSteps(),
      isValid: validateCurrentStep(),
      currentFields: getCurrentStepFields(),
      currentData: getCurrentStepData()
    });
    
    if (!validateCurrentStep()) {
      console.log('❌ Step validation failed, not proceeding to next step');
      return;
    }
    
    // Save current step data
    if (isMultiStepForm()) {
      setStepData(prev => ({
        ...prev,
        [currentStep]: getCurrentStepData()
      }));
      setCompletedSteps(prev => new Set([...prev, currentStep]));
    }
    
    if (currentStep < getTotalSteps()) {
      console.log('✅ Moving to next step:', currentStep + 1);
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

  const handleStepFieldChange = (fieldId, value) => {
    if (isMultiStepForm()) {
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
    if (!isMultiStepForm()) {
      console.log('🔍 Single-step form data:', formData);
      return formData;
    }
    
    // Combine all step data - THIS IS CRITICAL FOR MULTI-STEP FORMS
    const allData = {};
    
    // First, merge all completed steps
    Object.entries(stepData).forEach(([stepNum, stepFormData]) => {
      console.log(`🔍 Merging step ${stepNum} data:`, stepFormData);
      Object.assign(allData, stepFormData);
    });
    
    // Then, include current step data (in case it hasn't been saved yet)
    const currentStepData = getCurrentStepData();
    console.log(`🔍 Current step ${currentStep} data:`, currentStepData);
    Object.assign(allData, currentStepData);
    
    console.log('🔍 Multi-step combined data:', {
      stepDataKeys: Object.keys(stepData),
      currentStep,
      allDataKeys: Object.keys(allData),
      fileKeys: Object.keys(allData).filter(key => key.includes('_file')),
      allData
    });
    
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

  // ✅ NEW: Render form field function (extracted for reuse)
  const renderFormField = (field, fieldId, currentData, onFieldChange) => {
    return (
      <div className="space-y-2">
        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <div className="relative">
          {renderField(field, fieldId, currentData, onFieldChange)}
        </div>
      </div>
    );
  };

  // ✅ NEW: Render individual field based on type
  const renderField = (field, fieldId, currentData, onFieldChange) => {
    const value = currentData[fieldId] || '';
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <input
            type={field.type}
            id={fieldId}
            name={fieldId}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            onFocus={scrollFieldIntoView}
            required={field.required}
            autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'on'}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
          />
        );
      
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            name={fieldId}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            onFocus={scrollFieldIntoView}
            required={field.required}
            rows={3}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm resize-none transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
          />
        );
      
      case 'select':
        return (
          <select
            id={fieldId}
            name={fieldId}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            onFocus={scrollFieldIntoView}
            required={field.required}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
          >
            <option value="">Select an option</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg border transition-colors ${isDark ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'}`}>
                <input
                  type="radio"
                  name={fieldId}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onFieldChange(fieldId, e.target.value)}
                  required={field.required}
                  className={`w-4 h-4 text-[#0ECCEE] focus:ring-[#0ECCEE] focus:ring-2 ${isDark ? 'bg-[#1D1E20] border-gray-600' : 'bg-white border-gray-300'}`}
                />
                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{option}</span>
              </label>
            ))}
          </div>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const isChecked = Array.isArray(value) ? value.includes(option) : false;
              return (
                <label key={index} className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg border transition-colors ${isDark ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'}`}>
                  <input
                    type="checkbox"
                    value={option}
                    checked={isChecked}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      if (e.target.checked) {
                        onFieldChange(fieldId, [...currentValues, option]);
                      } else {
                        onFieldChange(fieldId, currentValues.filter(v => v !== option));
                      }
                    }}
                    className={`w-4 h-4 text-[#0ECCEE] rounded focus:ring-[#0ECCEE] focus:ring-2 ${isDark ? 'bg-[#1D1E20] border-gray-600' : 'bg-white border-gray-300'}`}
                  />
                  <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{option}</span>
                </label>
              );
            })}
          </div>
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
            id={fieldId}
            name={fieldId}
            value={sanitizedValue}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
          />
        );
      }
      
      case 'file':
      case 'image':
        return (
          <div className="space-y-2">
            <input
              type="file"
              id={fieldId}
              name={fieldId}
              data-field-id={fieldId}
              accept={field.type === 'image' ? 'image/*' : '*/*'}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  handleFileUpload(file, fieldId);
                }
              }}
              required={field.required}
              className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[#0ECCEE] file:text-black hover:file:bg-[#0ECCEE]/80 transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
            />
            {uploadingFiles[fieldId] && (
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader className="w-4 h-4 animate-spin" />
                Processing...
              </div>
            )}
            {value && value.ready && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                ✓ File ready: {value.fileName}
              </div>
            )}
          </div>
        );
      
      case 'group': {
        // Group field type - allows multiple entries with sub-fields
        const groupEntries = Array.isArray(value) ? value : [];
        
        return (
          <div className="space-y-4">
            {groupEntries.map((entry, entryIndex) => (
              <div key={`group-entry-${fieldId}-${entryIndex}`} className={`p-4 rounded-lg border ${isDark ? 'bg-[#111213] border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[#0ECCEE]">Entry {entryIndex + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      // Remove entry inline
                      const newEntries = groupEntries.filter((_, i) => i !== entryIndex);
                      onFieldChange(fieldId, newEntries);
                    }}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <span>×</span> Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {field.subFields?.map((subField, subIndex) => {
                    // Use subField.fieldName if available, otherwise fall back to label-based name or index
                    const actualFieldName = subField.fieldName || subField.label?.replace(/\s+/g, '_').toLowerCase() || `subfield_${subIndex}`;
                    const subFieldKey = `${fieldId}-${entryIndex}-${actualFieldName}-${subIndex}`;
                    const subFieldValue = entry?.[actualFieldName] ?? '';
                    
                    // Handle select/dropdown type for subfields
                    if (subField.type === 'select' || subField.type === 'competition_dropdown') {
                      // Get options - either from competitions or from subField.options
                      let selectOptions = [];
                      if (subField.optionsSource === 'competitions' || subField.type === 'competition_dropdown') {
                        // Get competitions from fest data
                        const allCompetitions = [];
                        if (fest?.competitions) {
                          Object.values(fest.competitions).forEach(categoryComps => {
                            if (Array.isArray(categoryComps)) {
                              allCompetitions.push(...categoryComps);
                            }
                          });
                        }
                        selectOptions = allCompetitions.map(comp => ({
                          value: comp._id || comp.id,
                          label: comp.name || comp.title
                        }));
                      } else if (subField.options) {
                        selectOptions = subField.options.map(opt => 
                          typeof opt === 'string' ? { value: opt, label: opt } : opt
                        );
                      }
                      
                      return (
                        <div key={subFieldKey}>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {subField.label}
                            {subField.required && <span className="text-red-400 ml-1">*</span>}
                          </label>
                          <select
                            id={subFieldKey}
                            name={subFieldKey}
                            value={subFieldValue}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              const newEntries = groupEntries.map((ent, idx) => {
                                if (idx === entryIndex) {
                                  return {
                                    ...ent,
                                    [actualFieldName]: newValue
                                  };
                                }
                                return { ...ent };
                              });
                              onFieldChange(fieldId, newEntries);
                            }}
                            required={subField.required}
                            className={`w-full px-3 py-2 rounded-lg border focus:border-[#0ECCEE] focus:outline-none text-sm ${isDark ? 'bg-[#1D1E20] border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                          >
                            <option value="">{subField.placeholder || `Select ${subField.label}`}</option>
                            {selectOptions.map((opt, optIdx) => (
                              <option key={optIdx} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={subFieldKey}>
                        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {subField.label}
                          {subField.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <input
                          id={subFieldKey}
                          name={subFieldKey}
                          type={subField.type || 'text'}
                          placeholder={subField.placeholder}
                          value={subFieldValue}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            // Update entry inline with proper cloning
                            const newEntries = groupEntries.map((ent, idx) => {
                              if (idx === entryIndex) {
                                return {
                                  ...ent,
                                  [actualFieldName]: newValue
                                };
                              }
                              return { ...ent };
                            });
                            onFieldChange(fieldId, newEntries);
                          }}
                          required={subField.required}
                          className={`w-full px-3 py-2 rounded-lg border focus:border-[#0ECCEE] focus:outline-none text-sm ${isDark ? 'bg-[#1D1E20] border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                // Add entry inline with proper field names
                const newEntry = {};
                field.subFields?.forEach((subField, subIndex) => {
                  const actualFieldName = subField.fieldName || subField.label?.replace(/\s+/g, '_').toLowerCase() || `subfield_${subIndex}`;
                  newEntry[actualFieldName] = '';
                });
                onFieldChange(fieldId, [...groupEntries, newEntry]);
              }}
              className={`w-full py-2 px-4 border-2 border-dashed hover:border-[#0ECCEE] rounded-lg hover:text-[#0ECCEE] transition-colors text-sm flex items-center justify-center gap-2 ${isDark ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}
            >
              <span>+</span> Add {field.label || 'Entry'}
            </button>
            {field.required && groupEntries.length === 0 && (
              <p className="text-xs text-yellow-400">At least one entry is required</p>
            )}
          </div>
        );
      }

      case 'category_competition_selector': {
        // Cascading selector: first select category, then competition from that category
        const currentValue = typeof value === 'object' ? value : { category: '', competition: '' };
        
        // Use manually defined categoryOptions from the field configuration
        const categoryOptions = field.categoryOptions || [];
        
        const selectedCategory = currentValue.category || '';
        const selectedCategoryData = categoryOptions.find(cat => cat.categoryName === selectedCategory);
        const competitionsInCategory = selectedCategoryData?.competitions || [];
        
        return (
          <div className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Select Category
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <select
                id={`${fieldId}-category`}
                name={`${fieldId}-category`}
                value={selectedCategory}
                onChange={(e) => {
                  // When category changes, reset competition selection
                  onFieldChange(fieldId, { category: e.target.value, competition: '' });
                }}
                required={field.required}
                className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
              >
                <option value="">-- Select a Category --</option>
                {categoryOptions.map((cat, index) => (
                  <option key={index} value={cat.categoryName}>
                    {cat.categoryName} ({cat.competitions?.length || 0})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Competition Selection - only show if category is selected */}
            {selectedCategory && competitionsInCategory.length > 0 && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Competition
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <select
                  id={`${fieldId}-competition`}
                  name={`${fieldId}-competition`}
                  value={currentValue.competition || ''}
                  onChange={(e) => {
                    onFieldChange(fieldId, { ...currentValue, competition: e.target.value });
                  }}
                  required={field.required}
                  className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
                >
                  <option value="">-- Select a Competition --</option>
                  {competitionsInCategory.map((comp, index) => (
                    <option key={index} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {selectedCategory && competitionsInCategory.length === 0 && (
              <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                No competitions available in this category.
              </p>
            )}
            
            {categoryOptions.length === 0 && (
              <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                No categories configured. Please contact the administrator.
              </p>
            )}
          </div>
        );
      }
      
      default:
        return (
          <input
            type="text"
            id={fieldId}
            name={fieldId}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
          />
        );
    }
  };



  const fetchFestDetails = async () => {
    try {
      console.log('📡 Fetching fest details for:', festId);
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`${API_BASE_URL}/fests/${festId}/public?_cb=${cacheBuster}`, {
        credentials: 'omit', // ✅ iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const data = await response.json();
      
      // If the fest has a feeAmount, skip mode validation — payment replaces the form
      if (!data.feeAmount || data.feeAmount <= 0) {
        if (data.registration?.mode !== 'INTERNAL_FORM') {
          console.error('❌ Invalid registration mode:', data.registration?.mode);
          setError(`Registration is not available. Mode: ${data.registration?.mode || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      }

      setFest(data);

      console.log('🔍 DEBUG - Fest registration data loaded:', {
        mode: data.registration?.mode,
        formType: data.registration?.formType,
        formSchemaLength: data.registration?.formSchema?.length,
        stepsLength: data.registration?.steps?.length,
        steps: data.registration?.steps?.map(step => ({
          stepNumber: step.stepNumber,
          stepTitle: step.stepTitle,
          fieldsCount: step.fields?.length
        })),
        fullStepsData: data.registration?.steps
      });

      // Initialize form data with empty values using stable field IDs
      const initialData = {};
      if (data.registration?.formSchema) {
        data.registration.formSchema.forEach(field => {
          const fieldId = generateFieldId(field);
          console.log('🔧 Initializing field:', { fieldId, type: field.type, label: field.label });
          // Initialize fields based on type
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else if (field.type === 'checkbox') {
            initialData[fieldId] = [];
          } else if (field.type === 'category_competition_selector') {
            initialData[fieldId] = { category: '', competition: '' };
          } else if (field.type === 'group') {
            initialData[fieldId] = [];
          } else {
            initialData[fieldId] = '';
          }
        });
      }
      setFormData(initialData);
      restoreRegistrationDraft();
      console.log('✅ Form initialized with', Object.keys(initialData).length, 'fields');
    } catch (err) {
      console.error('❌ Error fetching fest details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionAndFestDetails = async () => {
    try {
      console.log('📡 Fetching competition and fest details...', { competitionId, festId });
      
      // Fetch competition details first
      const competitionResponse = await fetch(`${API_BASE_URL}/fests/competitions/${competitionId}/public`, {
        credentials: 'omit', // ✅ iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      if (!competitionResponse.ok) {
        throw new Error('Failed to fetch competition details');
      }
      const competitionData = await competitionResponse.json();
      console.log('✅ Competition data received:', {
        name: competitionData.name,
        registrationType: competitionData.registrationType,
        festId: competitionData.fest?._id
      });
      setCompetition(competitionData);

      // Fetch fest details
      const cacheBuster = Date.now();
      const festResponse = await fetch(`${API_BASE_URL}/fests/${festId}/public?_cb=${cacheBuster}`, {
        credentials: 'omit', // ✅ iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      if (!festResponse.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const festData = await festResponse.json();
      
      // ✅ CRITICAL: Validate registration mode for competition registration
      if (competitionData.registrationType === 'fest') {
        // Competition uses fest registration - check fest mode
        if (festData.registration?.mode !== 'INTERNAL_FORM') {
          console.error('❌ Fest registration mode invalid for competition:', festData.registration?.mode);
          setError(`Competition registration is not available. Fest mode: ${festData.registration?.mode || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      } else if (competitionData.registrationType === 'custom') {
        // Competition has its own registration - check competition mode
        if (competitionData.registration?.status !== 'internal_form') {
          console.error('❌ Competition registration status invalid:', competitionData.registration?.status);
          setError(`Competition registration is not available. Status: ${competitionData.registration?.status || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      }
      
      setFest(festData);
      console.log('🔍 DEBUG - Competition fest registration data loaded:', {
        mode: festData.registration?.mode,
        formType: festData.registration?.formType,
        formSchemaLength: festData.registration?.formSchema?.length,
        stepsLength: festData.registration?.steps?.length,
        steps: festData.registration?.steps?.map(step => ({
          stepNumber: step.stepNumber,
          stepTitle: step.stepTitle,
          fieldsCount: step.fields?.length
        }))
      });

      // Initialize form data with empty values using stable field IDs
      const initialData = {};
      if (festData.registration?.formSchema) {
        festData.registration.formSchema.forEach(field => {
          const fieldId = generateFieldId(field);
          console.log('🔧 Initializing field:', { fieldId, type: field.type, label: field.label });
          // Initialize fields based on type
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else if (field.type === 'checkbox') {
            initialData[fieldId] = [];
          } else if (field.type === 'category_competition_selector') {
            initialData[fieldId] = { category: '', competition: '' };
          } else if (field.type === 'group') {
            initialData[fieldId] = [];
          } else {
            initialData[fieldId] = '';
          }
        });
      }
      setFormData(initialData);
      restoreRegistrationDraft();
      console.log('✅ Form initialized with', Object.keys(initialData).length, 'fields');
    } catch (err) {
      console.error('❌ Error fetching competition/fest details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file, fieldId) => {
    if (!file) {
      setError('No file selected. Please upload a file.');
      return;
    }

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

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Allowed types: JPEG, PNG, GIF, PDF');
        return;
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

      console.log('✅ File validated:', {
        name: processedFile.name,
        size: `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`,
        type: processedFile.type,
        fieldId: fieldId
      });

      // ✅ PERFORMANCE FIX: Store file immediately without uploading
      // Upload will happen during form submission to avoid blocking UI
      const fileInfo = { 
        uploaded: true, 
        fileName: processedFile.name,
        fileSize: processedFile.size,
        fileType: processedFile.type,
        ready: true // Mark as ready for submission
      };
      
      if (isMultiStepForm()) {
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

  const handleSubmit = async (e, options = {}) => {
    e?.preventDefault?.();
    const {
      paidResume = false,
      verifiedPaymentOverride = null,
      draft = null,
    } = options;
    const formSubmissionStartTime = Date.now(); // Track submission time for error reporting
    console.log('🚀 Starting form submission...');
    console.log('🔍 DEBUG - Form submission state:', {
      isMultiStep: isMultiStepForm(),
      currentStep,
      totalSteps: getTotalSteps(),
      isNotFinalStep: currentStep < getTotalSteps(),
      submitting
    });
    
    // ✅ PERFORMANCE: Prevent double submission
    if (submitting) {
      console.log('⚠️ Submission already in progress, ignoring duplicate request');
      return;
    }
    
    // Validate only current step's required fields for multi-step forms
    if (!paidResume && isMultiStepForm()) {
      const currentFields = getCurrentStepFields();
      const currentData = getCurrentStepData();
      for (const field of currentFields) {
        if (field.required) {
          const fieldId = generateFieldId(field);
          const value = currentData[fieldId];
          if (field.type === 'file' || field.type === 'image') {
            if (!value || !value.ready || !formData[`${fieldId}_file`]) {
              setError(`${field.label} is required - please upload a file`);
              return;
            }
          } else if (field.type === 'category_competition_selector') {
            if (!value || typeof value !== 'object' || !value.category || !value.competition) {
              setError(`${field.label} is required - please select both category and competition`);
              return;
            }
          } else if (field.type === 'group') {
            if (!value || !Array.isArray(value) || value.length === 0) {
              setError(`${field.label} is required - please add at least one entry`);
              return;
            }
          } else if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
            setError(`${field.label} is required`);
            return;
          }
        }
      }
    } else if (!paidResume) {
      // Single-step form: validate all required fields
      const allFormData = draft ? buildFormDataFromDraft(draft) : getAllFormData();
      const formSchema = fest.registration?.formSchema || [];
      const requiredFields = formSchema.filter(field => field.required);
      for (const field of requiredFields) {
        const fieldId = generateFieldId(field);
        const value = allFormData[fieldId];
        if (field.type === 'file' || field.type === 'image') {
          if (!value || !value.ready || !formData[`${fieldId}_file`]) {
            setError(`${field.label} is required - please upload a file`);
            return;
          }
        } else if (field.type === 'category_competition_selector') {
          if (!value || typeof value !== 'object' || !value.category || !value.competition) {
            setError(`${field.label} is required - please select both category and competition`);
            return;
          }
        } else if (field.type === 'group') {
          if (!value || !Array.isArray(value) || value.length === 0) {
            setError(`${field.label} is required - please add at least one entry`);
            return;
          }
        } else if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
          setError(`${field.label} is required`);
          return;
        }
      }
    }

    // ✅ NEW: For multi-step forms, validate current step first
    if (!paidResume && isMultiStepForm() && currentStep < getTotalSteps()) {
      console.log('📝 Multi-step form: Moving to next step instead of submitting');
      // This is not the final step, just go to next step
      handleStepNext();
      return;
    }
    
    console.log('📤 Final step reached, proceeding with actual submission');
    // ✅ NEW: Final validation for multi-step forms
    if (!paidResume && isMultiStepForm() && !validateCurrentStep()) {
      return;
    }

    console.log('✅ All required fields validated');
    
    setSubmitting(true);
    setError('');

    try {
      setSubmissionProgress('Validating authentication...');
      // ✅ FIX: Use authToken from context FIRST, fallback to localStorage
      const token = resolveAuthToken(authToken);
      const user = localStorage.getItem('crwdctrl_user');

      const allFormData = draft ? buildFormDataFromDraft(draft) : getAllFormData();

      console.log('🔑 Auth check for submission:', {
        hasToken: !!token,
        hasUser: !!user,
        tokenLength: token?.length,
      });

      if (!token) {
        clearStoredAuthSession();
        setShowLogin(true);
        throw new Error('Your session has expired. Please log in again to continue.');
      }

      setSubmissionProgress('Checking registration availability...');
      // ✅ CRITICAL: Double-check registration mode before submission
      console.log('🔍 Final registration mode check:', {
        festRegistrationMode: fest.registration?.mode,
        isCompetitionRegistration,
        competitionRegistrationType: competition?.registrationType
      });

      if (!isCompetitionRegistration && fest.registration?.mode !== 'INTERNAL_FORM') {
        throw new Error(`Registration is not available. Current mode: ${fest.registration?.mode}`);
      }

      if (isCompetitionRegistration) {
        if (competition?.registrationType === 'fest' && fest.registration?.mode !== 'INTERNAL_FORM') {
          throw new Error(`Competition registration is not available. Fest mode: ${fest.registration?.mode}`);
        }
        if (competition?.registrationType === 'custom' && competition?.registration?.status !== 'internal_form') {
          throw new Error(`Competition registration is not available. Status: ${competition?.registration?.status}`);
        }
      }

      setSubmissionProgress('Validating form fields...');
      // ✅ NEW: Get all form data (single-step or combined multi-step)
      // allFormData already obtained at line 841 for single-step or will be obtained below
      
      console.log('🔍 Form validation starting:', {
        isMultiStep: isMultiStepForm(),
        currentStep,
        allFormDataKeys: Object.keys(allFormData),
        fileKeys: Object.keys(allFormData).filter(key => key.includes('_file'))
      });
      
      // ✅ PERFORMANCE: Validate required fields with better field matching
      const formSchema = isMultiStepForm() 
        ? fest.registration.steps.flatMap(step => step.fields)
        : fest.registration?.formSchema || [];
      const requiredFields = formSchema.filter(field => field.required);
      
      console.log('🔍 Form schema fields:', formSchema.map(field => ({
        id: field.id,
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        generatedId: generateFieldId(field)
      })));
      
      console.log('🔍 Validating', requiredFields.length, 'required fields...');
      
      for (const field of requiredFields) {
        const fieldId = generateFieldId(field);
        const value = allFormData[fieldId];
        
        console.log('🔍 Checking field:', { 
          fieldId, 
          label: field.label, 
          type: field.type, 
          hasValue: !!value,
          valueType: typeof value,
          hasFileData: !!(field.type === 'file' || field.type === 'image') && !!allFormData[`${fieldId}_file`],
          isReady: value?.ready,
          fieldValue: value,
          fileKey: `${fieldId}_file`,
          fileData: allFormData[`${fieldId}_file`],
          allFormDataKeys: Object.keys(allFormData).filter(key => key.includes(fieldId))
        });
        
        // For file/image fields, check if file was selected and is ready
        if (field.type === 'file' || field.type === 'image') {
          if (paidResume) continue;
          console.log('🔍 File field validation:', {
            fieldId,
            label: field.label,
            hasValue: !!value,
            valueReady: value?.ready,
            hasFileData: !!allFormData[`${fieldId}_file`],
            fileDataType: typeof allFormData[`${fieldId}_file`]
          });
          
          if (!value || !value.ready || !allFormData[`${fieldId}_file`]) {
            console.error('❌ File validation failed:', {
              fieldId,
              label: field.label,
              value,
              fileData: allFormData[`${fieldId}_file`],
              allFormDataKeys: Object.keys(allFormData)
            });
            throw new Error(`${field.label} is required - please upload a file`);
          }
        } else if (field.type === 'category_competition_selector') {
          // For category_competition_selector, check both category AND competition are selected
          if (!value || typeof value !== 'object' || !value.category || !value.competition) {
            throw new Error(`${field.label} is required - please select both category and competition`);
          }
        } else if (field.type === 'group') {
          // For group fields, check if at least one entry exists
          if (!value || !Array.isArray(value) || value.length === 0) {
            throw new Error(`${field.label} is required - please add at least one entry`);
          }
        } else {
          // For other fields, check if value exists and is not empty
          if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
            throw new Error(`${field.label} is required`);
          }
        }
      }

      console.log('✅ All required fields validated');

      // Cashfree: open checkout if competition/fest has a fee and payment not yet done
      const effectiveFeeAmount = priceBreakdown?.ticketPrice || (isCompetitionRegistration ? (parseTicketPrice(competition?.feeAmount) || parseTicketPrice(competition?.registrationFee)) : (fest.feeAmount || 0));
      let verifiedPaymentFields = verifiedPaymentOverride || paymentFields;
      if (effectiveFeeAmount > 0 && !verifiedPaymentFields && !paidResume) {
        setSubmissionProgress('Opening payment gateway...');

        const orderNotes = isCompetitionRegistration ? { competitionId } : { festId };
        const orderRes = await fetch(`${API_BASE_URL}/payment/order`, {
          method: 'POST',
          headers: getBearerAuthHeaders(authToken),
          body: JSON.stringify(orderNotes),
        });
        if (orderRes.status === 401) {
          clearStoredAuthSession();
          setShowLogin(true);
          throw new Error('Session expired. Please log in again to complete payment.');
        }
        if (!orderRes.ok) {
          const orderErr = await orderRes.json().catch(() => ({}));
          throw new Error(orderErr.message || 'Could not create payment order. Please try again.');
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
          { token },
        );
        if (!ok || !verifyData?.verified) {
          throw new Error(verifyData?.message || 'Payment verification failed. Please contact support.');
        }

        verifiedPaymentFields = buildVerifiedPaymentFields(verifyData, orderData.orderId);
        setPaymentFields(verifiedPaymentFields);
      }

      setSubmissionProgress('Preparing form data...');
      // ✅ PERFORMANCE: Prepare form data efficiently
      const submissionFormData = new FormData();
      const textResponses = {};
      let totalFileSize = 0;
      let fileCount = 0;

      // Debug: Log all available form data and files
      console.log('🔍 DEBUG - All Form Data Keys:', Object.keys(allFormData));
      console.log('🔍 DEBUG - File Keys:', Object.keys(allFormData).filter(key => key.includes('_file')));
      console.log('🔍 DEBUG - Full allFormData:', allFormData);

      // formSchema already defined above for validation purposes

      // Process form fields with consistent field naming
      console.log('🔍 PROCESSING FIELDS - Starting:', {
        formSchemaLength: formSchema.length,
        allFormDataKeys: Object.keys(allFormData),
        fileFieldsInSchema: formSchema.filter(f => f.type === 'file' || f.type === 'image').map(f => ({
          label: f.label,
          fieldId: generateFieldId(f),
          lookingFor: `${generateFieldId(f)}_file`
        }))
      });
      
      formSchema.forEach(field => {
        const fieldId = generateFieldId(field);
        const value = allFormData[fieldId];
        
        // ✅ CRITICAL: Use the same field identifier for backend consistency
        // This should match what generateFieldId returns
        const backendFieldName = generateFieldId(field);
        
        if (field.type === 'file' || field.type === 'image') {
          // Add file to FormData if it exists
          const fileData = allFormData[`${fieldId}_file`];
          
          // Debug: Check what we have
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
          } else {
            console.log('⚠️ No valid file found for field:', {
              fieldId,
              label: field.label,
              lookingForKey: `${fieldId}_file`,
              hasFileData: !!fileData,
              fileSize: fileData?.size,
              allFormDataKeys: Object.keys(allFormData),
              allFormDataFileKeys: Object.keys(allFormData).filter(k => k.includes('_file'))
            });
            
            // ✅ FALLBACK: Try to get file from DOM input element
            try {
              const fileInput = document.querySelector(`input[data-field-id="${fieldId}"]`);
              if (fileInput?.files?.length > 0) {
                const file = fileInput.files[0];
                console.log('✅ FALLBACK: Found file in DOM:', {
                  fieldId,
                  fileName: file.name,
                  fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
                });
                submissionFormData.append(backendFieldName, file);
                totalFileSize += file.size;
                fileCount++;
              }
            } catch (error) {
              console.log('ℹ️ No fallback file input found for:', fieldId, error?.message);
            }
          }
        } else {
          // Add text data to responses object using backend field name
          textResponses[backendFieldName] = value;
          console.log('📝 Added text response:', backendFieldName, typeof value === 'string' ? value.substring(0, 50) : value);
        }
      });

      // Add text responses as JSON
      submissionFormData.append('responses', JSON.stringify(textResponses));

      // Attach Cashfree payment fields if payment was made
      if (verifiedPaymentFields) {
        submissionFormData.append('payment_order_id', verifiedPaymentFields.payment_order_id);
        submissionFormData.append('payment_id', verifiedPaymentFields.payment_id);
      }

      // ✅ PERFORMANCE: Show file submission progress
      if (fileCount > 0) {
        setSubmissionProgress(`Submitting ${fileCount} file(s) (${(totalFileSize / 1024 / 1024).toFixed(2)}MB)...`);
      } else {
        setSubmissionProgress('Submitting registration...');
      }
      // ✅ PERFORMANCE: Pre-validate files before submission
      const maxTotalSize = 50 * 1024 * 1024; // 50MB total limit
      if (totalFileSize > maxTotalSize) {
        throw new Error(`Total file size (${(totalFileSize / 1024 / 1024).toFixed(2)}MB) exceeds limit of 50MB. Please reduce file sizes.`);
      }

      // ✅ PERFORMANCE: Determine endpoint and make request
      const endpoint = isCompetitionRegistration 
        ? `${API_BASE_URL}/registrations/competitions/${competitionId}/register`
        : `${API_BASE_URL}/registrations/fests/${festId}/register`;

      console.log('🌐 Making registration request to:', endpoint);
      console.log('� [DEBUG] Submission details:', {
        endpoint: endpoint,
        isCompetition: isCompetitionRegistration,
        competitionId: competitionId,
        festId: festId,
        hasCompetitionId: !!competitionId,
        competitionIdType: typeof competitionId,
        competitionIdLength: competitionId?.length,
        competitionIdValue: competitionId
      });
      console.log('�📊 Submission summary:', {
        textFields: Object.keys(textResponses).length,
        fileFields: fileCount,
        totalFileSize: `${(totalFileSize / 1024 / 1024).toFixed(2)}MB`,
        estimatedUploadTime: `${Math.ceil(totalFileSize / (1024 * 1024))}s`
      });


      // ✅ PERFORMANCE: Dynamic timeout based on file size
      // Base timeout: 90s (enough for backend file processing and response)
      // Plus additional time for file upload: 30s per MB
      // Backend will continue sending emails in background after response
      
      console.log('🔍 BEFORE TIMEOUT CALCULATION:', {
        totalFileSize: totalFileSize,
        totalFileSizeInMB: (totalFileSize / 1024 / 1024).toFixed(2),
        fileCount: fileCount,
        formSchemaLength: formSchema.length,
        allFormDataKeys: Object.keys(allFormData).length,
        allFormDataFileKeys: Object.keys(allFormData).filter(k => k.includes('_file')),
        isMultiStep: isMultiStepForm()
      });
      
      // ✅ OPTIMIZED: Backend now responds IMMEDIATELY (files upload in background)
      // Base timeout: 120s - allowing time for server processing and slow connections
      // Backend responds with registration ID immediately, files upload in background
      // File uploads happen in background on server after response is sent to user
      const baseTimeout = 120000; // 120 seconds - reasonable timeout for production stability
      const controller = new AbortController();
      
      // ✅ PERFORMANCE: Track upload progress (define BEFORE fetch so it's available in error handler)
      const startTime = Date.now();
      
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Aborting request after ${(baseTimeout / 1000).toFixed(0)}s timeout`);
        controller.abort();
      }, baseTimeout);

      console.log(`⏱️ Request timeout: ${(baseTimeout / 1000).toFixed(0)}s (backend responds immediately, files upload in background)`);

      console.log('🌐 Making fetch request to:', endpoint);
      console.log('📤 FormData size:', submissionFormData.size || 'unknown');
      
      // ✅ FIX: Ensure we have a valid token before submission
      const submitToken = token;
      if (!submitToken) {
        clearStoredAuthSession();
        setShowLogin(true);
        throw new Error('Authentication required. Please log in again to submit your registration.');
      }

      // ✅ PRODUCTION FIX: Show user that submission is in progress (don't timeout on their end)
      setSubmissionProgress('Submitting registration to server... (instant response)');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${submitToken}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: submissionFormData,
        signal: controller.signal,
        credentials: 'include', // ✅ FIX: Include cookies for production auth
        mode: 'cors', // ✅ FIX: Enable CORS for production domains
      });

      clearTimeout(timeoutId);
      const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('📡 Registration response received:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText,
        uploadTime: `${uploadTime}s`,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        let errorMessage = 'Failed to submit registration';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('❌ Backend error details:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            endpoint: endpoint,
            timestamp: new Date().toISOString()
          });
          
          // Handle specific error cases
          if (response.status === 401) {
            if (paidResume) {
              errorMessage = 'Session expired after payment. Please check My Bookings or log in again.';
            } else {
              clearStoredAuthSession();
              setShowLogin(true);
              errorMessage = 'Session expired. Please log in again.';
            }
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

      setSubmissionProgress('Processing registration...');
      const result = await response.json();
      console.log('✅ Registration successful:', result);

      setSubmissionProgress('Registration completed successfully!');
      const regId = result._id || result.registration?._id || result.registrationId;
      setRegistrationId(regId);
      setCompletingPayment(false);
      setSuccess(true);
      refreshNotifications();
      clearRegistrationDraft(draftKey);
      if (paidResume) {
        clearPendingPayment();
        setPaymentResumeError('');
        clearCashfreeReturnParams();
      }

      return { success: true, regId };

    } catch (err) {
      if (paidResume) {
        throw err;
      }
      setCompletingPayment(false);
      console.error('❌ Registration error:', err);
      console.error('❌ Error name:', err.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      
      // Handle specific error types with better user feedback
      if (err.name === 'AbortError') {
        const elapsedTime = ((Date.now() - formSubmissionStartTime) / 1000).toFixed(1);
        console.error('❌ Request was aborted/timed out after', elapsedTime, 'seconds');
        console.log('ℹ️ Registration may have been saved on the server. Checking registered events...');
        setError('Registration is taking longer than expected. Your submission may have been saved. Please check My Bookings in a moment. Contact support if needed.');
      } else if (
        err.message.includes('Authentication')
        || err.message.includes('session')
        || err.message.includes('token')
        || err.message.includes('log in')
      ) {
        if (paidResume) {
          setPaymentResumeError(err.message || 'Your session has expired. Please log in and check My Bookings.');
        } else {
          setError('Your session has expired. Please log in again.');
          clearStoredAuthSession();
          setShowLogin(true);
        }
      } else if (err.message.includes('registration') && err.message.includes('not available')) {
        setError('Registration is currently not available for this event. Please contact the organizers.');
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

  // Helper function for handling input changes (for single-step forms)
  const _handleInputChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  handleSubmitRef.current = handleSubmit;

  const hasAuth = hasUsableAuthToken(authToken);

  if (completingPayment && !success) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex flex-col items-center justify-center px-4">
        {paymentResumeError ? (
          <div className="text-center max-w-md mx-auto p-6">
            <p className={`text-sm mb-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              Payment received, but registration could not be completed.
            </p>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{paymentResumeError}</p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => goToBookings(navigate)}
                className="w-full px-6 py-3 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
              >
                View My Bookings
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompletingPayment(false);
                  setPaymentResumeError('');
                }}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                  isDark ? 'border border-gray-600 text-gray-200 hover:bg-gray-800' : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                }`}
              >
                Return to form
              </button>
            </div>
          </div>
        ) : (
          <>
            <Loader className="w-8 h-8 animate-spin text-[#0ECCEE] mb-4" />
            <p className={`text-sm text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {submissionProgress || 'Completing your registration...'}
            </p>
          </>
        )}
      </div>
    );
  }

  if (success) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🎉 Registration Successful!</h1>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Your registration for <span className="text-[#0ECCEE] font-semibold">
              {isCompetitionRegistration ? competition?.name : fest?.festName}
            </span> has been submitted successfully.
          </p>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Download your ticket or view all bookings whenever you&apos;re ready.
          </p>
          <div className="flex flex-col gap-3">
            {registrationId && (
              <button
                type="button"
                onClick={() => navigate(`/qr-ticket/${registrationId}`, { state: { refreshBookings: true } })}
                className="w-full px-6 py-3 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
              >
                Download Ticket
              </button>
            )}
            <button
              type="button"
              onClick={() => goToBookings(navigate)}
              className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                registrationId
                  ? isDark
                    ? 'border border-gray-600 text-gray-200 hover:bg-gray-800'
                    : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                  : 'bg-[#0ECCEE] text-black hover:bg-[#0ECCEE]/80'
              }`}
            >
              View My Bookings
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`w-full py-2 text-sm font-medium ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasStoredSession = hasUsableAuthToken(authToken);
  const waitingOnAuth = !hasStoredSession && (
    authLoading || isAuthProcessing || isRedirectProcessing || (!!firebaseUser && !authSyncExpired)
  );

  if ((loading || waitingOnAuth) && !success && !completingPayment) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-[#0ECCEE]" />
      </div>
    );
  }

  if (!hasAuth) {
    return (
      <>
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
          <div className={`w-full max-w-md rounded-2xl p-8 text-center shadow-xl ${isDark ? 'bg-[#1D1E20]' : 'bg-white'}`}>
            <h1 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Log in to register</h1>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Please log in to register for this fest and receive booking notifications.
            </p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="w-full py-3 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
            >
              Log in to continue
            </button>
          </div>
        </div>
        {showLogin && (
          <div className="fixed inset-0 z-50">
            <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
          </div>
        )}
        {showRegister && (
          <div className="fixed inset-0 z-50">
            <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
          </div>
        )}
      </>
    );
  }

  // ─── CASHFREE DIRECT PAYMENT: if fest has a feeAmount, bypass the form ───
  const handleCashfreeFestRegister = async () => {
    setPaymentLoading(true);
    setCompletingPayment(true);
    setPaymentError('');
    try {
      const token = resolveAuthToken(authToken);
      if (!token) {
        clearStoredAuthSession();
        setShowLogin(true);
        throw new Error('Please log in to continue with payment.');
      }
      const orderRes = await fetch(`${API_BASE_URL}/payment/order`, {
        method: 'POST',
        headers: getBearerAuthHeaders(authToken),
        body: JSON.stringify({ festId }),
      });
      if (orderRes.status === 401) {
        clearStoredAuthSession();
        setShowLogin(true);
        throw new Error('Session expired. Please log in again.');
      }
      if (!orderRes.ok) {
        const orderErr = await orderRes.json().catch(() => ({}));
        throw new Error(orderErr.message || 'Could not create payment order. Please try again.');
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
        setPaymentLoading(false);
        setCompletingPayment(false);
        setSubmissionProgress('');
        if (kind !== 'cancelled') {
          retryCheckoutRef.current = () => handleCashfreeFestRegister();
          setPaymentModal({ open: true, message, orderId: orderData.orderId });
        }
        return;
      }

      if (checkoutResult?.redirectDeferred) {
        setPaymentLoading(false);
        setCompletingPayment(true);
        setSubmissionProgress('Complete payment in the gateway. You will return here automatically.');
        return;
      }

      setCompletingPayment(true);
      setSubmissionProgress('Confirming payment and registering...');

      const regRes = await fetch(`${API_BASE_URL}/registrations/fests/${festId}/pay-and-register`, {
        method: 'POST',
        headers: getBearerAuthHeaders(authToken),
        body: JSON.stringify({ payment_order_id: orderData.orderId }),
      });
      if (!regRes.ok) {
        const errData = await regRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Registration failed after payment. Please contact support.');
      }

      const regData = await regRes.json().catch(() => ({}));
      const regId = regData._id || regData.registration?._id || regData.registrationId;
      setRegistrationId(regId);
      setCompletingPayment(false);
      setSuccess(true);
      refreshNotifications();
      clearRegistrationDraft(draftKey);
    } catch (err) {
      setCompletingPayment(false);
      if (err.message !== 'Payment cancelled') {
        setPaymentError(err.message || 'Payment failed. Please try again.');
        setTimeout(() => setPaymentError(''), 5000);
      }
    } finally {
      setPaymentLoading(false);
      setSubmissionProgress('');
    }
  };

  const closePaymentModal = () => setPaymentModal({ open: false, message: '', orderId: '' });
  const paymentModalEl = (
    <PaymentErrorModal
      open={paymentModal.open}
      message={paymentModal.message}
      orderId={paymentModal.orderId}
      onClose={closePaymentModal}
      onRetry={() => {
        closePaymentModal();
        retryCheckoutRef.current?.();
      }}
    />
  );

  // Show Cashfree payment UI when fest has a feeAmount (only for fest-only registrations, not competition registrations)
  if (fest && !isCompetitionRegistration && fest.feeAmount > 0 && !success) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        {paymentModalEl}
        <div className={`w-full max-w-md rounded-2xl p-8 text-center shadow-xl ${isDark ? 'bg-[#1D1E20]' : 'bg-white'}`}>
          <div className="mb-6">
            {fest.coverImage && (
              <img src={fest.coverImage} alt={fest.festName} className="w-24 h-24 object-cover rounded-full mx-auto mb-4" />
            )}
            <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{fest.festName}</h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fest.collegeName}</p>
          </div>

          <div className={`rounded-xl p-5 mb-6 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
            <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Payment Breakdown</p>
            {priceBreakdown && (
              <div className={`space-y-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className="flex justify-between gap-4">
                  <span>Ticket Price</span>
                  <span>₹{priceBreakdown.ticketPrice}</span>
                </div>
                <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span>Platform Fee</span>
                  <span>₹{priceBreakdown.platformFee}</span>
                </div>
                <div className="flex justify-between gap-4 pt-2.5 mt-1 border-t border-gray-700 font-bold text-base text-[#0ECCEE]">
                  <span>Amount Payable</span>
                  <span>₹{priceBreakdown.totalAmount}</span>
                </div>
              </div>
            )}
            <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Includes all charges · Secure payment via Cashfree</p>
          </div>

          {competition && (
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Registering for: <span className="font-semibold">{competition.name}</span>
            </p>
          )}

          {paymentError && (
            <p className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800 rounded-lg p-2">{paymentError}</p>
          )}

          <button
            onClick={handleCashfreeFestRegister}
            disabled={paymentLoading || !priceBreakdown}
            className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {paymentLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Processing Payment...
              </>
            ) : !priceBreakdown ? (
              'Calculating Amount...'
            ) : (
              `Pay ₹${Number(priceBreakdown.totalAmount).toLocaleString('en-IN')} & Book`
            )}
          </button>

          <button
            onClick={() => navigate(-1)}
            className={`w-full mt-3 py-2.5 rounded-xl text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'} transition`}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!fest) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Fest Not Found</h1>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>The requested fest could not be found or may have been removed.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ✅ CRITICAL: Better registration mode validation with detailed error messages
  if (!isCompetitionRegistration && fest.registration?.mode !== 'INTERNAL_FORM') {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Registration Not Available</h1>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            This fest does not accept internal form registrations.
          </p>
          <div className={`rounded-lg p-4 mb-6 border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}`}>
            <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              Current registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              Expected mode: <span className="font-mono">INTERNAL_FORM</span>
            </p>
          </div>
          {fest.registration?.mode === 'EXTERNAL_LINK' && fest.registration?.externalLink && (
            <div className="mb-6">
              <p className={`mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Registration is available via external link:</p>
              <a
                href={fest.registration.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                Register Externally
              </a>
            </div>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ✅ CRITICAL: Competition registration mode validation
  if (isCompetitionRegistration) {
    if (competition?.registrationType === 'fest' && fest.registration?.mode !== 'INTERNAL_FORM') {
      return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Competition Registration Not Available</h1>
            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              This competition uses fest registration, but the fest does not accept internal form registrations.
            </p>
            <div className={`rounded-lg p-4 mb-6 border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}`}>
              <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Fest registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Expected mode: <span className="font-mono">INTERNAL_FORM</span>
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    
    if (competition?.registrationType === 'custom' && competition?.registration?.status !== 'internal_form') {
      return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Competition Registration Not Available</h1>
            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              This competition has custom registration, but internal form registration is not enabled.
            </p>
            <div className={`rounded-lg p-4 mb-6 border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}`}>
              <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Competition registration status: <span className="font-mono">{competition?.registration?.status || 'NOT_SET'}</span>
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Expected status: <span className="font-mono">internal_form</span>
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
  }



  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:pt-[calc(env(safe-area-inset-top)+1rem)] pb-40 sm:pb-32 md:pb-20">
      {paymentModalEl}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className={`p-2 rounded-lg transition-colors shrink-0 mt-1 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
          >
            <ArrowLeft className={`w-5 h-5 sm:w-6 sm:h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Register for {isCompetitionRegistration ? competition?.name : fest.festName}
            </h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {isCompetitionRegistration 
                ? `${competition?.name} - ${fest.festName} (${fest.collegeName})`
                : fest.collegeName
              }
            </p>
          </div>
        </div>

        {notice && (
          <div className={`rounded-lg p-3 mb-4 text-sm border ${isDark ? 'bg-green-900/20 border-green-700 text-green-400' : 'bg-green-50 border-green-300 text-green-700'}`}>
            {notice}
          </div>
        )}
        {error && (
          <div className={`rounded-lg p-3 mb-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
            {error}
          </div>
        )}



        {/* Registration Form */}
        <div className={`rounded-2xl p-4 sm:p-6 border ${isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ✅ NEW: Multi-Step Progress Indicator */}
            {isMultiStepForm() && (
              <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</h3>
                  <div className="text-right">
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {currentStep} of {getTotalSteps()}</span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div 
                    className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / getTotalSteps()) * 100}%` }}
                  ></div>
                </div>
                
                {/* Step Indicators */}
                <div className="flex justify-between">
                  {/* Regular form steps */}
                  {fest.registration.steps.map((step) => (
                    <div key={step.stepNumber} className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        step.stepNumber === currentStep 
                          ? 'bg-[#0ECCEE] text-black' 
                          : completedSteps.has(step.stepNumber)
                            ? 'bg-green-600 text-white'
                            : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {completedSteps.has(step.stepNumber) ? '✓' : step.stepNumber}
                      </div>
                      <span className={`text-xs mt-1 text-center max-w-16 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {step.stepTitle}
                      </span>
                    </div>
                  ))}
                  
                </div>
              </div>
            )}

            {/* ✅ NEW: Current Step Title and Description */}
            {isMultiStepForm() && (
              <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                {/* Step title and description */}
                {currentStep <= fest.registration.steps.length ? (
                  // Regular form step
                  <>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepTitle}
                    </h3>
                    {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription && (
                      <p className={`text-sm mb-4 mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription}
                      </p>
                    )}
                    <div className={`border-b mb-4 ${isDark ? 'border-gray-700/70' : 'border-gray-200'}`} />
                  </>
                ) : (
                  // Payment step
                  <>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Payment
                    </h3>
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Complete your payment to finalize your registration
                    </p>
                  </>
                )}
                
                {/* Current Step Fields - Only show if not payment step */}
                {currentStep <= fest.registration.steps.length && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {(() => {
                      const currentFields = getCurrentStepFields();
                      console.log('🔍 Current step fields:', currentFields);
                      console.log('🔍 Current step:', currentStep);
                      console.log('🔍 Total steps:', getTotalSteps());
                      
                      return currentFields.map((field) => {
                      const fieldId = generateFieldId(field);
                      const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image' || 
                                         field.type === 'checkbox' || field.type === 'radio';
                      
                      return (
                        <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                          {renderFormField(field, fieldId, getCurrentStepData(), handleStepFieldChange)}
                        </div>
                      );
                    });
                  })()}
                  </div>
                )}
              </div>
            )}

            {/* ✅ EXISTING: Single Step Form Fields */}
            {!isMultiStepForm() && (
              <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 pb-2.5 border-b ${isDark ? 'text-gray-400 border-gray-700/70' : 'text-gray-500 border-gray-200'}`}>Registration Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {(() => {
                    const formFields = fest.registration.formSchema;
                    
                    return formFields.map((field) => {
                      const fieldId = generateFieldId(field);
                      const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image' || 
                                         field.type === 'checkbox' || field.type === 'radio';
                      
                      return (
                        <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                          {renderFormField(field, fieldId, formData, (fieldId, value) => setFormData(prev => ({ ...prev, [fieldId]: value })))}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Fee box — shown before payment */}
            {!paymentFields && (() => {
              if (!priceBreakdown) return null;
              return (
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#111213] border-[#0ECCEE]/30' : 'bg-gray-50 border-[#0ECCEE]/40'}`}>
                  <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Breakdown</p>
                  <div className={`space-y-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="flex justify-between gap-4">
                      <span>Ticket Price</span>
                      <span>₹{priceBreakdown.ticketPrice}</span>
                    </div>
                    <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>Platform Fee</span>
                      <span>₹{priceBreakdown.platformFee}</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-2.5 mt-1 border-t border-gray-700 font-bold text-base text-[#0ECCEE]">
                      <span>Amount Payable</span>
                      <span>₹{priceBreakdown.totalAmount}</span>
                    </div>
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Includes all charges · Secure payment via Cashfree</p>
                </div>
              );
            })()}

            {/* Payment confirmed notice — shown after Cashfree payment is verified */}
            {paymentFields && (
              <div className={`rounded-xl p-3 border flex items-center gap-3 ${isDark ? 'bg-green-900/15 border-green-700/40' : 'bg-green-50 border-green-300'}`}>
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-400">Payment Confirmed</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tap Confirm Booking to finish.</p>
                </div>
              </div>
            )}

            {/* ✅ NEW: Multi-Step Form Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 pb-44 md:pb-32">
              {/* Back Button */}
              <button
                type="button"
                onClick={isMultiStepForm() && currentStep > 1 ? handleStepBack : () => navigate(-1)}
                className={`px-4 sm:px-6 py-3 rounded-xl border font-medium transition-colors text-sm sm:text-base ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}
                disabled={submitting}
              >
                {isMultiStepForm() && currentStep > 1 ? 'Previous Step' : 'Cancel'}
              </button>

              {/* Next/Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#0ECCEE]/10"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span className="hidden sm:inline">{submissionProgress || 'Processing...'}</span>
                    <span className="sm:hidden">Processing...</span>
                    
                    {/* Progress indicator */}
                    {submissionProgress && (
                      <div className="w-full mt-2">
                        <div className={`rounded-full h-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          <div 
                            className="bg-[#0ECCEE] h-1.5 rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: submissionProgress.includes('Validating') ? '20%' :
                                     submissionProgress.includes('Preparing') ? '40%' :
                                     submissionProgress.includes('Submitting') ? '70%' :
                                     submissionProgress.includes('Processing') ? '90%' :
                                     submissionProgress.includes('completed') ? '100%' : '10%'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (() => {
                  if (isMultiStepForm() && currentStep < getTotalSteps()) {
                    return 'Next Step';
                  }
                  // Final step
                  if (priceBreakdown && !paymentFields) {
                    return `Pay ₹${Number(priceBreakdown.totalAmount).toLocaleString('en-IN')} & Book`;
                  }
                  return 'Confirm Booking';
                })()}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showLogin && (
        <div className="fixed inset-0 z-50">
          <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
        </div>
      )}

      {showRegister && (
        <div className="fixed inset-0 z-50">
          <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
        </div>
      )}
    </div>
  );
}
