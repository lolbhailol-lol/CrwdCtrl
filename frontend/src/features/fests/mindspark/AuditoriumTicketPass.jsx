import { useState } from 'react';
import { IdCard } from 'lucide-react';
import LocalQRCode from '../../../components/LocalQRCode';

/**
 * Concert-pass style auditorium ticket — face on front, ID available for gate.
 */
export default function AuditoriumTicketPass({
  ticket,
  compact = false,
  className = '',
  showIdToggle = true,
}) {
  const [showId, setShowId] = useState(false);
  const name = ticket?.fullName || ticket?.userName || 'Guest';
  const category = ticket?.categoryLabel || ticket?.auditoriumCategory || '';
  const college = ticket?.college || '';
  const photo = ticket?.ticketPhotoUrl || '';
  const idCard = ticket?.idCardPhotoUrl || '';
  const regId = String(ticket?.registrationId || ticket?.id || '').slice(-8).toUpperCase();
  const qrHash = ticket?.qrCodeData || ticket?.qrHash || '';
  const qrValue = qrHash
    ? {
        hash: qrHash,
        registrationId: ticket?.registrationId || ticket?.id,
        type: 'crwdctrl-checkin',
      }
    : null;
  const checkedIn = Boolean(ticket?.checkedIn);

  return (
    <article
      className={`aud-pass relative overflow-hidden rounded-[1.75rem] ${className}`}
      style={{
        background:
          'linear-gradient(165deg, #141618 0%, #0c0d0f 45%, #101214 100%)',
        boxShadow:
          '0 0 0 1px rgba(14,204,238,0.22), 0 28px 60px -24px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(14,204,238,0.22), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 80%, rgba(245,158,11,0.08), transparent 50%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      <header className="relative px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]"
            style={{ fontFamily: 'Outfit, Poppins, sans-serif' }}
          >
            MindSpark
          </p>
          <h2
            className="mt-1 text-[1.65rem] leading-none font-bold tracking-tight text-white"
            style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.04em' }}
          >
            AUDITORIUM
          </h2>
          <p className="mt-1 text-[11px] text-white/45">COEP · Free entry pass</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="shrink-0 rounded-full border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0ECCEE]">
              {checkedIn ? 'Checked in' : 'Valid'}
            </span>
          </div>
          {idCard ? (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide text-emerald-300/90">
              <IdCard size={10} /> ID on file
            </span>
          ) : null}
        </div>
      </header>

      <div className={`relative px-5 ${compact ? 'pb-3' : 'pb-4'}`}>
        <div className="flex gap-4 items-stretch">
          <div className="relative shrink-0">
            <div
              className={`overflow-hidden rounded-2xl border border-white/15 bg-black/40 ${
                compact ? 'w-[88px] h-[110px]' : 'w-[108px] h-[136px]'
              }`}
              style={{ boxShadow: '0 0 0 1px rgba(14,204,238,0.15)' }}
            >
              {photo ? (
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/20 text-xs">
                  Photo
                </div>
              )}
            </div>
            <div
              aria-hidden
              className="absolute -bottom-1.5 -right-1.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-black shadow-lg -rotate-6"
            >
              Free
            </div>
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-center py-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Admit</p>
            <p
              className={`font-semibold text-white leading-tight ${compact ? 'text-lg' : 'text-xl'}`}
              style={{ fontFamily: 'Outfit, Poppins, sans-serif' }}
            >
              {name}
            </p>
            {category ? (
              <p className="mt-2 inline-flex self-start rounded-lg border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 px-2 py-1 text-[11px] font-semibold text-[#7DE8F7]">
                {category}
              </p>
            ) : null}
            {college ? (
              <p className="mt-2 text-[11px] text-white/40 line-clamp-2">{college}</p>
            ) : null}
            {regId ? (
              <p className="mt-auto pt-2 font-mono text-[10px] tracking-wider text-white/30">
                #{regId}
              </p>
            ) : null}
          </div>
        </div>

        {idCard && showIdToggle ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowId((v) => !v)}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-left"
            >
              <span className="inline-flex items-center gap-2 text-xs text-white/70">
                <IdCard size={14} className="text-[#0ECCEE]" />
                College ID card
              </span>
              <span className="text-[10px] uppercase tracking-wide text-[#0ECCEE]">
                {showId ? 'Hide' : 'Show'}
              </span>
            </button>
            {showId ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <img
                  src={idCard}
                  alt="College ID"
                  className="w-full max-h-48 object-contain bg-black/40"
                />
                <p className="px-3 py-2 text-[10px] text-white/40 text-center">
                  Gate check: face must match this ID. Mismatch — entry may be restricted.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative mx-3 flex items-center gap-2" aria-hidden>
        <span className="absolute -left-3 size-5 rounded-full bg-[#0a0b0c]" />
        <span className="absolute -right-3 size-5 rounded-full bg-[#0a0b0c]" />
        <div className="h-px flex-1 border-t border-dashed border-white/15" />
      </div>

      <div className={`relative px-5 ${compact ? 'py-4' : 'py-5'} flex flex-col items-center`}>
        {checkedIn ? (
          <p className="text-sm font-semibold text-emerald-300">Already checked in at the gate</p>
        ) : qrValue ? (
          <>
            <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_-12px_rgba(14,204,238,0.55)]">
              <LocalQRCode data={qrValue} size={compact ? 132 : 168} printSafe />
            </div>
            <p className="mt-3 text-center text-[11px] text-white/45 max-w-60">
              Show this pass at the gate. If ID and face don’t match, entry may be restricted.
            </p>
          </>
        ) : (
          <p className="text-xs text-white/40">QR loading…</p>
        )}
      </div>
    </article>
  );
}

export function ensureAuditoriumFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('aud-pass-fonts')) return;
  const link = document.createElement('link');
  link.id = 'aud-pass-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}
