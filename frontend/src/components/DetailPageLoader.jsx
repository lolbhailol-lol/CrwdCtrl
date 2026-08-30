import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Flag,
  Footprints,
  Mountain,
  Ticket,
} from 'lucide-react';
import { isHomeHubPath } from '../utils/homeShellReady';
import markLogo from '../assets/crwdctrl-mark.png';
import markLogoLight from '../assets/crwdctrl-mark-light.png';
import { LOGO_SOURCE_PX } from '../constants/logo';

function readShellDark() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function shellBgClass(isDark = readShellDark()) {
  return isDark ? 'bg-[#161718]' : 'bg-white';
}

const LOADER_VARIANT_ICONS = {
  trek: Mountain,
  event: Calendar,
  booking: Ticket,
  payment: CreditCard,
  run: Footprints,
  fest: Flag,
};

const LOGO_VARIANTS = new Set(['default', 'brand', 'competition']);

const LOGO_EXTRUDE_LAYERS = [0, 1, 2, 3, 4, 5, 6];

function CrwdCtrl3DMark({ isDark = false }) {
  // Dark: full depth stack + screen blend. Light: one sharp layer (no muddy 3D inside letters).
  const src = isDark ? markLogo : markLogoLight;
  const layers = isDark ? LOGO_EXTRUDE_LAYERS : [0];
  return (
    <>
      <div className="detail-loader-orb" />
      <div className="detail-loader-ring" />
      <div className="detail-loader-extrude">
        <div className="detail-loader-glass" />
        {layers.map((layer) => (
          <img
            key={layer}
            src={src}
            alt=""
            width={LOGO_SOURCE_PX}
            height={LOGO_SOURCE_PX}
            className={`detail-loader-logo-layer${layer === 0 ? ' detail-loader-logo-layer--front' : ''}`}
            style={{ '--layer': layer }}
            draggable={false}
            decoding="async"
          />
        ))}
      </div>
    </>
  );
}

/** Reusable floating 3D card — CrwdCtrl logo or contextual icon */
export function DetailLoader3DIcon({
  variant = 'default',
  size = 'md',
  className = '',
  tone = 'auto',
}) {
  const useLogo = LOGO_VARIANTS.has(variant);
  const VariantIcon = !useLogo ? LOADER_VARIANT_ICONS[variant] : null;
  const isDark = tone === 'auto' ? readShellDark() : tone === 'dark';
  const toneClass = isDark ? 'detail-loader-tone-dark' : 'detail-loader-tone-light';

  const stageClass =
    size === 'splash'
      ? 'detail-loader-stage detail-loader-stage--splash'
      : size === 'hero'
      ? 'detail-loader-stage detail-loader-stage--hero'
      : size === 'compact'
        ? 'detail-loader-stage detail-loader-stage--compact'
        : size === 'mini'
          ? 'detail-loader-stage detail-loader-stage--mini'
          : 'detail-loader-stage';

  return (
    <div className={`${stageClass}${useLogo ? ' detail-loader-stage--mark' : ''} ${toneClass} shrink-0 ${className}`.trim()} aria-hidden>
      {useLogo || !VariantIcon ? (
        <CrwdCtrl3DMark isDark={isDark} />
      ) : (
        <>
          <div className="detail-loader-orb" />
          <div className="detail-loader-card">
            <div className="detail-loader-card-face detail-loader-card-front">
              <VariantIcon className="detail-loader-icon" strokeWidth={2.25} />
              <span className="detail-loader-shine" />
            </div>
            <div className="detail-loader-card-face detail-loader-card-side" />
            <div className="detail-loader-card-face detail-loader-card-bottom" />
          </div>
        </>
      )}
    </div>
  );
}

/** Inline page/section loader — sits inside layouts (organizer, admin, booking, etc.) */
export function InlinePageLoader({
  label = '',
  variant = 'default',
  size = 'md',
  className = '',
  labelClassName = '',
  minHeight = true,
  fullScreen = false,
}) {
  const isDark = readShellDark();
  const labelCls = labelClassName
    || (isDark ? 'text-sm text-gray-400' : 'text-sm font-semibold text-gray-700');
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen
          ? `min-h-dvh w-full ${shellBgClass(isDark)}`
          : minHeight
            ? 'min-h-[50vh] py-16'
            : 'py-12'
      } ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
    >
      <DetailLoader3DIcon variant={variant} size={size} tone={isDark ? 'dark' : 'light'} />
      {label ? <p className={labelCls}>{label}</p> : null}
    </div>
  );
}

/** Full-viewport home hub loader — one overlay for boot handoff, Suspense, and data fetch */
export function HomeHubLoadingScreen() {
  const node = (
    <div
      className={`home-hub-loading-screen fixed inset-0 z-100050 flex items-center justify-center ${shellBgClass()}`}
      style={{
        paddingTop: 'max(var(--safe-top), 0px)',
        paddingBottom: 'max(var(--safe-bottom), 0px)',
        paddingLeft: 'max(var(--safe-left), 0px)',
        paddingRight: 'max(var(--safe-right), 0px)',
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <DetailLoader3DIcon variant="brand" size="md" tone={readShellDark() ? 'dark' : 'light'} />
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

/** Suspense / lazy-route fallback */
export function RouteLoadingFallback({ className = '' }) {
  if (typeof window !== 'undefined' && isHomeHubPath(window.location.pathname)) {
    return null;
  }

  const node = (
    <div
      className={`route-loading-fallback-root fixed inset-0 z-100050 flex items-center justify-center ${shellBgClass()} ${className}`.trim()}
      aria-busy="true"
      aria-label="Loading page"
    >
      <DetailLoader3DIcon variant="brand" size="md" tone={readShellDark() ? 'dark' : 'light'} />
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

/**
 * Detail-page wait state — logo + short type label
 * (fest / competition / trek / sports / event community).
 * Portaled to body so parent transforms never offset it; icon sits on true viewport center.
 */
export default function DetailPageLoader({
  label = 'Loading',
  variant = 'brand',
}) {
  const isDark = readShellDark();
  const displayLabel = String(label || 'Loading').trim() || 'Loading';

  useLayoutEffect(() => {
    document.body.classList.add('detail-page-loading');
    return () => document.body.classList.remove('detail-page-loading');
  }, []);

  const node = (
    <div
      className={`detail-page-loader-root fixed inset-0 z-100050 flex items-center justify-center ${shellBgClass(isDark)}`}
      style={{
        paddingTop: 'max(var(--safe-top), 0px)',
        paddingBottom: 'max(var(--safe-bottom), 0px)',
        paddingLeft: 'max(var(--safe-left), 0px)',
        paddingRight: 'max(var(--safe-right), 0px)',
      }}
      role="status"
      aria-live="polite"
      aria-label={displayLabel}
    >
      <div className="relative flex flex-col items-center justify-center">
        <DetailLoader3DIcon variant={variant} tone={isDark ? 'dark' : 'light'} />
        <div className="absolute top-full left-1/2 mt-6 w-max max-w-[min(90vw,20rem)] -translate-x-1/2 px-6 text-center pointer-events-none">
          <p className={`text-sm font-semibold tracking-wide ${isDark ? 'text-white/75' : 'text-gray-700'}`}>
            {displayLabel}
          </p>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

/**
 * WhatsApp / shared fest & competition links: same page chrome as the real
 * detail screen — no spinner, no black loading card. Content fills in on top.
 */
export function FestDetailOpeningShell({ onBack }) {
  const isDark = readShellDark();
  return (
    <div className={`crwdctrl-page crwdctrl-page--flat min-h-screen overflow-x-clip page-transition-enter ${shellBgClass(isDark)}`}>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,var(--safe-top))] pb-3 z-10">
        <button
          type="button"
          onClick={onBack}
          className={`p-2 rounded-full backdrop-blur-sm ${isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-gray-900'}`}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      </div>
    </div>
  );
}

export function CompetitionDetailOpeningShell({ onBack }) {
  const isDark = readShellDark();
  return (
    <div className={`crwdctrl-page crwdctrl-page--flat flex flex-col min-h-screen page-transition-enter ${shellBgClass(isDark)}`}>
      <div
        className="absolute top-0 left-0 right-0 flex items-center px-4 z-10"
        style={{ paddingTop: 'calc(max(var(--safe-top), 0px) + 2.5rem)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className={`size-11 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-gray-900'}`}
          aria-label="Go back"
        >
          <ArrowLeft size={22} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
