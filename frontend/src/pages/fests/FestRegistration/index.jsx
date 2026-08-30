import { useEffect, useState } from 'react';
import DetailPageLoader from '../../../components/DetailPageLoader';
import { COMPETITION_DEMO_LOAD_MS } from '../../../constants/skeletonLoading';
import useFestRegistration from './useFestRegistration';
import FestRegistrationForm from './FestRegistrationForm';
import PaymentStep, { CompletingPaymentStep } from './PaymentStep';
import SuccessStep from './SuccessStep';

export default function FestRegistration() {
  const r = useFestRegistration();
  const {
    isDark,
    navigate,
    goBack,
    fest,
    competition,
    isCompetitionRegistration,
    hideFestOnlyForm,
    isSoldOut,
    isRegistrationClosed,
    success,
    completingPayment,
    paymentResumeError,
    paymentResumeOrderId,
    paymentResumeWasPaid,
    submissionProgress,
    setCompletingPayment,
    setPaymentResumeError,
    retryPaymentResume,
    registrationId,
    loading,
    waitingOnAuth,
    hasAuth,
    showLogin,
    loginDismissed,
    setShowLogin,
    showRegister,
    handleCloseLogin,
    handleCloseRegister,
    handleSwitchToRegister,
    handleSwitchToLogin,
    couponCode,
    setCouponCode,
    handleCouponCodeChange,
    applyCouponCode,
    appliedCouponCode,
    setAppliedCouponCode,
    couponError,
    couponQuoting,
    priceBreakdown,
    paymentError,
    paymentLoading,
    paymentModal,
    closePaymentModal,
    retryCheckoutRef,
    handleCashfreeFestRegister,
    competitionId,
    festId,
    location,
  } = r;

  const skipDemoLoad = Boolean(
    location?.state?.skipDemoLoad || fest || location?.state?.prefetch,
  );
  const [holdLoader, setHoldLoader] = useState(() => !skipDemoLoad);
  useEffect(() => {
    if (skipDemoLoad) {
      setHoldLoader(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setHoldLoader(false), COMPETITION_DEMO_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [festId, competitionId, skipDemoLoad]);

  const waitingForData = (!fest && loading) || (isCompetitionRegistration && loading && !competition);

  if (completingPayment && !success) {
    return (
      <CompletingPaymentStep
        isDark={isDark}
        paymentResumeError={paymentResumeError}
        paymentResumeOrderId={paymentResumeOrderId}
        paymentResumeWasPaid={paymentResumeWasPaid}
        submissionProgress={submissionProgress}
        navigate={navigate}
        onRetryResume={retryPaymentResume}
        onReturnToForm={() => {
          setCompletingPayment(false);
          setPaymentResumeError('');
        }}
      />
    );
  }

  if (success) {
    return (
      <SuccessStep
        isDark={isDark}
        isCompetitionRegistration={isCompetitionRegistration}
        competition={competition}
        fest={fest}
        registrationId={registrationId}
        navigate={navigate}
        competitionId={competitionId}
        festId={festId}
      />
    );
  }

  if (hideFestOnlyForm) {
    return (
      <DetailPageLoader
        variant="default"
        label="Opening MindSpark"
      />
    );
  }

  // Show Cashfree payment UI when fest has a feeAmount (only for fest-only registrations, not competition registrations)
  if (fest && !isCompetitionRegistration && fest.feeAmount > 0 && !success) {
    return (
      <PaymentStep
        isDark={isDark}
        fest={fest}
        competition={competition}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        handleCouponCodeChange={handleCouponCodeChange}
        applyCouponCode={applyCouponCode}
        appliedCouponCode={appliedCouponCode}
        setAppliedCouponCode={setAppliedCouponCode}
        couponError={couponError}
        couponQuoting={couponQuoting}
        priceBreakdown={priceBreakdown}
        paymentError={paymentError}
        paymentLoading={paymentLoading}
        paymentModal={paymentModal}
        closePaymentModal={closePaymentModal}
        onRetryCheckout={() => retryCheckoutRef.current?.()}
        onPay={handleCashfreeFestRegister}
        navigate={navigate}
      />
    );
  }

  if (waitingForData || (holdLoader && !fest)) {
    return (
      <DetailPageLoader
        variant={isCompetitionRegistration ? 'competition' : 'fest'}
        label={isCompetitionRegistration ? 'Loading competition' : 'Loading fest'}
      />
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

  if (isRegistrationClosed) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Registration closed</h1>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {competition?.name || 'This competition'} is not accepting new registrations.
          </p>
          <button
            type="button"
            onClick={() => goBack()}
            className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (isSoldOut) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Sold out</h1>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {competition?.name || 'This competition'} has no slots remaining.
          </p>
          <button
            type="button"
            onClick={() => goBack()}
            className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
          >
            Back
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
    <FestRegistrationForm
      isDark={isDark}
      navigate={navigate}
      fest={fest}
      competition={competition}
      isCompetitionRegistration={isCompetitionRegistration}
      formLocked={!hasAuth}
      authSyncing={waitingOnAuth}
      notice={r.notice}
      error={r.error}
      handleSubmit={r.handleSubmit}
      isMultiStepForm={r.isMultiStepForm}
      isEffectiveMultiStep={r.isEffectiveMultiStep}
      isOnParticipantStep={r.isOnParticipantStep}
      isOnTeamDetailsStep={r.isOnTeamDetailsStep}
      isOnFeeTierStep={r.isOnFeeTierStep}
      isOnPersonStep={r.isOnPersonStep}
      getPersonIndex={r.getPersonIndex}
      hasParticipantStep={r.hasParticipantStep}
      getStepMeta={r.getStepMeta}
      currentStep={r.currentStep}
      getTotalSteps={r.getTotalSteps}
      completedSteps={r.completedSteps}
      getCurrentStepFields={r.getCurrentStepFields}
      getCurrentStepData={r.getCurrentStepData}
      handleStepFieldChange={r.handleStepFieldChange}
      formData={r.formData}
      setFormData={r.setFormData}
      paymentFields={r.paymentFields}
      priceBreakdown={priceBreakdown}
      couponCode={couponCode}
      setCouponCode={setCouponCode}
      handleCouponCodeChange={handleCouponCodeChange}
      applyCouponCode={applyCouponCode}
      appliedCouponCode={appliedCouponCode}
      setAppliedCouponCode={setAppliedCouponCode}
      couponError={couponError}
      couponQuoting={couponQuoting}
      submitting={r.submitting}
      processOverlayMode={r.processOverlayMode}
      submissionProgress={submissionProgress}
      handleStepBack={r.handleStepBack}
      paymentModal={paymentModal}
      closePaymentModal={closePaymentModal}
      retryCheckoutRef={retryCheckoutRef}
      showLogin={Boolean((showLogin || (!hasAuth && !!fest && !loginDismissed)) && !hasAuth)}
      showRegister={showRegister}
      handleCloseLogin={handleCloseLogin}
      handleCloseRegister={handleCloseRegister}
      handleSwitchToRegister={handleSwitchToRegister}
      handleSwitchToLogin={handleSwitchToLogin}
      uploadingFiles={r.uploadingFiles}
      handleFileUpload={r.handleFileUpload}
    />
  );
}
