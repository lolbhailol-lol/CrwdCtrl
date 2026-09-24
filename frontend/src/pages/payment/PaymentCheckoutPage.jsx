import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import { normalizeCashfreeMode } from '../../utils/cashfreeCheckoutBridge';
import { getPendingPayment } from '../../utils/deepLinks';

/**
 * Web redirect checkout (crwdctrl.in). The Android app uses in-app native SDK or
 * in-app Cashfree JS modal — not this page.
 */
export default function PaymentCheckoutPage() {
  const [searchParams] = useSearchParams();
  const startedRef = useRef(false);
  const [status, setStatus] = useState('Opening secure payment…');
  const [error, setError] = useState('');

  const paymentSessionId = searchParams.get('payment_session_id')?.trim();
  const orderId = searchParams.get('order_id')?.trim();
  const checkoutMode = normalizeCashfreeMode(
    searchParams.get('mode') || import.meta.env.VITE_CASHFREE_MODE || 'production',
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!paymentSessionId) {
      setError('Payment session is missing. Go back and try again.');
      return;
    }

    (async () => {
      try {
        const cashfree = await load({ mode: checkoutMode });
        if (!cashfree) throw new Error('Cashfree could not load. Please try again.');
        setStatus('Redirecting to Cashfree…');

        const result = await cashfree.checkout({
          paymentSessionId,
          redirectTarget: '_self',
        });

        if (result?.error) {
          setError(result.error.message || 'Payment was cancelled');
          return;
        }

        if (result?.paymentDetails) {
          setStatus('Payment complete. Finishing your registration…');
          const pending = getPendingPayment();
          const target = pending?.entityType === 'competition_bundle' && pending?.returnPath
            ? pending.returnPath
            : `/payment/return?order_id=${encodeURIComponent(orderId || pending?.orderId || '')}`;
          window.location.replace(target);
          return;
        }
        setError('Cashfree did not open. Check your network and try again.');
      } catch (err) {
        setError(err.message || 'Could not open payment gateway');
      }
    })();
  }, [paymentSessionId, orderId, checkoutMode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#161718] text-white p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold">CrwdCtrl Payment</h1>
        {error ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-[#0ECCEE] px-4 py-3 font-semibold text-black"
            >
              Try Cashfree again
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-200"
            >
              Back to registration
            </button>
          </div>
        ) : (
          <p className="text-gray-300 text-sm">{status}</p>
        )}
        {orderId && (
          <p className="text-xs text-gray-500">Order: {orderId}</p>
        )}
      </div>
    </div>
  );
}
