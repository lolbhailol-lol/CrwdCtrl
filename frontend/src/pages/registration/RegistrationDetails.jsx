import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Calendar, MapPin, Receipt, Clock } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';

import { userFetchJSONStrict } from '../../services/api/auth.api';
import JoinCommunityButton from '../../components/JoinCommunityButton';
import {
  dedupeFormFields,
  dedupeResponseEntries,
  responseAliasGroup,
  mergeRunFormFields,
} from '../../utils/formFieldDedupe';

function normalizeResponses(responses) {
  if (!responses) return {};
  if (responses instanceof Map) return Object.fromEntries(responses);
  if (typeof responses === 'object') return responses;
  return {};
}

function labelToFieldId(label) {
  if (!label) return '';
  return `field_${label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
}

function getResponseValue(responses, field) {
  const r = normalizeResponses(responses);
  const candidates = [
    field.fieldName,
    field.id,
    field.id ? `field_${field.id}` : null,
    labelToFieldId(field.label),
  ].filter(Boolean);
  for (const key of candidates) {
    const value = r[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function getRegistrationFormFields(registration) {
  const comp = registration.competitionId;
  const fest = registration.fest;

  if (comp?.registrationType === 'custom' && comp.registration) {
    const reg = comp.registration;
    if (reg.formType === 'MULTI_STEP' && reg.steps?.length) {
      return dedupeFormFields(reg.steps.flatMap((s) => s.fields || []));
    }
    return dedupeFormFields(reg.formSchema || []);
  }

  if (fest?.registration) {
    const reg = fest.registration;
    if (reg.formType === 'MULTI_STEP' && reg.steps?.length) {
      return dedupeFormFields(reg.steps.flatMap((s) => s.fields || []));
    }
    return dedupeFormFields(reg.formSchema || []);
  }

  return [];
}

export default function RegistrationDetails() {
  const { registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isTrekBooking = searchParams.get('type') === 'trek';
  const bookingAccess = searchParams.get('access') || '';
  const isEventRegistration = searchParams.get('type') === 'event';
  const isSportsRegistration = searchParams.get('type') === 'sports';
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
  const { isAuthenticated, token, isLoading: authLoading } = useAuth();
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const pendingHint = location.state?.pendingApproval || null;

  useEffect(() => {
    if (authLoading) return;

    const canGuestTrek = isTrekBooking && Boolean(bookingAccess);
    if (!isAuthenticated && !canGuestTrek) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }

    fetchRegistrationDetails();
  }, [registrationId, isAuthenticated, authLoading, token, isTrekBooking, isEventRegistration, isSportsRegistration, navigate, location.pathname, location.search, bookingAccess]);

  const fetchRegistrationDetails = async () => {
    try {
      setLoading(true);
      setError('');
      setErrorCode('');
      const path = isTrekBooking
        ? `/registrations/trek-booking/${registrationId}`
        : isEventRegistration
          ? `/registrations/event-registration/${registrationId}`
          : isSportsRegistration
            ? `/category-registrations/details/${registrationId}`
            : `/registrations/details/${registrationId}`;

      if (isTrekBooking && bookingAccess && !isAuthenticated) {
        const { API_BASE_URL } = await import('../../services/api/client');
        const res = await fetch(`${API_BASE_URL}${path}?access=${encodeURIComponent(bookingAccess)}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-booking-access': bookingAccess,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = new Error(data.error || data.message || 'Failed to load booking');
          err.code = res.status === 401 ? 'AUTH_401' : res.status === 404 ? 'NOT_FOUND' : '';
          throw err;
        }
        setRegistration(data);
      } else {
        const data = await userFetchJSONStrict(path, {
          token,
          cacheBust: true,
          headers: bookingAccess ? { 'x-booking-access': bookingAccess } : undefined,
        });
        setRegistration(data);
      }
    } catch (err) {
      if (err.code === 'AUTH_401' && !(isTrekBooking && bookingAccess)) {
        navigate('/login', { state: { from: location.pathname + location.search }, replace: true });
        return;
      }
      setError(err.message || 'Something went wrong');
      setErrorCode(err.code || '');
    } finally {
      setLoading(false);
    }
  };

  const renderFieldValue = (field, value) => {
    // Don't render file/image fields
    if (field.type === 'file' || field.type === 'image') {
      return null;
    }

    // Handle different field types
    if (field.type === 'checkbox' && Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return value || 'Not provided';
  };

  if (loading) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error || !registration) {
    const clubLabel = pendingHint?.clubName || 'The club';
    const isAuthError = errorCode === 'AUTH_401' || errorCode === 'NO_AUTH_TOKEN'
      || /authentication failed/i.test(error || '');
    const isNotFound = errorCode === 'NOT_FOUND' || /not found/i.test(error || '');
    // Only show pending-friendly UI when we arrived from a known pending submit/card
    const showPendingFriendly = isSportsRegistration && !!pendingHint && !isAuthError;

    if (showPendingFriendly) {
      return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md mx-auto w-full">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
              <Clock className="w-9 h-9 text-amber-400" />
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment submitted
            </h2>
            <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {clubLabel} will confirm your payment soon.
            </p>
            <button
              type="button"
              onClick={() => navigate('/booking', { state: { refreshBookings: true } })}
              className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
            >
              View My Bookings
            </button>
          </div>
        </div>
      );
    }

    const title = isAuthError
      ? 'Please log in again'
      : isNotFound
        ? 'Booking not found'
        : 'Couldn’t load this booking';
    const body = isAuthError
      ? 'Your session expired. Log in to view this booking.'
      : isNotFound
        ? 'This registration isn’t available. Check My Bookings for your latest runs.'
        : (error || 'Please go back to My Bookings and try again.');

    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>
            {title}
          </h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {body}
          </p>
          <div className="flex flex-col gap-3">
            {isAuthError ? (
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: location.pathname + location.search } })}
                className="bg-[#0ECCEE] text-black px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
              >
                Log in again
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate('/booking')}
              className={`${isAuthError ? 'border border-gray-600 text-gray-200' : 'bg-[#0ECCEE] text-white'} px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition`}
            >
              Back to My Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCompetitionRegistration = !isTrekBooking && !isEventRegistration && !isSportsRegistration && !!registration.competitionId;
  const eventShow = registration.eventShow || {};
  const sportsEvent = registration.event || {};
  const eventShowDate = eventShow.showTimings?.[0]?.date || null;
  const eventShowTime = eventShow.showTimings?.[0]?.time || null;
  const eventName = isTrekBooking
    ? registration.trekId?.trekName || 'Trek'
    : isEventRegistration
      ? eventShow.displayName || eventShow.title || 'Event'
      : isSportsRegistration
        ? sportsEvent.title || 'Run'
        : isCompetitionRegistration
          ? registration.competitionId?.name
          : registration.fest?.festName;
  const eventImage = isTrekBooking
    ? registration.trekId?.coverImage || registration.trekId?.images?.[0]
    : isEventRegistration
      ? eventShow.coverImage || eventShow.banner
      : isSportsRegistration
        ? sportsEvent.coverImage || sportsEvent.images?.[0]
        : isCompetitionRegistration
          ? registration.competitionId?.coverImage
          : registration.fest?.coverImage;
  const formEntries = isTrekBooking
    ? Object.entries(registration.formData || {})
    : null;

  const registrationFormFields = !isTrekBooking && !isEventRegistration && !isSportsRegistration
    ? getRegistrationFormFields(registration)
    : [];

  // Flatten event form fields (single-step schema or multi-step) for rendering responses
  const eventFormFields = isEventRegistration
    ? (eventShow.registration?.formType === 'MULTI_STEP'
        ? (eventShow.registration?.steps || []).flatMap((s) => s.fields || [])
        : (eventShow.registration?.formSchema || []))
    : [];

  const sportsFormFields = isSportsRegistration
    ? mergeRunFormFields(sportsEvent.registration?.formSchema || [])
    : [];

  const sportsSchemaKeys = new Set(
    sportsFormFields.flatMap((f) => [f.fieldName, f.id, f.id ? `field_${f.id}` : null].filter(Boolean)),
  );

  const sportsResponses = isSportsRegistration
    ? dedupeResponseEntries(
        Object.entries(normalizeResponses(registration.responses) || {}).filter(([k]) => {
          if (['people', 'date', 'time'].includes(k)) return false;
          if (k.endsWith('_file')) return false;
          if (sportsSchemaKeys.has(k)) return false;
          const alias = responseAliasGroup(k);
          if (alias && [...sportsSchemaKeys].some((sk) => responseAliasGroup(sk) === alias)) return false;
          return true;
        }),
      )
    : [];

  const paymentInfo = isTrekBooking
    ? {
        amountPaid: registration.bookingDetails?.amountPaid || 0,
        paymentId: registration.bookingDetails?.paymentId || '',
        orderId:
          registration.payment_order_id ||
          registration.bookingDetails?.payment_order_id ||
          '',
        gateway: 'cashfree',
        status: registration.bookingDetails?.amountPaid > 0 ? 'paid' : 'free',
      }
    : {
        amountPaid: registration.amountPaid || 0,
        paymentId: registration.payment_id || '',
        orderId: registration.payment_order_id || '',
        gateway: registration.payment_gateway || '',
        status: registration.paymentStatus || 'free',
      };

  const isPendingSports = isSportsRegistration && registration.status === 'pending';
  const isRejectedSports = isSportsRegistration && registration.status === 'cancelled';

  const hasPaymentReceipt =
    !isPendingSports &&
    !isRejectedSports &&
    (paymentInfo.amountPaid > 0 || paymentInfo.status === 'paid') &&
    !!paymentInfo.orderId;

  const formatAmount = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const invoicePath = isTrekBooking
    ? `/payment-invoice/${registrationId}?type=trek${bookingAccess ? `&access=${encodeURIComponent(bookingAccess)}` : ''}`
    : isEventRegistration
      ? `/payment-invoice/${registrationId}?type=event`
      : isSportsRegistration
        ? `/payment-invoice/${registrationId}?type=sports`
        : `/payment-invoice/${registrationId}`;

  const trekCommunityGroupLink = isTrekBooking
    ? String(
        registration.groupLink ||
        registration.trekId?.groupLink ||
        registration.trekId?.communityId?.groupLink ||
        '',
      ).trim()
    : '';

  const sportsGroupLink = isSportsRegistration && !isPendingSports && !isRejectedSports
    ? String(registration.groupLink || '').trim()
    : '';
  const sportsClubName = registration.clubName || '';
  const sportsWaIsPhone = /^https?:\/\/wa\.me\//i.test(sportsGroupLink);
  const sportsWaLabel = sportsWaIsPhone ? 'Message club on WhatsApp' : 'Join WhatsApp group';

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 sm:pt-[calc(env(safe-area-inset-top)+2rem)] sm:pb-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/booking')}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isPendingSports ? (
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isRejectedSports ? 'text-red-400' : 'text-green-500'}`} />
              )}
              <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isPendingSports
                  ? 'Payment submitted'
                  : isRejectedSports
                    ? 'Payment not approved'
                    : 'Registration Confirmed'}
              </h1>
            </div>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>
              {isPendingSports
                ? `${sportsClubName || 'The club'} will confirm your payment soon.`
                : isTrekBooking
                ? 'Trek Booking'
                : isEventRegistration
                  ? 'Event Registration'
                  : isSportsRegistration
                    ? 'Run Registration'
                    : isCompetitionRegistration
                      ? 'Competition Registration'
                      : 'Fest Registration'}
            </p>
          </div>
        </div>

        {isPendingSports ? (
          <div className={`rounded-xl p-4 mb-4 border ${isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Status</span>
                <span className={`font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Pending approval</span>
              </div>
              {paymentInfo.amountPaid > 0 ? (
                <div className="flex justify-between gap-3">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Amount paid to club</span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatAmount(paymentInfo.amountPaid)}</span>
                </div>
              ) : null}
              {registration.transactionId ? (
                <div className="flex justify-between gap-3">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>UPI / Txn ID</span>
                  <span className={`font-medium text-right break-all max-w-[60%] ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {registration.transactionId}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isRejectedSports && registration.paymentReviewNote ? (
          <div className={`rounded-xl p-4 mb-4 border ${isDark ? 'bg-red-900/20 border-red-700/40 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {registration.paymentReviewNote}
          </div>
        ) : null}

        {/* Event Information */}
        <div className={`${isDark ? 'bg-[#1D1E20]' : 'bg-white'} rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm`}>
          <h2 className={`text-lg sm:text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            Event Information
          </h2>
          
          <div className="flex items-start gap-3 sm:gap-4">
            {eventImage && (
              <img
                src={eventImage}
                alt={eventName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className={`text-base sm:text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2 line-clamp-2`}>
                {eventName}
              </h3>
              
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                {isTrekBooking && registration.trekId?.city && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className={`w-[18px] h-[18px] ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} line-clamp-1`}>
                      {registration.trekId.city}
                    </span>
                  </div>
                )}

                {!isTrekBooking && !isEventRegistration && !isSportsRegistration && registration.fest?.collegeName && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className={`w-[18px] h-[18px] ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} line-clamp-1`}>
                      {registration.fest.collegeName}
                    </span>
                  </div>
                )}

                {isSportsRegistration && (sportsEvent.venue || sportsEvent.city) && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className={`w-[18px] h-[18px] ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} line-clamp-1`}>
                      {sportsEvent.venue || sportsEvent.city}
                    </span>
                  </div>
                )}

                {isSportsRegistration && (registration.bookingDate || sportsEvent.eventDate) && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className={`w-[18px] h-[18px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                      {registration.bookingDate
                        || (sportsEvent.eventDate
                          ? new Date(sportsEvent.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '')}
                      {(registration.bookingTime || sportsEvent.reportingTime)
                        ? ` · ${registration.bookingTime || sportsEvent.reportingTime}`
                        : ''}
                    </span>
                  </div>
                )}

                {isEventRegistration && (eventShow.venue || eventShow.city) && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className={`w-[18px] h-[18px] ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} line-clamp-1`}>
                      {eventShow.venue || eventShow.city}
                    </span>
                  </div>
                )}

                {isEventRegistration && eventShowDate && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className={`w-[18px] h-[18px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                      {eventShowDate}
                      {eventShowTime ? ` · ${eventShowTime}` : ''}
                    </span>
                  </div>
                )}

                {isTrekBooking && registration.bookingDetails?.date && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className={`w-[18px] h-[18px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                      {registration.bookingDetails.date}
                      {registration.bookingDetails?.time ? ` · ${registration.bookingDetails.time}` : ''}
                    </span>
                  </div>
                )}

                {!isTrekBooking && !isEventRegistration && !isSportsRegistration && registration.fest?.festDate && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className={`w-[18px] h-[18px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                      {registration.fest.festDate}
                    </span>
                  </div>
                )}
              
              </div>
            </div>
          </div>
        </div>

        {isTrekBooking && trekCommunityGroupLink && (
          <div className={`${isDark ? 'bg-[#0d2818] border border-green-900/50' : 'bg-green-50 border border-green-100'} rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm`}>
            <h2 className={`text-lg sm:text-xl font-semibold mb-2 ${isDark ? 'text-green-300' : 'text-green-800'}`}>
              Join WhatsApp for trek updates
            </h2>
            <p className={`text-sm mb-4 ${isDark ? 'text-green-400/80' : 'text-green-700'}`}>
              Get announcements, meetup details and everything about <strong>{eventName}</strong> in the group.
            </p>
            <JoinCommunityButton
              groupLink={trekCommunityGroupLink}
              label="Join WhatsApp group"
              className="bg-[#25D366] text-white hover:opacity-90"
            />
          </div>
        )}

        {sportsGroupLink && (
          <div className={`${isDark ? 'bg-[#0d2818] border border-green-900/50' : 'bg-green-50 border border-green-100'} rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm`}>
            <h2 className={`text-lg sm:text-xl font-semibold mb-2 ${isDark ? 'text-green-300' : 'text-green-800'}`}>
              Join WhatsApp for run updates
            </h2>
            <p className={`text-sm mb-4 ${isDark ? 'text-green-400/80' : 'text-green-700'}`}>
              Stay in the loop for <strong>{eventName}</strong>
              {sportsClubName ? <> with <strong>{sportsClubName}</strong></> : null}.
            </p>
            <JoinCommunityButton
              groupLink={sportsGroupLink}
              label={sportsWaLabel}
              className="bg-[#25D366] text-white hover:opacity-90"
            />
          </div>
        )}

        {hasPaymentReceipt && (
          <div className={`${isDark ? 'bg-[#1D1E20]' : 'bg-white'} rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm`}>
            <div className="flex items-center gap-2 mb-4">
              <Receipt className={`w-5 h-5 ${isDark ? 'text-[#0ECCEE]' : 'text-cyan-600'}`} />
              <h2 className={`text-lg sm:text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Amount Paid</span>
                <div className={`text-lg font-bold ${isDark ? 'text-[#0ECCEE]' : 'text-cyan-600'}`}>
                  {formatAmount(paymentInfo.amountPaid)}
                </div>
              </div>
              <div>
                <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</span>
                <div className={`capitalize ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {paymentInfo.status}
                </div>
              </div>
              {paymentInfo.gateway && (
                <div>
                  <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Gateway</span>
                  <div className={`uppercase ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {paymentInfo.gateway}
                  </div>
                </div>
              )}
              <div>
                <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Order ID</span>
                <div className={`font-mono text-xs break-all ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                  {paymentInfo.orderId}
                </div>
              </div>
              {paymentInfo.paymentId && (
                <div className="sm:col-span-2">
                  <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Payment ID</span>
                  <div className={`font-mono text-xs break-all ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                    {paymentInfo.paymentId}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate(invoicePath)}
              className="mt-5 w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
            >
              View & Download Receipt
            </button>
          </div>
        )}

        {/* Registration Details */}
        <div className={`${isDark ? 'bg-[#1D1E20]' : 'bg-white'} rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-sm`}>
          <h2 className={`text-lg sm:text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 sm:mb-6`}>
            Registration Details
          </h2>

          {isTrekBooking && formEntries?.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {formEntries.map(([key, value]) => (
                <div key={key} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="sm:w-1/3">
                      <label className={`text-sm font-medium capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {key.replace(/_/g, ' ')}
                      </label>
                    </div>
                    <div className="sm:w-2/3">
                      <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {value || 'Not provided'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {registration.bookingDetails?.people > 1 && (
                <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="sm:w-1/3">
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>People</span>
                    </div>
                    <div className="sm:w-2/3">
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {registration.bookingDetails.people}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isSportsRegistration && (
            <div className="space-y-3 sm:space-y-4">
              {(registration.bookingPeople || sportsResponses.length > 0) && (
                <>
                  {registration.bookingPeople ? (
                    <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                        <div className="sm:w-1/3">
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>People</span>
                        </div>
                        <div className="sm:w-2/3">
                          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{registration.bookingPeople}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {sportsFormFields.length > 0
                    ? (
                      <>
                        {sportsFormFields.map((field, index) => {
                          const value = getResponseValue(registration.responses, field);
                          const renderedValue = renderFieldValue(field, value);
                          if (!renderedValue) return null;
                          return (
                            <div key={field.fieldName || field.id || index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                                <div className="sm:w-1/3">
                                  <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{field.label}</label>
                                </div>
                                <div className="sm:w-2/3">
                                  <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{renderedValue}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {sportsResponses.map(([key, value]) => (
                          <div key={key} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                              <div className="sm:w-1/3">
                                <label className={`text-sm font-medium capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {key.replace(/_/g, ' ')}
                                </label>
                              </div>
                              <div className="sm:w-2/3">
                                <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {typeof value === 'object' ? JSON.stringify(value) : (value || 'Not provided')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )
                    : sportsResponses.map(([key, value]) => (
                        <div key={key} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <div className="sm:w-1/3">
                              <label className={`text-sm font-medium capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {key.replace(/_/g, ' ')}
                              </label>
                            </div>
                            <div className="sm:w-2/3">
                              <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {typeof value === 'object' ? JSON.stringify(value) : (value || 'Not provided')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                </>
              )}
              {!isPendingSports && !isRejectedSports ? (
                <button
                  type="button"
                  onClick={() => navigate(`/qr-ticket/${registrationId}?type=sports`)}
                  className="mt-2 w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                >
                  Download Ticket
                </button>
              ) : null}
            </div>
          )}

          {isEventRegistration && eventFormFields.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {eventFormFields.map((field, index) => {
                const value = getResponseValue(registration.responses, field);
                const renderedValue = renderFieldValue(field, value);

                if (!renderedValue) return null;

                return (
                  <div key={index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <div className="sm:w-1/3">
                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                      </div>
                      <div className="sm:w-2/3">
                        <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} bg-transparent`}>
                          {renderedValue}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isTrekBooking && !isEventRegistration && !isSportsRegistration && registrationFormFields.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {registrationFormFields.map((field, index) => {
                const value = getResponseValue(registration.responses, field);
                const renderedValue = renderFieldValue(field, value);

                if (!renderedValue) return null;

                return (
                  <div key={index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <div className="sm:w-1/3">
                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                      </div>
                      <div className="sm:w-2/3">
                        <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} bg-transparent`}>
                          {renderedValue}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isTrekBooking && !isEventRegistration && !isSportsRegistration && registrationFormFields.length === 0 && (
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(normalizeResponses(registration.responses))
                .filter(([key]) => !key.endsWith('_file'))
                .map(([key, value]) => (
                  <div key={key} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-4`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <div className="sm:w-1/3">
                        <label className={`text-sm font-medium capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {key.replace(/_/g, ' ')}
                        </label>
                      </div>
                      <div className="sm:w-2/3">
                        <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {typeof value === 'object' ? JSON.stringify(value) : (value || 'Not provided')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Registration Metadata */}
          <div className={`mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Registration ID:
                </span>
                <div className={`${isDark ? 'text-white' : 'text-gray-900'} font-mono`}>
                  {registration._id}
                </div>
              </div>
              <div>
                <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Submitted On:
                </span>
                <div className={isDark ? 'text-white' : 'text-gray-900'}>
                  {new Date(registration.submittedAt || registration.createdAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-4">
          <button
            onClick={() => navigate('/booking')}
            className={`px-6 py-3 rounded-lg border transition-colors ${
              isDark 
                ? 'border-gray-600 text-gray-300 hover:bg-gray-800' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Back to My Bookings
          </button>
          {!isPendingSports && !isRejectedSports ? (
            <button
              type="button"
              onClick={() =>
                navigate(
                  isTrekBooking
                    ? `/qr-ticket/${registrationId}?type=trek${bookingAccess ? `&access=${encodeURIComponent(bookingAccess)}` : ''}`
                    : isEventRegistration
                      ? `/qr-ticket/${registrationId}?type=event`
                      : isSportsRegistration
                        ? `/qr-ticket/${registrationId}?type=sports`
                        : `/qr-ticket/${registrationId}`
                )
              }
              className="px-6 py-3 rounded-lg bg-[#0ECCEE] text-black font-medium hover:opacity-90 transition"
            >
              Download Ticket
            </button>
          ) : null}
          {isRejectedSports && isSportsRegistration ? (
            <button
              type="button"
              onClick={() => navigate('/sports')}
              className="px-6 py-3 rounded-lg bg-[#0ECCEE] text-black font-medium hover:opacity-90 transition"
            >
              Browse runs &amp; register again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}