import { ArrowLeft, Loader, CheckCircle } from 'lucide-react';
import CrwdCtrlLogin from '../../auth/login';
import CrwdCtrlRegister from '../../auth/register';
import PaymentErrorModal from '../../../components/PaymentErrorModal';
import FestRegistrationField from './FestRegistrationField';
import { generateFieldId } from './helpers';
import {
  TeamSizeSelect,
  TeamDetailsStep,
  FeeTierStep,
  RosterPersonStep,
} from '../../../features/fests/mindspark';
import { getFestPluginFromAny } from '../../../features/fests/plugins';
import { RegistrationProcessingOverlay } from '../../../components/RegistrationStatusVisual';
import { useInAppBack } from '../../../hooks/useInAppBack';

export default function FestRegistrationForm({
  isDark,
  fest,
  competition,
  isCompetitionRegistration,
  formLocked = false,
  authSyncing = false,
  notice,
  error,
  handleSubmit,
  isMultiStepForm,
  isEffectiveMultiStep,
  isOnParticipantStep,
  isOnTeamDetailsStep,
  isOnFeeTierStep,
  isOnPersonStep,
  getPersonIndex,
  hasParticipantStep,
  getStepMeta,
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
  handleCouponCodeChange,
  applyCouponCode,
  appliedCouponCode,
  couponError,
  couponQuoting,
  submitting,
  processOverlayMode = 'server',
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
  const goBack = useInAppBack();
  const hideFestCommonForm =
    Boolean(isCompetitionRegistration)
    && getFestPluginFromAny(fest, competition?.fest, competition).skipFestCommonFormOnCompetition;
  const onParticipantStep = typeof isOnParticipantStep === 'function' && isOnParticipantStep();
  const onTeamDetailsStep = typeof isOnTeamDetailsStep === 'function' && isOnTeamDetailsStep();
  const onFeeTierStep = typeof isOnFeeTierStep === 'function' && isOnFeeTierStep();
  const onPersonStep = typeof isOnPersonStep === 'function' && isOnPersonStep();

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
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen pt-[calc(var(--safe-top)+1.25rem)] sm:pt-[calc(var(--safe-top)+1.5rem)] pb-40 sm:pb-32 md:pb-20">
      {paymentModalEl}
      <RegistrationProcessingOverlay
        open={Boolean(submitting)}
        isDark={isDark}
        mode={
          processOverlayMode
          || (/pay|cashfree|checkout/i.test(String(submissionProgress || ''))
            ? 'payment'
            : 'server')
        }
        title={
          processOverlayMode === 'success'
            ? "You're registered"
            : processOverlayMode === 'error'
              ? 'Couldn’t finish'
              : paymentFields
                ? 'Confirming your booking'
                : /pay|cashfree/i.test(String(submissionProgress || ''))
                  ? 'Starting payment'
                  : 'Sending to server'
        }
        subtitle={
          processOverlayMode === 'success'
            ? 'Booking confirmed'
            : processOverlayMode === 'error'
              ? 'Check the message and try again'
              : 'Waiting for an instant response'
        }
        progressMessage={submissionProgress || 'Processing your registration…'}
      />
      <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 transition-opacity duration-300 ${formLocked ? 'opacity-90' : ''}`}>
        {formLocked && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${isDark ? 'bg-[#0ECCEE]/10 border-[#0ECCEE]/30 text-[#0ECCEE]' : 'bg-cyan-50 border-cyan-200 text-cyan-800'}`}>
            {authSyncing
              ? 'Finishing sign-in…'
              : 'Preview the form below — sign in with Google to fill and submit.'}
          </div>
        )}
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6 mt-1 sm:mt-0">
          <button
            onClick={goBack}
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
        <div className={`rounded-2xl p-4 sm:p-6 border transition-all duration-300 ${
          isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'
        } ${formLocked ? 'pointer-events-none select-none blur-[2px] saturate-75' : ''}`}>
          <form
            noValidate={Boolean(hasParticipantStep?.())}
            onSubmit={(e) => { if (formLocked) { e.preventDefault(); return; } handleSubmit(e); }}
            className="space-y-4"
          >
            {/* Multi-step progress (fest steps and/or competition Team size → Details) */}
            {isEffectiveMultiStep() && (
              <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</h3>
                  <div className="text-right">
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {currentStep} of {getTotalSteps()}</span>
                  </div>
                </div>

                <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / getTotalSteps()) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between gap-2 overflow-x-auto pb-1">
                  {getStepMeta().map((step) => (
                    <div key={step.stepNumber} className="flex flex-col items-center min-w-0 flex-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        step.stepNumber === currentStep
                          ? 'bg-[#0ECCEE] text-black'
                          : completedSteps.has(step.stepNumber)
                            ? 'bg-green-600 text-white'
                            : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {completedSteps.has(step.stepNumber) ? '✓' : step.stepNumber}
                      </div>
                      <span className={`text-xs mt-1 text-center max-w-24 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {step.stepTitle}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MindSpark: waiting for competition → roster shell, not fest form */}
            {hideFestCommonForm && !hasParticipantStep?.() && (
              <div className={`rounded-2xl border p-6 animate-pulse ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200'}`}>
                <div className={`h-4 w-24 rounded mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
                <div className={`h-10 w-full max-w-sm rounded mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
                <div className={`h-10 w-full max-w-sm rounded ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
              </div>
            )}

            {onFeeTierStep ? (
              <FeeTierStep
                competition={competition}
                formData={formData}
                setFormData={setFormData}
                isDark={isDark}
              />
            ) : null}

            {onParticipantStep ? (
              <TeamSizeSelect
                competition={competition}
                formData={formData}
                setFormData={setFormData}
                isDark={isDark}
              />
            ) : null}

            {onTeamDetailsStep ? (
              <TeamDetailsStep
                competition={competition}
                formData={formData}
                setFormData={setFormData}
                isDark={isDark}
              />
            ) : null}

            {/* Person details (solo = step 1; teams = after size + team details) */}
            {onPersonStep ? (
              <RosterPersonStep
                personIndex={getPersonIndex()}
                competition={competition}
                formData={formData}
                setFormData={setFormData}
                isDark={isDark}
              />
            ) : null}

            {/* Fest MULTI_STEP — never for MindSpark roster comps */}
            {isMultiStepForm() && !hideFestCommonForm && !hasParticipantStep?.() && !onParticipantStep && !onTeamDetailsStep && !onFeeTierStep && !onPersonStep && (
              <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                {(() => {
                  const meta = getStepMeta().find((s) => s.stepNumber === currentStep);
                  return (
                    <>
                      <h3 className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {meta?.stepTitle || 'Details'}
                      </h3>
                      {meta?.stepDescription ? (
                        <p className={`text-sm mb-4 mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {meta.stepDescription}
                        </p>
                      ) : null}
                      <div className={`border-b mb-4 ${isDark ? 'border-gray-700/70' : 'border-gray-200'}`} />
                    </>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {getCurrentStepFields().map((field) => {
                    const fieldId = generateFieldId(field);
                    const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image'
                      || field.type === 'checkbox' || field.type === 'radio';
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
                  })}
                </div>
              </div>
            )}

            {/* Single-step fest schema — never for MindSpark roster comps */}
            {!isMultiStepForm() && !hideFestCommonForm && !hasParticipantStep?.() && !onParticipantStep && !onTeamDetailsStep && !onFeeTierStep && !onPersonStep && (fest.registration?.formSchema || []).length > 0 && (
              <div className="space-y-4">
                <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 pb-2.5 border-b ${isDark ? 'text-gray-400 border-gray-700/70' : 'text-gray-500 border-gray-200'}`}>
                    Registration Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {(fest.registration?.formSchema || []).map((field) => {
                      const fieldId = generateFieldId(field);
                      const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image'
                        || field.type === 'checkbox' || field.type === 'radio';
                      return (
                        <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                          <FestRegistrationField
                            field={field}
                            fieldId={fieldId}
                            currentData={formData}
                            onFieldChange={(id, value) => setFormData((prev) => ({ ...prev, [id]: value }))}
                            isDark={isDark}
                            fest={fest}
                            uploadingFiles={uploadingFiles}
                            onFileUpload={handleFileUpload}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Fee box — amount first, coupon secondary */}
            {!paymentFields && !onFeeTierStep && !onParticipantStep && !onTeamDetailsStep && (!onPersonStep || currentStep === getTotalSteps()) && (() => {
              if (!priceBreakdown) return null;
              const total = Number(priceBreakdown.totalAmount) || 0;
              const saved = Number(priceBreakdown.couponDiscount) || 0;
              const couponApplied =
                saved > 0 && (appliedCouponCode || '').toUpperCase() === (couponCode || '').trim().toUpperCase();
              return (
                <div className={`rounded-2xl overflow-hidden border ${isDark ? 'border-gray-700/60 bg-[#111213]' : 'border-gray-200 bg-white shadow-sm'}`}>
                  <div className={`px-4 py-4 sm:px-5 ${isDark ? 'bg-gradient-to-br from-[#0ECCEE]/10 to-transparent' : 'bg-gradient-to-br from-cyan-50 to-white'}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Amount payable
                    </p>
                    <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl sm:text-4xl font-bold tabular-nums text-[#0ECCEE]">
                        ₹{total.toLocaleString('en-IN')}
                      </span>
                      {couponApplied ? (
                        <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          −₹{saved.toLocaleString('en-IN')} saved
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-[11px] mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Secure checkout via Cashfree
                    </p>
                  </div>

                  <div className={`px-4 py-3 sm:px-5 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                    <p className={`text-[11px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Have a coupon?</p>
                    <div className="flex gap-2">
                      <input
                        value={couponCode}
                        onChange={(e) => handleCouponCodeChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            applyCouponCode();
                          }
                        }}
                        placeholder="Code"
                        autoComplete="off"
                        className={`flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm outline-none focus:border-[#0ECCEE] ${
                          isDark
                            ? 'bg-[#1D1E20] border-gray-700 text-white placeholder:text-gray-600'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                        }`}
                      />
                      <button
                        type="button"
                        disabled={couponQuoting || !couponCode.trim()}
                        onClick={applyCouponCode}
                        className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          couponApplied
                            ? isDark
                              ? 'bg-green-900/40 text-green-300 border border-green-700/40'
                              : 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-[#0ECCEE] text-black hover:bg-[#0ECCEE]/90 active:scale-[0.98]'
                        }`}
                      >
                        {couponQuoting ? '…' : couponApplied ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                    {couponError ? <p className="text-xs text-red-400 mt-1.5">{couponError}</p> : null}
                  </div>
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
                onClick={isEffectiveMultiStep() && currentStep > 1 ? handleStepBack : goBack}
                className={`px-4 sm:px-6 py-3 rounded-xl border font-medium transition-colors text-sm sm:text-base ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}
                disabled={submitting}
              >
                {isEffectiveMultiStep() && currentStep > 1 ? 'Previous Step' : 'Cancel'}
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
                    <span>Processing…</span>
                  </>
                ) : (() => {
                  if (isEffectiveMultiStep() && currentStep < getTotalSteps()) {
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
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="pointer-events-auto h-full">
            <CrwdCtrlLogin
              googleOnly
              title="Sign in to register"
              subtitle="Sign in once — you stay signed in on this phone"
              onClose={handleCloseLogin}
            />
          </div>
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
