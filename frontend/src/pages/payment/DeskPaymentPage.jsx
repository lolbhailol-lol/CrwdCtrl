import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader, RefreshCw } from 'lucide-react';
import { load } from '@cashfreepayments/cashfree-js';
import LocalQRCode from '../../components/LocalQRCode';
import { fetchDeskPayment, reissueDeskPayment, verifyDeskPayment } from '../../services/api/deskPayment.api';

export default function DeskPaymentPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const returned = params.get('returned') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const polling = useRef(null);

  const refresh = useCallback(async () => {
    const next = returned ? await verifyDeskPayment(token) : await fetchDeskPayment(token);
    setData(next);
    return next;
  }, [returned, token]);

  useEffect(() => {
    refresh().catch((e) => setError(e.message)).finally(() => setBusy(false));
  }, [refresh]);
  useEffect(() => {
    if (!returned || data?.status === 'paid') return undefined;
    polling.current = window.setInterval(() => refresh().catch(() => {}), 3000);
    return () => window.clearInterval(polling.current);
  }, [data?.status, refresh, returned]);

  const pay = async () => {
    if (!data?.paymentSessionId) return;
    setBusy(true); setError('');
    try {
      const cashfree = await load({ mode: data.cashfreeMode || 'production' });
      const result = await cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
      if (result?.error) setError(result.error.message || 'Payment was cancelled');
    } catch (e) { setError(e.message || 'Could not open Cashfree'); }
    finally { setBusy(false); }
  };

  const reissue = async () => {
    setBusy(true); setError('');
    try { setData(await reissueDeskPayment(token)); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <main className="min-h-dvh bg-[#0c0d0e] text-white flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#161718] p-6 text-center space-y-4">
      <p className="text-xs uppercase tracking-wider text-[#0ECCEE]">MindSpark secure payment</p>
      {busy && !data ? <Loader className="animate-spin mx-auto text-[#0ECCEE]" /> : null}
      {data ? <><h1 className="text-2xl font-bold">{data.competitionName}</h1><p className="text-gray-300">{data.participantName}{data.teamName ? ` · ${data.teamName}` : ''}</p><p className="text-4xl font-bold">₹{Number(data.amount).toLocaleString('en-IN')}</p><p className="font-mono text-xs text-gray-500">{data.orderId}</p></> : null}
      {data?.status === 'paid' ? <div className="space-y-3"><CheckCircle2 className="mx-auto text-emerald-400" size={42}/><p className="text-emerald-300 font-semibold">Payment confirmed</p>{data.ticketQr ? <div className="rounded-2xl bg-white p-4 mx-auto w-fit"><LocalQRCode data={data.ticketQr} size={230} /></div> : null}<p className="text-xs text-gray-400">Registration: {data.registrationId}</p></div> : null}
      {data && ['pending'].includes(data.status) ? <button type="button" onClick={pay} disabled={busy || !data.paymentSessionId} className="w-full rounded-xl bg-[#0ECCEE] text-black py-3 font-semibold disabled:opacity-50">{busy ? 'Opening…' : 'Pay securely with Cashfree'}</button> : null}
      {data && ['confirming'].includes(data.status) ? <div className="rounded-xl bg-amber-500/10 border border-amber-400/20 p-3 text-sm text-amber-200">Payment confirming—do not pay again. This page checks automatically.</div> : null}
      {data && ['failed', 'expired'].includes(data.status) ? <button type="button" onClick={reissue} disabled={busy} className="w-full rounded-xl border border-white/15 py-3 font-semibold inline-flex justify-center items-center gap-2"><RefreshCw size={16}/>Create new payment attempt</button> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  </main>;
}
