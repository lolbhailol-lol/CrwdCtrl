import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader, ShieldCheck } from 'lucide-react';
import { apiUtils } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { createMindSparkBundle, fetchMindSparkBundleOffer, quoteMindSparkBundle, reissueMindSparkBundlePayment } from '../../../services/api/mindsparkBundle.api';
import { openCashfreeCheckout } from '../../../utils/useCashfree';

const STEPS = ['Your details', 'Choose events', 'Participants', 'Pay'];
const memberNames = value => (Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/)).map(x => String(x || '').trim()).filter(Boolean);

export default function MindSparkBundlePage({ embedded = false, onClose }) {
  const [params] = useSearchParams();
  const desk = params.get('desk') === '1';
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [step, setStep] = useState(1);
  const [formIndex, setFormIndex] = useState(0);
  const [offer, setOffer] = useState(null);
  const [selected, setSelected] = useState(['', '', '']);
  const [forms, setForms] = useState([{}, {}, {}]);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submissionKey = useRef(crypto.randomUUID());

  useEffect(() => { fetchMindSparkBundleOffer().then(setOffer).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setCustomer(current => ({
      name: current.name || user.name || '',
      phone: current.phone || user.phoneNumber || user.phone || '',
      email: current.email || user.email || '',
    }));
    setShowLogin(false);
  }, [isAuthenticated, user]);
  const comps = useMemo(() => selected.map((id, i) => (i === 0 ? offer?.technical : offer?.nonTechnical)?.find(c => c._id === id)), [offer, selected]);
  const items = useMemo(() => selected.map((competitionId, i) => ({
    competitionId,
    feeTierId: forms[i].feeTierId || '',
    roster: { full_name: customer.name, phone: customer.phone, email: customer.email, team_name: forms[i].teamName || '', team_members: memberNames(forms[i].memberNames || forms[i].members) },
  })), [selected, forms, customer]);
  const detailsValid = Boolean(customer.name.trim())
    && customer.phone.replace(/\D/g, '').length === 10
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim());
  const selectionValid = selected.every(Boolean) && new Set(selected).size === 3;
  const formsValid = selectionValid && comps.every((c, i) => {
    const count = memberNames(forms[i].memberNames || forms[i].members).length;
    const min = Math.max(1, Number(c?.teamSizeMin) || 1);
    const max = Math.max(min, Number(c?.teamSizeMax) || min);
    return count >= min && count <= max && (!c?.feeTiers?.length || Boolean(forms[i].feeTierId));
  });
  const currentFormValid = (() => {
    const competition = comps[formIndex];
    if (!competition) return false;
    const count = memberNames(forms[formIndex]?.memberNames || forms[formIndex]?.members).length;
    const min = Math.max(1, Number(competition.teamSizeMin) || 1);
    const max = Math.max(min, Number(competition.teamSizeMax) || min);
    return count >= min && count <= max && (!competition.feeTiers?.length || Boolean(forms[formIndex]?.feeTierId));
  })();

  useEffect(() => {
    if (!detailsValid || !formsValid) { setQuote(null); return; }
    quoteMindSparkBundle(items).then(data => { setQuote(data); setError(''); }).catch(e => { setQuote(null); setError(e.message); });
  }, [detailsValid, formsValid, items]);

  const setForm = (i, field, value) => setForms(all => all.map((form, index) => index === i ? { ...form, [field]: value } : form));
  const goNext = () => {
    setError('');
    if (step === 1 && !desk && !isAuthenticated) { setShowLogin(true); return; }
    if (step === 1 && !detailsValid) return setError('Enter the team leader’s name, 10-digit WhatsApp number, and valid email.');
    if (step === 2 && !selectionValid) return setError('Select 1 technical and 2 different non-technical competitions.');
    if (step === 2) setForms(all => all.map((form, i) => {
      const min = Math.max(1, Number(comps[i]?.teamSizeMin) || 1);
      const existing = Array.isArray(form.memberNames) ? [...form.memberNames] : memberNames(form.members);
      if (!existing.length) existing.push(customer.name);
      while (existing.length < min) existing.push('');
      return { ...form, memberNames: existing.slice(0, Math.max(min, existing.length)) };
    }));
    if (step === 3 && !currentFormValid) return setError('Complete the required participant details for this competition.');
    if (step === 3 && formIndex < 2) { setFormIndex(index => index + 1); return; }
    if (step === 3 && !formsValid) return setError('Complete the required participant details for every competition.');
    setStep(current => Math.min(4, current + 1));
  };
  const goBack = () => {
    setError('');
    if (step === 3 && formIndex > 0) { setFormIndex(index => index - 1); return; }
    if (step > 1) { setStep(current => current - 1); return; }
    if (onClose) onClose();
    else navigate(-1);
  };
  const submit = async () => {
    if (!desk && !apiUtils.isAuthenticated()) return navigate(`/login?redirect=${encodeURIComponent('/mindspark/bundle')}`);
    setBusy(true); setError('');
    try {
      let result = await createMindSparkBundle({ festId: offer.festId, submissionKey: submissionKey.current, customer, items }, desk);
      if (desk || result.status === 'paid') {
        window.location.assign(result.paymentUrl);
        return;
      }
      if (!result.paymentSessionId) {
        const paymentToken = new URL(result.paymentUrl, window.location.origin).pathname.split('/').filter(Boolean).pop();
        result = { ...result, ...await reissueMindSparkBundlePayment(paymentToken) };
      }
      if (!result.paymentSessionId) throw new Error('Cashfree could not be opened. Please try Pay securely again.');
      const checkout = await openCashfreeCheckout({
        paymentSessionId: result.paymentSessionId,
        orderId: result.orderId,
        returnPath: `${new URL(result.paymentUrl, window.location.origin).pathname}?returned=1`,
        entityType: 'competition_bundle',
        cashfreeMode: result.cashfreeMode,
        customerEmail: customer.email,
      });
      if (!checkout?.redirectDeferred) {
        const separator = result.paymentUrl.includes('?') ? '&' : '?';
        window.location.assign(`${result.paymentUrl}${separator}returned=1`);
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!offer) return <main className="min-h-dvh bg-[#090b0d] text-white grid place-items-center"><Loader className="animate-spin text-[#0ECCEE]" /></main>;
  const activeCompetition = comps[formIndex];
  const activeNames = Array.isArray(forms[formIndex]?.memberNames) ? forms[formIndex].memberNames : [customer.name];
  const activeMin = Math.max(1, Number(activeCompetition?.teamSizeMin) || 1);
  const activeMax = Math.max(activeMin, Number(activeCompetition?.teamSizeMax) || activeMin);
  const content = <div className={`mx-auto w-full min-w-0 max-w-2xl overflow-x-hidden ${embedded ? 'p-4 sm:p-6' : ''}`}>
    <div className="mb-5 flex items-center justify-between gap-3">
      <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#121416] px-3 py-2 text-sm font-semibold"><ArrowLeft size={17} />Back</button>
      <div className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-bold text-emerald-300">70% OFF</div>
    </div>
    <header className="mb-5"><p className="text-xs font-semibold uppercase tracking-wider text-[#0ECCEE]">MindSpark bundle</p><h1 className="mt-1 text-2xl font-black">1 Tech + 2 Non-Tech</h1></header>
    <nav className="mb-6 flex gap-2" aria-label="Registration progress">{STEPS.map((label, i) => <div key={label} className="min-w-0 flex-1"><div className={`h-1 rounded-full ${i + 1 <= step ? 'bg-[#0ECCEE]' : 'bg-white/10'}`} /><p className={`mt-1.5 truncate text-[10px] sm:text-xs ${i + 1 === step ? 'font-semibold text-white' : 'text-gray-600'}`}>{label}</p></div>)}</nav>

    {step === 1 ? <section className="rounded-2xl border border-white/10 bg-[#121416] p-4 sm:p-5"><h2 className="mb-4 text-lg font-bold">Your details</h2>{!desk && !isAuthenticated ? <button type="button" onClick={() => setShowLogin(true)} className="w-full rounded-xl bg-[#0ECCEE] py-3.5 font-bold text-black">Continue with Google</button> : <div className="space-y-3"><label className="block"><span className="mb-1 block text-sm text-gray-300">Full name</span><input value={customer.name} onChange={e => setCustomer(v => ({ ...v, name: e.target.value }))} placeholder="Team leader’s full name" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label><label className="block"><span className="mb-1 block text-sm text-gray-300">WhatsApp number</span><input inputMode="numeric" value={customer.phone} onChange={e => setCustomer(v => ({ ...v, phone: e.target.value }))} placeholder="10-digit number" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label><label className="block"><span className="mb-1 block text-sm text-gray-300">Email</span><input required type="email" value={customer.email} onChange={e => setCustomer(v => ({ ...v, email: e.target.value }))} placeholder="name@example.com" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label></div>}</section> : null}

    {step === 2 ? <section className="rounded-2xl border border-white/10 bg-[#121416] p-4 sm:p-5"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Choose 3 competitions</h2><p className="mt-1 text-sm text-gray-500">Select one from each box.</p></div><span className="text-sm font-bold text-[#0ECCEE]">{selected.filter(Boolean).length}/3</span></div><div className="space-y-3">{[0, 1, 2].map(i => { const list = i === 0 ? offer.technical : offer.nonTechnical; return <label key={i} className="block"><span className="mb-1.5 block text-sm font-semibold text-gray-300">{i === 0 ? 'Technical competition' : `Non-technical competition ${i}`}</span><select aria-label={i === 0 ? 'Select technical competition' : 'Select non-technical competition'} value={selected[i]} onChange={e => setSelected(all => all.map((id, index) => index === i ? e.target.value : id))} className={`w-full rounded-xl border p-3 ${selected[i] ? 'border-emerald-400/30 bg-emerald-500/5 text-white' : 'border-white/10 bg-[#1b1e20]'}`}><option value="">Select competition</option>{list.map(c => <option key={c._id} value={c._id} disabled={selected.some((id, index) => index !== i && id === c._id)}>{c.name} · {c.registrationFee}</option>)}</select></label>; })}</div></section> : null}

    {step === 3 && activeCompetition ? <section><div className="mb-4 flex gap-2">{comps.map((competition, index) => <button key={competition._id} type="button" onClick={() => setFormIndex(index)} className={`min-w-0 flex-1 rounded-xl border px-2 py-2 text-xs font-semibold ${index === formIndex ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10 text-[#0ECCEE]' : currentFormValid || index < formIndex ? 'border-white/10 text-gray-400' : 'border-white/10 text-gray-500'}`}>{index + 1}. <span className="hidden sm:inline">{competition.name}</span><span className="sm:hidden">Event</span></button>)}</div><div className="rounded-2xl border border-white/10 bg-[#121416] p-4 sm:p-5"><div className="mb-4"><p className="text-xs text-[#0ECCEE]">Competition {formIndex + 1} of 3</p><h2 className="mt-1 text-lg font-bold">{activeCompetition.name}</h2><p className="mt-1 text-xs text-gray-500">{activeMin === activeMax ? `${activeMin} participant${activeMin > 1 ? 's' : ''} required` : `${activeMin}–${activeMax} participants allowed`}</p></div><div className="space-y-3">{activeMax > 1 ? <label className="block"><span className="mb-1 block text-sm text-gray-300">Team name</span><input value={forms[formIndex].teamName || ''} onChange={e => setForm(formIndex, 'teamName', e.target.value)} placeholder="Your team name" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label> : null}{activeNames.map((name, index) => <div key={index} className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-1 block text-sm text-gray-300">{index === 0 ? 'Team leader' : `Participant ${index + 1}`}</span><input value={name} onChange={e => setForm(formIndex, 'memberNames', activeNames.map((item, n) => n === index ? e.target.value : item))} placeholder="Full name" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label>{index >= activeMin ? <button type="button" onClick={() => setForm(formIndex, 'memberNames', activeNames.filter((_, n) => n !== index))} className="rounded-xl border border-white/10 px-3 py-3 text-sm text-red-300">Remove</button> : null}</div>)}{activeNames.length < activeMax ? <button type="button" onClick={() => setForm(formIndex, 'memberNames', [...activeNames, ''])} className="w-full rounded-xl border border-dashed border-[#0ECCEE]/30 py-3 text-sm font-semibold text-[#0ECCEE]">+ Add participant</button> : null}{activeCompetition.feeTiers?.length ? <label className="block"><span className="mb-1 block text-sm text-gray-300">Category</span><select value={forms[formIndex].feeTierId || ''} onChange={e => setForm(formIndex, 'feeTierId', e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3"><option value="">Select category</option>{activeCompetition.feeTiers.map(t => <option key={t.id} value={t.id}>{t.label} · ₹{t.amount}</option>)}</select></label> : null}</div></div></section> : null}

    {step === 4 ? <section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Review and pay</h2><button type="button" onClick={() => { setFormIndex(0); setStep(2); }} className="text-sm font-semibold text-[#0ECCEE]">Edit</button></div><div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121416]">{comps.map((c, i) => { const names = memberNames(forms[i].memberNames || forms[i].members); const priced = quote?.items?.find(item => String(item.competitionId) === String(c._id)); return <div key={c._id} className="flex items-start justify-between gap-3 border-b border-white/8 p-4 last:border-0"><div className="min-w-0"><p className="truncate font-semibold">{c.name}</p><p className="mt-1 text-xs text-gray-500">{forms[i].teamName || names.join(', ')}</p><p className="text-xs text-gray-600">{names.length} participant{names.length === 1 ? '' : 's'}</p></div><span className="shrink-0 text-sm text-gray-300">₹{Number(priced?.amount || 0).toLocaleString('en-IN')}</span></div>; })}</div><div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/8 p-4"><div className="flex justify-between text-sm text-gray-400"><span>Original total</span><span className="line-through">₹{Number(quote?.subtotal || 0).toLocaleString('en-IN')}</span></div><div className="mt-2 flex justify-between text-sm font-semibold text-emerald-300"><span>You save 70%</span><span>₹{Number(quote?.discountAmount || 0).toLocaleString('en-IN')}</span></div><div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-xl font-black"><span>Pay now</span><span>₹{Number(quote?.totalAmount || 0).toLocaleString('en-IN')}</span></div>{quote ? <button onClick={submit} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0ECCEE] px-6 py-3.5 font-bold text-black disabled:opacity-50"><ShieldCheck size={18} />{busy ? 'Opening Cashfree…' : `Pay ₹${quote.totalAmount}`}</button> : <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm text-gray-400"><Loader size={16} className="animate-spin" />Calculating price…</div>}<p className="mt-2 text-center text-[11px] text-gray-500">One secure payment for all 3 registrations</p></div></section> : null}

    {error ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
    {step < 4 && !(step === 1 && !desk && !isAuthenticated) ? <button type="button" onClick={goNext} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0ECCEE] px-6 py-3.5 font-bold text-black">{step === 3 ? (formIndex < 2 ? 'Next competition' : 'Review and pay') : 'Continue'}<ArrowRight size={17} /></button> : null}
    {showLogin ? <CrwdCtrlLogin googleOnly title="Sign in for MindSpark Bundle" subtitle="Continue with Google to register" onClose={() => setShowLogin(false)} /> : null}
  </div>;
  if (embedded) return content;
  return <main className="min-h-dvh overflow-x-hidden bg-[#090b0d] p-4 text-white sm:p-8">{content}</main>;
}
