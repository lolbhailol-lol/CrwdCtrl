import { CheckCircle } from 'lucide-react';
import { goToBookings } from '../../../utils/paymentNavigation';

export default function SuccessStep({
  isDark,
  isCompetitionRegistration,
  competition,
  fest,
  registrationId,
  navigate,
}) {
  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto p-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
        <h1 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🎉 Registration Successful!</h1>
        <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Your registration for <span className="text-[#0ECCEE] font-semibold">
            {isCompetitionRegistration ? competition?.name : fest?.festName}
          </span> has been submitted successfully.
        </p>
        <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Download your ticket or view all bookings whenever you&apos;re ready.
        </p>
        <div className="flex flex-col gap-3">
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
  );
}
