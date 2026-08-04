import { ArrowLeft, Loader, CheckCircle } from 'lucide-react';
import CrwdCtrlLogin from '../../auth/login';
import CrwdCtrlRegister from '../../auth/register';
import PaymentErrorModal from '../../../components/PaymentErrorModal';
import FestRegistrationField from './FestRegistrationField';
import { generateFieldId } from './helpers';

export default function FestRegistrationForm({
  isDark,
  navigate,
  fest,
  competition,
  isCompetitionRegistration,
  notice,
  error,
  handleSubmit,
  isMultiStepForm,
  currentStep,
  getTotalSteps,
  completedSteps,
  getCurrentStepFields,
  getCurrentStepData,
  handleStepFieldChange,
  formData,
  setFormData,
  paymentFields,
  priceBreakdown,
  couponCode,
  setCouponCode,
  appliedCouponCode,
  setAppliedCouponCode,
  couponError,
  submitting,
  submissionProgress,
  handleStepBack,
  paymentModal,
  closePaymentModal,
  retryCheckoutRef,
  showLogin,
  showRegister,
  handleCloseLogin,
  handleCloseRegister,
  handleSwitchToRegister,
  handleSwitchToLogin,
  uploadingFiles,
  handleFileUpload,
}) {
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
                          <FestRegistrationField
                            field={field}
                            fieldId={fieldId}
                            currentData={getCurrentStepData()}
                            onFieldChange={handleStepFieldChange}
                            isDark={isDark}
                            fest={fest}
                            uploadingFiles={uploadingFiles}
                            onFileUpload={handleFileUpload}
                          />
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
                          <FestRegistrationField
                            field={field}
                            fieldId={fieldId}
                            currentData={formData}
                            onFieldChange={(id, value) => setFormData(prev => ({ ...prev, [id]: value }))}
                            isDark={isDark}
                            fest={fest}
                            uploadingFiles={uploadingFiles}
                            onFileUpload={handleFileUpload}
                          />
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
                  <div className="mb-3">
                    <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Coupon code</p>
                    <div className="flex gap-2">
                      <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter coupon" className={`flex-1 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#1D1E20] border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                      <button type="button" onClick={() => setAppliedCouponCode(couponCode.trim().toUpperCase())} className="px-3 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm">{Number(priceBreakdown?.couponDiscount || 0) > 0 && (appliedCouponCode || '').toUpperCase() === couponCode.trim().toUpperCase() ? 'Applied' : 'Apply'}</button>
                    </div>
                    {couponError ? <p className="text-xs text-red-400 mt-1">{couponError}</p> : null}
                    {Number(priceBreakdown?.couponDiscount || 0) > 0 ? (
                      <div className={`mt-2 rounded-lg border px-3 py-2 text-xs transition-all duration-300 animate-pulse ${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-300 text-green-700'}`}>
                        Coupon `{appliedCouponCode || couponCode}` applied · You save ₹{priceBreakdown.couponDiscount}
                      </div>
                    ) : null}
                  </div>
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
                    {Number(priceBreakdown.couponDiscount || 0) > 0 ? (
                      <div className="flex justify-between gap-4 text-green-400">
                        <span>Coupon Discount</span>
                        <span>-₹{priceBreakdown.couponDiscount}</span>
                      </div>
                    ) : null}
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
          <CrwdCtrlLogin
            googleOnly
            title="Sign in to register"
            subtitle="One tap with Google — then finish registration"
            onClose={handleCloseLogin}
          />
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
