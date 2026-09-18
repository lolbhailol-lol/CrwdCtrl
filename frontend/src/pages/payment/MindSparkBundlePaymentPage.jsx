import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import { CheckCircle2, Loader } from 'lucide-react';
import { fetchMindSparkBundlePayment, reissueMindSparkBundlePayment, verifyMindSparkBundlePayment } from '../../services/api/mindsparkBundle.api';

export default function MindSparkBundlePaymentPage() {
  const { token } = useParams(); const [params] = useSearchParams();
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(true);
  const refresh = useCallback(async () => { const next = params.get('returned') === '1' ? await verifyMindSparkBundlePayment(token) : await fetchMindSparkBundlePayment(token); setData(next); return next; }, [params, token]);
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setBusy(false)); }, [refresh]);
  useEffect(() => { if (!data || ['paid','failed','expired','paid_review'].includes(data.status)) return; const timer = setInterval(() => verifyMindSparkBundlePayment(token).then(setData).catch(() => {}), 3500); return () => clearInterval(timer); }, [data, token]);
  const openCheckout = async payment => { const cashfree = await load({ mode: payment.cashfreeMode || 'production' }); const result = await cashfree.checkout({ paymentSessionId: payment.paymentSessionId, redirectTarget: '_self' }); if (result?.error) throw new Error(result.error.message); };
  const pay = async () => { setBusy(true); try { await openCheckout(data); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const retry = async () => { setBusy(true); try { const next = await reissueMindSparkBundlePayment(token); setData(next); if (next.paymentSessionId) await openCheckout(next); } catch(e) { setError(e.message); } finally { setBusy(false); } };
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
                  <a className="block rounded-xl border border-white/10 p-3" key={t.registrationId} href={t.ticketUrl}>
                    {t.competitionName} · Open ticket
                  </a>
                ))}
              </div>
            ) : data.status === 'confirming' ? (
              <p className="rounded-xl bg-amber-500/10 p-3 text-amber-200">Payment confirming—do not pay again.</p>
            ) : ['failed', 'expired'].includes(data.status) ? (
              <button onClick={retry} disabled={busy} className="w-full rounded-xl border border-white/15 py-3 font-bold">Create replacement payment</button>
            ) : (
              <button disabled={!data.paymentSessionId || busy} onClick={pay} className="w-full rounded-xl bg-[#0ECCEE] py-3 font-bold text-black disabled:opacity-50">Pay securely with Cashfree</button>
            )}
          </>
        ) : null}
        {error ? <p className="text-red-400">{error}</p> : null}
      </section>
    </main>
  );
}
