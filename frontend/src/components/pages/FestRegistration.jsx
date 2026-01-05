import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function FestRegistration() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const competitionId = searchParams.get('competition');
  const { isAuthenticated, apiCall, isLoading: authLoading, user, token } = useAuth(); // Get user and token for debugging
  
  const [fest, setFest] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});

  const isCompetitionRegistration = !!competitionId;



  useEffect(() => {
    const initializeRegistration = async () => {
      // Wait for auth context to fully load
      if (authLoading) {
        return;
      }

      // Check authentication with fallback to localStorage
      const localToken = localStorage.getItem('crwdctrl_token');
      
      if (!isAuthenticated && !localToken) {
        setError('Please log in to register for events');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // If we have a local token but context isn't authenticated yet, give it more time
      if (!isAuthenticated && localToken) {
        // Set a timeout for auth context to catch up
        setTimeout(() => {
          proceedWithRegistration();
        }, 1000);
        return;
      }

      // User is authenticated, proceed with registration
      proceedWithRegistration();
    };

    const proceedWithRegistration = () => {
      if (isCompetitionRegistration) {
        fetchCompetitionAndFestDetails();
      } else {
        fetchFestDetails();
      }
    };

    initializeRegistration();
  }, [festId, competitionId, isAuthenticated, authLoading, isCompetitionRegistration, navigate, token]);

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
      const response = await fetch(`/api/fests/${festId}/public`);
      if (!response.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const data = await response.json();
      setFest(data);

      // Initialize form data with empty values using stable field IDs
      const initialData = {};
      if (data.registration?.formSchema) {
        data.registration.formSchema.forEach(field => {
          const fieldId = generateFieldId(field);
          // Initialize file/image fields as null, others as empty string/array
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else {
            initialData[fieldId] = field.type === 'checkbox' ? [] : '';
          }
        });
      }
      setFormData(initialData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionAndFestDetails = async () => {
    try {
      // Fetch competition details first
      const competitionResponse = await fetch(`/api/fests/competitions/${competitionId}/public`);
      if (!competitionResponse.ok) {
        throw new Error('Failed to fetch competition details');
      }
      const competitionData = await competitionResponse.json();
      setCompetition(competitionData);

      // Fetch fest details
      const festResponse = await fetch(`/api/fests/${festId}/public`);
      if (!festResponse.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const festData = await festResponse.json();
      setFest(festData);

      // Initialize form data with empty values using stable field IDs
      const initialData = {};
      if (festData.registration?.formSchema) {
        festData.registration.formSchema.forEach(field => {
          const fieldId = generateFieldId(field);
          // Initialize file/image fields as null, others as empty string/array
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else {
            initialData[fieldId] = field.type === 'checkbox' ? [] : '';
          }
        });
      }
      setFormData(initialData);
    } catch (err) {
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

      console.log('File validated:', {
        name: file.name,
        size: file.size,
        type: file.type,
        fieldId: fieldId
      });

      // Store file for later upload during form submission
      setFormData(prev => ({
        ...prev,
        [`${fieldId}_file`]: file, // Store actual file
        [fieldId]: { uploaded: true, fileName: file.name } // Store upload status
      }));
      
      console.log('File prepared for upload:', fieldId);
    } catch (err) {
      console.error('File validation error:', err);
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
    setSubmitting(true);
    setError('');

    try {
      // Debug authentication before submission
      const authToken = token || localStorage.getItem('crwdctrl_token');
      if (!authToken || !isAuthenticated) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Validate required fields - try multiple field ID strategies
      const formSchema = fest.registration?.formSchema || [];
      const requiredFields = formSchema.filter(field => field.required);
      
      for (const field of requiredFields) {
        // Try multiple field ID generation strategies
        const possibleFieldIds = [
          field.id,
          field.fieldName,
          `field_${field.id}`, // This should match what we see in form data
          generateFieldId(field),
          `field_${field.label?.toLowerCase().replace(/\s+/g, '_')}`,
          field.label?.toLowerCase().replace(/\s+/g, '_'),
          field.label
        ].filter(Boolean); // Remove null/undefined values
        
        let value = null;
        let matchedFieldId = null;
        
        // Try to find the value using any of the possible field IDs
        for (const fieldId of possibleFieldIds) {
          if (formData.hasOwnProperty(fieldId)) {
            value = formData[fieldId];
            matchedFieldId = fieldId;
            break;
          }
        }
        
        // For file/image fields, check if file was selected
        if (field.type === 'file' || field.type === 'image') {
          if (!value || !value.uploaded) {
            throw new Error(`${field.label} is required - please upload a file`);
          }
        } else {
          // For other fields, check if value exists and is not empty
          if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
            throw new Error(`${field.label} is required`);
          }
        }
      }

      // Prepare form data for submission with files
      const submissionFormData = new FormData();
      const textResponses = {};

      // Map form data from stable field IDs to fieldName keys for backend
      formSchema.forEach(field => {
        const fieldId = generateFieldId(field);
        const value = formData[fieldId];
        
        if (field.type === 'file' || field.type === 'image') {
          // Add file to FormData if it exists
          const fileData = formData[`${fieldId}_file`];
          if (fileData) {
            submissionFormData.append(field.fieldName, fileData);
            console.log('Added file to form data:', field.fieldName, fileData.name);
          }
        } else {
          // Add text data to responses object
          textResponses[field.fieldName] = value;
        }
      });

      // Add text responses as JSON
      submissionFormData.append('responses', JSON.stringify(textResponses));

      // Determine the registration endpoint based on whether it's competition or fest registration
      const endpoint = isCompetitionRegistration 
        ? `/api/registrations/competitions/${competitionId}/register`
        : `/api/registrations/fests/${festId}/register`;

      console.log('Making registration request to:', endpoint);
      console.log('Text responses:', textResponses);

      // Use direct fetch with FormData for file uploads
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: submissionFormData,
      });

      console.log('Registration response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to submit registration';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('Backend error details:', errorData);
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
          // Try to get text response if JSON parsing fails
          try {
            const textError = await response.text();
            console.error('Raw error response:', textError);
            if (textError) errorMessage = textError;
          } catch (textError) {
            console.error('Could not get text response either:', textError);
          }
        }
        
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Registration successful:', result);

      setSuccess(true);
      // Auto redirect after 3 seconds to registered events page
      setTimeout(() => {
        navigate('/registered-fest');
      }, 3000);

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
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

  if (fest.registration?.mode !== 'INTERNAL_FORM' && !isCompetitionRegistration) {
    return (
      <div className="min-h-screen bg-[#1B1C1E] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Registration Not Available</h1>
          <p className="text-gray-400 mb-6">This fest does not accept internal form registrations.</p>
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
                    Submitting...
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