import { Loader } from 'lucide-react';
import PaymentErrorModal from '../../../components/PaymentErrorModal';
import { goToBookings } from '../../../utils/paymentNavigation';
import { RegistrationStatusVisual, RegistrationProcessingOverlay } from '../../../components/RegistrationStatusVisual';

export function CompletingPaymentStep({
  isDark,
  paymentResumeError,
  paymentResumeOrderId,
  paymentResumeWasPaid = false,
  submissionProgress,
  navigate,
  onReturnToForm,
  onRetryResume,
}) {
  return (
    <div className={`crwdctrl-page crwdctrl-page--flat min-h-screen flex flex-col items-center justify-center px-4 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
      {paymentResumeError ? (
        <div className="text-center max-w-md mx-auto p-6">
          <p className={`text-sm mb-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
            {paymentResumeWasPaid
              ? 'Payment received, but registration could not be completed.'
              : 'We couldn’t complete your registration.'}
          </p>
          <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{paymentResumeError}</p>
          {paymentResumeOrderId ? (
            <p className={`text-xs mb-6 font-mono ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Order ID: {paymentResumeOrderId}
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            {onRetryResume ? (
              <button
                type="button"
                onClick={onRetryResume}
                className="w-full px-6 py-3 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
              >
                Retry registration
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goToBookings(navigate)}
              className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                onRetryResume
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
              onClick={onReturnToForm}
              className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                isDark ? 'border border-gray-600 text-gray-200 hover:bg-gray-800' : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
              }`}
            >
              Return to form
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`w-full max-w-sm rounded-3xl border p-8 ${
            isDark ? 'bg-[#121314] border-white/10' : 'bg-white border-gray-200 shadow-xl'
          }`}
        >
          <RegistrationStatusVisual
            mode={/pay|cashfree|checkout/i.test(String(submissionProgress || '')) ? 'payment' : 'server'}
            title="Finishing registration"
            subtitle="This usually takes a few seconds"
            progressMessage={submissionProgress || 'Confirming payment & saving your booking…'}
            isDark={isDark}
          />
        </div>
      )}
    </div>
  );
}

export default function PaymentStep({
  isDark,
  fest,
  competition,
  couponCode,
  handleCouponCodeChange,
  applyCouponCode,
  appliedCouponCode,
  couponError,
  couponQuoting,
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
    <div className="crwdctrl-page crwdctrl-page--flat min-h-screen flex items-center justify-center px-4">
      <RegistrationProcessingOverlay
        open={paymentLoading}
        isDark={isDark}
        mode="payment"
        title="Processing payment"
        subtitle="Secure checkout is opening"
        progressMessage="Connecting to Cashfree…"
      />
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
      <div className={`w-full max-w-md rounded-2xl p-8 text-center shadow-xl ${isDark ? 'bg-[#1D1E20]' : 'bg-white'}`}>
        <div className="mb-6">
          {fest.coverImage && (
            <img src={fest.coverImage} alt={fest.festName} className="w-24 h-24 object-cover rounded-full mx-auto mb-4" />
          )}
          <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{fest.festName}</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fest.collegeName}</p>
        </div>

        <div className={`rounded-xl p-5 mb-6 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
          <div className="mb-3">
            <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Coupon code</p>
            <div className={`flex overflow-hidden rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
              <input
                value={couponCode}
                onChange={(e) => handleCouponCodeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCouponCode();
                  }
                }}
                placeholder="Enter coupon"
                autoComplete="off"
                className={`flex-1 min-w-0 px-3 py-2.5 text-sm border-0 outline-none focus:ring-0 ${isDark ? 'bg-[#1D1E20] text-white placeholder:text-gray-500' : 'bg-white text-gray-900 placeholder:text-gray-400'}`}
              />
              <button
                type="button"
                disabled={couponQuoting || !couponCode.trim()}
                onClick={applyCouponCode}
                className="shrink-0 px-4 py-2.5 bg-[#0ECCEE] text-black font-semibold text-sm hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {couponQuoting
                  ? 'Checking…'
                  : Number(priceBreakdown?.couponDiscount || 0) > 0 && (appliedCouponCode || '').toUpperCase() === couponCode.trim().toUpperCase()
                    ? 'Applied'
                    : 'Apply'}
              </button>
            </div>
            {couponError ? <p className="text-xs text-red-400 mt-1">{couponError}</p> : null}
            {Number(priceBreakdown?.couponDiscount || 0) > 0 && appliedCouponCode ? (
              <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-300 text-green-700'}`}>
                Coupon `{appliedCouponCode}` applied · You save ₹{priceBreakdown.couponDiscount}
              </div>
            ) : null}
          </div>
          <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Payment Breakdown</p>
          {priceBreakdown && (
            <div className={`space-y-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex justify-between gap-4">
                <span>Ticket Price</span>
                <span>₹{priceBreakdown.ticketPrice}</span>
              </div>
              {Number(priceBreakdown.platformFee || 0) > 0 ? (
                <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span>Platform Fee</span>
                  <span>₹{priceBreakdown.platformFee}</span>
                </div>
              ) : null}
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
          onClick={onPay}
          disabled={paymentLoading || !priceBreakdown}
          className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {paymentLoading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Processing…
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
