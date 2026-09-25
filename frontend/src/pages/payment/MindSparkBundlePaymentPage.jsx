import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader, MessageCircle, RefreshCw } from 'lucide-react';
import { fetchMindSparkBundlePayment, reissueMindSparkBundlePayment, verifyMindSparkBundlePayment } from '../../services/api/mindsparkBundle.api';
import { openPaymentCheckout } from '../../utils/usePaymentCheckout';
import { clearPendingPayment } from '../../utils/deepLinks';

export default function MindSparkBundlePaymentPage() {
  const { token } = useParams(); const [params] = useSearchParams();
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(true);
  const refresh = useCallback(async () => { const returned = params.get('returned') === '1'; const next = returned ? await verifyMindSparkBundlePayment(token) : await fetchMindSparkBundlePayment(token); if (returned) clearPendingPayment(); setError(''); setData(next); return next; }, [params, token]);
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setBusy(false)); }, [refresh]);
  useEffect(() => { if (!data || ['paid','failed','expired','paid_review'].includes(data.status)) return; const timer = setInterval(() => verifyMindSparkBundlePayment(token).then(setData).catch(() => {}), 5000); return () => clearInterval(timer); }, [data, token]);
  const openCheckout = async payment => openPaymentCheckout({ gateway: payment.gateway, keyId: payment.keyId, paymentSessionId: payment.paymentSessionId, orderId: payment.orderId, returnPath: `${window.location.pathname}?returned=1`, entityType: 'competition_bundle', cashfreeMode: payment.cashfreeMode || 'production', customerEmail: payment.customerEmail, customerPhone: payment.customerPhone, displayName: 'MindSpark competition bundle' });
  const verifyCheckout = async (payment, checkout) => verifyMindSparkBundlePayment(token, payment.gateway === 'razorpay' ? { razorpay_order_id: payment.orderId, razorpay_payment_id: checkout?.paymentDetails?.paymentId, razorpay_signature: checkout?.paymentDetails?.signature } : null);
  const pay = async () => { setBusy(true); setError(''); try { const result = await openCheckout(data); if (!result?.redirectDeferred) setData(await verifyCheckout(data, result)); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const retry = async () => { setBusy(true); setError(''); try { const next = await reissueMindSparkBundlePayment(token); setData(next); if (!next.orderId || (next.gateway !== 'razorpay' && !next.paymentSessionId)) throw new Error('Could not prepare the payment. Please tap Retry payment again.'); const result = await openCheckout(next); if (!result?.redirectDeferred) setData(await verifyCheckout(next, result)); } catch(e) { setError(e.message); } finally { setBusy(false); } };
  const discountPercent = Number(data?.discountPercent) || 65;
  return (
    <main className="min-h-dvh bg-[#090b0d] text-white grid place-items-center p-4">
      <section className="w-full max-w-lg rounded-3xl border border-cyan-400/20 bg-[#151719] p-6 space-y-5 text-center">
        <p className="text-xs uppercase tracking-[.2em] text-[#0ECCEE]">MindSpark bundle</p>
        <h1 className="text-2xl font-bold">Any 3 competitions</h1>
        {busy && !data ? <Loader className="animate-spin mx-auto" /> : null}
        {data ? (
          <>
            <div>
              <span className="text-gray-500 line-through">₹{data.subtotal}</span>
              <p className="text-5xl font-black">₹{data.amount}</p>
              <p className="text-emerald-300">{discountPercent}% bundle discount applied</p>
            </div>
            {data.status === 'paid' ? (
              <div className="space-y-3">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                <p className="font-semibold">Payment confirmed · 3 tickets issued</p>
                {data.tickets.map(t => (
                  <div className="rounded-xl border border-white/10 p-3 space-y-2" key={t.registrationId}>
                    <a className="block font-semibold text-[#0ECCEE]" href={t.ticketUrl}>
                      {t.competitionName} · Open ticket
                    </a>
                    {t.whatsappGroupLink ? (
                      <a
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-black"
                        href={t.whatsappGroupLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle size={16} /> Join WhatsApp group
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : data.status === 'paid_review' ? (
              <div className="rounded-xl border border-orange-400/20 bg-orange-500/10 p-3 text-orange-100">
                <p className="font-semibold">Payment received</p>
                <p className="mt-1 text-sm">Final ticket confirmation is in progress. Do not pay again.</p>
              </div>
            ) : data.status === 'confirming' ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-amber-200">
                <Loader size={18} className="mx-auto mb-2 animate-spin" />
                Payment confirming — do not pay again. This page checks automatically.
              </div>
            ) : ['failed', 'expired'].includes(data.status) || !data.orderId || (data.gateway !== 'razorpay' && !data.paymentSessionId) ? (
              <button onClick={retry} disabled={busy} className="w-full rounded-xl border border-white/15 py-3 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                {busy ? 'Preparing payment…' : 'Retry payment'}
              </button>
            ) : (
              <button disabled={!data.orderId || (data.gateway !== 'razorpay' && !data.paymentSessionId) || busy} onClick={pay} className="w-full rounded-xl bg-[#0ECCEE] py-3 font-bold text-black disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {busy ? <Loader size={18} className="animate-spin" /> : null}
                {busy ? 'Opening secure payment…' : `Pay securely with ${data.gateway === 'razorpay' ? 'Razorpay' : 'Cashfree'}`}
              </button>
            )}
          </>
        ) : null}
        {error ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      </section>
    </main>
  );
}
