import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Calendar, MapPin, Receipt, Clock, UserPlus, Trash2 } from 'lucide-react';
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
import { primaryCoverUrl } from '../../utils/coverImages';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { sportsQrTicketPath, isEventsListingHub } from '../../utils/listingHubCopy';

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

const RESPONSE_ALIAS_KEYS = {
  name: ['full_name', 'name', 'leader_name'],
  email: ['email'],
  phone: ['contact_no', 'phone', 'mobile', 'tel'],
  college: ['college', 'college_name', 'institution'],
};

function pickAliasValue(responses, alias) {
  const r = normalizeResponses(responses);
  const keys = RESPONSE_ALIAS_KEYS[alias] || [];
  for (const key of keys) {
    const value = r[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  const members = r.team_members;
  if (Array.isArray(members) && members[0] && typeof members[0] === 'object') {
    const memberKey = alias === 'name' ? 'name' : alias;
    const value = members[0][memberKey];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function labelAliasGroup(label) {
  const text = String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;
  if (/^(full name|name)$/.test(text)) return 'name';
  if (/^(e-?mail|email|email address)$/.test(text)) return 'email';
  if (/^(contact( no\.?)?|phone|mobile( number)?|tel)$/.test(text)) return 'phone';
  if (/college|institute/.test(text)) return 'college';
  return null;
}

function resolveFieldAlias(field) {
  const fromLabelId = labelToFieldId(field.label);
  const strippedLabelId = fromLabelId.replace(/^field_/, '');
  return responseAliasGroup(field.fieldName)
    || responseAliasGroup(field.id)
    || labelAliasGroup(field.label)
    || responseAliasGroup(strippedLabelId);
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
  const alias = resolveFieldAlias(field);
  if (alias) {
    const fromAlias = pickAliasValue(r, alias);
    if (fromAlias !== undefined) return fromAlias;
  }
  if (field.fieldName === 'team_name' || /team.?name/i.test(field.label || '')) {
    const teamName = r.team_name;
    if (teamName !== undefined && teamName !== null && String(teamName).trim() !== '') return teamName;
  }
  return undefined;
}

function personFieldToFormField(field) {
  const key = String(field?.key || '').trim();
  if (!key) return null;
  return {
    id: key,
    fieldName: key,
    label: field.label || key,
    type: key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text',
  };
}

function getRegistrationFormFields(registration) {
  const responses = normalizeResponses(registration.responses);
  const comp = registration.competitionId;
  const fest = registration.fest;

  const savedPersonFields = Array.isArray(responses.person_fields) ? responses.person_fields : [];
  const schemaPersonFields = Array.isArray(comp?.registration?.personFields)
    ? comp.registration.personFields
    : [];

  const personFieldsMeta = savedPersonFields.length ? savedPersonFields : schemaPersonFields;
  if (personFieldsMeta.length > 0) {
    const fields = [];
    if (responses.team_name || Number(responses.team_size) > 1) {
      fields.push({ id: 'team_name', fieldName: 'team_name', label: 'Team Name', type: 'text' });
    }
    personFieldsMeta
      .filter((field) => field.scope !== 'team')
      .forEach((field) => {
        const mapped = personFieldToFormField(field);
        if (mapped) fields.push(mapped);
      });
    return dedupeFormFields(fields);
  }

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
  const [resolvedAsSports, setResolvedAsSports] = useState(false);
  // Add-members state
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [addMemberRows, setAddMemberRows] = useState([]);
  const [addMembersBusy, setAddMembersBusy] = useState(false);
  const [addMembersError, setAddMembersError] = useState('');
  const pendingHint = location.state?.pendingApproval || null;
  const treatAsSports = isSportsRegistration
    || resolvedAsSports
    || registration?.category === 'sports';
  const isEventCommunitySports = treatAsSports && (
    searchParams.get('hub') === 'events'
    || isEventsListingHub(registration?.event)
    || isEventsListingHub(registration)
  );

  useEffect(() => {
    if (authLoading) return;

    const canGuestTrek = isTrekBooking && Boolean(bookingAccess);
    if (!isAuthenticated && !canGuestTrek) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }

    setResolvedAsSports(false);
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
        try {
          const data = await userFetchJSONStrict(path, {
            token,
            cacheBust: true,
            headers: bookingAccess ? { 'x-booking-access': bookingAccess } : undefined,
          });
          setRegistration(data);
        } catch (primaryErr) {
          const shouldRetrySports = !isTrekBooking
            && !isEventRegistration
            && !isSportsRegistration
            && (primaryErr.code === 'NOT_FOUND' || /not found/i.test(primaryErr.message || ''));
          if (!shouldRetrySports) throw primaryErr;
          const data = await userFetchJSONStrict(`/category-registrations/details/${registrationId}`, {
            token,
            cacheBust: true,
          });
          setResolvedAsSports(true);
          setRegistration(data);
        }
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
    if (field.type === 'file' || field.type === 'image') {
      const url = typeof value === 'string' ? value.trim() : '';
      if (!url) return 'Not provided';
      if (/^https?:\/\//i.test(url)) {
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#0ECCEE] underline break-all">
            View upload
          </a>
        );
      }
      return url;
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
      <InlinePageLoader label="Loading registration" variant="booking" fullScreen />
    );
  }

  if (error || !registration) {
    const clubLabel = pendingHint?.clubName || 'The club';
    const isAuthError = errorCode === 'AUTH_401' || errorCode === 'NO_AUTH_TOKEN'
      || /authentication failed/i.test(error || '');
    const isNotFound = errorCode === 'NOT_FOUND' || /not found/i.test(error || '');
    // Only show pending-friendly UI when we arrived from a known pending submit/card
    const showPendingFriendly = treatAsSports && !!pendingHint && !isAuthError;

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

  const isCompetitionRegistration = !isTrekBooking && !isEventRegistration && !treatAsSports && !!registration.competitionId;
  const eventShow = registration.eventShow || {};
  const sportsEvent = registration.event || {};
  const eventShowDate = eventShow.showTimings?.[0]?.date || null;
  const eventShowTime = eventShow.showTimings?.[0]?.time || null;
  const eventName = isTrekBooking
    ? registration.trekId?.trekName || 'Trek'
    : isEventRegistration
      ? eventShow.displayName || eventShow.title || 'Event'
      : treatAsSports
        ? sportsEvent.title || 'Run'
        : isCompetitionRegistration
          ? registration.competitionId?.name
          : registration.fest?.festName;
  const eventImage = isTrekBooking
    ? registration.trekId?.coverImage || registration.trekId?.images?.[0]
    : isEventRegistration
      ? primaryCoverUrl(
          eventShow.coverImages,
          eventShow.poster || eventShow.banner || eventShow.coverImage || '',
        ) || null
      : treatAsSports
        ? sportsEvent.coverImage || sportsEvent.images?.[0]
        : isCompetitionRegistration
          ? registration.competitionId?.coverImage
          : registration.fest?.coverImage;
  const formEntries = isTrekBooking
    ? Object.entries(registration.formData || {})
    : null;

  const registrationFormFields = !isTrekBooking && !isEventRegistration && !treatAsSports
    ? getRegistrationFormFields(registration)
    : [];

  const rosterTeamMembers = !isTrekBooking && !isEventRegistration && !treatAsSports
    ? (Array.isArray(normalizeResponses(registration.responses).team_members)
      ? normalizeResponses(registration.responses).team_members.filter(
        (member) => member && typeof member === 'object',
      )
      : [])
    : [];

  const rosterPersonFields = !isTrekBooking && !isEventRegistration && !treatAsSports
    ? (Array.isArray(normalizeResponses(registration.responses).person_fields)
      ? normalizeResponses(registration.responses).person_fields.filter((field) => field?.scope !== 'team')
      : [])
    : [];

  // Flatten event form fields (single-step schema or multi-step) for rendering responses
  const eventFormFields = isEventRegistration
    ? (eventShow.registration?.formType === 'MULTI_STEP'
        ? (eventShow.registration?.steps || []).flatMap((s) => s.fields || [])
        : (eventShow.registration?.formSchema || []))
    : [];

  const sportsFormFields = treatAsSports
    ? mergeRunFormFields(sportsEvent.registration?.formSchema || [])
    : [];

  const sportsSchemaKeys = new Set(
    sportsFormFields.flatMap((f) => [f.fieldName, f.id, f.id ? `field_${f.id}` : null].filter(Boolean)),
  );

  const sportsResponses = treatAsSports
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

  const isPendingSports = treatAsSports && registration.status === 'pending';
  const isRejectedSports = treatAsSports && registration.status === 'cancelled';

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
      : treatAsSports
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

  const sportsGroupLink = treatAsSports && !isPendingSports && !isRejectedSports
    ? String(registration.groupLink || '').trim()
    : '';
  const sportsClubName = registration.clubName || '';
  const sportsWaIsPhone = /^https?:\/\/wa\.me\//i.test(sportsGroupLink);
  const sportsWaLabel = sportsWaIsPhone ? 'Message club on WhatsApp' : 'Join WhatsApp group';

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen pt-[calc(var(--safe-top)+1rem)] pb-4 sm:pt-[calc(var(--safe-top)+2rem)] sm:pb-8">
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
                  : treatAsSports
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

                {!isTrekBooking && !isEventRegistration && !treatAsSports && registration.fest?.collegeName && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className={`w-[18px] h-[18px] ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} line-clamp-1`}>
                      {registration.fest.collegeName}
                    </span>
                  </div>
                )}

                {treatAsSports && (sportsEvent.venue || sportsEvent.city) && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className={`w-[18px] h-[18px] ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} line-clamp-1`}>
                      {sportsEvent.venue || sportsEvent.city}
                    </span>
                  </div>
                )}

                {treatAsSports && (registration.bookingDate || sportsEvent.eventDate) && (
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

                {!isTrekBooking && !isEventRegistration && !treatAsSports && registration.fest?.festDate && (
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

          {treatAsSports && (
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
                  onClick={() => navigate(sportsQrTicketPath(registrationId, isEventCommunitySports))}
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

          {!isTrekBooking && !isEventRegistration && !treatAsSports && registrationFormFields.length > 0 && (
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

          {!isTrekBooking && !isEventRegistration && !treatAsSports && registrationFormFields.length === 0 && (
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(normalizeResponses(registration.responses))
                .filter(([key]) => !key.endsWith('_file'))
                .filter(([key]) => !['team_members', 'person_fields', 'team_size'].includes(key))
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

          {!isTrekBooking && !isEventRegistration && !treatAsSports && rosterTeamMembers.length > 1 ? (
            <div className={`mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Team members
              </h3>
              <div className="space-y-4">
                {rosterTeamMembers.map((member, index) => (
                  <div
                    key={`member-${index}`}
                    className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-[#151617]' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {rosterTeamMembers.length > 1 ? `Person ${index + 1}` : 'Participant'}
                    </p>
                    <div className="space-y-2 text-sm">
                      {(rosterPersonFields.length ? rosterPersonFields : [
                        { key: 'name', label: 'Name' },
                        { key: 'email', label: 'Email' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'college', label: 'College' },
                      ]).map((field) => {
                        const value = member?.[field.key];
                        if (!value) return null;
                        return (
                          <div key={`${index}-${field.key}`} className="flex flex-col sm:flex-row sm:gap-3">
                            <span className={`sm:w-1/3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {field.label || field.key}
                            </span>
                            <span className={`sm:w-2/3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Add team members (only when slots remain and not rejected) ── */}
          {isCompetitionRegistration &&
            registration.status !== 'rejected' &&
            (() => {
              const comp = registration.competitionId;
              const sizeMax = comp?.teamSizeMax || comp?.registration?.teamSizeMax || 1;
              const canAdd = rosterTeamMembers.length < sizeMax;
              if (!canAdd) return null;
              const slotsLeft = sizeMax - rosterTeamMembers.length;
              const displayFields = rosterPersonFields.length
                ? rosterPersonFields.filter(f => f.scope !== 'team')
                : [
                    { key: 'name', label: 'Full Name', required: true },
                    { key: 'email', label: 'Email', required: true },
                    { key: 'phone', label: 'Phone', required: false },
                    { key: 'college', label: 'College / Institution', required: false },
                  ];
              const emptyRow = () => Object.fromEntries(displayFields.map(f => [f.key, '']));

              const handleOpenAddMembers = () => {
                setAddMemberRows(Array.from({ length: 1 }, emptyRow));
                setAddMembersError('');
                setAddMembersOpen(true);
              };
              const handleAddRow = () => {
                if (addMemberRows.length < slotsLeft) {
                  setAddMemberRows(prev => [...prev, emptyRow()]);
                }
              };
              const handleRemoveRow = (i) => {
                setAddMemberRows(prev => prev.filter((_, idx) => idx !== i));
              };
              const handleFieldChange = (rowIdx, key, value) => {
                setAddMemberRows(prev => prev.map((row, i) => i === rowIdx ? { ...row, [key]: value } : row));
              };
              const handleSubmitMembers = async () => {
                setAddMembersBusy(true);
                setAddMembersError('');
                try {
                  // Build full new array: existing + new rows
                  const newFullList = [...rosterTeamMembers, ...addMemberRows];
                  const res = await userFetchJSONStrict(`/api/registrations/details/${registration._id}/team-members`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ team_members: newFullList }),
                  });
                  if (res.success) {
                    // Update local registration state with new team_members
                    setRegistration(prev => {
                      const updated = { ...prev };
                      const resp = updated.responses ? { ...updated.responses } : {};
                      resp.team_members = res.team_members;
                      updated.responses = resp;
                      return updated;
                    });
                    setAddMembersOpen(false);
                    setAddMemberRows([]);
                  } else {
                    setAddMembersError(res.error || 'Failed to save members');
                  }
                } catch (err) {
                  setAddMembersError(err.message || 'Failed to save members');
                } finally {
                  setAddMembersBusy(false);
                }
              };

              return (
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  {!addMembersOpen ? (
                    <button
                      type="button"
                      onClick={handleOpenAddMembers}
                      className="flex items-center gap-2 text-sm font-medium text-[#0ECCEE] hover:opacity-80 transition"
                    >
                      <UserPlus size={16} />
                      Add team members ({slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} remaining)
                    </button>
                  ) : (
                    <div>
                      <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Add team members
                      </h3>
                      <div className="space-y-4">
                        {addMemberRows.map((row, rowIdx) => (
                          <div
                            key={`new-member-${rowIdx}`}
                            className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-[#151617]' : 'border-gray-200 bg-gray-50'}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Person {rosterTeamMembers.length + rowIdx + 1}
                              </p>
                              {addMemberRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(rowIdx)}
                                  className="text-red-400 hover:text-red-500 transition"
                                  aria-label="Remove member"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {displayFields.map(field => (
                                <div key={field.key}>
                                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {field.label}{field.required ? ' *' : ''}
                                  </label>
                                  <input
                                    type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
                                    value={row[field.key] || ''}
                                    onChange={e => handleFieldChange(rowIdx, field.key, e.target.value)}
                                    placeholder={field.placeholder || field.label}
                                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#0ECCEE] ${
                                      isDark
                                        ? 'bg-[#1a1b1c] border-gray-700 text-white placeholder-gray-500'
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                    }`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {addMemberRows.length < slotsLeft && (
                        <button
                          type="button"
                          onClick={handleAddRow}
                          className="mt-3 flex items-center gap-1 text-xs text-[#0ECCEE] hover:opacity-80 transition"
                        >
                          <UserPlus size={13} /> Add another member
                        </button>
                      )}

                      {addMembersError && (
                        <p className="mt-3 text-sm text-red-400">{addMembersError}</p>
                      )}

                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={handleSubmitMembers}
                          disabled={addMembersBusy}
                          className="px-5 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
                        >
                          {addMembersBusy ? 'Saving…' : 'Save members'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddMembersOpen(false); setAddMemberRows([]); setAddMembersError(''); }}
                          disabled={addMembersBusy}
                          className={`px-5 py-2 rounded-xl border text-sm font-medium transition ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          }

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
                      : treatAsSports
                        ? sportsQrTicketPath(registrationId, isEventCommunitySports)
                        : `/qr-ticket/${registrationId}`
                )
              }
              className="px-6 py-3 rounded-lg bg-[#0ECCEE] text-black font-medium hover:opacity-90 transition"
            >
              Download Ticket
            </button>
          ) : null}
          {isRejectedSports && treatAsSports ? (
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