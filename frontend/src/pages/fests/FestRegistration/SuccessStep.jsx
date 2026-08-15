import { goToBookings } from '../../../utils/paymentNavigation';
import { isMindSparkFest, MindSparkSuccessStep, MINDSPARK_FEST_ID } from '../../../features/fests/mindspark';
import { RegistrationStatusVisual, SuccessRevealGate } from '../../../components/RegistrationStatusVisual';

export default function SuccessStep({
  isDark,
  isCompetitionRegistration,
  competition,
  fest,
  registrationId,
  navigate,
  competitionId: competitionIdProp,
  festId: festIdProp,
}) {
  const mindSpark =
    isCompetitionRegistration
    && (
      isMindSparkFest(fest)
      || isMindSparkFest(competition)
      || isMindSparkFest(competition?.fest)
      || isMindSparkFest(festIdProp)
      || String(festIdProp || '').toLowerCase().includes('mindspark')
      || String(fest?._id || fest?.id || '') === MINDSPARK_FEST_ID
    );

  if (mindSpark) {
    return (
      <MindSparkSuccessStep
        isDark={isDark}
        competition={competition}
        fest={fest}
        registrationId={registrationId}
        navigate={navigate}
        competitionId={competitionIdProp || competition?._id || competition?.id}
      />
    );
  }

  const name = isCompetitionRegistration ? competition?.name : fest?.festName;

  return (
    <SuccessRevealGate
      isDark={isDark}
      title="Registration successful"
      subtitle={`You're booked for ${name || 'this event'}`}
      minMs={1000}
    >
      <div className={`crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
        <div className={`text-center max-w-md mx-auto p-8 rounded-3xl border ${isDark ? 'bg-[#121314] border-white/10' : 'bg-white border-gray-200 shadow-xl'}`}>
          <RegistrationStatusVisual
            mode="success"
            title="Registration successful"
            subtitle={`You're booked for ${name || 'this event'}`}
            showProgress={false}
            isDark={isDark}
          />
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
              className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                registrationId
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
    </SuccessRevealGate>
  );
}
