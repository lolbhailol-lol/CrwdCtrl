import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Calendar, MapPin, User, Mail, Phone } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function RegistrationDetails() {
  const { registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const isTrekBooking = searchParams.get('type') === 'trek';
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
  const { isAuthenticated } = useAuth();
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

   
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchRegistrationDetails();
  }, [registrationId, isAuthenticated, isTrekBooking, navigate]);

  const fetchRegistrationDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('crwdctrl_token');
      const url = isTrekBooking
        ? `${API_BASE_URL}/registrations/trek-booking/${registrationId}`
        : `${API_BASE_URL}/registrations/details/${registrationId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(isTrekBooking ? 'Trek booking not found' : 'Failed to fetch registration details');
      }

      const data = await response.json();
      setRegistration(data);
    } catch (err) {
      setError(err.message);
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
      <div className={`min-h-screen ${isDark ? 'bg-[#111213]' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#111213]' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            {error || 'Registration not found'}
          </h2>
          <button
            onClick={() => navigate('/booking')}
            className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600 transition"
          >
            Back to Registered Events
          </button>
        </div>
      </div>
    );
  }

  const isCompetitionRegistration = !isTrekBooking && !!registration.competitionId;
  const eventName = isTrekBooking
    ? registration.trekId?.trekName || 'Trek'
    : isCompetitionRegistration
      ? registration.competitionId?.name
      : registration.fest?.festName;
  const eventImage = isTrekBooking
    ? registration.trekId?.coverImage || registration.trekId?.images?.[0]
    : isCompetitionRegistration
      ? registration.competitionId?.coverImage
      : registration.fest?.coverImage;
  const formEntries = isTrekBooking
    ? Object.entries(registration.formData || {})
    : null;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#111213]' : 'bg-gray-50'} py-4 sm:py-8`}>
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
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Registration Confirmed
            </h1>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>
              {isTrekBooking ? 'Trek Booking' : isCompetitionRegistration ? 'Competition Registration' : 'Fest Registration'}
            </p>
          </div>
        </div>

        {/* Success Banner */}
        <div className={`${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'} border rounded-lg p-3 sm:p-4 mb-4 sm:mb-6`}>
          <div className="flex items-start gap-2 sm:gap-3">
            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className={`text-sm sm:text-base font-semibold ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                Registration Successful!
              </h3>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-green-300' : 'text-green-700'} mt-0.5`}>
                Your {isTrekBooking ? 'booking' : 'registration'} for {eventName} has been confirmed.
              </p>
            </div>
          </div>
        </div>

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

                {!isTrekBooking && registration.fest?.collegeName && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin className={`w-[18px] h-[18px] ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} line-clamp-1`}>
                      {registration.fest.collegeName}
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

                {!isTrekBooking && registration.fest?.festDate && (
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

          {!isTrekBooking && registration.fest?.registration?.formSchema && (
            <div className="space-y-3 sm:space-y-4">
              {registration.fest.registration.formSchema.map((field, index) => {
                const value = registration.responses?.[field.fieldName];
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

          {/* Registration Metadata */}
          <div className={`mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Registration Information
            </h3>
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
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate('/booking')}
            className={`px-6 py-3 rounded-lg border transition-colors ${
              isDark 
                ? 'border-gray-600 text-gray-300 hover:bg-gray-800' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Back to Registered Events
          </button>
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            Print Registration
          </button>
        </div>
      </div>
    </div>
  );
}