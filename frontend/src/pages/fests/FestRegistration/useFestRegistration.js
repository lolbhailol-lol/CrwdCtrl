import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useNotifications } from '../../../context/NotificationsContext';
import { openCashfreeCheckout, buildVerifiedPaymentFields, classifyCheckoutError } from '../../../utils/useCashfree';
import {
  getPendingPayment,
  clearPendingPayment,
  isTrekPaymentPending,
  shouldResumePendingPayment,
} from '../../../utils/deepLinks';
import {
  verifyPaymentWithRetry,
  classifyVerifyError,
  clearCashfreeReturnAndPending,
} from '../../../utils/paymentNavigation';
import {
  clearRegistrationDraft,
  festRegDraftKey,
  loadRegistrationDraft,
  saveRegistrationDraft,
  applyRegistrationDraft,
  saveFestRegistrationSuccess,
} from '../../../utils/registrationDraft';
import { useRegistrationSuccessPopup } from '../../../hooks/useSuccessPopup';
import { finalizeCompetitionAfterPayment } from '../../../utils/competitionPaymentComplete';
import {
  clearStoredAuthSession,
  getBearerAuthHeaders,
  hasUsableAuthToken,
  resolveAuthToken,
} from '../../../utils/authToken';
import { parseTicketPrice } from '../../../utils/platformFee';
import { fetchPaymentQuote as fetchPaymentQuoteApi } from '../../../services/api/payment.api';
import { requiresTeamRosterGate, getRosterBounds, needsParticipantCountStep } from '../../../utils/teamSize';
import {
  teamMemberMissingLabel,
  normalizeTeamMember,
  getPersonFields,
  isMindSparkFest,
} from '../../../features/fests/mindspark';
import { waitAtLeast, sleep } from '../../../components/RegistrationStatusVisual';
import { API_BASE_URL } from '../../../services/api/client';
import { festRegisterPath } from '../../../utils/slugRoutes';
import { loadRegistrationPrefetch, saveRegistrationPrefetch } from '../../../utils/festPublicTransform';
import { getInitialFestRegistrationUi, generateFieldId, compressImage, buildInitialFormData, mergeFormDataWithSchema } from './helpers';

export default function useFestRegistration() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const paymentResumeRef = useRef(false);
  const competitionPaymentResumeRef = useRef(false);
  const handleSubmitRef = useRef(null);
  const competitionId = searchParams.get('competition') || location.state?.competitionId || null;
  const storedPrefetch = festId ? loadRegistrationPrefetch(festId, competitionId) : null;
  const registrationPrefetch = location.state?.prefetch ?? storedPrefetch ?? null;
  const initialUi = getInitialFestRegistrationUi(location.pathname, location.search, location.state, {
    festId,
    competitionId,
  });
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
  
  const [fest, setFest] = useState(() => registrationPrefetch?.fest ?? null);
  const [competition, setCompetition] = useState(() => registrationPrefetch?.competition ?? null);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [formData, setFormData] = useState(() =>
    registrationPrefetch?.fest?.registration
      ? buildInitialFormData(registrationPrefetch.fest.registration)
      : {},
  );
  const [loading, setLoading] = useState(() => !registrationPrefetch?.fest);
  const [submitting, setSubmitting] = useState(false);
  const [processOverlayMode, setProcessOverlayMode] = useState('server'); // server | payment | success | error
  const processUiStartedAt = useRef(0);
  const [submissionProgress, setSubmissionProgress] = useState('');
  const [error, setError] = useState('');
  const [notice] = useState('');
  const [success, setSuccess] = useState(() => Boolean(initialUi.success));
  const [completingPayment, setCompletingPayment] = useState(initialUi.completingPayment);
  const [registrationId, setRegistrationId] = useState(() => initialUi.registrationId || null);
  const [uploadingFiles, setUploadingFiles] = useState({});
  // Cashfree verified payment fields
  const [paymentFields, setPaymentFields] = useState(null);
  // ? NEW: Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [stepData, setStepData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  // Cashfree direct payment state
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });
  const retryCheckoutRef = useRef(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponQuoting, setCouponQuoting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  // True once we've waited long enough for Firebase -> backend JWT sync to finish
  const [authSyncExpired, setAuthSyncExpired] = useState(false);
  const [paymentResumeError, setPaymentResumeError] = useState('');
  const [paymentResumeOrderId, setPaymentResumeOrderId] = useState('');
  const [paymentResumeWasPaid, setPaymentResumeWasPaid] = useState(false);

  useEffect(() => {
    if (location.state?.prefetch && festId) {
      saveRegistrationPrefetch(festId, competitionId, location.state.prefetch);
    }
  }, [location.state?.prefetch, festId, competitionId]);

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

  useRegistrationSuccessPopup(success && !isMindSparkFest(fest) && !isMindSparkFest(competition), {
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

  const handleCloseLogin = () => {
    if (isAuthenticated || hasUsableAuthToken(authToken)) {
      setShowLogin(false);
      return;
    }
    navigate(-1);
  };
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

  const buildOrderRegistrationDraft = () => ({
    formData: getAllFormData(),
    stepData,
    currentStep,
    festId: festId || fest?._id,
    competitionId: competitionId || competition?._id || null,
    couponCode: appliedCouponCode || '',
  });

  const handleVerifyCancelled = () => {
    restoreRegistrationDraft();
    clearCashfreeReturnAndPending(navigate, location);
    setCompletingPayment(false);
    setPaymentLoading(false);
    setPaymentResumeError('');
    setPaymentResumeWasPaid(false);
    setPaymentError('Payment cancelled.');
    window.setTimeout(() => setPaymentError(''), 5000);
  };

  const completeFestPaymentResume = async (orderIdOverride) => {
    const pending = getPendingPayment();
    const orderId = orderIdOverride || pending?.orderId;
    if (!orderId) {
      throw new Error('No pending payment found. Your booking may already be complete ? check My Bookings.');
    }

    setPaymentResumeOrderId(orderId);
    setPaymentResumeError('');
    setPaymentResumeWasPaid(false);
    setPaymentError('');
    setError('');
    setSubmissionProgress('Confirming payment?');

    const submitToken = resolveAuthToken(authToken) || localStorage.getItem('crwdctrl_token');
    if (!submitToken) {
      throw new Error('Please log in to complete your registration.');
    }

    const verifyResult = await verifyPaymentWithRetry(
      API_BASE_URL,
      orderId,
      { token: submitToken, search: location.search },
    );

    if (verifyResult.status === 'cancelled') {
      handleVerifyCancelled();
      return;
    }

    if (!verifyResult.ok || !verifyResult.verified) {
      const { kind, message } = classifyVerifyError(verifyResult);
      if (kind === 'pending' || kind === 'network') {
        throw new Error(message);
      }
      throw new Error(message);
    }

    setPaymentResumeWasPaid(true);
    setSubmissionProgress('Completing registration?');

    const regRes = await fetch(`${API_BASE_URL}/registrations/fests/${festId}/pay-and-register`, {
      method: 'POST',
      headers: getBearerAuthHeaders(authToken),
      body: JSON.stringify({ payment_order_id: orderId }),
    });
    if (!regRes.ok) {
      const errData = await regRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Registration failed after payment. Please retry or check My Bookings.');
    }

    const regData = await regRes.json().catch(() => ({}));
    const regId = regData._id || regData.registration?._id || regData.registrationId;
    if (regId) setRegistrationId(regId);
    saveFestRegistrationSuccess({
      festId: festId || fest?._id,
      festMongoId: fest?._id || fest?.id || null,
      competitionId: null,
      registrationId: regId,
    });
    setProcessOverlayMode('success');
    setSubmissionProgress("You're registered!");
    setCompletingPayment(false);
    setSuccess(true);
    clearPendingPayment();
    clearCashfreeReturnAndPending(navigate, location);
    await sleep(1000);
    refreshNotifications();
    clearRegistrationDraft(draftKey);
  };

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
    setPaymentResumeError('');
    setSubmissionProgress('Confirming payment?');

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

        await completeFestPaymentResume(pending.orderId);
      } catch (err) {
        setPaymentResumeError(err.message || 'Could not complete registration after payment.');
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

  const completeCompetitionPaymentResume = async (orderIdOverride) => {
    const pending = getPendingPayment();
    const orderId = orderIdOverride || pending?.orderId;
    if (!orderId) {
      throw new Error('No pending payment found. Your booking may already be complete ? check My Bookings.');
    }

    setPaymentResumeOrderId(orderId);
    setPaymentResumeError('');
    setPaymentResumeWasPaid(false);
    setPaymentError('');
    setError('');
    setSubmissionProgress('Confirming payment?');

    const submitToken = resolveAuthToken(authToken) || localStorage.getItem('crwdctrl_token');
    if (!submitToken) {
      throw new Error('Please log in to complete your registration.');
    }

    const verifyResult = await verifyPaymentWithRetry(
      API_BASE_URL,
      orderId,
      { token: submitToken, search: location.search },
    );

    if (verifyResult.status === 'cancelled') {
      handleVerifyCancelled();
      return;
    }

    if (!verifyResult.ok || !verifyResult.verified) {
      const { kind, message } = classifyVerifyError(verifyResult);
      throw new Error(message);
    }

    const verifyData = verifyResult.data;
    setPaymentResumeWasPaid(true);
    const verifiedFields = buildVerifiedPaymentFields(verifyData, orderId);
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
    saveFestRegistrationSuccess({
      festId: festId || fest?._id,
      festMongoId: fest?._id || fest?.id || null,
      competitionId: competitionId || competition?._id || null,
      registrationId: regId,
    });
    clearRegistrationDraft(draftKey);
    setProcessOverlayMode('success');
    setSubmissionProgress("You're registered!");
    setCompletingPayment(false);
    setSuccess(true);
    clearPendingPayment();
    clearCashfreeReturnAndPending(navigate, location);
    await sleep(1000);
    refreshNotifications();
  };

  const retryPaymentResume = async () => {
    setPaymentResumeError('');
    setSubmissionProgress('Retrying?');
    try {
      if (isCompetitionRegistration) {
        await completeCompetitionPaymentResume(paymentResumeOrderId);
      } else {
        await completeFestPaymentResume(paymentResumeOrderId);
      }
    } catch (err) {
      setPaymentResumeError(err.message || 'Could not complete registration after payment.');
      setPaymentError(err.message || 'Could not complete registration after payment.');
    } finally {
      setSubmissionProgress('');
    }
  };

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

    (async () => {
      try {
        await completeCompetitionPaymentResume(pending.orderId);
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

  // Refresh fest/competition in background (prefetch makes first paint instant)
  useEffect(() => {
    if (!festId) return;
    if (!fest) setLoading(true);
    if (isCompetitionRegistration && competitionId) {
      fetchCompetitionAndFestDetails();
    } else {
      fetchFestDetails();
    }
  }, [festId, competitionId, isCompetitionRegistration]);

  // Google login sheet when session missing; dismiss as soon as token is ready
  useEffect(() => {
    if (authLoading || isAuthProcessing || isRedirectProcessing) return;

    const currentPath = `${location.pathname}${location.search}`;
    const pendingPayment = getPendingPayment();
    const resumingPayment = pendingPayment
      && shouldResumePendingPayment(pendingPayment, currentPath, location.search);
    if (resumingPayment) return;

    const usableToken = resolveAuthToken(authToken);
    if (usableToken) {
      setShowLogin(false);
      setError((prev) => (prev === 'Please log in to register for events' ? '' : prev));
      return;
    }
    if (firebaseUser && !authSyncExpired) return;
    setShowLogin(true);
  }, [
    authLoading,
    authToken,
    firebaseUser,
    authSyncExpired,
    isAuthProcessing,
    isRedirectProcessing,
    location.pathname,
    location.search,
  ]);

  useEffect(() => {
    if (!fest) return;
    const canonical = festRegisterPath(fest);
    if (window.location.pathname !== canonical) {
      // Keep payment-return / success navigation state across ObjectId ? slug rewrite
      navigate(`${canonical}${location.search || ''}`, {
        replace: true,
        state: location.state,
      });
    }
  }, [fest, navigate, location.search, location.state]);

  useEffect(() => {
    if (loading || !fest) return;

    const competitionBaseFee = competition
      ? parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee)
      : 0;

    let pricingPayload = null;
    if (isCompetitionRegistration && competitionBaseFee > 0) {
      pricingPayload = { competitionId: competition?._id || competitionId, couponCode: appliedCouponCode || undefined };
    } else if ((fest.feeAmount || 0) > 0) {
      pricingPayload = { festId: fest._id || festId, couponCode: appliedCouponCode || undefined };
    }

    if (!pricingPayload) {
      setPriceBreakdown(null);
      setCouponQuoting(false);
      return;
    }

    if (!resolveAuthToken(authToken) || isAuthProcessing) return;

    let cancelled = false;
    setCouponQuoting(Boolean(appliedCouponCode));
    (async () => {
      try {
        const quote = await fetchPaymentQuoteApi(pricingPayload, authToken);
        if (cancelled) return;
        setCouponError('');
        setPriceBreakdown(quote);
        if (appliedCouponCode && !(Number(quote?.couponDiscount) > 0)) {
          setCouponError('Coupon not applied to this order');
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || '';
        if (msg.includes('token') || msg.includes('401') || msg.includes('Unauthorized')) {
          if (!firebaseUser) {
            setShowLogin(true);
            setError('Please log in to register for events');
          }
        } else {
          setCouponError(err?.message || 'Invalid coupon');
          // Keep last good ticket price; drop discount so UI doesn't look stuck
          setPriceBreakdown((prev) => (
            prev
              ? {
                  ...prev,
                  couponDiscount: 0,
                  couponCode: '',
                  totalAmount: Math.max(
                    0,
                    Number(prev.ticketPrice || 0) + Number(prev.platformFee || 0),
                  ),
                }
              : prev
          ));
          console.warn('Payment quote failed:', msg);
        }
      } finally {
        if (!cancelled) setCouponQuoting(false);
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
    appliedCouponCode,
  ]);

  const handleCouponCodeChange = (raw) => {
    const next = String(raw || '').toUpperCase();
    setCouponCode(next);
    setCouponError('');
    const applied = (appliedCouponCode || '').trim().toUpperCase();
    if (applied && next.trim() !== applied) {
      setAppliedCouponCode('');
      setPriceBreakdown((prev) => (
        prev
          ? {
              ...prev,
              couponDiscount: 0,
              couponCode: '',
              totalAmount: Math.max(
                0,
                Number(prev.ticketPrice || 0) + Number(prev.platformFee || 0),
              ),
            }
          : prev
      ));
    }
  };

  const applyCouponCode = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError('Enter a coupon code');
      return;
    }
    setCouponError('');
    setAppliedCouponCode(code);
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);



  // ? NEW: Multi-step form helper functions
  const isMultiStepForm = () => {
    return fest?.registration?.formType === 'MULTI_STEP' && fest?.registration?.steps?.length > 0;
  };

  const isMindSparkCompetitionReg = () =>
    Boolean(
      isCompetitionRegistration
      && competition
      && (
        isMindSparkFest(fest)
        || isMindSparkFest(competition?.fest)
        || isMindSparkFest(competition?.festId || competition?.fest_id)
      ),
    );

  /** MindSpark comps always use roster person form (solo = 1 person step; teams = size + people) */
  const hasParticipantStep = () => isMindSparkCompetitionReg();

  /** Only when team can be 2+ ? solo skips straight to person details */
  const needsTeamSizePicker = () =>
    hasParticipantStep() && needsParticipantCountStep(competition);

  /** Fest MULTI_STEP or competition with injected Team-size step */
  const isEffectiveMultiStep = () => isMultiStepForm() || hasParticipantStep();

  const getPeopleCount = () => {
    if (!hasParticipantStep()) return 0;
    const { min, max } = getRosterBounds(competition);
    if (max <= 1) return 1;
    return Math.min(max, Math.max(min, Number(formData.team_size) || min));
  };

  /** MindSpark roster flow: person fields only ? never append fest default formSchema/steps */
  const getFormStepsCount = () => {
    if (hasParticipantStep()) return 0;
    if (isMultiStepForm()) return fest.registration.steps.length;
    if ((fest?.registration?.formSchema || []).length > 0) return 1;
    return 1;
  };

  const isOnParticipantStep = () => needsTeamSizePicker() && currentStep === 1;

  const isOnPersonStep = () => {
    if (!hasParticipantStep()) return false;
    const people = getPeopleCount();
    if (needsTeamSizePicker()) {
      return currentStep >= 2 && currentStep <= 1 + people;
    }
    return currentStep === 1;
  };

  const getPersonIndex = () => {
    if (!isOnPersonStep()) return -1;
    if (needsTeamSizePicker()) return currentStep - 2;
    return 0;
  };

  const getFormStartStep = () => {
    if (!hasParticipantStep()) return 1;
    return (needsTeamSizePicker() ? 1 : 0) + getPeopleCount();
  };

  const getCurrentStepFields = () => {
    if (isOnParticipantStep() || isOnPersonStep() || hasParticipantStep()) return [];

    if (!isMultiStepForm()) {
      return fest?.registration?.formSchema || [];
    }

    const festStepNum = currentStep - getFormStartStep() + 1;
    const step = fest.registration.steps.find((s) => s.stepNumber === festStepNum);
    return step?.fields || [];
  };

  const getTotalSteps = () => {
    if (!hasParticipantStep()) {
      return isMultiStepForm() ? fest.registration.steps.length : 1;
    }
    return (needsTeamSizePicker() ? 1 : 0) + getPeopleCount() + getFormStepsCount();
  };

  const getStepMeta = () => {
    const steps = [];
    if (!hasParticipantStep()) {
      if (isMultiStepForm()) {
        return fest.registration.steps.map((s) => ({
          stepNumber: s.stepNumber,
          stepTitle: s.stepTitle || `Step ${s.stepNumber}`,
          stepDescription: s.stepDescription,
        }));
      }
      return [{ stepNumber: 1, stepTitle: 'Details' }];
    }

    let n = 1;
    if (needsTeamSizePicker()) {
      steps.push({ stepNumber: n, stepTitle: 'Team size' });
      n += 1;
    }
    const people = getPeopleCount();
    for (let i = 0; i < people; i += 1) {
      steps.push({
        stepNumber: n + i,
        stepTitle: people === 1 ? 'Your details' : `Person ${i + 1}`,
      });
    }
    return steps;
  };

  const getCurrentStepData = () => {
    if (!isMultiStepForm() || isOnParticipantStep() || isOnPersonStep()) {
      return formData;
    }
    return stepData[currentStep] || {};
  };

  /** Step 1: only need a valid count selected */
  const validateParticipantStep = () => {
    if (!needsTeamSizePicker()) return true;
    const { min, max } = getRosterBounds(competition);
    const chosen = Math.max(0, Number(formData.team_size) || 0);
    if (chosen < min || chosen > max) {
      setError(`Select between ${min} and ${max} participant${max === 1 ? '' : 's'}`);
      return false;
    }
    return true;
  };

  /** Current person step: all compulsory personFields */
  const validateCurrentPerson = () => {
    const idx = getPersonIndex();
    if (idx < 0) return true;
    const personFields = getPersonFields(competition);
    const members = Array.isArray(formData.team_members) ? formData.team_members : [];
    const missing = teamMemberMissingLabel(members[idx], personFields);
    if (missing) {
      setError(`Person ${idx + 1}: ${missing}`);
      return false;
    }
    return true;
  };

  /** Final check: every selected person has full compulsory details */
  const validateMemberNames = () => {
    if (!hasParticipantStep()) return true;
    const chosen = getPeopleCount();
    const personFields = getPersonFields(competition);
    const members = Array.isArray(formData.team_members) ? formData.team_members : [];
    for (let i = 0; i < chosen; i += 1) {
      const missing = teamMemberMissingLabel(members[i], personFields);
      if (missing) {
        setError(`Person ${i + 1}: ${missing}`);
        return false;
      }
    }
    return true;
  };

  const validateCurrentStep = () => {
    if (isOnParticipantStep()) {
      return validateParticipantStep();
    }

    if (isOnPersonStep()) {
      return validateCurrentPerson();
    }

    const currentFields = getCurrentStepFields();
    const currentData = getCurrentStepData();
    
    console.log('?? DEBUG - validateCurrentStep:', {
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
        console.log('?? Validating required field:', { fieldId, value, hasValue: !!value });
        
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          setError(`Please fill in the required field: ${field.label}`);
          console.log('? Validation failed for field:', field.label);
          return false;
        }
      }
    }

    console.log('? Step validation passed');
    return true;
  };

  const handleStepNext = () => {
    console.log('?? DEBUG - handleStepNext called:', {
      currentStep,
      totalSteps: getTotalSteps(),
      isValid: validateCurrentStep(),
      currentFields: getCurrentStepFields(),
      currentData: getCurrentStepData()
    });
    
    if (!validateCurrentStep()) {
      console.log('? Step validation failed, not proceeding to next step');
      return;
    }
    
    // Save fest field steps only (team size / person names live on formData)
    if (isMultiStepForm() && !isOnParticipantStep() && !isOnPersonStep()) {
      setStepData(prev => ({
        ...prev,
        [currentStep]: getCurrentStepData()
      }));
    }
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    if (currentStep < getTotalSteps()) {
      console.log('? Moving to next step:', currentStep + 1);
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

  // If user reduces team size while mid-flow, clamp step into new range
  useEffect(() => {
    if (!hasParticipantStep()) return;
    const total = getTotalSteps();
    if (currentStep > total) {
      setCurrentStep(total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.team_size, competition?._id || competition?.id]);

  // Solo MindSpark: lock team_size to 1 so submit / validation stay consistent
  useEffect(() => {
    if (!hasParticipantStep()) return;
    if (needsTeamSizePicker()) return;
    setFormData((prev) => {
      if (Number(prev.team_size) === 1) return prev;
      return { ...prev, team_size: 1 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition?._id || competition?.id, competition?.teamSizeMax, competition?.teamSizeMin]);

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
      console.log('?? Single-step form data:', formData);
      return formData;
    }
    
    // Combine all step data - THIS IS CRITICAL FOR MULTI-STEP FORMS
    const allData = {};
    
    // First, merge all completed steps
    Object.entries(stepData).forEach(([stepNum, stepFormData]) => {
      console.log(`?? Merging step ${stepNum} data:`, stepFormData);
      Object.assign(allData, stepFormData);
    });
    
    // Then, include current step data (in case it hasn't been saved yet)
    const currentStepData = getCurrentStepData();
    console.log(`?? Current step ${currentStep} data:`, currentStepData);
    Object.assign(allData, currentStepData);
    
    console.log('?? Multi-step combined data:', {
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


  const fetchFestDetails = async () => {
    try {
      console.log('?? Fetching fest details for:', festId);
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`${API_BASE_URL}/fests/${festId}/public?_cb=${cacheBuster}`, {
        credentials: 'omit', // ? iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const data = await response.json();
      
      // If the fest has a feeAmount, skip mode validation ? payment replaces the form
      if (!data.feeAmount || data.feeAmount <= 0) {
        if (data.registration?.mode !== 'INTERNAL_FORM') {
          console.error('? Invalid registration mode:', data.registration?.mode);
          setError(`Registration is not available. Mode: ${data.registration?.mode || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      }

      setFest(data);
      if (festId) {
        saveRegistrationPrefetch(festId, competitionId, {
          fest: data,
          competition: competition || null,
        });
      }

      console.log('?? DEBUG - Fest registration data loaded:', {
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

      // Merge schema with existing user input ? do not wipe fields on background refresh
      setFormData((prev) => mergeFormDataWithSchema(prev, data.registration));
      restoreRegistrationDraft();
    } catch (err) {
      console.error('? Error fetching fest details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionAndFestDetails = async () => {
    try {
      console.log('?? Fetching competition and fest details...', { competitionId, festId });
      
      // Fetch competition details first
      const competitionResponse = await fetch(`${API_BASE_URL}/fests/competitions/${competitionId}/public`, {
        credentials: 'omit', // ? iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      if (!competitionResponse.ok) {
        throw new Error('Failed to fetch competition details');
      }
      const competitionData = await competitionResponse.json();
      console.log('? Competition data received:', {
        name: competitionData.name,
        registrationType: competitionData.registrationType,
        festId: competitionData.fest?._id
      });
      setCompetition(competitionData);

      const cacheBuster = Date.now();
      const festResponse = await fetch(`${API_BASE_URL}/fests/${festId}/public?_cb=${cacheBuster}`, {
        credentials: 'omit',
        mode: 'cors',
        headers: { 'Accept': 'application/json' },
      });
      if (!festResponse.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const festData = await festResponse.json();

      if (competitionData.registrationType === 'fest') {
        if (festData.registration?.mode !== 'INTERNAL_FORM') {
          console.error('? Fest registration mode invalid for competition:', festData.registration?.mode);
          setError(`Competition registration is not available. Fest mode: ${festData.registration?.mode || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      } else if (competitionData.registrationType === 'custom') {
        if (competitionData.registration?.status !== 'internal_form') {
          console.error('? Competition registration status invalid:', competitionData.registration?.status);
          setError(`Competition registration is not available. Status: ${competitionData.registration?.status || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      }

      setFest(festData);
      if (festId) {
        saveRegistrationPrefetch(festId, competitionId, {
          fest: festData,
          competition: competitionData,
        });
      }
      console.log('?? DEBUG - Competition fest registration data loaded:', {
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

      setFormData((prev) => mergeFormDataWithSchema(prev, festData.registration));
      restoreRegistrationDraft();
    } catch (err) {
      console.error('? Error fetching competition/fest details:', err);
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

    console.log('?? Starting file upload for field:', fieldId, 'File:', file.name);

    setUploadingFiles(prev => ({
      ...prev,
      [fieldId]: true
    }));

    try {
      // ? PERFORMANCE: Quick validation first
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

      // ? PERFORMANCE: Compress images if they're large
      let processedFile = file;
      if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) { // 2MB threshold
        console.log('??? Compressing large image:', file.name);
        try {
          processedFile = await compressImage(file);
          console.log('? Image compressed:', {
            original: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            compressed: `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`,
            reduction: `${(((file.size - processedFile.size) / file.size) * 100).toFixed(1)}%`
          });
        } catch (compressionError) {
          console.warn('?? Image compression failed, using original:', compressionError);
          processedFile = file;
        }
      }

      console.log('? File validated:', {
        name: processedFile.name,
        size: `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`,
        type: processedFile.type,
        fieldId: fieldId
      });

      // ? PERFORMANCE FIX: Store file immediately without uploading
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
      
      console.log('? File prepared for upload:', fieldId, '- Will upload during form submission');
    } catch (err) {
      console.error('? File validation error:', err);
      setError(err.message || 'Failed to validate file');
    } finally {
      setUploadingFiles(prev => ({
        ...prev,
        [fieldId]: false
      }));
    }
  };

  const handleSubmit = async (e, options = {}) => {
    e?.preventDefault?.();
    const {
      paidResume = false,
      verifiedPaymentOverride = null,
      draft = null,
    } = options;
    const formSubmissionStartTime = Date.now(); // Track submission time for error reporting
    console.log('?? Starting form submission...');
    console.log('?? DEBUG - Form submission state:', {
      isMultiStep: isMultiStepForm(),
      currentStep,
      totalSteps: getTotalSteps(),
      isNotFinalStep: currentStep < getTotalSteps(),
      submitting
    });
    
    // ? PERFORMANCE: Prevent double submission
    if (submitting) {
      console.log('?? Submission already in progress, ignoring duplicate request');
      return;
    }
    
    // Validate only current step's required fields for multi-step forms
    if (!paidResume && isMultiStepForm()) {
      if (isOnParticipantStep()) {
        if (!validateParticipantStep()) return;
      } else if (isOnPersonStep()) {
        if (!validateCurrentPerson()) return;
      } else {
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
      }
    } else if (!paidResume) {
      // Competition multi-step (Team size ? Person N) before full single-step validation
      if (hasParticipantStep() && currentStep < getTotalSteps()) {
        handleStepNext();
        return;
      }
      // MindSpark roster: person fields only ? skip fest default formSchema requirements
      if (!hasParticipantStep()) {
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
    }

    // ? NEW: For multi-step forms, validate current step first
    if (!paidResume && isEffectiveMultiStep() && currentStep < getTotalSteps()) {
      console.log('?? Multi-step form: Moving to next step instead of submitting');
      // This is not the final step, just go to next step
      handleStepNext();
      return;
    }

    if (!paidResume && hasParticipantStep() && !validateMemberNames()) {
      return;
    }
    
    console.log('?? Final step reached, proceeding with actual submission');
    // Final fest-step validation ? not used for MindSpark roster (person fields only)
    if (!paidResume && isMultiStepForm() && !hasParticipantStep() && !validateCurrentStep()) {
      return;
    }

    console.log('? All required fields validated');
    
    processUiStartedAt.current = Date.now();
    setProcessOverlayMode('server');
    setSubmitting(true);
    setError('');

    try {
      setSubmissionProgress('Validating authentication...');
      // ? FIX: Use authToken from context FIRST, fallback to localStorage
      const token = resolveAuthToken(authToken);
      const user = localStorage.getItem('crwdctrl_user');

      const allFormData = draft ? buildFormDataFromDraft(draft) : getAllFormData();

      console.log('?? Auth check for submission:', {
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
      // ? CRITICAL: Double-check registration mode before submission
      console.log('?? Final registration mode check:', {
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
      // ? NEW: Get all form data (single-step or combined multi-step)
      // allFormData already obtained at line 841 for single-step or will be obtained below
      
      console.log('?? Form validation starting:', {
        isMultiStep: isMultiStepForm(),
        currentStep,
        allFormDataKeys: Object.keys(allFormData),
        fileKeys: Object.keys(allFormData).filter(key => key.includes('_file')),
        mindSparkRoster: hasParticipantStep(),
      });
      
      // MindSpark roster: empty schema so common fest "Full Name" is never required/sent
      const formSchema = hasParticipantStep()
        ? []
        : (isMultiStepForm()
          ? (fest.registration?.steps || []).flatMap((step) => step.fields || [])
          : (fest.registration?.formSchema || []));

      if (!hasParticipantStep()) {
      const requiredFields = formSchema.filter(field => field.required);
      
      console.log('?? Form schema fields:', formSchema.map(field => ({
        id: field.id,
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        generatedId: generateFieldId(field)
      })));
      
      console.log('?? Validating', requiredFields.length, 'required fields...');
      
      for (const field of requiredFields) {
        const fieldId = generateFieldId(field);
        const value = allFormData[fieldId];
        
        console.log('?? Checking field:', { 
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
          console.log('?? File field validation:', {
            fieldId,
            label: field.label,
            hasValue: !!value,
            valueReady: value?.ready,
            hasFileData: !!allFormData[`${fieldId}_file`],
            fileDataType: typeof allFormData[`${fieldId}_file`]
          });
          
          if (!value || !value.ready || !allFormData[`${fieldId}_file`]) {
            console.error('? File validation failed:', {
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

      console.log('? All required fields validated');
      } else {
        console.log('? MindSpark roster ? skipped fest formSchema validation');
      }
      // Cashfree: open checkout if competition/fest has a fee and payment not yet done
      const effectiveFeeAmount = priceBreakdown?.ticketPrice || (isCompetitionRegistration ? (parseTicketPrice(competition?.feeAmount) || parseTicketPrice(competition?.registrationFee)) : (fest.feeAmount || 0));
      let verifiedPaymentFields = verifiedPaymentOverride || paymentFields;
      if (effectiveFeeAmount > 0 && !verifiedPaymentFields && !paidResume) {
        setSubmissionProgress('Opening payment gateway...');

        const orderNotes = isCompetitionRegistration
          ? { competitionId, registrationDraft: buildOrderRegistrationDraft() }
          : { festId, registrationDraft: buildOrderRegistrationDraft() };
        const orderRes = await fetch(`${API_BASE_URL}/payment/order`, {
          method: 'POST',
          headers: getBearerAuthHeaders(authToken),
          body: JSON.stringify({ ...orderNotes, couponCode: appliedCouponCode || undefined }),
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
          await waitAtLeast(processUiStartedAt.current, 1000);
          setCompletingPayment(false);
          setProcessOverlayMode('error');
          setSubmissionProgress(kind === 'cancelled' ? 'Payment cancelled' : message);
          await sleep(900);
          setSubmitting(false);
          setSubmissionProgress('');
          setProcessOverlayMode('server');
          if (kind !== 'cancelled') {
            retryCheckoutRef.current = () => handleSubmit();
            setPaymentModal({ open: true, message, orderId: orderData.orderId });
          } else {
            setError('Payment was cancelled. You can try again when ready.');
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
          await waitAtLeast(processUiStartedAt.current, 1000);
          setSubmitting(false);
          setCompletingPayment(true);
          setProcessOverlayMode('payment');
          setSubmissionProgress('Complete payment in the gateway. You will return here automatically.');
          return;
        }

        setCompletingPayment(true);
        setProcessOverlayMode('payment');
        setSubmissionProgress('Confirming payment?');

        const verifyResult = await verifyPaymentWithRetry(
          API_BASE_URL,
          orderData.orderId,
          { token, search: location.search },
        );
        if (verifyResult.status === 'cancelled') {
          handleVerifyCancelled();
          await waitAtLeast(processUiStartedAt.current, 1000);
          setSubmitting(false);
          setSubmissionProgress('');
          setProcessOverlayMode('server');
          return;
        }
        if (!verifyResult.ok || !verifyResult.verified) {
          const { message } = classifyVerifyError(verifyResult);
          throw new Error(message);
        }

        verifiedPaymentFields = buildVerifiedPaymentFields(verifyResult.data, orderData.orderId);
        setPaymentFields(verifiedPaymentFields);
      }

      setProcessOverlayMode('server');
      setSubmissionProgress('Preparing form data...');
      // ? PERFORMANCE: Prepare form data efficiently
      const submissionFormData = new FormData();
      const textResponses = {};
      let totalFileSize = 0;
      let fileCount = 0;

      // Debug: Log all available form data and files
      console.log('?? DEBUG - All Form Data Keys:', Object.keys(allFormData));
      console.log('?? DEBUG - File Keys:', Object.keys(allFormData).filter(key => key.includes('_file')));
      console.log('?? DEBUG - Full allFormData:', allFormData);

      // formSchema already defined above for validation purposes

      // Process form fields with consistent field naming
      console.log('?? PROCESSING FIELDS - Starting:', {
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
        
        // ? CRITICAL: Use the same field identifier for backend consistency
        // This should match what generateFieldId returns
        const backendFieldName = generateFieldId(field);
        
        if (field.type === 'file' || field.type === 'image') {
          // Add file to FormData if it exists
          const fileData = allFormData[`${fieldId}_file`];
          
          // Debug: Check what we have
          console.log('?? FILE DEBUG:', {
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
            console.log('?? Added file to form data:', {
              fieldName: backendFieldName,
              fileName: fileData.name,
              fileSize: `${fileSizeInMB}MB`,
              actualSize: fileData.size,
              totalFileSize: `${(totalFileSize / 1024 / 1024).toFixed(2)}MB`
            });
          } else {
            console.log('?? No valid file found for field:', {
              fieldId,
              label: field.label,
              lookingForKey: `${fieldId}_file`,
              hasFileData: !!fileData,
              fileSize: fileData?.size,
              allFormDataKeys: Object.keys(allFormData),
              allFormDataFileKeys: Object.keys(allFormData).filter(k => k.includes('_file'))
            });
            
            // ? FALLBACK: Try to get file from DOM input element
            try {
              const fileInput = document.querySelector(`input[data-field-id="${fieldId}"]`);
              if (fileInput?.files?.length > 0) {
                const file = fileInput.files[0];
                console.log('? FALLBACK: Found file in DOM:', {
                  fieldId,
                  fileName: file.name,
                  fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
                });
                submissionFormData.append(backendFieldName, file);
                totalFileSize += file.size;
                fileCount++;
              }
            } catch (error) {
              console.log('?? No fallback file input found for:', fieldId, error?.message);
            }
          }
        } else {
          // Add text data to responses object using backend field name
          textResponses[backendFieldName] = value;
          console.log('?? Added text response:', backendFieldName, typeof value === 'string' ? value.substring(0, 50) : value);
        }
      });

      // Add text responses as JSON
      if (isCompetitionRegistration && isMindSparkFest(fest) && hasParticipantStep()) {
        const chosen = getPeopleCount();
        const personFields = getPersonFields(competition);
        const members = (Array.isArray(formData.team_members) ? formData.team_members : [])
          .slice(0, chosen)
          .map((m) => normalizeTeamMember(m, personFields));
        textResponses.team_size = chosen;
        textResponses.team_members = members;
        textResponses.person_fields = personFields.map((f) => ({ key: f.key, label: f.label }));
        // Lead (person 1) identity for organizer list / receipts
        if (members[0]) {
          if (members[0].name) textResponses.full_name = members[0].name;
          if (members[0].email) textResponses.email = members[0].email;
          if (members[0].phone) textResponses.phone = members[0].phone;
          if (members[0].college) textResponses.college = members[0].college;
        }
      }
      submissionFormData.append('responses', JSON.stringify(textResponses));
      if (competitionId) {
        submissionFormData.append('competitionId', String(competitionId));
      }

      // Attach Cashfree payment fields if payment was made
      if (verifiedPaymentFields) {
        submissionFormData.append('payment_order_id', verifiedPaymentFields.payment_order_id);
        submissionFormData.append('payment_id', verifiedPaymentFields.payment_id);
      }

      // ? PERFORMANCE: Show file submission progress
      if (fileCount > 0) {
        setSubmissionProgress(`Submitting ${fileCount} file(s) (${(totalFileSize / 1024 / 1024).toFixed(2)}MB)...`);
      } else {
        setSubmissionProgress('Submitting registration...');
      }
      // ? PERFORMANCE: Pre-validate files before submission
      const maxTotalSize = 50 * 1024 * 1024; // 50MB total limit
      if (totalFileSize > maxTotalSize) {
        throw new Error(`Total file size (${(totalFileSize / 1024 / 1024).toFixed(2)}MB) exceeds limit of 50MB. Please reduce file sizes.`);
      }

      // ? PERFORMANCE: Determine endpoint and make request
      const endpoint = isCompetitionRegistration 
        ? `${API_BASE_URL}/registrations/competitions/${competitionId}/register`
        : `${API_BASE_URL}/registrations/fests/${festId}/register`;

      console.log('?? Making registration request to:', endpoint);
      console.log('? [DEBUG] Submission details:', {
        endpoint: endpoint,
        isCompetition: isCompetitionRegistration,
        competitionId: competitionId,
        festId: festId,
        hasCompetitionId: !!competitionId,
        competitionIdType: typeof competitionId,
        competitionIdLength: competitionId?.length,
        competitionIdValue: competitionId
      });
      console.log('??? Submission summary:', {
        textFields: Object.keys(textResponses).length,
        fileFields: fileCount,
        totalFileSize: `${(totalFileSize / 1024 / 1024).toFixed(2)}MB`,
        estimatedUploadTime: `${Math.ceil(totalFileSize / (1024 * 1024))}s`
      });


      // ? PERFORMANCE: Dynamic timeout based on file size
      // Base timeout: 90s (enough for backend file processing and response)
      // Plus additional time for file upload: 30s per MB
      // Backend will continue sending emails in background after response
      
      console.log('?? BEFORE TIMEOUT CALCULATION:', {
        totalFileSize: totalFileSize,
        totalFileSizeInMB: (totalFileSize / 1024 / 1024).toFixed(2),
        fileCount: fileCount,
        formSchemaLength: formSchema.length,
        allFormDataKeys: Object.keys(allFormData).length,
        allFormDataFileKeys: Object.keys(allFormData).filter(k => k.includes('_file')),
        isMultiStep: isMultiStepForm()
      });
      
      // ? OPTIMIZED: Backend now responds IMMEDIATELY (files upload in background)
      // Base timeout: 120s - allowing time for server processing and slow connections
      // Backend responds with registration ID immediately, files upload in background
      // File uploads happen in background on server after response is sent to user
      const baseTimeout = 120000; // 120 seconds - reasonable timeout for production stability
      const controller = new AbortController();
      
      // ? PERFORMANCE: Track upload progress (define BEFORE fetch so it's available in error handler)
      const startTime = Date.now();
      
      const timeoutId = setTimeout(() => {
        console.warn(`?? Aborting request after ${(baseTimeout / 1000).toFixed(0)}s timeout`);
        controller.abort();
      }, baseTimeout);

      console.log(`?? Request timeout: ${(baseTimeout / 1000).toFixed(0)}s (backend responds immediately, files upload in background)`);

      console.log('?? Making fetch request to:', endpoint);
      console.log('?? FormData size:', submissionFormData.size || 'unknown');
      
      // ? FIX: Ensure we have a valid token before submission
      const submitToken = token;
      if (!submitToken) {
        clearStoredAuthSession();
        setShowLogin(true);
        throw new Error('Authentication required. Please log in again to submit your registration.');
      }

      // ? PRODUCTION FIX: Show user that submission is in progress (don't timeout on their end)
      setSubmissionProgress('Submitting registration to server... (instant response)');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${submitToken}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: submissionFormData,
        signal: controller.signal,
        credentials: 'include', // ? FIX: Include cookies for production auth
        mode: 'cors', // ? FIX: Enable CORS for production domains
      });

      clearTimeout(timeoutId);
      const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('?? Registration response received:', { 
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
          console.error('? Backend error details:', {
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
          console.error('? Could not parse error response:', parseError);
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
      console.log('? Registration successful:', result);

      setSubmissionProgress('Registration completed successfully!');
      const regId = result._id || result.registration?._id || result.registrationId;
      setRegistrationId(regId);
      await waitAtLeast(processUiStartedAt.current, 1000);
      setProcessOverlayMode('success');
      setSubmissionProgress('You\'re registered!');
      saveFestRegistrationSuccess({
        festId: festId || fest?._id,
        festMongoId: fest?._id || fest?.id || null,
        competitionId: isCompetitionRegistration
          ? (competitionId || competition?._id || null)
          : null,
        registrationId: regId,
      });
      setCompletingPayment(false);
      setSubmitting(false);
      setSubmissionProgress('');
      setProcessOverlayMode('server');
      setSuccess(true);
      refreshNotifications();
      clearRegistrationDraft(draftKey);
      if (paidResume) {
        clearPendingPayment();
        setPaymentResumeError('');
        clearCashfreeReturnAndPending(navigate, location);
      }
      await sleep(1000);

      return { success: true, regId };

    } catch (err) {
      if (paidResume) {
        throw err;
      }
      setCompletingPayment(false);
      console.error('? Registration error:', err);
      console.error('? Error name:', err.name);
      console.error('? Error message:', err.message);
      console.error('? Error stack:', err.stack);

      let userMessage = err.message || 'An unexpected error occurred. Please try again.';
      
      // Handle specific error types with better user feedback
      if (err.name === 'AbortError') {
        const elapsedTime = ((Date.now() - formSubmissionStartTime) / 1000).toFixed(1);
        console.error('? Request was aborted/timed out after', elapsedTime, 'seconds');
        console.log('?? Registration may have been saved on the server. Checking registered events...');
        userMessage = 'Registration is taking longer than expected. Your submission may have been saved. Please check My Bookings in a moment. Contact support if needed.';
      } else if (
        err.message.includes('Authentication')
        || err.message.includes('session')
        || err.message.includes('token')
        || err.message.includes('log in')
      ) {
        if (paidResume) {
          setPaymentResumeError(err.message || 'Your session has expired. Please log in and check My Bookings.');
        } else {
          userMessage = 'Your session has expired. Please log in again.';
          clearStoredAuthSession();
          setShowLogin(true);
        }
      } else if (err.message.includes('registration') && err.message.includes('not available')) {
        userMessage = 'Registration is currently not available for this event. Please contact the organizers.';
      } else if (err.message.includes('required')) {
        userMessage = err.message;
      } else if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      }

      await waitAtLeast(processUiStartedAt.current, 1000);
      setProcessOverlayMode('error');
      setSubmissionProgress(userMessage);
      await sleep(1100);
      setError(userMessage);
    } finally {
      setSubmitting(false);
      setSubmissionProgress('');
      setProcessOverlayMode('server');
    }
  };

  // Helper function for handling input changes (for single-step forms)
  const _handleInputChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  handleSubmitRef.current = handleSubmit;

  const handleCashfreeFestRegister = async () => {
    processUiStartedAt.current = Date.now();
    setProcessOverlayMode('payment');
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
        body: JSON.stringify({
          festId,
          couponCode: appliedCouponCode || undefined,
          registrationDraft: buildOrderRegistrationDraft(),
        }),
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
        await waitAtLeast(processUiStartedAt.current, 1000);
        setProcessOverlayMode('error');
        setSubmissionProgress(kind === 'cancelled' ? 'Payment cancelled' : message);
        await sleep(900);
        setPaymentLoading(false);
        setCompletingPayment(false);
        setSubmissionProgress('');
        setProcessOverlayMode('server');
        if (kind !== 'cancelled') {
          retryCheckoutRef.current = () => handleCashfreeFestRegister();
          setPaymentModal({ open: true, message, orderId: orderData.orderId });
        } else {
          setPaymentError('Payment was cancelled. You can try again when ready.');
          setTimeout(() => setPaymentError(''), 5000);
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
        await waitAtLeast(processUiStartedAt.current, 1000);
        setPaymentLoading(false);
        setCompletingPayment(true);
        setProcessOverlayMode('payment');
        setSubmissionProgress('Complete payment in the gateway. You will return here automatically.');
        return;
      }

      setCompletingPayment(true);
      setProcessOverlayMode('payment');
      setSubmissionProgress('Confirming payment?');

      const verifyResult = await verifyPaymentWithRetry(
        API_BASE_URL,
        orderData.orderId,
        { token, search: location.search },
      );
      if (verifyResult.status === 'cancelled') {
        handleVerifyCancelled();
        return;
      }
      if (!verifyResult.ok || !verifyResult.verified) {
        const { message } = classifyVerifyError(verifyResult);
        throw new Error(message);
      }

      setProcessOverlayMode('server');
      setSubmissionProgress('Completing registration?');

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
      if (regId) setRegistrationId(regId);
      saveFestRegistrationSuccess({
        festId: festId || fest?._id,
        festMongoId: fest?._id || fest?.id || null,
        competitionId: null,
        registrationId: regId,
      });
      await waitAtLeast(processUiStartedAt.current, 1000);
      setProcessOverlayMode('success');
      setSubmissionProgress("You're registered!");
      setCompletingPayment(false);
      setSuccess(true);
      clearPendingPayment();
      clearCashfreeReturnAndPending(navigate, location);
      await sleep(1000);
      refreshNotifications();
      clearRegistrationDraft(draftKey);
    } catch (err) {
      await waitAtLeast(processUiStartedAt.current, 1000);
      setProcessOverlayMode('error');
      const msg = err.message || 'Payment failed. Please try again.';
      setSubmissionProgress(msg);
      await sleep(1100);
      setCompletingPayment(false);
      if (err.message !== 'Payment cancelled') {
        setPaymentError(msg);
        setTimeout(() => setPaymentError(''), 5000);
      }
    } finally {
      setPaymentLoading(false);
      setSubmissionProgress('');
      setProcessOverlayMode('server');
    }
  };


  const hasAuth = hasUsableAuthToken(authToken);
  const hasStoredSession = hasUsableAuthToken(authToken);
  const waitingOnAuth = !hasStoredSession && (
    authLoading || isAuthProcessing || isRedirectProcessing || (!!firebaseUser && !authSyncExpired)
  );
  const closePaymentModal = () => setPaymentModal({ open: false, message: '', orderId: '' });

  return {
    // routing / auth
    festId,
    navigate,
    location,
    competitionId,
    isAuthenticated,
    authLoading,
    authToken,
    firebaseUser,
    isAuthProcessing,
    isRedirectProcessing,
    isDark,
    // data
    fest,
    competition,
    priceBreakdown,
    formData,
    setFormData,
    loading,
    submitting,
    processOverlayMode,
    submissionProgress,
    error,
    notice,
    success,
    completingPayment,
    setCompletingPayment,
    registrationId,
    uploadingFiles,
    paymentFields,
    currentStep,
    stepData,
    completedSteps,
    paymentLoading,
    paymentError,
    paymentModal,
    couponCode,
    setCouponCode,
    handleCouponCodeChange,
    applyCouponCode,
    appliedCouponCode,
    setAppliedCouponCode,
    couponError,
    couponQuoting,
    showLogin,
    setShowLogin,
    showRegister,
    setShowRegister,
    authSyncExpired,
    paymentResumeError,
    setPaymentResumeError,
    paymentResumeOrderId,
    paymentResumeWasPaid,
    retryPaymentResume,
    isCompetitionRegistration,
    draftKey,
    registrationDisplayName,
    hasAuth,
    hasStoredSession,
    waitingOnAuth,
    retryCheckoutRef,
    // helpers / handlers
    generateFieldId,
    isMultiStepForm,
    isEffectiveMultiStep,
    hasParticipantStep,
    isOnParticipantStep,
    isOnPersonStep,
    getPersonIndex,
    getStepMeta,
    getCurrentStepFields,
    getTotalSteps,
    getCurrentStepData,
    validateCurrentStep,
    handleStepNext,
    handleStepBack,
    handleStepFieldChange,
    getAllFormData,
    handleSubmit,
    handleFileUpload,
    handleCashfreeFestRegister,
    closePaymentModal,
    handleCloseLogin,
    handleCloseRegister,
    handleSwitchToRegister,
    handleSwitchToLogin,
  };
}

