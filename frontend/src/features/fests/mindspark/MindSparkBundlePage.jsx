import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader, ShieldCheck } from 'lucide-react';
import { apiUtils } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { createMindSparkBundle, fetchMindSparkBundleOffer, quoteMindSparkBundle, reissueMindSparkBundlePayment, verifyMindSparkBundlePayment } from '../../../services/api/mindsparkBundle.api';
import { openPaymentCheckout } from '../../../utils/usePaymentCheckout';
import { PUBLIC_WEB_ORIGIN } from '../../../utils/publicWebOrigin';
import LocalQRCode from '../../../components/LocalQRCode';
import MindSparkBundleChoices, { MINDSPARK_BUNDLE_CHOICES, mindsparkBundleEvents, mindsparkBundleKeyFromSlug, mindsparkBundlePath } from './MindSparkBundleChoices';

const STEPS = ['Bundle', 'Details', 'Events', 'People', 'Pay'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyMember = () => ({ name: '', email: '' });

/** Normalize legacy string names or {name,email} rows into member objects.
 *  Keeps blank rows so “Add participant” can open an empty slot before the user types.
 */
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
    .filter((row) => row != null);
}

function membersComplete(members, min, max) {
  if (members.length < min || members.length > max) return false;
  return members.every((m) => m.name.trim() && EMAIL_RE.test(m.email.trim()));
}

/** FLASH / FANDOM (and similar) once-per-registration subcategory from personFields. */
function getSubcategoryField(competition) {
  const fields = competition?.registration?.personFields || competition?.personFields || [];
  if (!Array.isArray(fields)) return null;
  return fields.find((f) => String(f.key || '').toLowerCase() === 'subcategory')
    || fields.find((f) => /sub\s*categor/i.test(String(f.label || '')))
    || null;
}

function subcategoryComplete(competition, form) {
  const field = getSubcategoryField(competition);
  if (!field || field.required === false) return true;
  return Boolean(String(form?.subcategory || '').trim());
}

function sortEvents(list) {
  return [...(list || [])].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'en', { sensitivity: 'base' }));
}

function eventsForSlot(bundle, offer, index) {
  const raw = (bundle?.competitions?.length ? bundle.competitions : offer?.competitions) || [];
  const list = sortEvents(mindsparkBundleEvents(raw));
  if (bundle?.rule === 'both_tech') return list.filter((event) => event.group === 'technical');
  if (bundle?.rule === 'one_each') {
    return list.filter((event) => event.group === (index === 0 ? 'technical' : 'non_technical'));
  }
  return list;
}

function quoteShares(quote) {
  const items = quote?.items || [];
  if (items.length && items.every((item) => item?.payableAmount != null)) {
    return items.map((item) => Number(item.payableAmount) || 0);
  }
  const total = Math.round(Number(quote?.totalAmount) || 0);
  const originals = items.map((item) => Number(item?.originalAmount ?? item?.amount) || 0);
  const subtotal = originals.reduce((sum, amount) => sum + amount, 0);
  if (subtotal <= 0) return originals.map(() => 0);
  let used = 0;
  return originals.map((original, index) => {
    const amount = index === originals.length - 1 ? total - used : Math.round((total * original) / subtotal);
    used += amount;
    return amount;
  });
}

function eventOptionLabel(event) {
  const fee = event.feeAmount ?? event.registrationFee;
  const amount = Number(fee);
  return Number.isFinite(amount) && String(fee) !== '' ? `${event.name} · ₹${amount.toLocaleString('en-IN')}` : event.name;
}

function localCompetitionPrice(competition, feeTierId) {
  const tiers = Array.isArray(competition?.feeTiers) ? competition.feeTiers : [];
  if (tiers.length) {
    const tier = tiers.find((item) => String(item?.id || '') === String(feeTierId || ''));
    return Number(tier?.amount) || 0;
  }
  return Number(competition?.feeAmount ?? competition?.registrationFee) || 0;
}

function fieldClass(isDark) {
  return `w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${
    isDark
      ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400 [color-scheme:dark]'
      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500 [color-scheme:light]'
  }`;
}

export default function MindSparkBundlePage({ embedded = false, onClose, onSaved, initialBundleKey = '', deskMode = false }) {
  const [params] = useSearchParams();
  const { bundleSlug } = useParams();
  const desk = deskMode || params.get('desk') === '1';
  const navigate = useNavigate();
  const { isDark: prefersDark } = useDarkMode();
  const isDark = desk || prefersDark;
  const { isAuthenticated, user } = useAuth();
  const startKey = mindsparkBundleKeyFromSlug(bundleSlug) || initialBundleKey || 'hat_trick';
  const startChoice = MINDSPARK_BUNDLE_CHOICES.find((bundle) => bundle.key === startKey) || MINDSPARK_BUNDLE_CHOICES[0];
  const [showLogin, setShowLogin] = useState(false);
  const [step, setStep] = useState(1);
  const [formIndex, setFormIndex] = useState(0);
  const [offer, setOffer] = useState(null);
  const [offerStatus, setOfferStatus] = useState('loading');
  const [bundleKey, setBundleKey] = useState(startChoice.key);
  const [selected, setSelected] = useState(() => Array.from({ length: startChoice.size }, () => ''));
  const [forms, setForms] = useState(() => Array.from({ length: startChoice.size }, () => ({})));
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deskPay, setDeskPay] = useState(null);
  const [savedQrs, setSavedQrs] = useState([]);
  const [archiveView, setArchiveView] = useState(null);
  const submissionKey = useRef(crypto.randomUUID());
  const scrollRef = useRef(null);
  const inputCls = fieldClass(isDark);

  useEffect(() => {
    let cancelled = false;
    fetchMindSparkBundleOffer()
      .then((data) => {
        if (cancelled) return;
        setOffer(data);
        setOfferStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setOfferStatus('error');
      });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (embedded) return undefined;
    const path = mindsparkBundlePath(startChoice.key, { desk });
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== path) navigate(path, { replace: true });
    return undefined;
  }, [desk, embedded, navigate, startChoice.key]);
  useEffect(() => {
    if (!desk || !deskPay?.paymentToken || deskPay.status === 'paid') return undefined;
    const timer = window.setInterval(async () => {
      try {
        const next = await verifyMindSparkBundlePayment(deskPay.paymentToken);
        setDeskPay((prev) => ({
          ...prev,
          ...next,
          paymentToken: prev.paymentToken,
          paymentUrl: prev.paymentUrl,
          status: next.status || prev.status,
        }));
      } catch {
        /* keep polling */
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [desk, deskPay?.paymentToken, deskPay?.status]);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const accountPhone = String(user.phoneNumber || user.phone || '').replace(/\D/g, '').slice(-10);
    setCustomer(current => ({
      name: current.name || user.name || '',
      phone: current.phone || (accountPhone && accountPhone !== '9999999999' ? accountPhone : '') || '',
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
    const list = [
      ...(offer?.competitions || []),
      ...(offer?.technical || []),
      ...(offer?.nonTechnical || []),
      ...((offer?.bundles || []).flatMap((bundle) => bundle?.competitions || [])),
    ];
    const byId = new Map(list.map((competition) => [String(competition?._id || ''), competition]));
    return selected.map((id) => byId.get(String(id)));
  }, [offer, selected]);
  const activeBundle = useMemo(() => {
    const list = offer?.bundles || [];
    const fromOffer = list.find((b) => b.key === bundleKey);
    if (fromOffer) return fromOffer;
    const choice = MINDSPARK_BUNDLE_CHOICES.find((b) => b.key === bundleKey) || MINDSPARK_BUNDLE_CHOICES[0];
    return {
      key: choice.key,
      name: choice.basket,
      size: choice.size,
      discountPercent: choice.off,
      rule: choice.rule,
      blurb: choice.blurb,
    };
  }, [offer, bundleKey]);
  const size = Math.max(2, Number(activeBundle.size) || selected.length || 3);
  const discountPercent = Number(activeBundle.discountPercent) || 65;
  const pickBundle = (key) => {
    const next = (offer?.bundles || []).find((b) => b.key === key);
    const fallback = MINDSPARK_BUNDLE_CHOICES.find((b) => b.key === key);
    const n = Math.max(2, Number(next?.size) || Number(fallback?.size) || 3);
    setBundleKey(key);
    setSelected(Array.from({ length: n }, () => ''));
    setForms(Array.from({ length: n }, () => ({})));
    setFormIndex(0);
    setQuote(null);
    setError('');
    if (!embedded) {
      const path = mindsparkBundlePath(key, { desk });
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== path) navigate(path, { replace: true });
    }
  };
  const appliedBundleKey = useRef('');
  useEffect(() => {
    if (!initialBundleKey || appliedBundleKey.current === initialBundleKey) return;
    appliedBundleKey.current = initialBundleKey;
    pickBundle(initialBundleKey);
  }, [initialBundleKey, offer]);
  const items = useMemo(() => selected.map((competitionId, i) => ({
    competitionId,
    feeTierId: forms[i].feeTierId || '',
    subcategory: forms[i].subcategory || '',
    roster: {
      full_name: customer.name,
      phone: customer.phone,
      email: customer.email,
      team_name: forms[i].teamName || '',
      team_members: normalizeMembers(forms[i].members || forms[i].memberNames),
      subcategory: forms[i].subcategory || '',
      team_responses: forms[i].subcategory
        ? { subcategory: forms[i].subcategory }
        : undefined,
    },
  })), [selected, forms, customer]);
  const detailsValid = Boolean(customer.name.trim())
    && customer.phone.replace(/\D/g, '').length === 10
    && customer.phone.replace(/\D/g, '').slice(-10) !== '9999999999'
    && EMAIL_RE.test(customer.email.trim());
  const selectionValid = selected.length === size
    && selected.every(Boolean)
    && new Set(selected.map(String)).size === size
    && selected.every((id, index) => eventsForSlot(activeBundle, offer, index)
      .some((event) => String(event?._id || '') === String(id)));
  const formsValid = selectionValid && comps.every((c, i) => {
    const members = normalizeMembers(forms[i].members || forms[i].memberNames);
    const min = Math.max(1, Number(c?.teamSizeMin) || 1);
    const max = Math.max(min, Number(c?.teamSizeMax) || min);
    return membersComplete(members, min, max)
      && (!c?.feeTiers?.length || Boolean(forms[i].feeTierId))
      && subcategoryComplete(c, forms[i]);
  });
  const currentFormValid = (() => {
    const competition = comps[formIndex];
    if (!competition) return false;
    const members = normalizeMembers(forms[formIndex]?.members || forms[formIndex]?.memberNames);
    const min = Math.max(1, Number(competition.teamSizeMin) || 1);
    const max = Math.max(min, Number(competition.teamSizeMax) || min);
    return membersComplete(members, min, max)
      && (!competition.feeTiers?.length || Boolean(forms[formIndex]?.feeTierId))
      && subcategoryComplete(competition, forms[formIndex]);
  })();
  const localQuote = useMemo(() => {
    if (!selectionValid || !comps.length) return null;
    const items = comps.map((competition, index) => ({
      competitionId: competition._id,
      name: competition.name,
      originalAmount: localCompetitionPrice(competition, forms[index]?.feeTierId),
    }));
    const subtotal = items.reduce((sum, item) => sum + item.originalAmount, 0);
    if (!items.every((item) => item.originalAmount > 0)) return null;
    const totalAmount = Math.round(subtotal * ((100 - discountPercent) / 100));
    const shares = quoteShares({ totalAmount, items });
    return {
      bundleKey: activeBundle.key,
      bundleName: activeBundle.name,
      subtotal,
      discountPercent,
      discountAmount: subtotal - totalAmount,
      totalAmount,
      items: items.map((item, index) => ({ ...item, payableAmount: shares[index], amount: shares[index] })),
    };
  }, [activeBundle.key, activeBundle.name, comps, discountPercent, forms, selectionValid]);

  useEffect(() => {
    if (!detailsValid || !formsValid) { setQuote(null); return undefined; }
    setQuote(null);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      quoteMindSparkBundle({ bundleKey: activeBundle.key, items })
        .then((data) => {
          if (!cancelled) { setQuote(data); setError(''); }
        })
        .catch((e) => {
          if (!cancelled) { setQuote(null); setError(e.message); }
        });
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [detailsValid, formsValid, items, activeBundle.key]);

  const displayQuote = quote || localQuote;

  const setForm = (i, field, value) => setForms(all => all.map((form, index) => index === i ? { ...form, [field]: value } : form));
  const goNext = () => {
    setError('');
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2 && !desk && !isAuthenticated) { setShowLogin(true); return; }
    if (step === 2 && !detailsValid) return setError('Enter the team leader’s name, 10-digit WhatsApp number, and valid email.');
    if (step === 3 && !selectionValid) {
      if (activeBundle.rule === 'both_tech') return setError('Pick 2 different tech events.');
      if (activeBundle.rule === 'one_each') return setError('Pick 1 tech event and 1 non-tech event.');
      return setError('Pick 3 different events.');
    }
    if (step === 3) setForms(all => all.map((form, i) => {
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
    if (step === 4 && !currentFormValid) {
      const field = getSubcategoryField(comps[formIndex]);
      if (field && !subcategoryComplete(comps[formIndex], forms[formIndex])) {
        return setError(`Select a subcategory for ${comps[formIndex]?.name || 'this event'}.`);
      }
      return setError('Every participant needs a full name and a valid email.');
    }
    if (step === 4 && formIndex < size - 1) { setFormIndex(index => index + 1); return; }
    if (step === 4 && !formsValid) return setError('Add the people for every event before paying.');
    setStep(current => Math.min(5, current + 1));
  };
  const goBack = () => {
    setError('');
    if (step === 4 && formIndex > 0) { setFormIndex(index => index - 1); return; }
    if (step > 1) { setStep(current => current - 1); return; }
    if (onClose) onClose();
    else navigate(-1);
  };
  const submit = async () => {
    if (!desk && !apiUtils.isAuthenticated()) {
      const here = `${window.location.pathname}${window.location.search}`;
      return navigate(`/login?redirect=${encodeURIComponent(here)}`);
    }
    setBusy(true); setError('');
    try {
      let result = await createMindSparkBundle({ festId: offer.festId, submissionKey: submissionKey.current, customer, items, bundleKey: activeBundle.key }, desk);
      if (desk) {
        const paymentToken = String(result.paymentUrl || '')
          .split('/bundle-pay/')[1]
          ?.split(/[?#]/)[0] || '';
        const paymentUrl = result.paymentUrl || (paymentToken ? `${PUBLIC_WEB_ORIGIN}/mindspark/bundle-pay/${paymentToken}` : '');
        const snapshot = {
          ...result,
          paymentToken,
          paymentUrl,
          savedName: customer.name,
          savedLabel: activeBundle.name,
        };
        setArchiveView(null);
        setDeskPay(snapshot);
        onSaved?.({
          participantName: customer.name,
          competitionName: activeBundle.name,
          amount: result.amount,
          orderId: result.orderId,
          paymentUrl,
          activityType: 'bundle',
        });
        return;
      }
      if (result.status === 'paid') {
        window.location.assign(result.paymentUrl);
        return;
      }
      if (!result.orderId || (result.gateway !== 'razorpay' && !result.paymentSessionId)) {
        const paymentToken = new URL(result.paymentUrl, window.location.origin).pathname.split('/').filter(Boolean).pop();
        result = { ...result, ...await reissueMindSparkBundlePayment(paymentToken) };
      }
      if (!result.orderId || (result.gateway !== 'razorpay' && !result.paymentSessionId)) throw new Error('Payment checkout could not be opened. Please try Pay securely again.');
      const checkout = await openPaymentCheckout({
        gateway: result.gateway,
        keyId: result.keyId,
        paymentSessionId: result.paymentSessionId,
        orderId: result.orderId,
        returnPath: `${new URL(result.paymentUrl, window.location.origin).pathname}?returned=1`,
        entityType: 'competition_bundle',
        cashfreeMode: result.cashfreeMode,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerName: customer.name,
        displayName: 'MindSpark competition bundle',
      });
      if (!checkout?.redirectDeferred) {
        if (result.gateway === 'razorpay') {
          await verifyMindSparkBundlePayment(
            new URL(result.paymentUrl, window.location.origin).pathname.split('/').filter(Boolean).pop(),
            {
              razorpay_order_id: result.orderId,
              razorpay_payment_id: checkout?.paymentDetails?.paymentId,
              razorpay_signature: checkout?.paymentDetails?.signature,
            },
          );
        }
        const separator = result.paymentUrl.includes('?') ? '&' : '?';
        window.location.assign(`${result.paymentUrl}${separator}returned=1`);
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const startNextDeskPerson = () => {
    if (deskPay?.paymentUrl) {
      const snapshot = {
        ...deskPay,
        savedName: customer.name,
        savedLabel: activeBundle.name,
      };
      setSavedQrs((list) => [snapshot, ...list.filter((row) => row.orderId !== snapshot.orderId)].slice(0, 6));
    }
    submissionKey.current = crypto.randomUUID();
    setArchiveView(null);
    setDeskPay(null);
    setCustomer({ name: '', phone: '', email: '' });
    setSelected(Array.from({ length: size }, () => ''));
    setForms(Array.from({ length: size }, () => ({})));
    setFormIndex(0);
    setQuote(null);
    setError('');
    setBusy(false);
    setStep(2);
    window.setTimeout(() => scrollRef.current?.scrollIntoView({ block: 'start' }), 0);
  };

  const leaveDesk = () => {
    if (onClose) onClose();
    else navigate(`/fest-organizer/fests/${offer?.festId || '6a7f1010ed26d983b34e55c2'}/fest-day-desk`);
  };

  const pageClass = embedded && desk
    ? 'min-h-dvh bg-[#0c0d0e] text-white pb-10'
    : `crwdctrl-page crwdctrl-page--content ${embedded ? 'min-h-full' : 'min-h-dvh'} pt-[calc(var(--safe-top)+1.25rem)] sm:pt-[calc(var(--safe-top)+1.5rem)] pb-24`;
  const titleCls = isDark ? 'text-white' : 'text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';

  const shownPay = archiveView || deskPay;
  if (desk && shownPay) {
    const paid = shownPay.status === 'paid';
    const eventNames = archiveView
      ? []
      : comps.map((event) => event?.name).filter(Boolean);
    const deskContent = (
      <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#0ECCEE]">Fest Day Desk · Bundle</p>
            <h1 className={`text-xl font-bold mt-1 ${titleCls}`}>{shownPay.savedLabel || activeBundle.name} · {discountPercent}% off</h1>
            <p className={`text-sm mt-1 ${muted}`}>{(archiveView ? shownPay.savedName : customer.name) || 'Student'}{eventNames.length ? ` · ${eventNames.join(' · ')}` : ''}</p>
          </div>
          <button type="button" onClick={leaveDesk} className="text-sm font-semibold text-[#0ECCEE]">
            Back to desk
          </button>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-center text-sm font-semibold ${
          paid
            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
            : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
        }`}>
          {paid ? 'SUCCESSFUL — registrations done' : 'DRAFT · payment QR'}
        </div>
        <div className="rounded-3xl bg-white p-4 flex items-center justify-center min-h-[300px]">
          {paid && !(Array.isArray(shownPay.tickets) && shownPay.tickets.length) ? (
            <CheckCircle2 className="text-emerald-600" size={54} />
          ) : shownPay.paymentUrl && !paid ? (
            <LocalQRCode data={shownPay.paymentUrl} size={360} className="w-full max-w-[420px]" printSafe />
          ) : paid ? (
            <CheckCircle2 className="text-emerald-600" size={54} />
          ) : (
            <p className="text-sm text-gray-700 text-center px-4">Payment link is not ready yet. Go back one step and show the QR again.</p>
          )}
        </div>
        <div className="text-center space-y-1">
          <p className={`text-3xl font-bold ${titleCls}`}>₹{Number(shownPay.amount || 0).toLocaleString('en-IN')}</p>
          <p className={paid ? 'text-sm text-emerald-300' : 'text-sm text-amber-300'}>
            {paid
              ? 'Successful · each event now has its registration'
              : 'Draft · student scans this QR and pays on their phone'}
          </p>
          <p className={`font-mono text-xs ${muted}`}>{shownPay.orderId}</p>
        </div>
        {paid && Array.isArray(shownPay.tickets) && shownPay.tickets.length ? (
          <div className="space-y-2">
            {shownPay.tickets.map((ticket) => (
              <div key={ticket.registrationId || ticket.competitionName} className="rounded-xl border border-white/10 p-3">
                <p className={`text-sm font-semibold ${titleCls}`}>{ticket.competitionName}</p>
                <p className={`text-xs font-mono ${muted}`}>{ticket.registrationId}</p>
                {ticket.ticketQr || ticket.ticketUrl ? (
                  <div className="mt-2 rounded-xl bg-white p-2 w-fit mx-auto">
                    <LocalQRCode data={ticket.ticketQr || ticket.ticketUrl} size={140} printSafe />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {archiveView ? (
          <button type="button" onClick={() => setArchiveView(null)} className="w-full rounded-xl bg-[#0ECCEE] text-black py-3 font-semibold">
            Back to this form
          </button>
        ) : (
          <button type="button" onClick={startNextDeskPerson} className="w-full rounded-xl bg-[#0ECCEE] text-black py-3 font-semibold">
            Next student
          </button>
        )}
        {!archiveView && savedQrs.length ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Earlier drafts</p>
            {savedQrs.map((row) => (
              <button
                key={row.orderId || row.paymentUrl}
                type="button"
                onClick={() => setArchiveView(row)}
                className="w-full rounded-lg bg-black/30 px-3 py-2 text-left text-sm font-semibold text-white"
              >
                Draft · {row.savedName || 'Student'} · ₹{Number(row.amount || 0).toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        ) : null}
        <p className={`text-center text-xs ${muted}`}>
          {archiveView
            ? 'This one is still Draft until they pay. Go back to finish the student you are entering now.'
            : 'Next student keeps this QR as Draft and opens a blank form for the same bundle.'}
        </p>
      </div>
    );
    if (embedded) return <div className={pageClass}>{deskContent}</div>;
    return <main className={pageClass}>{deskContent}</main>;
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
  const needsLogin = step === 2 && !desk && !isAuthenticated;
  const labelCls = `block text-sm font-medium mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`;

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
            MindSpark bundles
          </h1>
          <p className={`text-sm mt-0.5 ${muted}`}>
            {desk
              ? `${activeBundle.name} · fill the form, then show the payment QR`
              : `${activeBundle.name} · ${activeBundle.blurb} · ${discountPercent}% off`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
          {discountPercent}% OFF
        </span>
      </div>
      {desk && savedQrs.length ? (
        <div className={`mb-4 rounded-xl border p-3 ${isDark ? 'border-amber-400/20 bg-amber-500/10' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>Drafts still waiting for payment</p>
          <div className="mt-2 flex flex-col gap-2">
            {savedQrs.map((row) => (
              <button
                key={row.orderId || row.paymentUrl}
                type="button"
                onClick={() => setArchiveView(row)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${isDark ? 'bg-black/30 text-white' : 'bg-white text-gray-900'}`}
              >
                Draft · {row.savedName || 'Student'} · {row.savedLabel || 'Bundle'} · ₹{Number(row.amount || 0).toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`rounded-2xl p-4 sm:p-6 md:p-8 border transition-all duration-300 ${
        isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="mb-5">
          <div className={`w-full rounded-full h-1.5 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className="bg-[#0ECCEE] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((step - 1 + (step === 4 ? (formIndex + 1) / size : 0)) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between gap-1">
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
                  <span className={`text-[11px] mt-1 text-center ${current ? titleCls : muted}`}>{desk && label === 'Pay' ? 'QR' : label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div key={`${step}-${formIndex}`} className="space-y-4 animate-detail-enter">
          {step === 1 ? (
            <div className="space-y-3">
              <MindSparkBundleChoices
                isDark={isDark}
                selectedKey={bundleKey}
                onPick={pickBundle}
                title=""
                subtitle=""
              />
              <p className={`rounded-xl px-3 py-3 text-sm leading-relaxed ${isDark ? 'bg-[#111213] text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                {MINDSPARK_BUNDLE_CHOICES.find((bundle) => bundle.key === bundleKey)?.guide}
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
              <h3 className={`text-sm font-bold mb-1 ${titleCls}`}>Team leader</h3>
              <p className={`text-sm mb-4 ${muted}`}>This contact is used for every event in the bundle.</p>
              {needsLogin ? (
                <p className={`text-sm ${muted}`}>Sign in with Google, then add the team leader.</p>
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

          {step === 3 ? (
            offerStatus !== 'ready' ? (
              <p className={`py-8 text-center text-sm font-semibold ${titleCls}`}>Loading events</p>
            ) : (
            <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className={`text-sm font-bold ${titleCls}`}>Choose events</h3>
                  <p className={`text-sm mt-0.5 ${muted}`}>{MINDSPARK_BUNDLE_CHOICES.find((bundle) => bundle.key === bundleKey)?.guide}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="shrink-0 text-xs font-bold text-[#0ECCEE]">
                  Change bundle
                </button>
              </div>
              <div className="space-y-4">
                {selected.map((_, i) => {
                  const slotList = eventsForSlot(activeBundle, offer, i);
                  const techEvents = slotList.filter((event) => event.group !== 'non_technical');
                  const nonTechEvents = slotList.filter((event) => event.group === 'non_technical');
                  const grouped = activeBundle.rule === 'any' && nonTechEvents.length > 0;
                  const slotLabel = activeBundle.rule === 'one_each'
                    ? (i === 0 ? 'Tech event' : 'Non-tech event')
                    : activeBundle.rule === 'both_tech'
                      ? `Tech event ${i + 1}`
                      : `Event ${i + 1}`;
                  const renderOption = (event) => (
                    <option
                      key={event._id}
                      value={event._id}
                      disabled={selected.some((id, index) => index !== i && String(id) === String(event._id))}
                    >
                      {eventOptionLabel(event)}
                    </option>
                  );
                  return (
                    <label key={`${activeBundle.key}-${i}`} className="block">
                      <span className={labelCls}>{slotLabel} <span className="text-red-400">*</span></span>
                      <select
                        aria-label={`Select ${slotLabel}`}
                        value={selected[i] || ''}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setSelected((all) => all.map((id, index) => (index === i ? nextId : id)));
                          setForms((all) => all.map((form, index) => (
                            index === i ? { ...form, subcategory: '', feeTierId: '' } : form
                          )));
                        }}
                        className={inputCls}
                      >
                        <option value="">Select event</option>
                        {grouped ? (
                          <>
                            <optgroup label={`Tech · ${techEvents.length}`}>
                              {techEvents.map(renderOption)}
                            </optgroup>
                            <optgroup label={`Non-tech · ${nonTechEvents.length}`}>
                              {nonTechEvents.map(renderOption)}
                            </optgroup>
                          </>
                        ) : slotList.map(renderOption)}
                      </select>
                    </label>
                  );
                })}
              </div>
              <p className={`text-xs mt-3 ${muted}`}>{selected.filter(Boolean).length} of {size} picked</p>
            </div>
            )
          ) : null}

          {step === 4 && activeCompetition ? (
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
                <p className="text-xs font-bold uppercase tracking-widest text-[#0ECCEE]">Event {formIndex + 1} of {size}</p>
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
                      onClick={() => {
                        setError('');
                        setForm(formIndex, 'members', [...activeNames, emptyMember()]);
                      }}
                      className="relative z-10 w-full rounded-xl border border-dashed border-[#0ECCEE]/50 bg-[#0ECCEE]/5 py-3.5 text-sm font-semibold text-[#0ECCEE] hover:bg-[#0ECCEE]/10 active:scale-[0.99] cursor-pointer transition"
                    >
                      + Add participant
                    </button>
                  ) : (
                    <p className={`text-center text-xs ${muted}`}>
                      Max {activeMax} participant{activeMax === 1 ? '' : 's'} for this event
                    </p>
                  )}
                  {activeCompetition.feeTiers?.length ? (
                    <label className="block">
                      <span className={labelCls}>Category <span className="text-red-400">*</span></span>
                      <select value={forms[formIndex].feeTierId || ''} onChange={e => setForm(formIndex, 'feeTierId', e.target.value)} className={inputCls}>
                        <option value="">Select category</option>
                        {activeCompetition.feeTiers.map(t => <option key={t.id} value={t.id}>{t.label} · ₹{t.amount}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {(() => {
                    const subField = getSubcategoryField(activeCompetition);
                    if (!subField?.options?.length) return null;
                    return (
                      <label className="block">
                        <span className={labelCls}>
                          {subField.label || 'Subcategory'}
                          {subField.required === false ? null : <span className="text-red-400"> *</span>}
                        </span>
                        <select
                          value={forms[formIndex].subcategory || ''}
                          onChange={(e) => setForm(formIndex, 'subcategory', e.target.value)}
                          className={inputCls}
                        >
                          <option value="">{subField.placeholder || 'Select subcategory'}</option>
                          {subField.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </label>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${muted}`}>Review and pay</h3>
                <button type="button" onClick={() => { setFormIndex(0); setStep(3); }} className="text-sm font-semibold text-[#0ECCEE]">Edit events</button>
              </div>
              <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                {(() => {
                  const shares = quoteShares(displayQuote);
                  return comps.map((c, i) => {
                  const members = normalizeMembers(forms[i].members || forms[i].memberNames);
                  const priced = displayQuote?.items?.find(item => String(item.competitionId) === String(c._id));
                  const shareIndex = (displayQuote?.items || []).findIndex(item => String(item.competitionId) === String(c._id));
                  const payable = shareIndex >= 0 ? (shares[shareIndex] || 0) : 0;
                  const original = Number(priced?.originalAmount ?? (priced?.payableAmount == null ? priced?.amount : payable)) || 0;
                  return (
                    <div key={c._id} className={`flex items-start justify-between gap-3 p-4 ${i > 0 ? (isDark ? 'border-t border-gray-700/50' : 'border-t border-gray-200') : ''}`}>
                      <div className="min-w-0">
                        <p className={`truncate font-semibold ${titleCls}`}>{c.name}</p>
                        <p className={`mt-1 text-xs ${muted}`}>{forms[i].teamName || members.map((m) => m.name).filter(Boolean).join(', ')}</p>
                        <p className={`text-xs ${muted}`}>{members.length} participant{members.length === 1 ? '' : 's'}</p>
                        {forms[i].subcategory ? (
                          <p className={`text-xs ${muted}`}>{forms[i].subcategory}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-right">
                        {original > payable ? (
                          <span className={`block text-xs line-through ${muted}`}>₹{original.toLocaleString('en-IN')}</span>
                        ) : null}
                        <span className={`text-sm font-semibold ${titleCls}`}>₹{payable.toLocaleString('en-IN')}</span>
                      </span>
                    </div>
                  );
                });
                })()}
              </div>
              <div className={`rounded-xl border p-4 ${isDark ? 'border-emerald-400/25 bg-emerald-500/8' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className={`flex justify-between text-sm ${muted}`}>
                  <span>Original total</span>
                  <span className="line-through">₹{Number(displayQuote?.subtotal || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className={`mt-2 flex justify-between text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  <span>You save {discountPercent}%</span>
                  <span>₹{Number(displayQuote?.discountAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className={`mt-3 flex justify-between border-t pt-3 text-xl font-black ${isDark ? 'border-white/10' : 'border-emerald-200'} ${titleCls}`}>
                  <span>Pay now</span>
                  <span>₹{Number(displayQuote?.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                {displayQuote ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0ECCEE] px-6 py-3 font-bold text-black hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-[#0ECCEE]/10"
                  >
                    {busy ? <Loader className="w-4 h-4 animate-spin" /> : <ShieldCheck size={18} />}
                    {busy ? (desk ? 'Creating payment QR…' : 'Opening secure payment…') : desk ? 'Generate payment QR' : `Pay ₹${Number(displayQuote.totalAmount).toLocaleString('en-IN')}`}
                  </button>
                ) : (
                  <div className={`mt-4 flex items-center justify-center gap-2 rounded-xl py-3 text-sm ${muted}`}>
                    <Loader size={16} className="animate-spin" />Calculating price…
                  </div>
                )}
                <p className={`mt-2 text-center text-[11px] ${muted}`}>
                  {desk ? 'Student scans the QR. You can start the next person right after it appears.' : `One secure payment for all ${size} registrations`}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className={`rounded-lg p-3 mt-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
            {error}
          </div>
        ) : null}

        {step < 5 ? (
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
              {needsLogin ? 'Continue with Google' : step === 1 ? 'Continue' : step === 4 && formIndex >= size - 1 ? (desk ? 'Review QR' : 'Review and pay') : 'Next'}
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
