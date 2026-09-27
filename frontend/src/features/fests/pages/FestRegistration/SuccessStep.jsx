import { goToBookings } from '../../../../utils/paymentNavigation';
import { getFestPluginFromAny } from '../../plugins/registry';
import { RegistrationStatusVisual, SuccessRevealGate } from '../../../../components/RegistrationStatusVisual';
import StallCouponCard from '../../../../components/StallCouponCard';
import { Clock3 } from 'lucide-react';

export default function SuccessStep({
  isDark,
  isCompetitionRegistration,
  competition,
  fest,
  registrationId,
  registrationStatus,
  navigate,
  competitionId: competitionIdProp,
  festId: festIdProp,
  stallCoupon,
}) {
  const plugin = getFestPluginFromAny(
    fest,
    competition?.fest,
    competition?.festId || competition?.fest_id,
    festIdProp,
  );
  const SuccessScreen = plugin.competitionSuccessScreen;
  const isPendingApproval = plugin.id === 'kshitij' && registrationStatus === 'pending';

  if (isPendingApproval) {
    return (
      <div className={`crwdctrl-page crwdctrl-page--flat min-h-screen flex items-center justify-center px-4 py-10 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
        <div className="w-full max-w-md mx-auto">
          <div className={`p-7 sm:p-8 rounded-3xl border text-center ${isDark ? 'bg-[#121314] border-white/10' : 'bg-white border-gray-200 shadow-xl'}`}>
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isDark ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
              <Clock3 className="h-8 w-8" strokeWidth={2.2} />
            </div>
            <p className={`mt-6 text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Registration submitted
            </p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              Pending organizer approval
            </span>
            <p className={`mt-5 text-sm leading-6 ${isDark ? 'text-white/55' : 'text-gray-600'}`}>
              The Kshitij team will review your registration for {competition?.name || 'this competition'}.
              We&apos;ll notify you and email your confirmation when it is approved.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => goToBookings(navigate)}
                className="w-full px-6 py-3 bg-[#0ECCEE] text-black rounded-xl font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
              >
                View My Bookings
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`w-full py-2 text-sm font-medium ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCompetitionRegistration && SuccessScreen) {
    return (
      <SuccessScreen
        isDark={isDark}
        competition={competition}
        fest={fest}
        registrationId={registrationId}
        navigate={navigate}
        competitionId={competitionIdProp || competition?._id || competition?.id}
        festId={festIdProp || fest?._id || fest?.id}
        stallCoupon={stallCoupon}
      />
    );
  }

  const name = isCompetitionRegistration ? competition?.name : fest?.festName;

  return (
    <SuccessRevealGate
      isDark={isDark}
      title="Registration successful"
      subtitle={`You're booked for ${name || 'this event'}`}
    >
      <div className={`crwdctrl-page crwdctrl-page--flat min-h-screen flex items-center justify-center px-4 py-10 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className={`text-center p-8 rounded-3xl border ${isDark ? 'bg-[#121314] border-white/10' : 'bg-white border-gray-200 shadow-xl'}`}>
            <RegistrationStatusVisual
              mode="success"
              title="Registration successful"
              subtitle={`You're booked for ${name || 'this event'}`}
              showProgress={false}
              isDark={isDark}
            />

            {stallCoupon ? (
              <div className="mt-6">
                <StallCouponCard isDark={isDark} stallCoupon={stallCoupon} />
              </div>
            ) : null}

            <div className="flex flex-col gap-3 mt-8">
              {registrationId && (
                <button
                  type="button"
                  onClick={() => navigate(`/qr-ticket/${registrationId}`, { state: { refreshBookings: true } })}
                  className="w-full px-6 py-3 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
                >
                  Download Ticket
                </button>
              )}
              <button
                type="button"
                onClick={() => goToBookings(navigate)}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${registrationId
                    ? isDark
                      ? 'border border-gray-600 text-gray-200 hover:bg-gray-800'
                      : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                    : 'bg-[#0ECCEE] text-black hover:bg-[#0ECCEE]/80'
                  }`}
              >
                View My Bookings
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`w-full py-2 text-sm font-medium ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </SuccessRevealGate>
  );
}
