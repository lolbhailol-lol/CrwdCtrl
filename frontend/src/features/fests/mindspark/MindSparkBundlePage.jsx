import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader, ShieldCheck } from 'lucide-react';
import { apiUtils } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { createMindSparkBundle, fetchMindSparkBundleOffer, quoteMindSparkBundle, reissueMindSparkBundlePayment } from '../../../services/api/mindsparkBundle.api';
import { openCashfreeCheckout } from '../../../utils/useCashfree';

const STEPS = ['Details', 'Competitions', 'Team forms', 'Review & pay'];
const memberNames = value => (Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/)).map(x => String(x || '').trim()).filter(Boolean);

export default function MindSparkBundlePage({ embedded = false, onClose }) {
  const [params] = useSearchParams();
  const desk = params.get('desk') === '1';
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [step, setStep] = useState(1);
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
    if (step === 3 && !formsValid) return setError('Complete the required team members and fee tier for every competition.');
    setStep(current => Math.min(4, current + 1));
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
  const content = <div className={`mx-auto max-w-3xl space-y-5 ${embedded ? 'p-4 sm:p-6' : ''}`}>
    <button
      type="button"
      onClick={() => {
        setError('');
        if (step > 1) setStep(current => current - 1);
        else if (onClose) onClose();
        else navigate(-1);
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#121416] px-4 py-2.5 text-sm font-semibold text-white hover:border-[#0ECCEE]/50"
    >
      <ArrowLeft size={17} />
      {step > 1 ? 'Back to previous step' : 'Back to MindSpark'}
    </button>
    <header className="flex items-center justify-between gap-4 rounded-2xl border border-[#0ECCEE]/25 bg-[#121619] p-4 sm:p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#0ECCEE]">MindSpark special offer</p><h1 className="mt-1 text-2xl font-black">Build your bundle</h1><p className="mt-1 text-sm text-gray-400">Choose 3 competitions, fill the teams, review once, and pay once.</p></div><div className="shrink-0 rounded-2xl bg-emerald-500/15 px-3 py-2 text-center"><p className="text-2xl font-black text-emerald-300">70%</p><p className="text-[10px] font-semibold uppercase text-emerald-300">off</p></div></header>
    <nav aria-label="Registration progress"><div className="flex gap-2">{STEPS.map((label, i) => <div key={label} className="min-w-0 flex-1"><div className={`h-1.5 rounded-full ${i + 1 <= step ? 'bg-[#0ECCEE]' : 'bg-white/10'}`} /><p className={`mt-1.5 truncate text-[10px] sm:text-xs ${i + 1 === step ? 'font-semibold text-[#0ECCEE]' : 'text-gray-500'}`}>{label}</p></div>)}</div></nav>

    {step === 1 ? <section className="rounded-2xl border border-white/10 bg-[#121416] p-5 space-y-4"><div><h2 className="text-xl font-bold">Team leader details</h2><p className="mt-1 text-sm text-gray-400">Tickets and payment updates will be sent to this email.</p></div>{!desk && !isAuthenticated ? <div className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-5 text-center"><p className="font-semibold">Sign in to register</p><button type="button" onClick={() => setShowLogin(true)} className="mt-4 w-full rounded-xl bg-[#0ECCEE] py-3 font-bold text-black">Continue with Google</button></div> : <><label className="block"><span className="mb-1 block text-sm text-gray-300">Full name *</span><input value={customer.name} onChange={e => setCustomer(v => ({ ...v, name: e.target.value }))} placeholder="Rahul Sharma" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label><label className="block"><span className="mb-1 block text-sm text-gray-300">WhatsApp number *</span><input inputMode="numeric" value={customer.phone} onChange={e => setCustomer(v => ({ ...v, phone: e.target.value }))} placeholder="10-digit number" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label><label className="block"><span className="mb-1 block text-sm text-gray-300">Email *</span><input required type="email" value={customer.email} onChange={e => setCustomer(v => ({ ...v, email: e.target.value }))} placeholder="rahul@example.com" className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label></>}</section> : null}

    {step === 2 ? <section className="rounded-2xl border border-white/10 bg-[#121416] p-5 space-y-4"><div><p className="text-xs uppercase tracking-wider text-[#0ECCEE]">Step 2 of 4</p><h2 className="text-xl font-bold">Build your 3-event cart</h2><p className="mt-1 text-sm text-gray-400">Add exactly one technical and two different non-technical events.</p></div><div className="rounded-xl border border-[#0ECCEE]/20 bg-[#0ECCEE]/5 px-3 py-2 text-sm"><span className="font-semibold text-[#0ECCEE]">Cart: {selected.filter(Boolean).length}/3 events</span><span className="text-gray-400"> · 70% discount activates after all three are added</span></div>{[0, 1, 2].map(i => { const list = i === 0 ? offer.technical : offer.nonTechnical; const chosen = comps[i]; return <div key={i} className={`rounded-2xl border p-4 ${chosen ? 'border-emerald-400/25 bg-emerald-500/5' : 'border-white/10 bg-[#181a1c]'}`}><div className="mb-2 flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-gray-500">Cart slot {i + 1}</p><p className="font-semibold">{i === 0 ? 'Technical event' : `Non-technical event ${i}`}</p></div>{chosen ? <button type="button" onClick={() => setSelected(all => all.map((id, index) => index === i ? '' : id))} className="text-xs text-red-300">Remove</button> : null}</div><select aria-label={i === 0 ? 'Select technical event' : 'Select non-technical event'} value={selected[i]} onChange={e => setSelected(all => all.map((id, index) => index === i ? e.target.value : id))} className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3"><option value="">Choose an event to add</option>{list.map(c => <option key={c._id} value={c._id} disabled={selected.some((id, index) => index !== i && id === c._id)}>{c.name} · {c.registrationFee}</option>)}</select>{chosen ? <div className="mt-3 flex items-center justify-between gap-3"><div><p className="font-bold text-emerald-200">{chosen.name}</p><p className="text-xs text-gray-400">{chosen.registrationFee}</p></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">Added</span></div> : null}</div>; })}</section> : null}

    {step === 3 ? <section className="space-y-4"><div><p className="text-xs uppercase tracking-wider text-[#0ECCEE]">Step 3 of 4</p><h2 className="text-xl font-bold">Team information</h2><p className="text-sm text-gray-400">Enter one participant in each box.</p></div>{comps.map((c, i) => { const min = Math.max(1, Number(c?.teamSizeMin) || 1), max = Math.max(min, Number(c?.teamSizeMax) || min), names = Array.isArray(forms[i].memberNames) ? forms[i].memberNames : [customer.name], count = names.filter(name => String(name || '').trim()).length; const updateName = (index, value) => setForm(i, 'memberNames', names.map((name, n) => n === index ? value : name)); return <div key={c._id} className="rounded-2xl border border-white/10 bg-[#121416] p-5 space-y-3"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{c.name}</h3><p className={`text-xs ${count >= min && count <= max ? 'text-emerald-300' : 'text-amber-300'}`}>{min === max ? `Exactly ${min} participant${min > 1 ? 's' : ''} required` : `${min} to ${max} participants allowed`} · {count} completed</p></div><span className="text-sm text-[#0ECCEE]">{c.registrationFee}</span></div>{max > 1 ? <label className="block"><span className="mb-1 block text-sm text-gray-300">Team name</span><input value={forms[i].teamName || ''} onChange={e => setForm(i, 'teamName', e.target.value)} placeholder="Example: Team Phoenix" className="w-full rounded-xl bg-[#1b1e20] p-3" /></label> : null}<div className="space-y-2"><p className="text-sm text-gray-300">Participant full names *</p>{names.map((name, index) => <div key={index} className="flex gap-2"><label className="min-w-0 flex-1"><span className="mb-1 block text-xs text-gray-500">{index === 0 ? 'Team leader' : `Team member ${index + 1}`}</span><input value={name} onChange={e => updateName(index, e.target.value)} placeholder={index === 0 ? 'Team leader’s full name' : `Member ${index + 1} full name`} className="w-full rounded-xl border border-white/10 bg-[#1b1e20] p-3" /></label>{index >= min ? <button type="button" onClick={() => setForm(i, 'memberNames', names.filter((_, n) => n !== index))} className="mt-6 rounded-xl border border-red-400/20 px-3 text-sm text-red-300">Remove</button> : null}</div>)}{names.length < max ? <button type="button" onClick={() => setForm(i, 'memberNames', [...names, ''])} className="w-full rounded-xl border border-dashed border-[#0ECCEE]/40 p-2.5 text-sm font-semibold text-[#0ECCEE]">+ Add another team member</button> : null}<p className="text-xs text-gray-500">Minimum {min}, maximum {max}. The team leader stays in the first box.</p></div>{c.feeTiers?.length ? <label className="block"><span className="mb-1 block text-sm text-gray-300">Participant category *</span><select value={forms[i].feeTierId || ''} onChange={e => setForm(i, 'feeTierId', e.target.value)} className="w-full rounded-xl bg-[#1b1e20] p-3"><option value="">Choose the correct category</option>{c.feeTiers.map(t => <option key={t.id} value={t.id}>{t.label} · ₹{t.amount}</option>)}</select></label> : null}</div>; })}</section> : null}

    {step === 4 ? <section className="space-y-4"><div><p className="text-xs uppercase tracking-wider text-[#0ECCEE]">Final step</p><h2 className="text-xl font-bold">Review your bundle</h2><p className="mt-1 text-sm text-gray-400">Check all three competitions and teams before opening Cashfree.</p></div><div className="space-y-3">{comps.map((c, i) => { const names = memberNames(forms[i].memberNames || forms[i].members); const priced = quote?.items?.find(item => String(item.competitionId) === String(c._id)); return <article key={c._id} className="rounded-xl border border-white/10 bg-[#121416] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{i + 1}. {c.name}</p><p className="mt-1 text-xs text-gray-400">{forms[i].teamName ? `${forms[i].teamName} · ` : ''}{names.length} participant{names.length === 1 ? '' : 's'}</p><p className="mt-1 text-xs text-gray-500">{names.join(', ')}</p></div><span className="shrink-0 text-sm font-semibold text-gray-300">₹{Number(priced?.amount || 0).toLocaleString('en-IN')}</span></div><button type="button" onClick={() => setStep(3)} className="mt-3 text-xs font-semibold text-[#0ECCEE]">Edit team details</button></article>; })}</div><div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/8 p-4"><div className="space-y-2 text-sm"><div className="flex justify-between text-gray-400"><span>Competition total</span><span>₹{Number(quote?.subtotal || 0).toLocaleString('en-IN')}</span></div><div className="flex justify-between text-emerald-300"><span>Bundle discount (70%)</span><span>− ₹{Number(quote?.discountAmount || 0).toLocaleString('en-IN')}</span></div><div className="flex justify-between border-t border-white/10 pt-3 text-lg font-black text-white"><span>Payable now</span><span>₹{Number(quote?.totalAmount || 0).toLocaleString('en-IN')}</span></div></div>{quote ? <button onClick={submit} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0ECCEE] px-6 py-3.5 font-bold text-black disabled:opacity-50"><ShieldCheck size={18} />{busy ? 'Opening secure payment…' : `Pay ₹${quote.totalAmount} securely`}</button> : <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm text-gray-400"><Loader size={16} className="animate-spin" />Confirming the final price…</div>}<p className="mt-3 text-center text-[11px] text-gray-500">One Cashfree payment · Three registrations · Tickets only after payment confirmation</p></div></section> : null}

    {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
    <div className="flex justify-between gap-3">{step > 1 ? <button type="button" onClick={() => { setError(''); setStep(s => s - 1); }} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold"><ArrowLeft size={17} />Back</button> : <span />}{step < 4 ? <button type="button" onClick={goNext} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#0ECCEE] px-6 py-3 font-bold text-black">{step === 3 ? 'Review cart' : 'Continue'}<ArrowRight size={17} /></button> : null}</div>
    {showLogin ? <CrwdCtrlLogin googleOnly title="Sign in for MindSpark Bundle" subtitle="Continue with Google to register" onClose={() => setShowLogin(false)} /> : null}
  </div>;
  if (embedded) return content;
  return <main className="min-h-dvh bg-[#090b0d] text-white p-4 sm:p-8">{content}</main>;
}
