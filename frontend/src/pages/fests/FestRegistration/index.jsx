import CrwdCtrlLogin from '../../auth/login';
import useFestRegistration from './useFestRegistration';
import FestRegistrationForm from './FestRegistrationForm';
import PaymentStep, { CompletingPaymentStep } from './PaymentStep';
import SuccessStep from './SuccessStep';

export default function FestRegistration() {
  const r = useFestRegistration();
  const {
    isDark,
    navigate,
    fest,
    competition,
    isCompetitionRegistration,
    success,
    completingPayment,
    paymentResumeError,
    submissionProgress,
    setCompletingPayment,
    setPaymentResumeError,
    registrationId,
    loading,
    waitingOnAuth,
    hasAuth,
    showLogin,
    setShowLogin,
    showRegister,
    handleCloseLogin,
    handleCloseRegister,
    handleSwitchToRegister,
    handleSwitchToLogin,
    couponCode,
    setCouponCode,
    appliedCouponCode,
    setAppliedCouponCode,
    couponError,
    priceBreakdown,
    paymentError,
    paymentLoading,
    paymentModal,
    closePaymentModal,
    retryCheckoutRef,
    handleCashfreeFestRegister,
  } = r;

  if (completingPayment && !success) {
    return (
      <CompletingPaymentStep
        isDark={isDark}
        paymentResumeError={paymentResumeError}
        submissionProgress={submissionProgress}
        navigate={navigate}
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
        appliedCouponCode={appliedCouponCode}
        setAppliedCouponCode={setAppliedCouponCode}
        couponError={couponError}
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

  if (!fest && loading) {
    return (
      <>
        <div className={`crwdctrl-page crwdctrl-page--content min-h-screen pt-[calc(var(--safe-top)+0.5rem)] pb-32 ${isDark ? 'bg-[#0a0b0c]' : 'bg-gray-50'}`}>
          <div className="max-w-4xl mx-auto px-4 animate-pulse">
            <div className={`h-8 w-56 rounded-lg mb-6 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
            <div className={`rounded-2xl p-6 border space-y-4 ${isDark ? 'bg-[#1D1E20] border-gray-800' : 'bg-white border-gray-200'}`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`h-12 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
              ))}
            </div>
          </div>
        </div>
        {!hasAuth && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="pointer-events-auto h-full">
              <CrwdCtrlLogin
                googleOnly
                title="Sign in to register"
                subtitle="Your form is loading — one tap with Google to start"
                onClose={handleCloseLogin}
              />
            </div>
          </div>
        )}
      </>
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
      appliedCouponCode={appliedCouponCode}
      setAppliedCouponCode={setAppliedCouponCode}
      couponError={couponError}
      submitting={r.submitting}
      submissionProgress={submissionProgress}
      handleStepBack={r.handleStepBack}
      paymentModal={paymentModal}
      closePaymentModal={closePaymentModal}
      retryCheckoutRef={retryCheckoutRef}
      showLogin={showLogin || (!hasAuth && !!fest)}
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
