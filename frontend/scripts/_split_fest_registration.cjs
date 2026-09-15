/**
 * Split FestRegistration.jsx into FestRegistration/ colocated modules.
 * node frontend/scripts/_split_fest_registration.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/pages/fests/FestRegistration.jsx');
const OUT_DIR = path.join(ROOT, 'src/pages/fests/FestRegistration');

const original = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const lines = original.split('\n');

function slice(start, endInclusive) {
  return lines.slice(start - 1, endInclusive).join('\n');
}

function fixDeepImports(code) {
  return code
    .replace(/from '\.\.\/\.\.\/context\//g, "from '../../../context/")
    .replace(/from '\.\.\/auth\//g, "from '../../auth/")
    .replace(/from '\.\.\/\.\.\/utils\//g, "from '../../../utils/")
    .replace(/from '\.\.\/\.\.\/components\//g, "from '../../../components/")
    .replace(/from '\.\.\/\.\.\/hooks\//g, "from '../../../hooks/")
    .replace(/from '\.\.\/\.\.\/services\//g, "from '../../../services/");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════════
// 1. helpers.js
// ═══════════════════════════════════════════════════════════
const helpers = `import {
  getPendingPayment,
  shouldResumePendingPayment,
} from '../../../utils/deepLinks';

export function getInitialFestRegistrationUi(pathname, search) {
  const currentPath = \`\${pathname}\${search}\`;
  const resumingPayment = shouldResumePendingPayment(
    getPendingPayment(),
    currentPath,
    search,
  );
  return { completingPayment: resumingPayment };
}

export function generateFieldId(field) {
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
    return \`field_\${labelToSanitize.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}\`;
  }
  return 'unknown_field';
}

export function compressImage(file) {
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
}
`;
fs.writeFileSync(path.join(OUT_DIR, 'helpers.js'), helpers);

// ═══════════════════════════════════════════════════════════
// 2. FestRegistrationField.jsx — extract renderField body
// ═══════════════════════════════════════════════════════════
// Original renderField: lines 691-1088
// Inside: switch starts 694, cases 695-1087, closing }; 1088
let fieldSwitch = slice(695, 1087);
fieldSwitch = fieldSwitch.replace(/handleFileUpload\(file, fieldId\)/g, 'onFileUpload(file, fieldId)');

const fieldComponent = `import { Loader } from 'lucide-react';
import { scrollFieldIntoView } from '../../../utils/registrationDraft';

export default function FestRegistrationField({
  field,
  fieldId,
  currentData,
  onFieldChange,
  isDark,
  fest,
  uploadingFiles,
  onFileUpload,
}) {
  return (
    <div className="space-y-2">
      <label className={\`block text-sm font-medium mb-1.5 \${isDark ? 'text-white' : 'text-gray-900'}\`}>
        {field.label}
        {field.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        {renderField(field, fieldId, currentData, onFieldChange, {
          isDark,
          fest,
          uploadingFiles,
          onFileUpload,
        })}
      </div>
    </div>
  );
}

function renderField(field, fieldId, currentData, onFieldChange, ctx) {
  const { isDark, fest, uploadingFiles, onFileUpload } = ctx;
  const value = currentData[fieldId] || '';

  switch (field.type) {
${fieldSwitch}
  }
}
`;
fs.writeFileSync(path.join(OUT_DIR, 'FestRegistrationField.jsx'), fieldComponent);

// ═══════════════════════════════════════════════════════════
// 3. SuccessStep.jsx
// ═══════════════════════════════════════════════════════════
const successStep = `import { CheckCircle } from 'lucide-react';
import { goToBookings } from '../../../utils/paymentNavigation';

export default function SuccessStep({
  isDark,
  isCompetitionRegistration,
  competition,
  fest,
  registrationId,
  navigate,
}) {
  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto p-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
        <h1 className={\`text-3xl font-bold mb-4 \${isDark ? 'text-white' : 'text-gray-900'}\`}>🎉 Registration Successful!</h1>
        <p className={\`mb-4 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
          Your registration for <span className="text-[#0ECCEE] font-semibold">
            {isCompetitionRegistration ? competition?.name : fest?.festName}
          </span> has been submitted successfully.
        </p>
        <p className={\`text-sm mb-6 \${isDark ? 'text-gray-500' : 'text-gray-400'}\`}>
          Download your ticket or view all bookings whenever you&apos;re ready.
        </p>
        <div className="flex flex-col gap-3">
          {registrationId && (
            <button
              type="button"
              onClick={() => navigate(\`/qr-ticket/\${registrationId}\`, { state: { refreshBookings: true } })}
              className="w-full px-6 py-3 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
            >
              Download Ticket
            </button>
          )}
          <button
            type="button"
            onClick={() => goToBookings(navigate)}
            className={\`w-full px-6 py-3 rounded-lg font-semibold transition-colors \${
              registrationId
                ? isDark
                  ? 'border border-gray-600 text-gray-200 hover:bg-gray-800'
                  : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                : 'bg-[#0ECCEE] text-black hover:bg-[#0ECCEE]/80'
            }\`}
          >
            View My Bookings
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className={\`w-full py-2 text-sm font-medium \${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}\`}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(path.join(OUT_DIR, 'SuccessStep.jsx'), successStep);

// ═══════════════════════════════════════════════════════════
// 4. PaymentStep.jsx — completing payment + direct Cashfree UI
// ═══════════════════════════════════════════════════════════
const paymentStep = `import { Loader } from 'lucide-react';
import PaymentErrorModal from '../../../components/PaymentErrorModal';
import { goToBookings } from '../../../utils/paymentNavigation';

export function CompletingPaymentStep({
  isDark,
  paymentResumeError,
  submissionProgress,
  navigate,
  onReturnToForm,
}) {
  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex flex-col items-center justify-center px-4">
      {paymentResumeError ? (
        <div className="text-center max-w-md mx-auto p-6">
          <p className={\`text-sm mb-2 \${isDark ? 'text-red-300' : 'text-red-600'}\`}>
            Payment received, but registration could not be completed.
          </p>
          <p className={\`text-sm mb-6 \${isDark ? 'text-gray-400' : 'text-gray-600'}\`}>{paymentResumeError}</p>
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
              onClick={onReturnToForm}
              className={\`w-full px-6 py-3 rounded-lg font-semibold transition-colors \${
                isDark ? 'border border-gray-600 text-gray-200 hover:bg-gray-800' : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
              }\`}
            >
              Return to form
            </button>
          </div>
        </div>
      ) : (
        <>
          <Loader className="w-8 h-8 animate-spin text-[#0ECCEE] mb-4" />
          <p className={\`text-sm text-center \${isDark ? 'text-gray-300' : 'text-gray-600'}\`}>
            {submissionProgress || 'Completing your registration...'}
          </p>
        </>
      )}
    </div>
  );
}

export default function PaymentStep({
  isDark,
  fest,
  competition,
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
  onRetryCheckout,
  onPay,
  navigate,
}) {
  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
      <PaymentErrorModal
        open={paymentModal.open}
        message={paymentModal.message}
        orderId={paymentModal.orderId}
        onClose={closePaymentModal}
        onRetry={() => {
          closePaymentModal();
          onRetryCheckout?.();
        }}
      />
      <div className={\`w-full max-w-md rounded-2xl p-8 text-center shadow-xl \${isDark ? 'bg-[#1D1E20]' : 'bg-white'}\`}>
        <div className="mb-6">
          {fest.coverImage && (
            <img src={fest.coverImage} alt={fest.festName} className="w-24 h-24 object-cover rounded-full mx-auto mb-4" />
          )}
          <h1 className={\`text-2xl font-bold mb-1 \${isDark ? 'text-white' : 'text-gray-900'}\`}>{fest.festName}</h1>
          <p className={\`text-sm \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>{fest.collegeName}</p>
        </div>

        <div className={\`rounded-xl p-5 mb-6 \${isDark ? 'bg-[#111213]' : 'bg-gray-50'}\`}>
          <div className="mb-3">
            <p className={\`text-sm mb-2 \${isDark ? 'text-gray-300' : 'text-gray-700'}\`}>Coupon code</p>
            <div className="flex gap-2">
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter coupon" className={\`flex-1 px-3 py-2 rounded-lg border \${isDark ? 'bg-[#1D1E20] border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}\`} />
              <button type="button" onClick={() => setAppliedCouponCode(couponCode.trim().toUpperCase())} className="px-3 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm">{Number(priceBreakdown?.couponDiscount || 0) > 0 && (appliedCouponCode || '').toUpperCase() === couponCode.trim().toUpperCase() ? 'Applied' : 'Apply'}</button>
            </div>
            {couponError ? <p className="text-xs text-red-400 mt-1">{couponError}</p> : null}
            {Number(priceBreakdown?.couponDiscount || 0) > 0 ? (
              <div className={\`mt-2 rounded-lg border px-3 py-2 text-xs transition-all duration-300 animate-pulse \${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-300 text-green-700'}\`}>
                Coupon \`{appliedCouponCode || couponCode}\` applied · You save ₹{priceBreakdown.couponDiscount}
              </div>
            ) : null}
          </div>
          <p className={\`text-sm mb-3 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>Payment Breakdown</p>
          {priceBreakdown && (
            <div className={\`space-y-1.5 text-sm \${isDark ? 'text-gray-300' : 'text-gray-700'}\`}>
              <div className="flex justify-between gap-4">
                <span>Ticket Price</span>
                <span>₹{priceBreakdown.ticketPrice}</span>
              </div>
              <div className={\`flex justify-between gap-4 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
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
          )}
          <p className={\`text-xs mt-2 \${isDark ? 'text-gray-500' : 'text-gray-400'}\`}>Includes all charges · Secure payment via Cashfree</p>
        </div>

        {competition && (
          <p className={\`text-sm mb-4 \${isDark ? 'text-gray-300' : 'text-gray-600'}\`}>
            Registering for: <span className="font-semibold">{competition.name}</span>
          </p>
        )}

        {paymentError && (
          <p className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800 rounded-lg p-2">{paymentError}</p>
        )}

        <button
          onClick={onPay}
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
            \`Pay ₹\${Number(priceBreakdown.totalAmount).toLocaleString('en-IN')} & Book\`
          )}
        </button>

        <button
          onClick={() => navigate(-1)}
          className={\`w-full mt-3 py-2.5 rounded-xl text-sm \${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'} transition\`}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(path.join(OUT_DIR, 'PaymentStep.jsx'), paymentStep);

console.log('Wrote helpers, field, success, payment');
console.log('Next: useFestRegistration + Form + index via transform of original...');

// ═══════════════════════════════════════════════════════════
// 5. Build useFestRegistration.js from original logic body
// ═══════════════════════════════════════════════════════════
// Strategy: take the whole component, strip JSX returns / UI helpers,
// wrap remaining as a hook that returns a bag of values.

// We'll create useFestRegistration by taking lines 52-2019 (function body start through handleSubmitRef)
// and adapting it, then appending handleCashfreeFestRegister from 2162-2246,
// then a return statement listing all exports.

// Simpler reliable approach: copy entire original into index.jsx with path fixes,
// then surgically replace sections with imports. Given complexity of mid-function
// early returns after handleCashfree definition, keep logic+orchestration in
// useFestRegistration returning BOTH data and prebuilt "view" flags, and put
// ALL JSX in components/index.

// Most reliable: put ALL non-JSX logic in the hook by extracting the function
// body and removing JSX-only blocks, moving handleCashfree before returns.

const hookImports = `import { useState, useEffect, useRef } from 'react';
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
} from '../../../utils/paymentNavigation';
import {
  clearRegistrationDraft,
  festRegDraftKey,
  loadRegistrationDraft,
  saveRegistrationDraft,
  applyRegistrationDraft,
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
import { API_BASE_URL } from '../../../services/api/client';
import { festRegisterPath } from '../../../utils/slugRoutes';
import { getInitialFestRegistrationUi, generateFieldId, compressImage } from './helpers';
`;

// Extract body pieces:
// Lines 53-674: from start of function through clearCashfreeReturnParams (before renderFormField)
// Skip 675-1088 (render helpers)
// Lines 1092-2019: fetch through handleSubmitRef
// Lines 2162-2247: handleCashfreeFestRegister + closePaymentModal

let logicPart1 = slice(53, 674); // includes generateFieldId local - remove it
// Remove local getInitial usage stays; remove generateFieldId function definition (485-501)
logicPart1 = logicPart1.replace(
  /\n  \/\/ Helper function to generate consistent field IDs\n  const generateFieldId = \(field\) => \{[\s\S]*?return 'unknown_field';\n  \};\n/,
  '\n',
);

let logicPart2 = slice(1092, 2019);
// Remove compressImage local definition (1352-1397) — it's now in helpers
logicPart2 = logicPart2.replace(
  /\n  \/\/ ✅ PERFORMANCE: Image compression function\n  const compressImage = \(file\) => \{[\s\S]*?img\.src = URL\.createObjectURL\(file\);\n  \};\n/,
  '\n',
);

const cashfreeHandler = slice(2162, 2247);

const hookReturn = `
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
    appliedCouponCode,
    setAppliedCouponCode,
    couponError,
    showLogin,
    setShowLogin,
    showRegister,
    setShowRegister,
    authSyncExpired,
    paymentResumeError,
    setPaymentResumeError,
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
`;

const useFestRegistration = `${hookImports}
export default function useFestRegistration() {
${logicPart1}

${logicPart2}

${cashfreeHandler}
${hookReturn}
`;

fs.writeFileSync(path.join(OUT_DIR, 'useFestRegistration.js'), useFestRegistration);

// ═══════════════════════════════════════════════════════════
// 6. FestRegistrationForm.jsx — main form UI
// ═══════════════════════════════════════════════════════════
const formJsx = slice(2472, 2757); // inner of final return (div ... )

const festRegistrationForm = `import { ArrowLeft, Loader, CheckCircle } from 'lucide-react';
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
${formJsx
  .replace(
    /\{renderFormField\(field, fieldId, getCurrentStepData\(\), handleStepFieldChange\)\}/g,
    `{<FestRegistrationField
                            field={field}
                            fieldId={fieldId}
                            currentData={getCurrentStepData()}
                            onFieldChange={handleStepFieldChange}
                            isDark={isDark}
                            fest={fest}
                            uploadingFiles={uploadingFiles}
                            onFileUpload={handleFileUpload}
                          />}`,
  )
  .replace(
    /\{renderFormField\(field, fieldId, formData, \(fieldId, value\) => setFormData\(prev => \(\{ \.\.\.prev, \[fieldId\]: value \}\)\)\)\}/g,
    `{<FestRegistrationField
                            field={field}
                            fieldId={fieldId}
                            currentData={formData}
                            onFieldChange={(id, value) => setFormData(prev => ({ ...prev, [id]: value }))}
                            isDark={isDark}
                            fest={fest}
                            uploadingFiles={uploadingFiles}
                            onFileUpload={handleFileUpload}
                          />}`,
  )}
  );
}
`;

fs.writeFileSync(path.join(OUT_DIR, 'FestRegistrationForm.jsx'), festRegistrationForm);

// ═══════════════════════════════════════════════════════════
// 7. index.jsx — orchestrator
// ═══════════════════════════════════════════════════════════
const indexJsx = `import { Loader } from 'lucide-react';
import CrwdCtrlLogin from '../../auth/login';
import CrwdCtrlRegister from '../../auth/register';
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
          <div className={\`w-full max-w-md rounded-2xl p-8 text-center shadow-xl \${isDark ? 'bg-[#1D1E20]' : 'bg-white'}\`}>
            <h1 className={\`text-xl font-bold mb-2 \${isDark ? 'text-white' : 'text-gray-900'}\`}>Log in to register</h1>
            <p className={\`text-sm mb-6 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
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

  if (!fest) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className={\`text-2xl font-bold mb-4 \${isDark ? 'text-white' : 'text-gray-900'}\`}>Fest Not Found</h1>
          <p className={\`mb-6 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>The requested fest could not be found or may have been removed.</p>
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
          <h1 className={\`text-2xl font-bold mb-4 \${isDark ? 'text-white' : 'text-gray-900'}\`}>Registration Not Available</h1>
          <p className={\`mb-4 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
            This fest does not accept internal form registrations.
          </p>
          <div className={\`rounded-lg p-4 mb-6 border \${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}\`}>
            <p className={\`text-sm \${isDark ? 'text-yellow-300' : 'text-yellow-700'}\`}>
              Current registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
            </p>
            <p className={\`text-sm mt-1 \${isDark ? 'text-yellow-300' : 'text-yellow-700'}\`}>
              Expected mode: <span className="font-mono">INTERNAL_FORM</span>
            </p>
          </div>
          {fest.registration?.mode === 'EXTERNAL_LINK' && fest.registration?.externalLink && (
            <div className="mb-6">
              <p className={\`mb-3 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>Registration is available via external link:</p>
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
            <h1 className={\`text-2xl font-bold mb-4 \${isDark ? 'text-white' : 'text-gray-900'}\`}>Competition Registration Not Available</h1>
            <p className={\`mb-4 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
              This competition uses fest registration, but the fest does not accept internal form registrations.
            </p>
            <div className={\`rounded-lg p-4 mb-6 border \${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}\`}>
              <p className={\`text-sm \${isDark ? 'text-yellow-300' : 'text-yellow-700'}\`}>
                Fest registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
              </p>
              <p className={\`text-sm mt-1 \${isDark ? 'text-yellow-300' : 'text-yellow-700'}\`}>
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
            <h1 className={\`text-2xl font-bold mb-4 \${isDark ? 'text-white' : 'text-gray-900'}\`}>Competition Registration Not Available</h1>
            <p className={\`mb-4 \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>
              This competition has custom registration, but internal form registration is not enabled.
            </p>
            <div className={\`rounded-lg p-4 mb-6 border \${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}\`}>
              <p className={\`text-sm \${isDark ? 'text-yellow-300' : 'text-yellow-700'}\`}>
                Competition registration status: <span className="font-mono">{competition?.registration?.status || 'NOT_SET'}</span>
              </p>
              <p className={\`text-sm mt-1 \${isDark ? 'text-yellow-300' : 'text-yellow-700'}\`}>
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
      showLogin={showLogin}
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
`;

fs.writeFileSync(path.join(OUT_DIR, 'index.jsx'), indexJsx);

// ═══════════════════════════════════════════════════════════
// 8. Thin re-export at original path
// ═══════════════════════════════════════════════════════════
fs.writeFileSync(
  SRC,
  `export { default } from './FestRegistration/index.jsx';\n`,
);

// Report line counts
const files = [
  'helpers.js',
  'useFestRegistration.js',
  'FestRegistrationField.jsx',
  'FestRegistrationForm.jsx',
  'PaymentStep.jsx',
  'SuccessStep.jsx',
  'index.jsx',
];
console.log('\n=== Line counts ===');
for (const f of files) {
  const p = path.join(OUT_DIR, f);
  const n = fs.readFileSync(p, 'utf8').split('\n').length;
  console.log(f + ': ' + n);
}
console.log('FestRegistration.jsx (re-export):', fs.readFileSync(SRC, 'utf8').split('\n').length);
console.log('\nDone.');
