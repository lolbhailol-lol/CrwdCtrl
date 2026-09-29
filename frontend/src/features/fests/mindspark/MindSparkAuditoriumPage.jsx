import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle, Loader, Ticket, ArrowLeft, Sparkles, IdCard, Image as ImageIcon, ChevronUp, ChevronDown, ZoomIn } from 'lucide-react';
import { publicFetchJSON } from '../../../services/api/client';
import { useDialog } from '../../../context/DialogContext';
import { InlinePageLoader } from '../../../components/DetailPageLoader';
import AuditoriumTicketPass, { ensureAuditoriumFonts } from './AuditoriumTicketPass';
import { CULT_NIGHT_PASS_DAYS, cultNightDayForCategory } from './cultNightPassDays';

const MIN_PHOTO_PX = 160;
const MINDSPARK_FEST = '6a7f1010ed26d983b34e55c2';
const DRAFT_KEY = 'mindspark_auditorium_draft_v1';
const COEP_COLLEGE = 'COEP';

function readDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(payload) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

async function uploadTicketPhoto(file, { eligibilityToken, inviteCode, categoryId, email }) {
  const collegeEmail = String(email || '').trim();
  if (!eligibilityToken && !inviteCode && !/@coeptech\.ac\.in$/i.test(collegeEmail)) {
    throw new Error('Only @coeptech.ac.in addresses are allowed.');
  }
  const signed = await publicFetchJSON('/mindspark/auditorium/upload-signature', {
    method: 'POST',
    body: JSON.stringify({ eligibilityToken, inviteCode, categoryId, email: collegeEmail }),
  });
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`;
  let lastError = null;

  // Upload directly from the phone so a photo rush never fills backend memory.
  // Cloudinary can briefly throttle a burst; retry there instead of proxying the
  // same files through the single API instance.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', signed.apiKey);
    fd.append('timestamp', String(signed.timestamp));
    fd.append('folder', signed.folder);
    fd.append('signature', signed.signature);
    try {
      const direct = await fetch(endpoint, { method: 'POST', body: fd });
      const directData = await direct.json().catch(() => ({}));
      if (direct.ok && directData.secure_url) return directData.secure_url;
      const message = directData.error?.message || `Photo upload failed (${direct.status})`;
      lastError = new Error(message);
      const retryable = direct.status === 420 || direct.status === 429 || direct.status >= 500;
      if (!retryable) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) {
      const delay = (500 * (2 ** attempt)) + Math.floor(Math.random() * 300);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }
  throw lastError || new Error('Photo upload failed. Please try again.');
}

async function optimizeUploadImage(file) {
  if (!file || /hei[cf]/i.test(`${file.type || ''} ${file.name || ''}`) || file.size < 900 * 1024) {
    return file;
  }
  if (typeof createImageBitmap !== 'function') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], `${String(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}

function looksLikeImageFile(file) {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  // iOS / some Androids leave MIME blank for camera / HEIC gallery picks
  if (!mime || mime === 'application/octet-stream') {
    return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i.test(file.name || '');
  }
  return false;
}

function validatePhotoFile(file, { kind = 'face' } = {}) {
  return new Promise((resolve, reject) => {
    if (!looksLikeImageFile(file)) {
      reject(new Error('Choose an image from camera or gallery'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error('Photo must be under 20 MB'));
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
      // HEIC often fails Image() decode in browser but Cloudinary accepts it
      if (/\.hei[cf]$/i.test(file.name || '') || /heic|heif/i.test(file.type || '')) {
        resolve(true);
        return;
      }
      reject(new Error('Could not read photo — try Gallery JPG/PNG'));
    };
    img.src = url;
  });
}

function PhotoSourcePicker({
  preview,
  uploadedUrl,
  busy,
  kind = 'id',
  onPick,
  onAdjust,
  emptyLabel,
  onBeforeOpen,
}) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return; // camera cancelled — stay on this step
    onPick(file);
  };

  const openPicker = (ref) => {
    onBeforeOpen?.();
    // Defer so draft flush lands before OS camera takes over the WebView
    requestAnimationFrame(() => ref.current?.click());
  };

  return (
    <div className="space-y-3">
      <div className="relative flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/20 bg-white/3 py-6 overflow-hidden min-h-[180px]">
        {busy ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader className="animate-spin text-[#0ECCEE]" size={28} />
            <span className="text-sm text-white/55">Uploading…</span>
          </div>
        ) : (preview || uploadedUrl) ? (
          <div className={`w-full px-4 space-y-2 ${kind === 'face' ? 'flex flex-col items-center' : ''}`}>
            {kind === 'face' ? (
              <div className="size-40 rounded-full overflow-hidden border-2 border-[#0ECCEE]/50 shadow-[0_0_40px_-10px_rgba(14,204,238,0.7)]">
                <img src={preview || uploadedUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <img
                src={preview || uploadedUrl}
                alt="ID card"
                className="w-full max-h-52 object-contain rounded-xl bg-black/40 border border-white/10"
              />
            )}
            <span className="block text-center text-[10px] text-emerald-300/90 font-semibold uppercase tracking-wide">
              Ready — drag to fix the face, or pick again
            </span>
            {onAdjust ? (
              <button
                type="button"
                onClick={onAdjust}
                className="mx-auto block rounded-xl border border-[#0ECCEE]/40 px-3 py-2 text-xs font-semibold text-[#7DE8F7]"
              >
                Move photo
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="size-16 rounded-full border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 flex items-center justify-center">
              {kind === 'face' ? <Camera className="text-[#0ECCEE]" size={26} /> : <IdCard className="text-[#0ECCEE]" size={26} />}
            </div>
            <span className="text-sm text-white/55">{emptyLabel}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => openPicker(cameraRef)}
          className="inline-flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/12 bg-white/4 text-sm font-medium text-white disabled:opacity-40"
        >
          <Camera size={16} className="text-[#0ECCEE]" /> Camera
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => openPicker(galleryRef)}
          className="inline-flex items-center justify-center gap-2 py-3 rounded-2xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 text-sm font-semibold text-[#0ECCEE] disabled:opacity-40"
        >
          <ImageIcon size={16} /> Gallery
        </button>
      </div>

      {/* capture forces camera; gallery input has no capture so Photos/Files opens */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture={kind === 'face' ? 'user' : 'environment'}
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

const ADJUST_FRAMES = {
  face: { width: 240, height: 320, outW: 810, outH: 1080, hint: 'Drag up or down until your face sits in the frame.' },
  id: { width: 300, height: 190, outW: 1200, outH: 760, hint: 'Drag until the photo on your ID is visible.' },
};

function PhotoAdjustModal({ file, imageUrl, kind = 'face', onCancel, onConfirm }) {
  const frame = ADJUST_FRAMES[kind] || ADJUST_FRAMES.face;
  const [imgSrc, setImgSrc] = useState('');
  const [imgEl, setImgEl] = useState(null);
  const [zoom, setZoom] = useState(1.15);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImgSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    setImgSrc(imageUrl || '');
    return undefined;
  }, [file, imageUrl]);

  useEffect(() => {
    if (!imgSrc) return undefined;
    const image = new Image();
    if (!file) image.crossOrigin = 'anonymous';
    image.onload = () => {
      setFailed(false);
      setImgEl(image);
    };
    image.onerror = () => setFailed(true);
    image.src = imgSrc;
    return undefined;
  }, [imgSrc, file]);

  const baseScale = imgEl
    ? Math.max(frame.width / imgEl.naturalWidth, frame.height / imgEl.naturalHeight)
    : 1;
  const displayScale = baseScale * zoom;
  const dispW = imgEl ? imgEl.naturalWidth * displayScale : frame.width;
  const dispH = imgEl ? imgEl.naturalHeight * displayScale : frame.height;

  const clampOffset = useCallback((next) => {
    const maxX = Math.max(0, (dispW - frame.width) / 2);
    const maxY = Math.max(0, (dispH - frame.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, [dispW, dispH, frame.width, frame.height]);

  useEffect(() => {
    setOffset((prev) => clampOffset(prev));
  }, [clampOffset]);

  const confirm = async () => {
    if (!imgEl) {
      if (file) onConfirm(file);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = frame.outW;
    canvas.height = frame.outH;
    const ctx = canvas.getContext('2d');
    const tlx = frame.width / 2 - dispW / 2 + offset.x;
    const tly = frame.height / 2 - dispH / 2 + offset.y;
    const sx = (0 - tlx) / displayScale;
    const sy = (0 - tly) / displayScale;
    ctx.drawImage(imgEl, sx, sy, frame.width / displayScale, frame.height / displayScale, 0, 0, frame.outW, frame.outH);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      if (file) onConfirm(file);
      return;
    }
    onConfirm(new File([blob], kind === 'face' ? 'face.jpg' : 'id-card.jpg', { type: 'image/jpeg' }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3">
      <div className="w-full max-w-sm rounded-3xl bg-[#121314] border border-white/10 p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">{kind === 'face' ? 'Fit your face' : 'Fit your ID'}</p>
          <p className="text-[11px] text-white/45 mt-1">{frame.hint}</p>
        </div>
        <div
          className="relative mx-auto overflow-hidden rounded-2xl bg-black touch-none"
          style={{ width: frame.width, height: frame.height }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const maxX = Math.max(0, (dispW - frame.width) / 2);
            const maxY = Math.max(0, (dispH - frame.height) / 2);
            const x = dragRef.current.ox + (e.clientX - dragRef.current.x);
            const y = dragRef.current.oy + (e.clientY - dragRef.current.y);
            setOffset({
              x: Math.min(maxX, Math.max(-maxX, x)),
              y: Math.min(maxY, Math.max(-maxY, y)),
            });
          }}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          {imgEl ? (
            <img
              src={imgSrc}
              alt=""
              draggable={false}
              className="absolute max-w-none"
              style={{
                left: '50%',
                top: '50%',
                width: dispW,
                height: dispH,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-white/40">
              {failed ? 'Could not open this photo' : 'Loading…'}
            </div>
          )}
          <div className="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-white/50" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setOffset((prev) => clampOffset({ x: prev.x, y: prev.y - 24 }))}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-white"
          >
            <ChevronUp size={14} /> Up
          </button>
          <button
            type="button"
            onClick={() => setOffset((prev) => clampOffset({ x: prev.x, y: prev.y + 24 }))}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-white"
          >
            <ChevronDown size={14} /> Down
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ZoomIn size={16} className="text-white/40 shrink-0" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[#0ECCEE]"
            aria-label="Zoom"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-white/12 text-sm text-white/70">
            Cancel
          </button>
          <button
            type="button"
            disabled={!imgEl && !file}
            onClick={confirm}
            className="flex-1 py-3 rounded-2xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-40"
          >
            Use this photo
          </button>
        </div>
      </div>
    </div>
  );
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
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const draftBoot = useMemo(() => readDraft(), []);
  const [step, setStep] = useState(() => Math.min(5, Math.max(1, Number(draftBoot?.step) || 1)));
  const [categoryId, setCategoryId] = useState(() => String(draftBoot?.categoryId || ''));
  const [directoryEmail, setDirectoryEmail] = useState(() => String(draftBoot?.directoryEmail || ''));
  const [otpCode, setOtpCode] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState(() => String(draftBoot?.otpChallengeId || ''));
  const [eligibilityToken, setEligibilityToken] = useState(() => String(draftBoot?.eligibilityToken || ''));
  const [otpBusy, setOtpBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    name: draftBoot?.form?.name || '',
    phone: draftBoot?.form?.phone || '',
    email: draftBoot?.form?.email || '',
    honorConfirmed: Boolean(draftBoot?.form?.honorConfirmed),
  }));
  const [photoUrl, setPhotoUrl] = useState(() => String(draftBoot?.photoUrl || ''));
  const [photoPreview, setPhotoPreview] = useState('');
  const [idCardUrl, setIdCardUrl] = useState(() => String(draftBoot?.idCardUrl || ''));
  const [idCardPreview, setIdCardPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingKind, setUploadingKind] = useState(null); // 'id' | 'face' | null
  const [ticket, setTicket] = useState(null);
  const [issuedFresh, setIssuedFresh] = useState(false);
  const faceUploadRef = useRef(0);
  const idUploadRef = useRef(0);
  const sourceFiles = useRef({ face: null, id: null });
  const [adjust, setAdjust] = useState(null);
  const draftSnapshotRef = useRef({
    step: Math.min(5, Math.max(1, Number(draftBoot?.step) || 1)),
    categoryId: String(draftBoot?.categoryId || ''),
    directoryEmail: String(draftBoot?.directoryEmail || ''),
    otpChallengeId: String(draftBoot?.otpChallengeId || ''),
    eligibilityToken: String(draftBoot?.eligibilityToken || ''),
    form: {
      name: draftBoot?.form?.name || '',
      phone: draftBoot?.form?.phone || '',
      email: draftBoot?.form?.email || '',
      honorConfirmed: Boolean(draftBoot?.form?.honorConfirmed),
    },
    photoUrl: String(draftBoot?.photoUrl || ''),
    idCardUrl: String(draftBoot?.idCardUrl || ''),
  });

  useEffect(() => {
    ensureAuditoriumFonts();
  }, []);

  const flushDraft = useCallback((override = {}) => {
    const next = {
      ...draftSnapshotRef.current,
      ...override,
      form: { ...draftSnapshotRef.current.form, ...(override.form || {}) },
    };
    draftSnapshotRef.current = next;
    writeDraft(next);
  }, []);

  // Keep step/form across camera open/close (mobile browsers often remount).
  useEffect(() => {
    if (ticket) {
      clearDraft();
      return;
    }
    const timer = window.setTimeout(
      () => flushDraft({ step, categoryId, directoryEmail, otpChallengeId, eligibilityToken, form, photoUrl, idCardUrl }),
      180,
    );
    return () => window.clearTimeout(timer);
  }, [step, categoryId, directoryEmail, otpChallengeId, eligibilityToken, form, photoUrl, idCardUrl, ticket, flushDraft]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  useEffect(() => () => {
    if (idCardPreview) URL.revokeObjectURL(idCardPreview);
  }, [idCardPreview]);

  // After camera/gallery returns, restore the in-progress draft if React remounted.
  useEffect(() => {
    const restore = () => {
      const d = readDraft();
      if (!d) return;
      const restoredStep = Math.min(5, Math.max(1, Number(d.step) || 1));
      // Only jump forward when we lost state (landed on step 1 after camera remount)
      setStep((s) => (s <= 1 && restoredStep > 1 ? restoredStep : s));
      if (d.categoryId) setCategoryId((c) => c || String(d.categoryId));
      if (d.directoryEmail) setDirectoryEmail((value) => value || String(d.directoryEmail));
      if (d.otpChallengeId) setOtpChallengeId((value) => value || String(d.otpChallengeId));
      if (d.eligibilityToken) setEligibilityToken((value) => value || String(d.eligibilityToken));
      if (d.form) {
        setForm((f) => ({
          name: f.name || d.form.name || '',
          phone: f.phone || d.form.phone || '',
          email: f.email || d.form.email || '',
          honorConfirmed: f.honorConfirmed || Boolean(d.form.honorConfirmed),
        }));
      }
      if (d.photoUrl) setPhotoUrl((u) => u || String(d.photoUrl));
      if (d.idCardUrl) setIdCardUrl((u) => u || String(d.idCardUrl));
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') restore();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', restore);
    restore();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', restore);
    };
  }, []);

  const metaRef = useRef(null);
  metaRef.current = meta;

  const loadMeta = useCallback(async () => {
    // Don't flash full-page loader on soft refreshes once we have meta
    if (!metaRef.current) setLoading(true);
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

  useEffect(() => { loadMeta(); }, [inviteCode, loadMeta]);

  const categories = useMemo(() => {
    const list = [...(meta?.categories || [])];
    if (meta?.inviteCategory) {
      list.unshift({ ...meta.inviteCategory, invite: true });
    }
    return list;
  }, [meta]);

  const selected = categories.find((c) => c.id === categoryId);
  const directoryRequired = false;

  const requestOtp = async () => {
    if (!directoryEmail.trim()) {
      toast('Enter your college email');
      return;
    }
    setOtpBusy(true);
    try {
      const res = await publicFetchJSON('/mindspark/auditorium/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: directoryEmail.trim() }),
      });
      setOtpChallengeId(res.challengeId || '');
      setOtpCode('');
      setEligibilityToken('');
      toast(res.message || 'If eligible, a code was sent');
    } catch (e) {
      toast(e.message || 'Could not send code');
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpChallengeId || !/^\d{6}$/.test(otpCode.trim())) {
      toast('Enter the six-digit code');
      return;
    }
    setOtpBusy(true);
    try {
      const res = await publicFetchJSON('/mindspark/auditorium/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ challengeId: otpChallengeId, email: directoryEmail.trim(), code: otpCode.trim() }),
      });
      setEligibilityToken(res.eligibilityToken);
      setCategoryId(res.categoryId);
      setForm((value) => ({ ...value, email: res.email }));
      flushDraft({
        step: 2,
        categoryId: res.categoryId,
        directoryEmail: res.email,
        otpChallengeId,
        eligibilityToken: res.eligibilityToken,
        form: { ...form, email: res.email },
      });
      setStep(2);
      toast('College email verified');
    } catch (e) {
      toast(e.message || 'Code verification failed');
    } finally {
      setOtpBusy(false);
    }
  };

  const onFacePhoto = async (file) => {
    if (!file) return;
    if (!inviteCode && !/@coeptech\.ac\.in$/i.test(form.email.trim())) {
      toast('Only @coeptech.ac.in addresses are allowed.');
      setStep(2);
      return;
    }
    const uploadId = faceUploadRef.current + 1;
    faceUploadRef.current = uploadId;
    setUploadingKind('face');
    setBusy(true);
    flushDraft({ step: 4, categoryId, form, photoUrl, idCardUrl });
    try {
      await validatePhotoFile(file, { kind: 'face' });
      const preview = URL.createObjectURL(file);
      setPhotoPreview(preview);
      const uploadFile = await optimizeUploadImage(file);
      const url = await uploadTicketPhoto(uploadFile, { eligibilityToken, inviteCode, categoryId, email: form.email });
      if (faceUploadRef.current !== uploadId) return;
      if (!url) throw new Error('Upload failed');
      if (idCardUrl && cloudinaryPathKey(url) === cloudinaryPathKey(idCardUrl)) {
        throw new Error('Face photo and college ID must be different pictures');
      }
      setPhotoUrl(url);
      flushDraft({ step: 4, categoryId, form, photoUrl: url, idCardUrl });
      toast('Face photo ready');
    } catch (e) {
      if (faceUploadRef.current !== uploadId) return;
      toast(e.message || 'Photo failed');
      setPhotoUrl('');
      setPhotoPreview('');
      flushDraft({ photoUrl: '' });
    } finally {
      setBusy(false);
      setUploadingKind(null);
    }
  };

  const onIdCardPhoto = async (file) => {
    if (!file) return;
    if (!inviteCode && !/@coeptech\.ac\.in$/i.test(form.email.trim())) {
      toast('Only @coeptech.ac.in addresses are allowed.');
      setStep(2);
      return;
    }
    const uploadId = idUploadRef.current + 1;
    idUploadRef.current = uploadId;
    setUploadingKind('id');
    setBusy(true);
    flushDraft({ step: 3, categoryId, form, photoUrl, idCardUrl });
    try {
      await validatePhotoFile(file, { kind: 'id' });
      const preview = URL.createObjectURL(file);
      setIdCardPreview(preview);
      const uploadFile = await optimizeUploadImage(file);
      const url = await uploadTicketPhoto(uploadFile, { eligibilityToken, inviteCode, categoryId, email: form.email });
      if (idUploadRef.current !== uploadId) return;
      if (!url) throw new Error('Upload failed');
      if (photoUrl && cloudinaryPathKey(url) === cloudinaryPathKey(photoUrl)) {
        throw new Error('Face photo and college ID must be different pictures');
      }
      setIdCardUrl(url);
      flushDraft({ step: 3, categoryId, form, photoUrl, idCardUrl: url });
      toast('ID card ready');
    } catch (e) {
      if (idUploadRef.current !== uploadId) return;
      toast(e.message || 'ID upload failed');
      setIdCardUrl('');
      setIdCardPreview('');
      flushDraft({ idCardUrl: '' });
    } finally {
      setBusy(false);
      setUploadingKind(null);
    }
  };

  const submit = async () => {
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
        college: COEP_COLLEGE,
        ticketPhotoUrl: photoUrl,
        idCardPhotoUrl: idCardUrl,
        honorConfirmed: form.honorConfirmed,
        eligibilityToken: eligibilityToken || undefined,
      };
      const res = await publicFetchJSON('/mindspark/auditorium/register', {
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
      } else if (e.code === 'SAME_PHOTO') {
        toast(e.message || 'Face photo and college ID must be different pictures');
      } else if (e.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setEligibilityToken('');
        setOtpChallengeId('');
        setOtpCode('');
        setStep(1);
        toast(e.message || 'Verify your college email again');
      } else {
        toast(e.message || 'Registration failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const startAdjust = (kind, file) => {
    if (file) sourceFiles.current[kind] = file;
    const saved = file || sourceFiles.current[kind] || null;
    const url = kind === 'face' ? (photoPreview || photoUrl) : (idCardPreview || idCardUrl);
    setAdjust({ kind, file: saved, imageUrl: saved ? '' : url });
  };

  if (loading && !meta) {
    return <InlinePageLoader label="Loading auditorium…" />;
  }

  if (ticket?.status === 'pending') {
    return (
      <StageShell>
        <div className="space-y-5 pt-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-amber-200 text-xs font-semibold">
            Pass requested
          </div>
          <h1
            className="text-3xl text-white leading-none"
            style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}
          >
            WAITING FOR APPROVAL
          </h1>
          <p className="text-sm text-white/55 max-w-sm mx-auto leading-relaxed">
            Organizers will check your ID card and photo. Once they approve, the same pass appears in My Bookings and is emailed to you.
          </p>
          <Link
            to="/booking"
            className="block w-full py-3 rounded-2xl bg-[#0ECCEE] text-black text-sm font-bold"
          >
            Go to My Bookings
          </Link>
        </div>
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
            <p className="text-sm text-white/45">Screenshot this pass and keep the email confirmation for entry</p>
            <p className="text-[11px] text-amber-200/80 max-w-sm mx-auto leading-relaxed">
              Note: If your college ID and face don’t match at the gate, entry may be restricted.
            </p>
          </div>

          <AuditoriumTicketPass ticket={ticket} />

          <div className="flex flex-col gap-2.5">
            <div className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/8 px-4 py-3 text-center text-xs text-[#9CEEF8]">
              Your QR is shown on the pass above. Save a screenshot before leaving this page.
            </div>
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
  const steps = [directoryRequired ? 'Verify' : 'Year', 'Details', 'ID card', 'Face', 'Confirm'];

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
          COEP students only · free night entry · ID card + face photo
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
            {directoryRequired ? (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">Verify your college email</p>
                  <p className="text-[11px] leading-relaxed text-white/40">
                    Use the exact email shared by your college. Your year is selected automatically.
                  </p>
                </div>
                <input
                  value={directoryEmail}
                  onChange={(e) => {
                    setDirectoryEmail(e.target.value);
                    setOtpChallengeId('');
                    setEligibilityToken('');
                    setOtpCode('');
                  }}
                  placeholder="College email"
                  type="email"
                  autoComplete="email"
                  className={fieldClass}
                />
                <button
                  type="button"
                  disabled={otpBusy || !regOpen}
                  onClick={requestOtp}
                  className="w-full py-3 rounded-2xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-40"
                >
                  {otpBusy ? 'Please wait…' : otpChallengeId ? 'Send code again' : 'Send OTP'}
                </button>
                {otpChallengeId ? (
                  <div className="space-y-2 pt-2">
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit OTP"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className={`${fieldClass} text-center tracking-[0.35em] text-lg`}
                    />
                    <button
                      type="button"
                      disabled={otpBusy || otpCode.length !== 6}
                      onClick={verifyOtp}
                      className="w-full py-3 rounded-2xl border border-[#0ECCEE]/50 bg-[#0ECCEE]/10 text-[#7DE8F7] text-sm font-bold disabled:opacity-40"
                    >
                      {otpBusy ? 'Checking…' : 'Verify and continue'}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-sm text-white/60">Choose your year</p>
                {CULT_NIGHT_PASS_DAYS.map((day) => {
                  const dayCategories = day.years
                    .map((year) => categories.find((item) => item.id === year.id))
                    .filter(Boolean);
                  if (!dayCategories.length) return null;
                  return (
                    <div key={day.id} className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0ECCEE]">
                        Pass distribution · {day.label}
                      </p>
                      {dayCategories.map((c) => {
                        const full = Boolean(c.full) || (c.left != null && c.left <= 0);
                        const seats = Number(c.seats) || 0;
                        const left = c.left != null ? Number(c.left) : null;
                        const filledPct = seats > 0 && left != null
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
                          >
                            <div className="flex justify-between gap-3 items-start">
                              <div>
                                <p className="text-[15px] font-semibold text-white group-hover:text-[#B8F4FC] transition">
                                  {c.label}
                                </p>
                                <p className="text-[10px] text-amber-200/80 mt-1">Collect on {day.label}</p>
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
                    </div>
                  );
                })}
                {categories.filter((c) => !cultNightDayForCategory(c.id)).map((c, idx) => {
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
              </>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[#0ECCEE]/80">
              {selected?.label || 'Details'}
            </p>
            {cultNightDayForCategory(categoryId) ? (
              <p className="text-[11px] text-amber-200/80 -mt-1">
                Pass distribution · {cultNightDayForCategory(categoryId).dayLabel}
              </p>
            ) : null}
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
              placeholder="College email"
              type="email"
              className={fieldClass}
              autoComplete="email"
            />
            {!inviteCode ? (
              <p className="text-[11px] text-white/45 -mt-1 px-1">
                Only addresses ending in @coeptech.ac.in are accepted.
              </p>
            ) : null}
            <p className="text-[11px] text-white/40 px-1">
              College locked to <span className="text-white/70 font-medium">COEP</span> — MindSpark auditorium is for COEP students only
            </p>
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
                  if (!inviteCode && !/@coeptech\.ac\.in$/i.test(form.email.trim())) {
                    toast('Only @coeptech.ac.in addresses are allowed.');
                    return;
                  }
                  if (inviteCode && (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))) {
                    toast('Valid email required for your ticket');
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
              <p className="text-sm text-white/70">COEP ID card</p>
              <p className="text-[11px] text-white/35 mt-1">
                Full card visible · name + year readable · Camera or Gallery
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-amber-100/90">
              If your ID and face don’t match, or the year on your ID doesn’t match the category
              you picked, <strong className="text-amber-50">entry may be restricted</strong> at the gate.
            </div>

            <PhotoSourcePicker
              kind="id"
              preview={idCardPreview}
              uploadedUrl={idCardUrl}
              busy={busy && uploadingKind === 'id'}
              emptyLabel="Add your COEP ID"
              onBeforeOpen={() => flushDraft({ step: 3, categoryId, form, photoUrl, idCardUrl })}
              onPick={(file) => startAdjust('id', file)}
              onAdjust={idCardUrl || idCardPreview ? () => startAdjust('id') : undefined}
            />

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
                {busy && uploadingKind === 'id' ? 'Uploading…' : 'Next'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-white/70">Face photo for the gate</p>
              <p className="text-[11px] text-white/35 mt-1">
                Fill the frame · good light · just you — same person as on your ID
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-amber-100/90">
              Gate staff will compare this face with your ID photo. Mismatch =
              {' '}<strong className="text-amber-50">entry may be restricted</strong>.
            </div>

            <PhotoSourcePicker
              kind="face"
              preview={photoPreview}
              uploadedUrl={photoUrl}
              busy={busy && uploadingKind === 'face'}
              emptyLabel="Add your face photo"
              onBeforeOpen={() => flushDraft({ step: 4, categoryId, form, photoUrl, idCardUrl })}
              onPick={(file) => startAdjust('face', file)}
              onAdjust={photoUrl || photoPreview ? () => startAdjust('face') : undefined}
            />

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
                {busy && uploadingKind === 'face' ? 'Uploading…' : 'Next'}
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
                {inviteCode ? 'Get my pass' : 'Request pass'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {adjust ? (
        <PhotoAdjustModal
          file={adjust.file}
          imageUrl={adjust.imageUrl}
          kind={adjust.kind}
          onCancel={() => setAdjust(null)}
          onConfirm={(file) => {
            const kind = adjust.kind;
            setAdjust(null);
            if (kind === 'face') onFacePhoto(file);
            else onIdCardPhoto(file);
          }}
        />
      ) : null}

    </StageShell>
  );
}
