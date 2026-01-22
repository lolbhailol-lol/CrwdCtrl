import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function FestRegistration() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const competitionId = searchParams.get('competition');
  const { isAuthenticated, apiCall, isLoading: authLoading, user, token: authToken } = useAuth(); // Get user and token for debugging
  
  const [fest, setFest] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});

  const isCompetitionRegistration = !!competitionId;



  useEffect(() => {
    const initializeRegistration = async () => {
      console.log('🔄 Initializing registration...', { 
        authLoading, 
        isAuthenticated, 
        hasToken: !!authToken,
        hasLocalToken: !!localStorage.getItem('crwdctrl_token'),
        hasLocalUser: !!localStorage.getItem('crwdctrl_user')
      });

      // ✅ CRITICAL FIX: Don't wait for auth context if we have localStorage data
      const localToken = localStorage.getItem('crwdctrl_token');
      const localUser = localStorage.getItem('crwdctrl_user');
      
      // If no authentication data at all, redirect to login
      if (!localToken || !localUser) {
        console.log('❌ No authentication data found, redirecting to login');
        setError('Please log in to register for events');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // ✅ PERFORMANCE: Proceed immediately if we have localStorage data
      // Don't wait for auth context to load
      console.log('✅ Authentication data found in localStorage, proceeding with registration');
      proceedWithRegistration();
    };

    const proceedWithRegistration = () => {
      console.log('🚀 Proceeding with registration fetch...', { isCompetitionRegistration });
      if (isCompetitionRegistration) {
        fetchCompetitionAndFestDetails();
      } else {
        fetchFestDetails();
      }
    };

    initializeRegistration();
  }, [festId, competitionId, isCompetitionRegistration, navigate]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Helper function to generate consistent field IDs
  const generateFieldId = (field) => {
    // Priority: use field.id with field_ prefix if it exists
    if (field.id) return `field_${field.id}`;
    if (field.fieldName) return field.fieldName;
    if (field.label) {
      // More robust label sanitization
      return `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
    }
    return 'unknown_field';
  };



  const fetchFestDetails = async () => {
    try {
      console.log('📡 Fetching fest details for:', festId);
      const response = await fetch(`${API_BASE_URL}/fests/${festId}/public`);
      if (!response.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const data = await response.json();
      console.log('✅ Fest data received:', {
        festName: data.festName,
        registrationMode: data.registration?.mode,
        formSchemaLength: data.registration?.formSchema?.length || 0
      });
      
      // ✅ CRITICAL: Validate registration mode immediately
      if (data.registration?.mode !== 'INTERNAL_FORM') {
        console.error('❌ Invalid registration mode:', data.registration?.mode);
        setError(`Registration is not available. Mode: ${data.registration?.mode || 'NOT_SET'}`);
        setLoading(false);
        return;
      }
      
      setFest(data);

      // Initialize form data with empty values using stable field IDs
      const initialData = {};
      if (data.registration?.formSchema) {
        data.registration.formSchema.forEach(field => {
          const fieldId = generateFieldId(field);
          console.log('🔧 Initializing field:', { fieldId, type: field.type, label: field.label });
          // Initialize file/image fields as null, others as empty string/array
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else {
            initialData[fieldId] = field.type === 'checkbox' ? [] : '';
          }
        });
      }
      setFormData(initialData);
      console.log('✅ Form initialized with', Object.keys(initialData).length, 'fields');
    } catch (err) {
      console.error('❌ Error fetching fest details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionAndFestDetails = async () => {
    try {
      console.log('📡 Fetching competition and fest details...', { competitionId, festId });
      
      // Fetch competition details first
      const competitionResponse = await fetch(`${API_BASE_URL}/fests/competitions/${competitionId}/public`);
      if (!competitionResponse.ok) {
        throw new Error('Failed to fetch competition details');
      }
      const competitionData = await competitionResponse.json();
      console.log('✅ Competition data received:', {
        name: competitionData.name,
        registrationType: competitionData.registrationType,
        festId: competitionData.fest?._id
      });
      setCompetition(competitionData);

      // Fetch fest details
      const festResponse = await fetch(`${API_BASE_URL}/fests/${festId}/public`);
      if (!festResponse.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const festData = await festResponse.json();
      console.log('✅ Fest data received:', {
        festName: festData.festName,
        registrationMode: festData.registration?.mode,
        formSchemaLength: festData.registration?.formSchema?.length || 0
      });
      
      // ✅ CRITICAL: Validate registration mode for competition registration
      if (competitionData.registrationType === 'fest') {
        // Competition uses fest registration - check fest mode
        if (festData.registration?.mode !== 'INTERNAL_FORM') {
          console.error('❌ Fest registration mode invalid for competition:', festData.registration?.mode);
          setError(`Competition registration is not available. Fest mode: ${festData.registration?.mode || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      } else if (competitionData.registrationType === 'custom') {
        // Competition has its own registration - check competition mode
        if (competitionData.registration?.status !== 'internal_form') {
          console.error('❌ Competition registration status invalid:', competitionData.registration?.status);
          setError(`Competition registration is not available. Status: ${competitionData.registration?.status || 'NOT_SET'}`);
          setLoading(false);
          return;
        }
      }
      
      setFest(festData);

      // Initialize form data with empty values using stable field IDs
      const initialData = {};
      if (festData.registration?.formSchema) {
        festData.registration.formSchema.forEach(field => {
          const fieldId = generateFieldId(field);
          console.log('🔧 Initializing field:', { fieldId, type: field.type, label: field.label });
          // Initialize file/image fields as null, others as empty string/array
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else {
            initialData[fieldId] = field.type === 'checkbox' ? [] : '';
          }
        });
      }
      setFormData(initialData);
      console.log('✅ Form initialized with', Object.keys(initialData).length, 'fields');
    } catch (err) {
      console.error('❌ Error fetching competition/fest details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
const handleInputChange = (fieldId, value, fieldType = 'text') => {
  setFormData(prev => {
    if (fieldType === 'checkbox') {
      const currentValues = prev[fieldId] || [];
      const updatedValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];

      return {
        ...prev,
        [fieldId]: updatedValues
      };
    }

    return {
      ...prev,
      [fieldId]: value
    };
  });
};


  const handleFileUpload = async (file, fieldId) => {
    if (!file) return;

    console.log('📁 Starting file upload for field:', fieldId, 'File:', file.name);

    setUploadingFiles(prev => ({
      ...prev,
      [fieldId]: true
    }));

    try {
      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setError('File size must be less than 10MB');
        return;
      }

      // Validate file type for images
      if (fieldId.includes('image')) {
        if (!file.type.startsWith('image/')) {
          setError('Please select a valid image file');
          return;
        }
      }

      console.log('✅ File validated:', {
        name: file.name,
        size: file.size,
        type: file.type,
        fieldId: fieldId
      });

      // ✅ PERFORMANCE FIX: Store file immediately without uploading
      // Upload will happen during form submission to avoid blocking UI
      setFormData(prev => ({
        ...prev,
        [`${fieldId}_file`]: file, // Store actual file
        [fieldId]: { 
          uploaded: true, 
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          ready: true // Mark as ready for submission
        }
      }));
      
      console.log('✅ File prepared for upload:', fieldId, '- Will upload during form submission');
    } catch (err) {
      console.error('❌ File validation error:', err);
      setError(err.message || 'Failed to validate file');
    } finally {
      setUploadingFiles(prev => ({
        ...prev,
        [fieldId]: false
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Starting form submission...');
    setSubmitting(true);
    setError('');

    try {
      setSubmissionProgress('Validating authentication...');
      // ✅ CRITICAL: Use localStorage token directly, don't rely on context
      const token = localStorage.getItem('crwdctrl_token');
      const user = localStorage.getItem('crwdctrl_user');
      
      console.log('🔑 Auth check for submission:', { 
        hasToken: !!token, 
        hasUser: !!user,
        tokenLength: token?.length 
      });
      
      if (!token || !user) {
        throw new Error('Authentication required. Please log in again.');
      }

      setSubmissionProgress('Checking registration availability...');
      // ✅ CRITICAL: Double-check registration mode before submission
      console.log('🔍 Final registration mode check:', {
        festRegistrationMode: fest.registration?.mode,
        isCompetitionRegistration,
        competitionRegistrationType: competition?.registrationType
      });

      if (!isCompetitionRegistration && fest.registration?.mode !== 'INTERNAL_FORM') {
        throw new Error(`Registration is not available. Current mode: ${fest.registration?.mode}`);
      }

      if (isCompetitionRegistration) {
        if (competition?.registrationType === 'fest' && fest.registration?.mode !== 'INTERNAL_FORM') {
          throw new Error(`Competition registration is not available. Fest mode: ${fest.registration?.mode}`);
        }
        if (competition?.registrationType === 'custom' && competition?.registration?.status !== 'internal_form') {
          throw new Error(`Competition registration is not available. Status: ${competition?.registration?.status}`);
        }
      }

      setSubmissionProgress('Validating form fields...');
      // ✅ PERFORMANCE: Validate required fields with better field matching
      const formSchema = fest.registration?.formSchema || [];
      const requiredFields = formSchema.filter(field => field.required);
      
      console.log('🔍 Validating', requiredFields.length, 'required fields...');
      
      for (const field of requiredFields) {
        const fieldId = generateFieldId(field);
        const value = formData[fieldId];
        
        console.log('🔍 Checking field:', { 
          fieldId, 
          label: field.label, 
          type: field.type, 
          hasValue: !!value,
          valueType: typeof value
        });
        
        // For file/image fields, check if file was selected and is ready
        if (field.type === 'file' || field.type === 'image') {
          if (!value || !value.ready || !formData[`${fieldId}_file`]) {
            throw new Error(`${field.label} is required - please upload a file`);
          }
        } else {
          // For other fields, check if value exists and is not empty
          if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
            throw new Error(`${field.label} is required`);
          }
        }
      }

      console.log('✅ All required fields validated');

      setSubmissionProgress('Preparing form data...');
      // ✅ PERFORMANCE: Prepare form data efficiently
      const submissionFormData = new FormData();
      const textResponses = {};

      // Process form fields with consistent field naming
      formSchema.forEach(field => {
        const fieldId = generateFieldId(field);
        const value = formData[fieldId];
        
        // ✅ CRITICAL: Use field.fieldName for backend consistency
        const backendFieldName = field.fieldName || field.id || fieldId;
        
        if (field.type === 'file' || field.type === 'image') {
          // Add file to FormData if it exists
          const fileData = formData[`${fieldId}_file`];
          if (fileData) {
            submissionFormData.append(backendFieldName, fileData);
            console.log('📁 Added file to form data:', backendFieldName, fileData.name);
          }
        } else {
          // Add text data to responses object using backend field name
          textResponses[backendFieldName] = value;
          console.log('📝 Added text response:', backendFieldName, typeof value === 'string' ? value.substring(0, 50) : value);
        }
      });

      // Add text responses as JSON
      submissionFormData.append('responses', JSON.stringify(textResponses));

      setSubmissionProgress('Submitting registration...');
      // ✅ PERFORMANCE: Determine endpoint and make request
      const endpoint = isCompetitionRegistration 
        ? `${API_BASE_URL}/registrations/competitions/${competitionId}/register`
        : `${API_BASE_URL}/registrations/fests/${festId}/register`;

      console.log('🌐 Making registration request to:', endpoint);
      console.log('📊 Submission summary:', {
        textFields: Object.keys(textResponses).length,
        fileFields: Array.from(submissionFormData.keys()).filter(key => key !== 'responses').length,
        totalSize: submissionFormData.get('responses')?.length || 0
      });

      // ✅ PERFORMANCE: Use fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: submissionFormData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 Registration response:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText
      });

      if (!response.ok) {
        let errorMessage = 'Failed to submit registration';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('❌ Backend error details:', errorData);
          
          // Handle specific error cases
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (response.status === 400 && errorData.error?.includes('registration')) {
            errorMessage = `Registration error: ${errorData.error}`;
          }
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (response.status === 400) {
            errorMessage = 'Invalid registration data. Please check your form and try again.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again in a few moments.';
          }
        }
        
        throw new Error(errorMessage);
      }

      setSubmissionProgress('Processing registration...');
      const result = await response.json();
      console.log('✅ Registration successful:', result);

      setSubmissionProgress('Registration completed successfully!');
      setSuccess(true);
      // Auto redirect after 3 seconds to registered events page
      setTimeout(() => {
        navigate('/registered-fest');
      }, 3000);

    } catch (err) {
      console.error('❌ Registration error:', err);
      
      // Handle specific error types with better user feedback
      if (err.name === 'AbortError') {
        setError('Registration timed out. Please check your internet connection and try again.');
      } else if (err.message.includes('Authentication') || err.message.includes('session') || err.message.includes('token')) {
        setError('Your session has expired. Please log in again.');
        // Clear invalid tokens
        localStorage.removeItem('crwdctrl_token');
        localStorage.removeItem('crwdctrl_user');
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.message.includes('registration') && err.message.includes('not available')) {
        setError('Registration is currently not available for this event. Please contact the organizers.');
      } else if (err.message.includes('required')) {
        setError(err.message); // Field validation errors
      } else if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
      setSubmissionProgress('');
    }
  };

  const renderField = (field) => {
    // Use consistent field ID generation
    const fieldId = generateFieldId(field);
    const { type, required, options, placeholder } = field;
    const value = formData[fieldId] || ''; // Use stable fieldId
    const isUploading = uploadingFiles[fieldId]; // Use stable fieldId

    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <input
            type={type}
            value={value}
            onChange={(e) => handleInputChange(fieldId, e.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(fieldId, e.target.value)}
            placeholder={placeholder}
            required={required}
            rows={4}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white resize-none text-sm sm:text-base"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(fieldId, e.target.value)}
            required={required}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(fieldId, e.target.value)}
            required={required}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm sm:text-base"
          >
            <option value="">{placeholder || 'Select an option'}</option>
            {options?.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {options?.map((option, idx) => (
              <label key={idx} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={fieldId} // Use stable fieldId
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(fieldId, e.target.value)}
                  required={required}
                  className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                />
                <span className="text-white">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {options?.map((option, idx) => (
              <label key={idx} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  value={option}
                  checked={(value || []).includes(option)}
                  onChange={(e) => handleInputChange(fieldId, option, 'checkbox')}
                  className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 rounded focus:ring-[#0ECCEE] focus:ring-2"
                />
                <span className="text-white">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'file':
      case 'image':
        return (
          <div className="space-y-2">
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
              <input
                type="file"
                accept={type === 'image' ? 'image/*' : '*'}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // Validate file size (10MB limit)
                    const maxSize = 10 * 1024 * 1024; // 10MB
                    if (file.size > maxSize) {
                      setError('File size must be less than 10MB');
                      e.target.value = ''; // Clear the input
                      return;
                    }
                    
                    // Validate file type for images
                    if (type === 'image' && !file.type.startsWith('image/')) {
                      setError('Please select a valid image file');
                      e.target.value = ''; // Clear the input
                      return;
                    }
                    
                    handleFileUpload(file, fieldId);
                  }
                }}
                className="hidden"
                id={`file-${fieldId}`} // Use stable fieldId
                disabled={isUploading}
              />
              <label
                htmlFor={`file-${fieldId}`} // Use stable fieldId
                className={`cursor-pointer flex flex-col items-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? (
                  <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
                ) : (
                  <Upload className="w-6 h-6 text-gray-400" />
                )}
                <span className="text-sm text-gray-400">
                  {isUploading ? 'Validating...' : `Click to upload ${type}`}
                </span>
                <span className="text-xs text-gray-500">
                  Max size: 10MB {type === 'image' ? '• Images only' : ''}
                </span>
              </label>
            </div>
            {value && value.uploaded && (
              <div className="text-sm text-green-400 flex items-center gap-2">
                <span>✅ File selected: {value.fileName}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
      </div>
    );
  }

  if (!fest) {
    return (
      <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Fest Not Found</h1>
          <p className="text-gray-400 mb-6">The requested fest could not be found or may have been removed.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ✅ CRITICAL: Better registration mode validation with detailed error messages
  if (!isCompetitionRegistration && fest.registration?.mode !== 'INTERNAL_FORM') {
    return (
      <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold text-white mb-4">Registration Not Available</h1>
          <p className="text-gray-400 mb-4">
            This fest does not accept internal form registrations.
          </p>
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-yellow-300 text-sm">
              Current registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
            </p>
            <p className="text-yellow-300 text-sm mt-1">
              Expected mode: <span className="font-mono">INTERNAL_FORM</span>
            </p>
          </div>
          {fest.registration?.mode === 'EXTERNAL_LINK' && fest.registration?.externalLink && (
            <div className="mb-6">
              <p className="text-gray-400 mb-3">Registration is available via external link:</p>
              <a
                href={fest.registration.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                Register Externally
              </a>
            </div>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ✅ CRITICAL: Competition registration mode validation
  if (isCompetitionRegistration) {
    if (competition?.registrationType === 'fest' && fest.registration?.mode !== 'INTERNAL_FORM') {
      return (
        <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <h1 className="text-2xl font-bold text-white mb-4">Competition Registration Not Available</h1>
            <p className="text-gray-400 mb-4">
              This competition uses fest registration, but the fest does not accept internal form registrations.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-yellow-300 text-sm">
                Fest registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
              </p>
              <p className="text-yellow-300 text-sm mt-1">
                Expected mode: <span className="font-mono">INTERNAL_FORM</span>
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    
    if (competition?.registrationType === 'custom' && competition?.registration?.status !== 'internal_form') {
      return (
        <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <h1 className="text-2xl font-bold text-white mb-4">Competition Registration Not Available</h1>
            <p className="text-gray-400 mb-4">
              This competition has custom registration, but internal form registration is not enabled.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-yellow-300 text-sm">
                Competition registration status: <span className="font-mono">{competition?.registration?.status || 'NOT_SET'}</span>
              </p>
              <p className="text-yellow-300 text-sm mt-1">
                Expected status: <span className="font-mono">internal_form</span>
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
  }



  if (success) {
    return (
      <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">🎉 Registration Successful!</h1>
          <p className="text-gray-400 mb-6">
            Your registration for <span className="text-[#0ECCEE] font-semibold">
              {isCompetitionRegistration ? competition?.name : fest.festName}
            </span> has been submitted successfully.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You will be redirected to your registered events shortly...
          </p>
          <button
            onClick={() => navigate('/registered-fest')}
            className="px-6 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors"
          >
            View My Registrations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1B1C1E] py-2 sm:py-4">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0 mt-1"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-tight">
              Register for {isCompetitionRegistration ? competition?.name : fest.festName}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {isCompetitionRegistration 
                ? `${competition?.name} - ${fest.festName} (${fest.collegeName})`
                : fest.collegeName
              }
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 mb-4 text-sm">
            {error}
          </div>
        )}



        {/* Registration Form */}
        <div className="bg-[#2A2B2D] rounded-xl p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Form Instructions */}
            {fest.registration.formInstructions && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-blue-300 mb-1">Instructions</h3>
                    <div className="text-sm text-blue-100 whitespace-pre-wrap">
                      {fest.registration.formInstructions}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields - Organized in a grid for better layout */}
            <div className="bg-[#1B1C1E] rounded-lg p-3 sm:p-4">
              <h3 className="text-base font-semibold text-white mb-3 border-b border-gray-700 pb-2">Registration Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {fest.registration.formSchema.map((field) => {
                  const fieldId = generateFieldId(field);
                  const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image' || 
                                     field.type === 'checkbox' || field.type === 'radio';
                  
                  return (
                    <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-white mb-1.5">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment QR Code Display - Compact and organized */}
            {fest.registration.paymentQR && (
              <div className="bg-[#1B1C1E] rounded-lg p-3 sm:p-4 border-2 border-yellow-600/30">
                <h3 className="text-base font-semibold text-white mb-3 border-b border-gray-700 pb-2">Payment Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-center">
                  <div className="flex justify-center">
                    <img 
                      src={fest.registration.paymentQR} 
                      alt="Payment QR Code" 
                      className="w-32 h-32 sm:w-40 sm:h-40 object-contain rounded-lg bg-white p-2"
                    />
                  </div>
                  <div className="text-center md:text-left">
                    <div className="text-sm text-gray-300">
                      {fest.registration.paymentQRMessage ? (
                        <div className="whitespace-pre-wrap">{fest.registration.paymentQRMessage}</div>
                      ) : (
                        <p>Scan this QR code to complete your payment</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 sm:px-6 py-2.5 rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition-colors text-sm sm:text-base"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 sm:px-6 py-2.5 rounded-lg bg-[#0ECCEE] text-black font-semibold hover:bg-[#0ECCEE]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span className="hidden sm:inline">{submissionProgress || 'Submitting...'}</span>
                    <span className="sm:hidden">Submitting...</span>
                  </>
                ) : (
                  'Submit Registration'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
