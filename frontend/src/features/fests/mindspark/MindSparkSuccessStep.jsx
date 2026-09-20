import { useEffect, useState } from 'react';
import { Download, Ticket, MessageCircle, ChevronRight } from 'lucide-react';
import { goToBookings } from '../../../utils/paymentNavigation';
import { openExternalUrl } from '../../../utils/externalLink';
import { SuccessRevealGate } from '../../../components/RegistrationStatusVisual';
import LocalQRCode from '../../../components/LocalQRCode';
import CompetitionCoverImage from '../../../components/CompetitionCoverImage';
import StallCouponCard from '../../../components/StallCouponCard';
import { getApiBaseUrl } from '../../../config/apiBase';
import { authenticatedFetchJSON } from '../../../services/api/auth.api';
import { useAuth } from '../../../context/AuthContext';

function pickWhatsApp(competition, fest) {
  return (
    String(competition?.registration?.whatsappGroupLink || '').trim()
    || String(fest?.registration?.whatsappCommunityLink || '').trim()
  );
}

function pickCoverImage(competition) {
  return (
    competition?.coverImage
    || competition?.image
    || competition?.heroImage
    || ''
  );
}

/**
 * Post-registration success for MindSpark competitions.
 * Order: ticket → next steps → Svvad Pro offer
 */
export default function MindSparkSuccessStep({
  isDark,
  competition,
  fest,
  registrationId,
  navigate,
  competitionId: competitionIdProp,
  festId: festIdProp,
  stallCoupon: stallCouponProp,
}) {
  const { token: authToken } = useAuth();
  const compName = competition?.name || 'your competition';
  const festName = fest?.festName || 'MindSpark';
  const coverFromProps = pickCoverImage(competition);
  const [coverImage, setCoverImage] = useState(() => coverFromProps);
  const [whatsapp, setWhatsapp] = useState(() => pickWhatsApp(competition, fest));
  const [ticket, setTicket] = useState(null);
  const [stallCoupon, setStallCoupon] = useState(stallCouponProp || null);

  const festId =
    festIdProp
    || fest?._id
    || fest?.id
    || competition?.fest?._id
    || competition?.fest?.id
    || competition?.festId
    || competition?.fest_id;

  useEffect(() => {
    if (stallCouponProp?.brand || stallCouponProp?.code) setStallCoupon(stallCouponProp);
  }, [stallCouponProp]);

  useEffect(() => {
    const next = pickCoverImage(competition);
    if (next) setCoverImage(next);
  }, [competition]);

  useEffect(() => {
    if (stallCoupon?.brand || stallCoupon?.code || !festId || !authToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJSON(
          `${getApiBaseUrl()}/registrations/fests/${festId}/my-coupon`,
          { token: authToken },
        );
        if (!cancelled && (data?.code || data?.brand)) {
          setStallCoupon({
            code: data.code,
            brand: data.brand,
            discountPercent: data.discountPercent || 20,
          });
        }
      } catch {
        /* no coupon yet / 404 */
      }
    })();
    return () => { cancelled = true; };
  }, [stallCoupon?.brand, stallCoupon?.code, festId, authToken]);

  useEffect(() => {
    const fromProps = pickWhatsApp(competition, fest);
    if (fromProps) setWhatsapp(fromProps);

    const needCover = !pickCoverImage(competition);
    const needWa = !fromProps;
    if (!needCover && !needWa) return undefined;

    const compId =
      competitionIdProp
      || competition?._id
      || competition?.id
      || competition?.slug;
    if (!compId || String(compId).startsWith('preview')) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/fests/competitions/${compId}/public`, {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (needWa) {
          const link = pickWhatsApp(data, fest);
          if (link) setWhatsapp(link);
        }
        if (needCover) {
          const cover = pickCoverImage(data);
          if (cover) setCoverImage(cover);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [competition, fest, competitionIdProp]);

  useEffect(() => {
    if (!registrationId || !authToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await authenticatedFetchJSON(
          `${getApiBaseUrl()}/qr/registrations/${registrationId}/qr`,
          { token: authToken },
        );
        if (!cancelled) setTicket(data.data || null);
      } catch {
        if (!cancelled) setTicket(null);
      }
    })();
    return () => { cancelled = true; };
  }, [registrationId, authToken]);

  const pageBg = isDark ? 'bg-[#161718]' : 'bg-[#F3F1EE]';
  const surface = isDark
    ? 'bg-[#0a0b0c] border border-gray-700/50 shadow-lg shadow-black/50'
    : 'bg-white border border-gray-200 shadow-sm';
  const muted = isDark ? 'text-gray-400' : 'text-black/50';
  const ink = isDark ? 'text-white' : 'text-[#141414]';

  return (
    <SuccessRevealGate
      isDark={isDark}
      title="You're in"
      subtitle={`${compName} · ${festName}`}
    >
      <div className={`min-h-screen px-4 sm:px-5 pt-7 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pt-12 md:pb-20 ${pageBg}`}>
        <div className="max-w-md mx-auto flex flex-col gap-3.5">
          {/* Ticket / you're in */}
          <div className={`rounded-3xl overflow-hidden ${surface}`}>
            {coverImage ? (
              <div className="relative h-36 sm:h-40 bg-[#1A1B1D]">
                <CompetitionCoverImage
                  src={coverImage}
                  alt={compName}
                  preset="hero"
                  containerClassName="absolute inset-0 w-full h-full"
                  className="w-full h-full object-cover"
                  loaderSize="compact"
                  eager
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
                    You&apos;re in
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight mt-1">{compName}</h1>
                  <p className="text-sm text-white/65 mt-1">{festName}</p>
                </div>
              </div>
            ) : (
              <div
                className={`px-5 py-5 ${
                  isDark
                    ? 'bg-[#0a0b0c]'
                    : 'bg-gradient-to-br from-[#E8FBFF] via-white to-[#F3F1EE]'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
                  You&apos;re in
                </p>
                <h1 className={`text-xl sm:text-2xl font-bold leading-tight mt-1.5 ${ink}`}>
                  {compName}
                </h1>
                <p className={`text-sm mt-1 ${muted}`}>{festName}</p>
              </div>
            )}

            {registrationId ? (
              <div className="px-5 py-5 flex flex-col items-center text-center">
                {ticket?.qrHash ? (
                  <>
                    <LocalQRCode data={ticket.qrHash} size={148} className="mx-auto" />
                    <p className={`mt-3.5 text-sm ${muted}`}>
                      Show this QR at check-in
                    </p>
                  </>
                ) : (
                  <p className={`text-sm ${muted}`}>Loading your ticket QR…</p>
                )}

                <button
                  type="button"
                  onClick={() => navigate(`/qr-ticket/${registrationId}`, { state: { refreshBookings: true } })}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#0ECCEE] text-black font-semibold text-sm hover:bg-[#0ECCEE]/90 active:scale-[0.99] transition-all"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  Open full ticket
                </button>
              </div>
            ) : null}
          </div>

          {/* Next steps */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => goToBookings(navigate)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-colors ${surface} ${
                isDark ? 'hover:bg-[#111213]' : 'hover:bg-[#FAFAF9]'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                  isDark ? 'bg-white/5 border border-gray-700/50' : 'bg-[#F0EEEA]'
                }`}
              >
                <Ticket className={`w-[18px] h-[18px] ${ink}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${ink}`}>View my bookings</span>
                <span className={`block text-xs mt-0.5 ${muted}`}>Ticket &amp; registration details</span>
              </span>
              <ChevronRight className={`w-4 h-4 shrink-0 opacity-50 ${muted}`} />
            </button>

            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  openExternalUrl(whatsapp);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-colors ${surface} ${
                  isDark ? 'hover:bg-[#111213]' : 'hover:bg-[#FAFAF9]'
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                    isDark ? 'bg-[#25D366]/10 border border-[#25D366]/20' : 'bg-[#E8F8EE]'
                  }`}
                >
                  <MessageCircle className="w-[18px] h-[18px] text-[#25D366]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${ink}`}>Join WhatsApp group</span>
                  <span className={`block text-xs mt-0.5 ${muted}`}>Updates &amp; meetups for {compName}</span>
                </span>
                <ChevronRight className={`w-4 h-4 shrink-0 opacity-50 ${muted}`} />
              </a>
            ) : null}
          </div>

          {stallCoupon ? (
            <StallCouponCard isDark={isDark} stallCoupon={stallCoupon} />
          ) : null}
        </div>
      </div>
    </SuccessRevealGate>
  );
}
