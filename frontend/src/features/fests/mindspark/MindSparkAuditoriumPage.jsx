import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle, Loader, Ticket, ArrowLeft, Sparkles, IdCard } from 'lucide-react';
import { API_BASE_URL, publicFetchJSON, resolveUrl } from '../../../services/api/client';
import { authenticatedFetchJSON, userFetchJSONStrict } from '../../../services/api/auth.api';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';
import { InlinePageLoader } from '../../../components/DetailPageLoader';
import CrwdCtrlLogin from '../../../pages/auth/login';
import AuditoriumTicketPass, { ensureAuditoriumFonts } from './AuditoriumTicketPass';

const MIN_PHOTO_PX = 240;
const MINDSPARK_FEST = '6a7f1010ed26d983b34e55c2';

async function uploadTicketPhoto(file, token) {
  if (!token) throw new Error('Sign in required to upload');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('folder', 'auditorium-tickets');
  const res = await fetch(`${API_BASE_URL}/mindspark/auditorium/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Photo upload failed');
  return data.url || data.secure_url || data.data?.url || '';
}

function validatePhotoFile(file, { kind = 'face' } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Choose an image from camera or gallery'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Photo must be under 8 MB'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < MIN_PHOTO_PX || img.height < MIN_PHOTO_PX) {
        reject(new Error(
          kind === 'id'
            ? 'ID photo too small — capture the full card clearly'
            : 'Photo too small — face should fill the frame',
        ));
        return;
      }
      resolve(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read photo'));
    };
    img.src = url;
  });
}

function cloudinaryPathKey(url) {
  try {
    const u = new URL(String(url || ''));
    return u.pathname.replace(/\/v\d+\//, '/').replace(/\/upload\/[^/]+\//, '/upload/').toLowerCase();
  } catch {
    return String(url || '').split('?')[0].toLowerCase();
  }
}

function StageShell({ children }) {
  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background: '#070809',
        fontFamily: 'Outfit, Poppins, sans-serif',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 70% at 50% -20%, rgba(14,204,238,0.18), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 60%, rgba(245,158,11,0.07), transparent 45%), radial-gradient(ellipse 40% 30% at 100% 90%, rgba(14,204,238,0.06), transparent 40%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(14,204,238,0.5), transparent)',
        }}
      />
      <div className="relative max-w-md mx-auto px-4 py-6 pb-16">{children}</div>
    </div>
  );
}

const fieldClass =
  'w-full px-3.5 py-3.5 rounded-2xl bg-white/4 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#0ECCEE]/50 focus:ring-1 focus:ring-[#0ECCEE]/25 transition';

export default function MindSparkAuditoriumPage() {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code') || '';
  const navigate = useNavigate();
  const { toast } = useDialog();
  const { isAuthenticated, token, user, isLoading: authLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', email: '', college: '', misId: '', honorConfirmed: false,
  });
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [idCardUrl, setIdCardUrl] = useState('');
  const [idCardPreview, setIdCardPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [issuedFresh, setIssuedFresh] = useState(false);

  useEffect(() => {
    ensureAuditoriumFonts();
  }, []);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    try {
      const qs = inviteCode ? `?code=${encodeURIComponent(inviteCode)}` : '';
      const res = await publicFetchJSON(`/mindspark/auditorium/meta${qs}`);
      setMeta(res?.data || res);
    } catch (e) {
      toast(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [inviteCode, toast]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.name || user.displayName || '',
      email: f.email || user.email || '',
      phone: f.phone || user.phoneNumber || user.phone || '',
    }));
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) setShowLogin(false);
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    authenticatedFetchJSON(resolveUrl('/mindspark/auditorium/my-ticket'))
      .then((res) => {
        if (res?.ticket) {
          setTicket(res.ticket);
          setIssuedFresh(false);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, token]);

  const categories = useMemo(() => {
    const list = [...(meta?.categories || [])];
    if (meta?.inviteCategory) {
      list.unshift({ ...meta.inviteCategory, invite: true });
    }
    return list;
  }, [meta]);

  const selected = categories.find((c) => c.id === categoryId);

  const onFacePhoto = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await validatePhotoFile(file, { kind: 'face' });
      const preview = URL.createObjectURL(file);
      setPhotoPreview(preview);
      const url = await uploadTicketPhoto(file, token);
      if (!url) throw new Error('Upload failed');
      if (idCardUrl && cloudinaryPathKey(url) === cloudinaryPathKey(idCardUrl)) {
        throw new Error('Face photo and college ID must be different pictures');
      }
      setPhotoUrl(url);
      toast('Face photo ready');
    } catch (e) {
      toast(e.message || 'Photo failed');
      setPhotoUrl('');
      setPhotoPreview('');
    } finally {
      setBusy(false);
    }
  };

  const onIdCardPhoto = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await validatePhotoFile(file, { kind: 'id' });
      const preview = URL.createObjectURL(file);
      setIdCardPreview(preview);
      const url = await uploadTicketPhoto(file, token);
      if (!url) throw new Error('Upload failed');
      if (photoUrl && cloudinaryPathKey(url) === cloudinaryPathKey(photoUrl)) {
        throw new Error('Face photo and college ID must be different pictures');
      }
      setIdCardUrl(url);
      toast('ID card ready');
    } catch (e) {
      toast(e.message || 'ID upload failed');
      setIdCardUrl('');
      setIdCardPreview('');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!isAuthenticated || !token) {
      setShowLogin(true);
      toast('Sign in with Google to continue');
      return;
    }
    if (photoUrl && idCardUrl && cloudinaryPathKey(photoUrl) === cloudinaryPathKey(idCardUrl)) {
      toast('Face photo and college ID must be different pictures');
      return;
    }
    setBusy(true);
    try {
      const body = {
        categoryId,
        inviteCode: inviteCode || undefined,
        name: form.name,
        phone: form.phone,
        email: form.email,
        college: form.college,
        misId: form.misId,
        ticketPhotoUrl: photoUrl,
        idCardPhotoUrl: idCardUrl,
        honorConfirmed: form.honorConfirmed,
      };
      const res = await userFetchJSONStrict('/mindspark/auditorium/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setTicket(res.ticket);
      setIssuedFresh(true);
      toast('Ticket issued');
    } catch (e) {
      if (e.code === 'ALREADY_REGISTERED' && (e.data?.ticket || e.ticket)) {
        setTicket(e.data?.ticket || e.ticket);
        setIssuedFresh(false);
        toast('You already have a ticket');
      } else if (e.code === 'MIS_YEAR_MISMATCH') {
        const expected = e.expectedCategoryId || e.data?.expectedCategoryId;
        if (expected) {
          setCategoryId(expected);
          toast(e.message || 'MIS batch doesn’t match the year you picked — switched to the matching year. Submit again.');
        } else {
          toast(e.message || 'MIS batch doesn’t match the year you picked');
        }
      } else if (e.code === 'SAME_PHOTO') {
        toast(e.message || 'Face photo and college ID must be different pictures');
      } else if (e.status === 401 || e.code === 'LOGIN_REQUIRED' || e.code === 'AUTH_401' || e.code === 'NO_AUTH_TOKEN') {
        setShowLogin(true);
        toast('Sign in with Google to continue');
      } else {
        toast(e.message || 'Registration failed');
      }
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || (loading && !meta)) {
    return <InlinePageLoader label="Loading auditorium…" />;
  }

  if (!isAuthenticated) {
    return (
      <StageShell>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80 transition"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <header className="mt-8 space-y-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#0ECCEE] font-semibold">MindSpark</p>
          <h1
            className="text-[2.5rem] leading-none text-white"
            style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}
          >
            AUDITORIUM PASS
          </h1>
          <p className="text-sm text-white/45 max-w-xs mx-auto">
            Sign in with Google once — we fill your name &amp; email. Already signed in on this device? You’re good.
          </p>
        </header>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-white text-gray-900 font-semibold py-3.5 text-sm shadow-lg active:scale-[0.98] transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <p className="text-center text-[11px] text-white/35">
            Required so each person gets one ticket · details auto-fill after sign-in
          </p>
        </div>

        {showLogin ? (
          <CrwdCtrlLogin
            googleOnly
            title="Sign in for your pass"
            subtitle="Google once — stay signed in on this device"
            onClose={() => setShowLogin(false)}
          />
        ) : null}
      </StageShell>
    );
  }

  if (ticket) {
    return (
      <StageShell>
        <div
          className="space-y-5 animate-[audFadeIn_0.55s_ease-out]"
          style={{
            animation: 'audFadeIn 0.55s ease-out',
          }}
        >
          <style>{`
            @keyframes audFadeIn {
              from { opacity: 0; transform: translateY(16px) scale(0.98); }
              to { opacity: 1; transform: none; }
            }
            @keyframes audPulse {
              0%, 100% { opacity: 0.55; }
              50% { opacity: 1; }
            }
          `}</style>

          <div className="text-center space-y-2 pt-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 text-xs font-semibold">
              <CheckCircle size={14} />
              {issuedFresh ? 'Pass unlocked' : 'Your pass'}
            </div>
            <h1
              className="text-3xl text-white leading-none"
              style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}
            >
              YOU&apos;RE ON THE LIST
            </h1>
            <p className="text-sm text-white/45">Screenshot this · check email · open from Bookings anytime</p>
            <p className="text-[11px] text-amber-200/80 max-w-sm mx-auto leading-relaxed">
              Note: If your college ID and face don’t match at the gate, entry may be restricted.
            </p>
          </div>

          <AuditoriumTicketPass ticket={ticket} />

          <div className="flex flex-col gap-2.5">
            <Link
              to={`/qr-ticket/${ticket.id || ticket.registrationId}?auditorium=1`}
              className="block text-center rounded-2xl bg-[#0ECCEE] text-black font-bold py-3.5 text-sm shadow-[0_12px_40px_-16px_rgba(14,204,238,0.8)] active:scale-[0.98] transition"
            >
              Full-screen gate pass
            </Link>
            <Link
              to="/booking"
              className="block text-center rounded-2xl border border-white/12 bg-white/3 text-white font-medium py-3.5 text-sm hover:border-white/25 transition"
            >
              View in My Bookings
            </Link>
            <Link
              to={`/fest/${MINDSPARK_FEST}`}
              className="block text-center text-sm text-white/40 py-1 hover:text-white/70 transition"
            >
              Back to MindSpark
            </Link>
          </div>
        </div>
      </StageShell>
    );
  }

  const regOpen = Boolean(meta?.registrationOpen) || Boolean(meta?.inviteCategory);
  const steps = ['Year', 'Details', 'ID card', 'Face', 'Confirm'];

  return (
    <StageShell>
      <style>{`
        @keyframes audBar {
          from { width: 0; }
        }
      `}</style>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white/80 transition"
      >
        <ArrowLeft size={16} /> Back
      </button>

        <header className="mt-5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
            <Sparkles size={10} /> MindSpark
          </span>
          {user?.email ? (
            <span className="text-[11px] text-white/40 truncate max-w-[200px]">
              Signed in · {user.email}
            </span>
          ) : null}
          {meta?.totalLeft != null && regOpen ? (
            <span className="text-[11px] text-white/35 tabular-nums">{meta.totalLeft} seats left</span>
          ) : null}
        </div>
        <h1
          className="text-[2.35rem] leading-[0.95] text-white"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.05em' }}
        >
          AUDITORIUM
          <br />
          <span className="text-[#0ECCEE]">PASS</span>
        </h1>
        <p className="text-sm text-white/45 max-w-[300px]">
          Free night entry · college ID with name + year · then a clear face photo
        </p>
      </header>

      {!regOpen ? (
        <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          Registration is not open yet. Check back when organizers flip the switch.
        </div>
      ) : null}

      {/* Progress */}
      <div className="mt-6 flex gap-1.5">
        {steps.map((label, i) => {
          const active = step === i + 1;
          const done = step > i + 1;
          return (
            <div key={label} className="flex-1 space-y-1.5">
              <div
                className={`h-1 rounded-full overflow-hidden ${
                  done || active ? 'bg-[#0ECCEE]/25' : 'bg-white/8'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-400 ${
                    done || active ? 'bg-[#0ECCEE] w-full' : 'w-0'
                  }`}
                />
              </div>
              <p
                className={`text-[10px] uppercase tracking-wider text-center ${
                  active ? 'text-[#0ECCEE]' : done ? 'text-white/50' : 'text-white/25'
                }`}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        {step === 1 ? (
          <div className="space-y-2.5">
            <p className="text-sm text-white/60">Choose your category</p>
            {categories.map((c, idx) => {
              const full = Boolean(c.full) || (c.left != null && c.left <= 0);
              const seats = Number(c.seats) || 0;
              const left = c.left != null ? Number(c.left) : null;
              const filledPct =
                seats > 0 && left != null
                  ? Math.min(100, Math.round(((seats - left) / seats) * 100))
                  : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={full || !regOpen}
                  onClick={() => { setCategoryId(c.id); setStep(2); }}
                  className={`group w-full text-left rounded-2xl border px-4 py-3.5 transition duration-200 ${
                    full
                      ? 'border-white/5 bg-white/2 opacity-45'
                      : 'border-white/10 bg-white/3 hover:border-[#0ECCEE]/45 hover:bg-[#0ECCEE]/05 active:scale-[0.99]'
                  }`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <p className="text-[15px] font-semibold text-white group-hover:text-[#B8F4FC] transition">
                        {c.label}
                      </p>
                      {c.invite ? (
                        <p className="text-[10px] text-[#0ECCEE] mt-1 font-medium tracking-wide uppercase">
                          Invite unlocked
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs tabular-nums text-white/40 shrink-0">
                      {full ? 'Full' : left != null ? `${left} left` : ''}
                    </p>
                  </div>
                  {filledPct != null && !full ? (
                    <div className="mt-3 h-1 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-[#0ECCEE] to-amber-300/80"
                        style={{ width: `${filledPct}%` }}
                      />
                    </div>
                  ) : null}
                </button>
              );
            })}
            {!categories.length ? (
              <p className="text-sm text-white/35 text-center py-10">No public seats configured yet</p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[#0ECCEE]/80">
              {selected?.label || 'Details'}
            </p>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              className={fieldClass}
              autoComplete="name"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone (10 digits)"
              inputMode="numeric"
              className={fieldClass}
              autoComplete="tel"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email (ticket delivery)"
              type="email"
              readOnly={Boolean(user?.email)}
              className={`${fieldClass}${user?.email ? ' opacity-80' : ''}`}
              autoComplete="email"
            />
            {user?.email ? (
              <p className="text-[10px] text-white/35 -mt-1 px-1">
                Using your Google account email
              </p>
            ) : null}
            <input
              value={form.college}
              onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))}
              placeholder="College"
              className={fieldClass}
            />
            <input
              value={form.misId}
              onChange={(e) => setForm((f) => ({ ...f, misId: e.target.value }))}
              placeholder="MIS / college ID number"
              className={fieldClass}
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl border border-white/12 text-sm text-white/70"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!form.name.trim() || form.phone.replace(/\D/g, '').slice(-10).length !== 10) {
                    toast('Name and valid phone required');
                    return;
                  }
                  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
                    toast('Valid email required for your ticket');
                    return;
                  }
                  const mis = form.misId.replace(/[^a-zA-Z0-9]/g, '');
                  if (mis.length < 5) {
                    toast('Enter your MIS / college ID number (min 5 characters)');
                    return;
                  }
                  setStep(3);
                }}
                className="flex-1 py-3 rounded-2xl bg-[#0ECCEE] text-black text-sm font-bold"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-white/70">College ID card</p>
              <p className="text-[11px] text-white/35 mt-1">
                Full card visible · name + year / class readable · no blur
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-amber-100/90">
              If your college ID and face photo don’t match, or the year on your ID doesn’t
              match the category you picked, <strong className="text-amber-50">entry may be restricted</strong> at the gate.
            </div>

            <label className="relative flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/20 bg-white/3 py-8 cursor-pointer hover:border-[#0ECCEE]/40 transition overflow-hidden">
              {(idCardPreview || idCardUrl) ? (
                <div className="w-full px-4 space-y-2">
                  <img
                    src={idCardPreview || idCardUrl}
                    alt="ID card"
                    className="w-full max-h-52 object-contain rounded-xl bg-black/40 border border-white/10"
                  />
                  <span className="block text-center text-[10px] text-[#0ECCEE] font-semibold uppercase tracking-wide">
                    Tap to retake
                  </span>
                </div>
              ) : (
                <>
                  <div className="size-16 rounded-full border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 flex items-center justify-center">
                    <IdCard className="text-[#0ECCEE]" size={26} />
                  </div>
                  <span className="text-sm text-white/55">Capture college ID</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onIdCardPhoto(e.target.files?.[0])}
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-2xl border border-white/12 text-sm text-white/70"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!idCardUrl || busy}
                onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-2xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-40"
              >
                {busy ? 'Uploading…' : 'Next'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-white/70">Face photo for the gate</p>
              <p className="text-[11px] text-white/35 mt-1">
                Fill the frame · good light · just you — same person as on your college ID
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-amber-100/90">
              Gate staff will compare this face with your ID photo. Mismatch =
              {' '}<strong className="text-amber-50">entry may be restricted</strong>.
            </div>

            <label className="relative flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/20 bg-white/3 py-8 cursor-pointer hover:border-[#0ECCEE]/40 transition overflow-hidden">
              {(photoPreview || photoUrl) ? (
                <div className="relative">
                  <div className="size-40 rounded-full overflow-hidden border-2 border-[#0ECCEE]/50 shadow-[0_0_40px_-10px_rgba(14,204,238,0.7)]">
                    <img
                      src={photoPreview || photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#0ECCEE] px-2.5 py-0.5 text-[10px] font-bold text-black">
                    Tap to change
                  </span>
                </div>
              ) : (
                <>
                  <div className="size-16 rounded-full border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 flex items-center justify-center">
                    <Camera className="text-[#0ECCEE]" size={26} />
                  </div>
                  <span className="text-sm text-white/55">Camera or gallery</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => onFacePhoto(e.target.files?.[0])}
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-2xl border border-white/12 text-sm text-white/70"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!photoUrl || busy}
                onClick={() => setStep(5)}
                className="flex-1 py-3 rounded-2xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-40"
              >
                {busy ? 'Uploading…' : 'Next'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/3 p-4 space-y-3">
              <div className="flex gap-3">
                {(photoPreview || photoUrl) ? (
                  <img
                    src={photoPreview || photoUrl}
                    alt=""
                    className="w-16 h-20 rounded-xl object-cover border border-white/10"
                  />
                ) : null}
                {(idCardPreview || idCardUrl) ? (
                  <img
                    src={idCardPreview || idCardUrl}
                    alt="ID"
                    className="w-24 h-20 rounded-xl object-cover border border-white/10"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#0ECCEE]">Preview</p>
                  <p className="text-base font-semibold text-white truncate">{form.name}</p>
                  <p className="text-xs text-[#7DE8F7]">{selected?.label}</p>
                  <p className="text-[11px] text-white/35 truncate">
                    {form.phone} · {form.email}
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/2 p-3.5 text-xs text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={form.honorConfirmed}
                onChange={(e) => setForm((f) => ({ ...f, honorConfirmed: e.target.checked }))}
                className="mt-0.5 accent-[#0ECCEE]"
              />
              <span>
                I confirm I belong to{' '}
                <strong className="text-white">{selected?.label}</strong>, this ID card is mine,
                the year on the card matches, and my face photo is of me. I understand that if ID
                and face don’t match, <strong className="text-white">entry may be restricted</strong>.
              </span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-2xl border border-white/12 text-sm text-white/70"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || !form.honorConfirmed || !photoUrl || !idCardUrl}
                onClick={submit}
                className="flex-1 py-3 rounded-2xl bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2 shadow-[0_12px_36px_-14px_rgba(52,211,153,0.7)]"
              >
                {busy ? <Loader className="animate-spin" size={16} /> : <Ticket size={16} />}
                Get my pass
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </StageShell>
  );
}
