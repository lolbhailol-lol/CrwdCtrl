import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { getPendingPayment, isStalePendingPayment } from '../../utils/deepLinks';

/**
 * Cashfree redirect checkout lands here (order return_url = /payment/return?order_id=...).
 * We forward the user back to the page they paid from (stored as pending.returnPath)
 * so that page's payment-resume effect can verify the payment and finish the
 * booking/registration. Falls back to My Bookings when there's no pending context.
 */
export default function PaymentReturn() {
  const navigate = useNavigate();

  useEffect(() => {
    const pending = getPendingPayment();
    const returnPath = pending?.orderId && !isStalePendingPayment(pending)
      ? pending.returnPath
      : null;

    // Preserve Cashfree query params (order_id, etc.) so resume detection still works.
    const search = typeof window !== 'undefined' ? window.location.search : '';

    if (returnPath) {
      const [path, existingQuery] = returnPath.split('?');
      const merged = new URLSearchParams(existingQuery || '');
      const incoming = new URLSearchParams(search);
      incoming.forEach((value, key) => {
        if (!merged.has(key)) merged.set(key, value);
      });
      const qs = merged.toString();
      navigate(qs ? `${path}?${qs}` : path, { replace: true });
      return;
    }

    navigate('/booking', { replace: true, state: { refreshBookings: true } });
  }, [navigate]);

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex flex-col items-center justify-center px-4">
      <Loader className="w-8 h-8 animate-spin text-[#0ECCEE] mb-4" />
      <p className="text-sm text-gray-400 text-center">Confirming your payment…</p>
    </div>
  );
}
