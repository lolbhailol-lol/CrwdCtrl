import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader, ShieldCheck } from 'lucide-react';
import { apiUtils } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { createMindSparkBundle, fetchMindSparkBundleOffer, quoteMindSparkBundle, reissueMindSparkBundlePayment } from '../../../services/api/mindsparkBundle.api';
import { openCashfreeCheckout } from '../../../utils/useCashfree';

const STEPS = ['Your details', 'Choose events', 'Participants', 'Pay'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyMember = () => ({ name: '', email: '' });

/** Normalize legacy string names or {name,email} rows into member objects. */
function normalizeMembers(value) {
  if (!Array.isArray(value)) {
    return String(value || '')
      .split(/[,;\n]+/)
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .map((name) => ({ name, email: '' }));
  }
  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        const name = entry.trim();
        return name ? { name, email: '' } : null;
      }
      if (entry && typeof entry === 'object') {
        return {
          name: String(entry.name || entry.full_name || '').trim(),
          email: String(entry.email || '').trim().toLowerCase(),
        };
      }
      return null;
    })
    .filter((row) => row && (row.name || row.email));
}

function membersComplete(members, min, max) {
  if (members.length < min || members.length > max) return false;
  return members.every((m) => m.name.trim() && EMAIL_RE.test(m.email.trim()));
}

function fieldClass(isDark) {
  return `w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${
    isDark
      ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400 [color-scheme:dark]'
      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500 [color-scheme:light]'
  }`;
}

export default function MindSparkBundlePage({ embedded = false, onClose }) {
  const [params] = useSearchParams();
  const desk = params.get('desk') === '1';
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
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
  const scrollRef = useRef(null);
  const inputCls = fieldClass(isDark);

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
  useEffect(() => {
    const overlay = document.querySelector('.mindspark-bundle-overlay__scroll');
    if (overlay) overlay.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, formIndex]);

  const comps = useMemo(() => {
    const list = offer?.competitions || [...(offer?.technical || []), ...(offer?.nonTechnical || [])];
    const byId = new Map(list.map(c => [String(c._id), c]));
    return selected.map(id => byId.get(String(id)));
  }, [offer, selected]);
  const discountPercent = Number(offer?.discountPercent) || 65;
  const items = useMemo(() => selected.map((competitionId, i) => ({
    competitionId,
    feeTierId: forms[i].feeTierId || '',
    roster: {
      full_name: customer.name,
      phone: customer.phone,
      email: customer.email,
      team_name: forms[i].teamName || '',
      team_members: normalizeMembers(forms[i].members || forms[i].memberNames),
    },
  })), [selected, forms, customer]);
  const detailsValid = Boolean(customer.name.trim())
    && customer.phone.replace(/\D/g, '').length === 10
    && EMAIL_RE.test(customer.email.trim());
  const selectionValid = selected.every(Boolean) && new Set(selected).size === 3;
  const formsValid = selectionValid && comps.every((c, i) => {
    const members = normalizeMembers(forms[i].members || forms[i].memberNames);
    const min = Math.max(1, Number(c?.teamSizeMin) || 1);
    const max = Math.max(min, Number(c?.teamSizeMax) || min);
    return membersComplete(members, min, max) && (!c?.feeTiers?.length || Boolean(forms[i].feeTierId));
  });
  const currentFormValid = (() => {
    const competition = comps[formIndex];
    if (!competition) return false;
    const members = normalizeMembers(forms[formIndex]?.members || forms[formIndex]?.memberNames);
    const min = Math.max(1, Number(competition.teamSizeMin) || 1);
    const max = Math.max(min, Number(competition.teamSizeMax) || min);
    return membersComplete(members, min, max) && (!competition.feeTiers?.length || Boolean(forms[formIndex]?.feeTierId));
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
    if (step === 2 && !selectionValid) return setError('Select any 3 different competitions from the bundle list.');
    if (step === 2) setForms(all => all.map((form, i) => {
      const min = Math.max(1, Number(comps[i]?.teamSizeMin) || 1);
      const existing = normalizeMembers(form.members || form.memberNames);
      if (!existing.length) {
        existing.push({ name: customer.name.trim(), email: customer.email.trim().toLowerCase() });
      } else if (!existing[0].email && customer.email) {
        existing[0] = { ...existing[0], email: customer.email.trim().toLowerCase() };
      }
      if (!existing[0].name && customer.name) {
        existing[0] = { ...existing[0], name: customer.name.trim() };
      }
      while (existing.length < min) existing.push(emptyMember());
      return { ...form, members: existing.slice(0, Math.max(min, existing.length)), memberNames: undefined };
    }));
    if (step === 3 && !currentFormValid) return setError('Every participant needs a full name and a valid email.');
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

  const pageClass = `crwdctrl-page crwdctrl-page--content ${embedded ? 'min-h-full' : 'min-h-dvh'} pt-[calc(var(--safe-top)+1.25rem)] sm:pt-[calc(var(--safe-top)+1.5rem)] pb-24`;
  if (!offer) {
    return (
      <main className={`${pageClass} grid place-items-center`}>
        <Loader className="animate-spin text-[#0ECCEE]" />
      </main>
    );
  }

  const activeCompetition = comps[formIndex];
  const activeMembers = normalizeMembers(forms[formIndex]?.members || forms[formIndex]?.memberNames);
  const activeNames = activeMembers.length
    ? activeMembers
    : [{ name: customer.name, email: customer.email }];
  const setActiveMember = (index, field, value) => {
    const next = activeNames.map((row, n) => (n === index ? { ...row, [field]: value } : row));
    setForm(formIndex, 'members', next);
  };
  const activeMin = Math.max(1, Number(activeCompetition?.teamSizeMin) || 1);
  const activeMax = Math.max(activeMin, Number(activeCompetition?.teamSizeMax) || activeMin);
  const needsLogin = step === 1 && !desk && !isAuthenticated;
  const labelCls = `block text-sm font-medium mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`;
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const titleCls = isDark ? 'text-white' : 'text-gray-900';

  const content = (
    <div ref={scrollRef} className={`mx-auto w-full min-w-0 max-w-4xl px-4 sm:px-6 lg:px-8 ${embedded ? 'pb-[max(1.25rem,env(safe-area-inset-bottom))]' : ''}`}>
      <div className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6 mt-1">
        <button
          type="button"
          onClick={goBack}
          className={`p-2 rounded-lg transition-colors shrink-0 mt-1 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
        >
          <ArrowLeft className={`w-5 h-5 sm:w-6 sm:h-6 ${titleCls}`} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold leading-tight ${titleCls}`}>
            MindSpark bundle
          </h1>
          <p className={`text-sm mt-0.5 ${muted}`}>Any 3 from the list · {discountPercent}% off</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
          {discountPercent}% OFF
        </span>
      </div>

      <div className={`rounded-2xl p-4 sm:p-6 md:p-8 border transition-all duration-300 ${
        isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className={`rounded-lg p-4 mb-5 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className={`text-sm font-semibold ${titleCls}`}>Progress</h3>
            <span className={`text-xs ${muted}`}>
              {STEPS[step - 1]}
              {step === 3 ? ` · ${formIndex + 1}/3` : ''}
              {' · '}
              Step {step} of {STEPS.length}
            </span>
          </div>
          <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300"
              style={{ width: `${((step - 1 + (step === 3 ? (formIndex + 1) / 3 : 0)) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between gap-2 overflow-x-auto pb-1">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <div key={label} className="flex flex-col items-center min-w-0 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    current
                      ? 'bg-[#0ECCEE] text-black'
                      : done
                        ? 'bg-green-600 text-white'
                        : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-xs mt-1 text-center max-w-24 truncate ${muted}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div key={`${step}-${formIndex}`} className="space-y-4 animate-detail-enter">
          {step === 1 ? (
            <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
              <h3 className={`text-xs font-bold uppercase tracking-widest mb-1 ${muted}`}>Your details</h3>
              <p className={`text-sm mb-4 ${muted}`}>Team leader contact — used for all 3 registrations.</p>
              <div className={`border-b mb-4 ${isDark ? 'border-gray-700/70' : 'border-gray-200'}`} />
              {needsLogin ? (
                <p className={`text-sm ${muted}`}>Sign in with Google to fill the form and continue.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Full name <span className="text-red-400">*</span></label>
                    <input value={customer.name} onChange={e => setCustomer(v => ({ ...v, name: e.target.value }))} placeholder="Team leader’s full name" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>WhatsApp number <span className="text-red-400">*</span></label>
                    <input inputMode="numeric" value={customer.phone} onChange={e => setCustomer(v => ({ ...v, phone: e.target.value }))} placeholder="10-digit number" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email <span className="text-red-400">*</span></label>
                    <input required type="email" value={customer.email} onChange={e => setCustomer(v => ({ ...v, email: e.target.value }))} placeholder="name@example.com" className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-end justify-between gap-3 mb-1">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${muted}`}>Choose 3 competitions</h3>
                <span className="text-xs font-bold text-[#0ECCEE]">{selected.filter(Boolean).length}/3</span>
              </div>
              <p className={`text-sm mb-4 ${muted}`}>Pick any 3 different competitions from the approved list.</p>
              <div className={`border-b mb-4 ${isDark ? 'border-gray-700/70' : 'border-gray-200'}`} />
              <div className="space-y-4">
                {[0, 1, 2].map(i => {
                  const list = offer.competitions || offer.technical || [];
                  return (
                    <label key={i} className="block">
                      <span className={labelCls}>Competition {i + 1} <span className="text-red-400">*</span></span>
                      <select
                        aria-label={`Select competition ${i + 1}`}
                        value={selected[i]}
                        onChange={e => setSelected(all => all.map((id, index) => index === i ? e.target.value : id))}
                        className={inputCls}
                      >
                        <option value="">Select competition</option>
                        {list.map(c => (
                          <option key={c._id} value={c._id} disabled={selected.some((id, index) => index !== i && id === c._id)}>
                            {c.name} · {c.registrationFee}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 && activeCompetition ? (
            <div>
              <div className="mb-4 flex gap-2">
                {comps.map((competition, index) => (
                  <button
                    key={competition._id}
                    type="button"
                    onClick={() => { setError(''); setFormIndex(index); }}
                    className={`min-w-0 flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                      index === formIndex
                        ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10 text-[#0ECCEE]'
                        : isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {index + 1}. <span className="hidden sm:inline">{competition.name}</span><span className="sm:hidden">Event</span>
                  </button>
                ))}
              </div>
              <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0ECCEE]">Competition {formIndex + 1} of 3</p>
                <h2 className={`mt-1 text-lg font-bold ${titleCls}`}>{activeCompetition.name}</h2>
                <p className={`mt-1 text-xs mb-4 ${muted}`}>
                  {activeMin === activeMax ? `${activeMin} participant${activeMin > 1 ? 's' : ''} required` : `${activeMin}–${activeMax} participants allowed`}
                  {' · '}name and email required for each
                </p>
                <div className={`border-b mb-4 ${isDark ? 'border-gray-700/70' : 'border-gray-200'}`} />
                <div className="space-y-4">
                  {activeMax > 1 ? (
                    <label className="block">
                      <span className={labelCls}>Team name</span>
                      <input value={forms[formIndex].teamName || ''} onChange={e => setForm(formIndex, 'teamName', e.target.value)} placeholder="Your team name" className={inputCls} />
                    </label>
                  ) : null}
                  {activeNames.map((member, index) => (
                    <div key={index} className={`rounded-xl border p-3 space-y-3 ${isDark ? 'border-gray-700/60 bg-[#0f1011]' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold ${titleCls}`}>
                          {index === 0 ? 'Team leader' : `Participant ${index + 1}`}
                          {index < activeMin ? <span className="text-red-400"> *</span> : null}
                        </p>
                        {index >= activeMin ? (
                          <button
                            type="button"
                            onClick={() => setForm(formIndex, 'members', activeNames.filter((_, n) => n !== index))}
                            className={`rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-gray-700 text-red-300' : 'border-gray-300 text-red-600'}`}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <label className="block">
                        <span className={labelCls}>Full name <span className="text-red-400">*</span></span>
                        <input
                          value={member.name}
                          onChange={(e) => setActiveMember(index, 'name', e.target.value)}
                          placeholder="Full name"
                          className={inputCls}
                        />
                      </label>
                      <label className="block">
                        <span className={labelCls}>Email <span className="text-red-400">*</span></span>
                        <input
                          type="email"
                          required
                          value={member.email}
                          onChange={(e) => setActiveMember(index, 'email', e.target.value)}
                          placeholder="name@example.com"
                          className={inputCls}
                        />
                      </label>
                    </div>
                  ))}
                  {activeNames.length < activeMax ? (
                    <button
                      type="button"
                      onClick={() => setForm(formIndex, 'members', [...activeNames, emptyMember()])}
                      className="w-full rounded-xl border border-dashed border-[#0ECCEE]/40 py-3 text-sm font-semibold text-[#0ECCEE]"
                    >
                      + Add participant
                    </button>
                  ) : null}
                  {activeCompetition.feeTiers?.length ? (
                    <label className="block">
                      <span className={labelCls}>Category <span className="text-red-400">*</span></span>
                      <select value={forms[formIndex].feeTierId || ''} onChange={e => setForm(formIndex, 'feeTierId', e.target.value)} className={inputCls}>
                        <option value="">Select category</option>
                        {activeCompetition.feeTiers.map(t => <option key={t.id} value={t.id}>{t.label} · ₹{t.amount}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${muted}`}>Review and pay</h3>
                <button type="button" onClick={() => { setFormIndex(0); setStep(2); }} className="text-sm font-semibold text-[#0ECCEE]">Edit</button>
              </div>
              <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                {comps.map((c, i) => {
                  const members = normalizeMembers(forms[i].members || forms[i].memberNames);
                  const priced = quote?.items?.find(item => String(item.competitionId) === String(c._id));
                  return (
                    <div key={c._id} className={`flex items-start justify-between gap-3 p-4 ${i > 0 ? (isDark ? 'border-t border-gray-700/50' : 'border-t border-gray-200') : ''}`}>
                      <div className="min-w-0">
                        <p className={`truncate font-semibold ${titleCls}`}>{c.name}</p>
                        <p className={`mt-1 text-xs ${muted}`}>{forms[i].teamName || members.map((m) => m.name).filter(Boolean).join(', ')}</p>
                        <p className={`text-xs ${muted}`}>{members.length} participant{members.length === 1 ? '' : 's'}</p>
                      </div>
                      <span className={`shrink-0 text-sm ${titleCls}`}>₹{Number(priced?.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
              <div className={`rounded-xl border p-4 ${isDark ? 'border-emerald-400/25 bg-emerald-500/8' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className={`flex justify-between text-sm ${muted}`}>
                  <span>Original total</span>
                  <span className="line-through">₹{Number(quote?.subtotal || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className={`mt-2 flex justify-between text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  <span>You save {discountPercent}%</span>
                  <span>₹{Number(quote?.discountAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className={`mt-3 flex justify-between border-t pt-3 text-xl font-black ${isDark ? 'border-white/10' : 'border-emerald-200'} ${titleCls}`}>
                  <span>Pay now</span>
                  <span>₹{Number(quote?.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                {quote ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0ECCEE] px-6 py-3 font-bold text-black hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#0ECCEE]/10"
                  >
                    {busy ? <Loader className="w-4 h-4 animate-spin" /> : <ShieldCheck size={18} />}
                    {busy ? 'Opening Cashfree…' : `Pay ₹${Number(quote.totalAmount).toLocaleString('en-IN')} & Book`}
                  </button>
                ) : (
                  <div className={`mt-4 flex items-center justify-center gap-2 rounded-xl py-3 text-sm ${muted}`}>
                    <Loader size={16} className="animate-spin" />Calculating price…
                  </div>
                )}
                <p className={`mt-2 text-center text-[11px] ${muted}`}>One secure payment for all 3 registrations</p>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className={`rounded-lg p-3 mt-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
            {error}
          </div>
        ) : null}

        {step < 4 ? (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 pb-2">
            <button
              type="button"
              onClick={goBack}
              className={`px-4 sm:px-6 py-3 rounded-xl border font-medium transition-colors text-sm sm:text-base ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}
            >
              {step > 1 || formIndex > 0 ? 'Previous Step' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={needsLogin ? () => setShowLogin(true) : goNext}
              className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#0ECCEE]/10"
            >
              {needsLogin ? 'Continue with Google' : step === 3 && formIndex >= 2 ? 'Review and pay' : 'Next Step'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 pb-2">
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className={`px-4 sm:px-6 py-3 rounded-xl border font-medium transition-colors text-sm sm:text-base ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}
            >
              Previous Step
            </button>
          </div>
        )}
      </div>

      {showLogin ? (
        <CrwdCtrlLogin
          googleOnly
          title="Sign in to register"
          subtitle="Sign in once — you stay signed in on this device"
          onClose={() => setShowLogin(false)}
        />
      ) : null}
    </div>
  );

  if (embedded) return <div className={pageClass}>{content}</div>;
  return <main className={pageClass}>{content}</main>;
}
