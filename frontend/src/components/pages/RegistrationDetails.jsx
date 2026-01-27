import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Calendar, MapPin, User, Mail, Phone } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function RegistrationDetails() {
  const { registrationId } = useParams();
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
  }, [registrationId, isAuthenticated, navigate]);

  const fetchRegistrationDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('crwdctrl_token');
      
      const response = await fetch(`${API_BASE_URL}/registrations/details/${registrationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch registration details');
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
      <div className={`min-h-screen ${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            {error || 'Registration not found'}
          </h2>
          <button
            onClick={() => navigate('/registered-fest')}
            className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600 transition"
          >
            Back to Registered Events
          </button>
        </div>
      </div>
    );
  }

  const isCompetitionRegistration = !!registration.competitionId;
  const eventName = isCompetitionRegistration 
    ? registration.competitionId?.name 
    : registration.fest?.festName;
  const eventImage = isCompetitionRegistration 
    ? registration.competitionId?.coverImage 
    : registration.fest?.coverImage;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-50'} py-4 sm:py-8`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/registered-fest')}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Registration Confirmed
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
              {isCompetitionRegistration ? 'Competition Registration' : 'Fest Registration'}
            </p>
          </div>
        </div>

        {/* Success Banner */}
        <div className={`${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'} border rounded-lg p-4 mb-6`}>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h3 className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                Registration Successful!
              </h3>
              <p className={`text-sm ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                Your registration for {eventName} has been confirmed.
              </p>
            </div>
          </div>
        </div>

        {/* Event Information */}
        <div className={`${isDark ? 'bg-[#2A2B2D]' : 'bg-white'} rounded-xl p-6 mb-6 shadow-sm`}>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            Event Information
          </h2>
          
          <div className="flex items-start gap-4">
            {eventImage && (
              <img
                src={eventImage}
                alt={eventName}
                className="w-20 h-20 rounded-lg object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                {eventName}
              </h3>
              
              <div className="space-y-2 text-sm">
                {registration.fest?.collegeName && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                      {registration.fest.collegeName}
                    </span>
                  </div>
                )}
                
                {registration.fest?.festDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
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
        <div className={`${isDark ? 'bg-[#2A2B2D]' : 'bg-white'} rounded-xl p-6 shadow-sm`}>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
            Registration Details
          </h2>

          {registration.fest?.registration?.formSchema && (
            <div className="space-y-4">
              {registration.fest.registration.formSchema.map((field, index) => {
                const value = registration.responses?.[field.fieldName];
                const renderedValue = renderFieldValue(field, value);
                
                // Skip file/image fields
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
                  {new Date(registration.submittedAt).toLocaleString('en-IN', {
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
            onClick={() => navigate('/registered-fest')}
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