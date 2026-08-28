import { useEffect, useState } from 'react';
import { Download, Ticket, MessageCircle, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { goToBookings } from '../../../utils/paymentNavigation';
import { openExternalUrl } from '../../../utils/externalLink';
import { RegistrationStatusVisual, SuccessRevealGate } from '../../../components/RegistrationStatusVisual';
import { getApiBaseUrl } from '../../../config/apiBase';

function normalizeLinks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((l) => ({
      label: String(l?.label || '').trim(),
      url: String(l?.url || '').trim(),
    }))
    .filter((l) => l.url);
}

function pickWhatsApp(competition, fest) {
  return (
    String(competition?.registration?.whatsappGroupLink || '').trim()
    || String(fest?.registration?.whatsappCommunityLink || '').trim()
  );
}

/**
 * Post-registration success for MindSpark competitions.
 * WhatsApp (comp) is the main CTA; ticket / bookings are secondary.
 */
export default function MindSparkSuccessStep({
  isDark,
  competition,
  fest,
  registrationId,
  navigate,
  competitionId: competitionIdProp,
}) {
  const compName = competition?.name || 'your competition';
  const festName = fest?.festName || 'MindSpark';
  const [whatsapp, setWhatsapp] = useState(() => pickWhatsApp(competition, fest));
  const overallSheet = String(fest?.registration?.overallSheetUrl || '').trim();
  const compSheet = String(competition?.registration?.shareSheetUrl || '').trim();
  const links = [
    ...normalizeLinks(competition?.registration?.resourceLinks),
    ...normalizeLinks(fest?.registration?.resourceLinks),
  ];

  // If prefetch was stale (no WA link), pull fresh public competition once
  useEffect(() => {
    const fromProps = pickWhatsApp(competition, fest);
    if (fromProps) {
      setWhatsapp(fromProps);
      return;
    }
    const compId =
      competitionIdProp
      || competition?._id
      || competition?.id
      || competition?.slug;
    if (!compId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/fests/competitions/${compId}/public`, {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const link = pickWhatsApp(data, fest);
        if (!cancelled && link) setWhatsapp(link);
      } catch {
        /* ignore — CTA stays placeholder */
      }
    })();
    return () => { cancelled = true; };
  }, [competition, fest, competitionIdProp]);

  const card = isDark
    ? 'bg-[#111213] border-gray-700/60'
    : 'bg-white border-gray-200 shadow-sm';

  return (
    <SuccessRevealGate
      isDark={isDark}
      title="You're registered"
      subtitle={`${compName} · ${festName}`}
    >
    <div className={`crwdctrl-page crwdctrl-page--content min-h-screen px-4 py-10 md:py-14 ${isDark ? 'bg-[#0a0b0c]' : 'bg-gray-50'}`}>
      <div className="max-w-md md:max-w-2xl mx-auto space-y-4">
        <div className={`rounded-3xl border p-6 ${card}`}>
          <RegistrationStatusVisual
            mode="success"
            title="You're registered"
            subtitle={`${compName} · ${festName}`}
            showProgress={false}
            isDark={isDark}
          />
        </div>

        {/* Main: Join WhatsApp */}
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openExternalUrl(whatsapp);
            }}
            className="block rounded-2xl p-5 bg-[#25D366] text-black shadow-lg shadow-[#25D366]/20 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Required next step</p>
                <p className="text-lg font-bold leading-tight mt-0.5">Join competition WhatsApp</p>
                <p className="text-sm mt-1 opacity-80">
                  Updates, rounds &amp; announcements for {compName} land here.
                </p>
              </div>
            </div>
          </a>
        ) : (
          <div className={`rounded-2xl border p-4 ${card}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              WhatsApp group link will appear here once organizers add it for this competition.
            </p>
          </div>
        )}

        {/* Ticket + bookings */}
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Your booking
            </p>
          </div>
          <div className="p-3 space-y-2">
            {registrationId ? (
              <button
                type="button"
                onClick={() => navigate(`/qr-ticket/${registrationId}`, { state: { refreshBookings: true } })}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#0ECCEE] text-black font-semibold hover:bg-[#0ECCEE]/90 active:scale-[0.99] transition-all"
              >
                <Download className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-left text-sm">Download ticket / QR</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goToBookings(navigate)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border font-medium text-sm transition-colors ${
                isDark
                  ? 'border-gray-700 text-gray-200 hover:bg-gray-800/80'
                  : 'border-gray-200 text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Ticket className="w-5 h-5 shrink-0 opacity-70" />
              <span className="flex-1 text-left">View my bookings</span>
            </button>
          </div>
        </div>

        {/* Sheets + resource links */}
        {(overallSheet || compSheet || links.length > 0) && (
          <div className={`rounded-2xl border overflow-hidden ${card}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Resources
              </p>
            </div>
            <div className="p-3 space-y-2">
              {compSheet ? (
                <a
                  href={compSheet}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-50 text-gray-800'}`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#0ECCEE] shrink-0" />
                  <span className="flex-1 text-left">Competition sheet</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                </a>
              ) : null}
              {overallSheet ? (
                <a
                  href={overallSheet}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-50 text-gray-800'}`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#0ECCEE] shrink-0" />
                  <span className="flex-1 text-left">MindSpark overall sheet</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                </a>
              ) : null}
              {links.map((l) => (
                <a
                  key={`${l.label}-${l.url}`}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-50 text-gray-800'}`}
                >
                  <ExternalLink className="w-4 h-4 text-[#0ECCEE] shrink-0" />
                  <span className="flex-1 text-left">{l.label || 'Open link'}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate('/')}
          className={`w-full py-2.5 text-sm font-medium ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Back to home
        </button>
      </div>
    </div>
    </SuccessRevealGate>
  );
}
