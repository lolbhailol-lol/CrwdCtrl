import { Loader } from 'lucide-react';
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
