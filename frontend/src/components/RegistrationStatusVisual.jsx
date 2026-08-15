import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Server, Sparkles, Ticket } from 'lucide-react';

/** Ensure a UI phase is visible for at least `minMs` from `startedAt`. */
export async function waitAtLeast(startedAt, minMs = 1000) {
  const start = Number(startedAt) || Date.now();
  const left = Math.max(0, minMs - (Date.now() - start));
  if (left > 0) {
    await new Promise((resolve) => setTimeout(resolve, left));
  }
}

export function sleep(ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function progressWidth(message = '') {
  const m = String(message || '');
  if (/completed|success|done/i.test(m)) return '100%';
  if (/error|fail|unable|couldn/i.test(m)) return '100%';
  if (/process|verif|confirm/i.test(m)) return '88%';
  if (/submit|server|send/i.test(m)) return '68%';
  if (/prepar|upload|pack/i.test(m)) return '42%';
  if (/valid/i.test(m)) return '22%';
  if (/pay|cashfree|checkout/i.test(m)) return '55%';
  return '18%';
}

function Icon3D({ mode = 'processing' }) {
  const Icon =
    mode === 'success'
      ? CheckCircle2
      : mode === 'error'
        ? AlertTriangle
        : mode === 'payment'
          ? CreditCard
          : mode === 'server'
            ? Server
            : Sparkles;

  const accent =
    mode === 'success'
      ? 'text-emerald-400'
      : mode === 'error'
        ? 'text-amber-400'
        : 'text-[#0ECCEE]';

  return (
    <div className="detail-loader-stage" aria-hidden>
      <div className="detail-loader-orb" />
      <div className="detail-loader-card">
        <div className="detail-loader-card-face detail-loader-card-front">
          <Icon className={`w-7 h-7 ${accent} drop-shadow-[0_0_12px_rgba(14,204,238,0.45)]`} strokeWidth={2.25} />
          <span className="detail-loader-shine" />
        </div>
        <div className="detail-loader-card-face detail-loader-card-side" />
        <div className="detail-loader-card-face detail-loader-card-bottom" />
      </div>
    </div>
  );
}

/**
 * Animated 3D status block for registration submit / payment / success / error.
 */
export function RegistrationStatusVisual({
  mode = 'processing',
  title,
  subtitle,
  progressMessage = '',
  showProgress = true,
  isDark = true,
}) {
  const resolvedTitle =
    title
    || (mode === 'success'
      ? 'You\'re in!'
      : mode === 'error'
        ? 'Something went wrong'
        : mode === 'payment'
          ? 'Opening secure payment'
          : 'Talking to the server');

  const resolvedSubtitle =
    subtitle
    || (mode === 'success'
      ? 'Registration confirmed'
      : mode === 'error'
        ? 'Please try again in a moment'
        : mode === 'payment'
          ? 'Almost there — Cashfree is loading'
          : 'Hang tight — instant response incoming');

  const iconMode =
    mode === 'success'
      ? 'success'
      : mode === 'error'
        ? 'error'
        : mode === 'payment'
          ? 'payment'
          : 'server';

  return (
    <div className="detail-loader flex flex-col items-center px-6 text-center w-full max-w-sm mx-auto">
      <Icon3D mode={iconMode} />

      <p className={`mt-7 text-base font-semibold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {resolvedTitle}
      </p>
      <p className={`mt-1.5 text-sm ${isDark ? 'text-white/45' : 'text-gray-500'}`}>
        {progressMessage || resolvedSubtitle}
      </p>

      {showProgress && mode !== 'success' && mode !== 'error' ? (
        <div className="w-full mt-5">
          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full bg-[#0ECCEE] transition-all duration-500 ease-out shadow-[0_0_12px_rgba(14,204,238,0.55)]"
              style={{ width: progressWidth(progressMessage || resolvedSubtitle) }}
            />
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ECCEE] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ECCEE] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ECCEE] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : null}

      {mode === 'success' ? (
        <div className="mt-5 flex items-center justify-center gap-3 text-[#0ECCEE]/90" aria-hidden>
          <Ticket className="w-5 h-5 animate-[detailLoaderPulse_2.2s_ease-in-out_infinite]" />
          <Sparkles className="w-5 h-5 animate-[detailLoaderPulse_2.2s_ease-in-out_infinite]" style={{ animationDelay: '0.35s' }} />
        </div>
      ) : null}
    </div>
  );
}

/** Full-screen processing overlay (submit / verify / server wait / brief success) */
export function RegistrationProcessingOverlay({
  open,
  isDark = true,
  mode = 'processing',
  title,
  subtitle,
  progressMessage = '',
}) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-center justify-center px-4 ${
        isDark ? 'bg-[#0a0a0b]/92' : 'bg-white/90'
      } backdrop-blur-md`}
      role="status"
      aria-live="polite"
      aria-label={title || 'Processing registration'}
    >
      <div
        className={`w-full max-w-sm rounded-3xl border p-8 shadow-2xl animate-detail-enter ${
          isDark
            ? 'bg-[#121314]/95 border-white/10 shadow-black/50'
            : 'bg-white border-gray-200 shadow-gray-300/40'
        }`}
      >
        <RegistrationStatusVisual
          mode={mode}
          title={title}
          subtitle={subtitle}
          progressMessage={progressMessage}
          isDark={isDark}
          showProgress={mode !== 'success' && mode !== 'error'}
        />
      </div>
    </div>
  );
}

/**
 * Holds a full-screen 3D success card for ~1s, then reveals children.
 */
export function SuccessRevealGate({
  isDark = true,
  title = "You're registered",
  subtitle = 'Booking confirmed',
  minMs = 1000,
  children,
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), minMs);
    return () => clearTimeout(t);
  }, [minMs]);

  if (!ready) {
    return (
      <div className={`crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
        <div
          className={`w-full max-w-sm rounded-3xl border p-8 ${
            isDark ? 'bg-[#121314] border-white/10' : 'bg-white border-gray-200 shadow-xl'
          }`}
        >
          <RegistrationStatusVisual
            mode="success"
            title={title}
            subtitle={subtitle}
            showProgress={false}
            isDark={isDark}
          />
        </div>
      </div>
    );
  }

  return children;
}

export default RegistrationStatusVisual;
