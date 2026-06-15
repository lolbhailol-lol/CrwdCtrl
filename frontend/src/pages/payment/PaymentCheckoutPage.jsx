import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';

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

  useEffect(() => {
    if (startedRef.current || !paymentSessionId) return;
    startedRef.current = true;

    if (!paymentSessionId) {
      setError('Payment session is missing. Go back and try again.');
      return;
    }

    (async () => {
      try {
        const mode = import.meta.env.VITE_CASHFREE_MODE || 'production';
        const cashfree = await load({ mode });
        setStatus('Redirecting to Cashfree…');

        const result = await cashfree.checkout({
          paymentSessionId,
          redirectTarget: '_self',
        });

        if (result.error) {
          setError(result.error.message || 'Payment was cancelled');
          return;
        }

        if (result.paymentDetails) {
          setStatus('Payment complete. You can close this tab and return to the app.');
        }
      } catch (err) {
        setError(err.message || 'Could not open payment gateway');
      }
    })();
  }, [paymentSessionId, orderId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#161718] text-white p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold">CrwdCtrl Payment</h1>
        {error ? (
          <p className="text-red-400 text-sm">{error}</p>
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
