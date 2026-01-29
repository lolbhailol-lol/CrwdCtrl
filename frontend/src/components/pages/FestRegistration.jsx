import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function FestRegistration() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const competitionId = searchParams.get('competition');
  const { isAuthenticated, isLoading: authLoading, token: authToken } = useAuth();
  
  const [fest, setFest] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});
  // ✅ NEW: Payment receipt upload state
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  // ✅ NEW: Transaction ID state
  const [transactionId, setTransactionId] = useState('');
  // ✅ NEW: Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [stepData, setStepData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festId, competitionId]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Helper function to generate consistent field IDs
  const generateFieldId = (field) => {
    // Priority 1: use fieldName directly (this is what backend expects)
    if (field.fieldName) return field.fieldName;
    // Priority 2: use field.id directly (without field_ prefix)
    if (field.id) return field.id;
    // Priority 3: generate from label as fallback
    if (field.label) {
      // More robust label sanitization
      return `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
    }
    return 'unknown_field';
  };

  // ✅ NEW: Multi-step form helper functions
  const isMultiStepForm = () => {
    return fest?.registration?.formType === 'MULTI_STEP' && fest?.registration?.steps?.length > 0;
  };

  const getCurrentStepFields = () => {
    if (!isMultiStepForm()) {
      return fest?.registration?.formSchema || [];
    }
    
    // ✅ NEW: If this is the payment step (last step with QR), return empty fields
    const baseSteps = fest.registration.steps.length;
    const isPaymentStep = fest.registration.paymentQR && currentStep > baseSteps;
    
    if (isPaymentStep) {
      return []; // Payment step has no form fields
    }
    
    const step = fest.registration.steps.find(s => s.stepNumber === currentStep);
    return step?.fields || [];
  };

  const getTotalSteps = () => {
    if (!isMultiStepForm()) return 1;
    
    // ✅ NEW: Add +1 for dedicated payment step if QR is configured
    const baseSteps = fest.registration.steps.length;
    const hasPaymentStep = fest.registration.paymentQR;
    
    return hasPaymentStep ? baseSteps + 1 : baseSteps;
  };

  const getCurrentStepData = () => {
    if (!isMultiStepForm()) {
      return formData;
    }
    return stepData[currentStep] || {};
  };

  const validateCurrentStep = () => {
    const currentFields = getCurrentStepFields();
    const currentData = getCurrentStepData();
    
    console.log('🔍 DEBUG - validateCurrentStep:', {
      currentFields: currentFields.map(f => ({ label: f.label, required: f.required, fieldName: f.fieldName })),
      currentData,
      currentStep
    });
    
    if (currentFields.length === 0) {
      // No fields to validate, skip validation for this step
      return true;
    }
    for (const field of currentFields) {
      if (field.required) {
        const fieldId = generateFieldId(field);
        const value = currentData[fieldId];
        console.log('🔍 Validating required field:', { fieldId, value, hasValue: !!value });
        
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          setError(`Please fill in the required field: ${field.label}`);
          console.log('❌ Validation failed for field:', field.label);
          return false;
        }
      }
    }

    console.log('✅ Step validation passed');
    return true;
  };

  const handleStepNext = () => {
    console.log('🔍 DEBUG - handleStepNext called:', {
      currentStep,
      totalSteps: getTotalSteps(),
      isValid: validateCurrentStep(),
      currentFields: getCurrentStepFields(),
      currentData: getCurrentStepData()
    });
    
    if (!validateCurrentStep()) {
      console.log('❌ Step validation failed, not proceeding to next step');
      return;
    }
    
    // Save current step data
    if (isMultiStepForm()) {
      setStepData(prev => ({
        ...prev,
        [currentStep]: getCurrentStepData()
      }));
      setCompletedSteps(prev => new Set([...prev, currentStep]));
    }
    
    if (currentStep < getTotalSteps()) {
      console.log('✅ Moving to next step:', currentStep + 1);
      setCurrentStep(prev => prev + 1);
      setError(''); // Clear any errors
    }
  };

  const handleStepBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      setError(''); // Clear any errors
    }
  };

  const handleStepFieldChange = (fieldId, value) => {
    if (isMultiStepForm()) {
      setStepData(prev => ({
        ...prev,
        [currentStep]: {
          ...prev[currentStep],
          [fieldId]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [fieldId]: value
      }));
    }
  };

  const getAllFormData = () => {
    if (!isMultiStepForm()) {
      console.log('🔍 Single-step form data:', formData);
      return formData;
    }
    
    // Combine all step data - THIS IS CRITICAL FOR MULTI-STEP FORMS
    const allData = {};
    
    // First, merge all completed steps
    Object.entries(stepData).forEach(([stepNum, stepFormData]) => {
      console.log(`🔍 Merging step ${stepNum} data:`, stepFormData);
      Object.assign(allData, stepFormData);
    });
    
    // Then, include current step data (in case it hasn't been saved yet)
    const currentStepData = getCurrentStepData();
    console.log(`🔍 Current step ${currentStep} data:`, currentStepData);
    Object.assign(allData, currentStepData);
    
    console.log('🔍 Multi-step combined data:', {
      stepDataKeys: Object.keys(stepData),
      currentStep,
      allDataKeys: Object.keys(allData),
      fileKeys: Object.keys(allData).filter(key => key.includes('_file')),
      allData
    });
    
    return allData;
  };

  // ✅ NEW: Render form field function (extracted for reuse)
  const renderFormField = (field, fieldId, currentData, onFieldChange) => {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white mb-1.5">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <div className="relative">
          {renderField(field, fieldId, currentData, onFieldChange)}
        </div>
      </div>
    );
  };

  // ✅ NEW: Render individual field based on type
  const renderField = (field, fieldId, currentData, onFieldChange) => {
    const value = currentData[fieldId] || '';
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <input
            type={field.type}
            id={fieldId}
            name={fieldId}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 rounded-lg bg-[#2A2B2D] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white placeholder-gray-400 text-sm transition-colors"
          />
        );
      
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            name={fieldId}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-[#2A2B2D] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white placeholder-gray-400 text-sm resize-none transition-colors"
          />
        );
      
      case 'select':
        return (
          <select
            id={fieldId}
            name={fieldId}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 rounded-lg bg-[#2A2B2D] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white text-sm transition-colors"
          >
            <option value="">Select an option</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg border border-gray-600 hover:border-gray-500 hover:bg-gray-800/30 transition-colors">
                <input
                  type="radio"
                  name={fieldId}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onFieldChange(fieldId, e.target.value)}
                  required={field.required}
                  className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-600 focus:ring-[#0ECCEE] focus:ring-2"
                />
                <span className="text-sm text-white">{option}</span>
              </label>
            ))}
          </div>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const isChecked = Array.isArray(value) ? value.includes(option) : false;
              return (
                <label key={index} className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg border border-gray-600 hover:border-gray-500 hover:bg-gray-800/30 transition-colors">
                  <input
                    type="checkbox"
                    value={option}
                    checked={isChecked}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      if (e.target.checked) {
                        onFieldChange(fieldId, [...currentValues, option]);
                      } else {
                        onFieldChange(fieldId, currentValues.filter(v => v !== option));
                      }
                    }}
                    className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-600 rounded focus:ring-[#0ECCEE] focus:ring-2"
                  />
                  <span className="text-sm text-white">{option}</span>
                </label>
              );
            })}
          </div>
        );
      
      case 'date':
        return (
          <input
            type="date"
            id={fieldId}
            name={fieldId}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 rounded-lg bg-[#2A2B2D] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white text-sm transition-colors"
          />
        );
      
      case 'file':
      case 'image':
        return (
          <div className="space-y-2">
            <input
              type="file"
              id={fieldId}
              name={fieldId}
              accept={field.type === 'image' ? 'image/*' : '*/*'}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  handleFileUpload(file, fieldId);
                }
              }}
              required={field.required}
              className="w-full px-3 py-2.5 rounded-lg bg-[#2A2B2D] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[#0ECCEE] file:text-black hover:file:bg-[#0ECCEE]/80 transition-colors"
            />
            {uploadingFiles[fieldId] && (
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader className="w-4 h-4 animate-spin" />
                Processing...
              </div>
            )}
            {value && value.ready && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                ✓ File ready: {value.fileName}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <input
            type="text"
            id={fieldId}
            name={fieldId}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 rounded-lg bg-[#2A2B2D] border-2 border-gray-600 hover:border-gray-500 focus:border-[#0ECCEE] focus:outline-none text-white placeholder-gray-400 text-sm transition-colors"
          />
        );
    }
  };



  const fetchFestDetails = async () => {
    try {
      console.log('📡 Fetching fest details for:', festId);
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`${API_BASE_URL}/fests/${festId}/public?_cb=${cacheBuster}`, {
        credentials: 'include',
        mode: 'cors'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const data = await response.json();
      console.log('🔍 DEBUG - Raw API response:', data);
      console.log('🔍 DEBUG - Raw registration data:', data.registration);
      console.log('🔍 DEBUG - Raw steps data:', data.registration?.steps);
      
      // ✅ CRITICAL: Validate registration mode immediately
      if (data.registration?.mode !== 'INTERNAL_FORM') {
        console.error('❌ Invalid registration mode:', data.registration?.mode);
        setError(`Registration is not available. Mode: ${data.registration?.mode || 'NOT_SET'}`);
        setLoading(false);
        return;
      }
      
      setFest(data);
      console.log('🔍 DEBUG - Fest registration data loaded:', {
        mode: data.registration?.mode,
        formType: data.registration?.formType,
        formSchemaLength: data.registration?.formSchema?.length,
        stepsLength: data.registration?.steps?.length,
        steps: data.registration?.steps?.map(step => ({
          stepNumber: step.stepNumber,
          stepTitle: step.stepTitle,
          fieldsCount: step.fields?.length
        })),
        fullStepsData: data.registration?.steps
      });

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
      const competitionResponse = await fetch(`${API_BASE_URL}/fests/competitions/${competitionId}/public`, {
        credentials: 'include',
        mode: 'cors'
      });
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
      const cacheBuster = Date.now();
      const festResponse = await fetch(`${API_BASE_URL}/fests/${festId}/public?_cb=${cacheBuster}`, {
        credentials: 'include',
        mode: 'cors'
      });
      if (!festResponse.ok) {
        throw new Error('Failed to fetch fest details');
      }
      const festData = await festResponse.json();
      console.log('🔍 DEBUG - Raw fest API response:', festData);
      console.log('🔍 DEBUG - Raw fest registration data:', festData.registration);
      console.log('🔍 DEBUG - Raw fest steps data:', festData.registration?.steps);
      
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
      console.log('🔍 DEBUG - Competition fest registration data loaded:', {
        mode: festData.registration?.mode,
        formType: festData.registration?.formType,
        formSchemaLength: festData.registration?.formSchema?.length,
        stepsLength: festData.registration?.steps?.length,
        steps: festData.registration?.steps?.map(step => ({
          stepNumber: step.stepNumber,
          stepTitle: step.stepTitle,
          fieldsCount: step.fields?.length
        }))
      });

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

  const handleFileUpload = async (file, fieldId) => {
    if (!file) {
      setError('No file selected. Please upload a file.');
      return;
    }

    console.log('📁 Starting file upload for field:', fieldId, 'File:', file.name);

    setUploadingFiles(prev => ({
      ...prev,
      [fieldId]: true
    }));

    try {
      // ✅ PERFORMANCE: Quick validation first
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setError(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.`);
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Allowed types: JPEG, PNG, GIF, PDF');
        return;
      }

      // ✅ PERFORMANCE: Compress images if they're large
      let processedFile = file;
      if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) { // 2MB threshold
        console.log('🗜️ Compressing large image:', file.name);
        try {
          processedFile = await compressImage(file);
          console.log('✅ Image compressed:', {
            original: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            compressed: `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`,
            reduction: `${(((file.size - processedFile.size) / file.size) * 100).toFixed(1)}%`
          });
        } catch (compressionError) {
          console.warn('⚠️ Image compression failed, using original:', compressionError);
          processedFile = file;
        }
      }

      console.log('✅ File validated:', {
        name: processedFile.name,
        size: `${(processedFile.size / 1024 / 1024).toFixed(2)}MB`,
        type: processedFile.type,
        fieldId: fieldId
      });

      // ✅ PERFORMANCE FIX: Store file immediately without uploading
      // Upload will happen during form submission to avoid blocking UI
      const fileInfo = { 
        uploaded: true, 
        fileName: processedFile.name,
        fileSize: processedFile.size,
        fileType: processedFile.type,
        ready: true // Mark as ready for submission
      };
      
      if (isMultiStepForm()) {
        // For multi-step forms, use step-specific data handling
        setStepData(prev => ({
          ...prev,
          [currentStep]: {
            ...prev[currentStep],
            [`${fieldId}_file`]: processedFile, // Store actual file
            [fieldId]: fileInfo
          }
        }));
      } else {
        // For single-step forms, use formData directly
        setFormData(prev => ({
          ...prev,
          [`${fieldId}_file`]: processedFile, // Store actual file
          [fieldId]: fileInfo
        }));
      }
      
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

  // ✅ PERFORMANCE: Image compression function
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1920x1080)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          file.type,
          0.8 // 80% quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  // ✅ NEW: Payment receipt upload function
  const handlePaymentReceiptUpload = async (file) => {
    if (!file) return;

    console.log('💳 Starting payment receipt upload:', file.name);
    setUploadingReceipt(true);
    setReceiptError('');

    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a valid image (JPG, PNG) or PDF file');
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size must be less than 5MB');
      }

      // Compress image if it's an image file
      let processedFile = file;
      if (file.type.startsWith('image/')) {
        try {
          processedFile = await compressImage(file);
          console.log('🗜️ Receipt image compressed:', {
            original: file.size,
            compressed: processedFile.size,
            reduction: Math.round((1 - processedFile.size / file.size) * 100) + '%'
          });
        } catch (compressionError) {
          console.warn('⚠️ Image compression failed, using original:', compressionError);
          processedFile = file;
        }
      }

      // Upload to backend
      const formData = new FormData();
      formData.append('image', processedFile);

      const response = await fetch(`${API_BASE_URL}/users/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('crwdctrl_token')}`
          // Don't set Content-Type - let browser set it with boundary for FormData
        },
        body: formData,
        credentials: 'include', // ✅ FIX: Include cookies for production
        mode: 'cors' // ✅ FIX: Enable CORS for production
      });

      console.log('📤 Upload response status:', response.status);
      console.log('📤 Upload response headers:', {
        contentType: response.headers.get('content-type'),
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          // Error handled - continue
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.message || 'Failed to upload receipt');
      }

      const result = await response.json();
      const uploadedUrl = result.url || result.imageUrl;

      if (!uploadedUrl) {
        throw new Error('Upload successful but no URL returned');
      }

      setPaymentReceiptUrl(uploadedUrl);
      setPaymentReceipt(processedFile);
      console.log('✅ Payment receipt uploaded successfully:', uploadedUrl);

    } catch (error) {
      console.error('❌ Payment receipt upload error:', error);
      setReceiptError(error.message || 'Failed to upload payment receipt');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Starting form submission...');
    console.log('🔍 DEBUG - Form submission state:', {
      isMultiStep: isMultiStepForm(),
      currentStep,
      totalSteps: getTotalSteps(),
      isNotFinalStep: currentStep < getTotalSteps(),
      submitting
    });
    
    // ✅ PERFORMANCE: Prevent double submission
    if (submitting) {
      console.log('⚠️ Submission already in progress, ignoring duplicate request');
      return;
    }
    
    // Validate only current step's required fields for multi-step forms
    if (isMultiStepForm()) {
      const currentFields = getCurrentStepFields();
      const currentData = getCurrentStepData();
      for (const field of currentFields) {
        if (field.required) {
          const fieldId = generateFieldId(field);
          const value = currentData[fieldId];
          if (field.type === 'file' || field.type === 'image') {
            if (!value || !value.ready || !formData[`${fieldId}_file`]) {
              setError(`${field.label} is required - please upload a file`);
              return;
            }
          } else if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
            setError(`${field.label} is required`);
            return;
          }
        }
      }
    } else {
      // Single-step form: validate all required fields
      const allFormData = getAllFormData();
      const formSchema = fest.registration?.formSchema || [];
      const requiredFields = formSchema.filter(field => field.required);
      for (const field of requiredFields) {
        const fieldId = generateFieldId(field);
        const value = allFormData[fieldId];
        if (field.type === 'file' || field.type === 'image') {
          if (!value || !value.ready || !formData[`${fieldId}_file`]) {
            setError(`${field.label} is required - please upload a file`);
            return;
          }
        } else if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
          setError(`${field.label} is required`);
          return;
        }
      }
    }

    // ✅ NEW: For multi-step forms, validate current step first
    if (isMultiStepForm() && currentStep < getTotalSteps()) {
      console.log('📝 Multi-step form: Moving to next step instead of submitting');
      // This is not the final step, just go to next step
      handleStepNext();
      return;
    }
    
    console.log('📤 Final step reached, proceeding with actual submission');
    // ✅ NEW: Final validation for multi-step forms
    if (isMultiStepForm() && !validateCurrentStep()) {
      return;
    }

    console.log('✅ All required fields validated');
    
    setSubmitting(true);
    setError('');

    try {
      setSubmissionProgress('Validating authentication...');
      // ✅ CRITICAL: Use localStorage token directly, don't rely on context
      const token = localStorage.getItem('crwdctrl_token');
      const user = localStorage.getItem('crwdctrl_user');
      
      // ✅ NEW: Get all form data once at the beginning (single-step or combined multi-step)
      const allFormData = getAllFormData();
      
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
      // ✅ NEW: Get all form data (single-step or combined multi-step)
      // allFormData already obtained at line 841 for single-step or will be obtained below
      
      console.log('🔍 Form validation starting:', {
        isMultiStep: isMultiStepForm(),
        currentStep,
        allFormDataKeys: Object.keys(allFormData),
        fileKeys: Object.keys(allFormData).filter(key => key.includes('_file'))
      });
      
      // ✅ PERFORMANCE: Validate required fields with better field matching
      const formSchema = isMultiStepForm() 
        ? fest.registration.steps.flatMap(step => step.fields)
        : fest.registration?.formSchema || [];
      const requiredFields = formSchema.filter(field => field.required);
      
      console.log('🔍 Form schema fields:', formSchema.map(field => ({
        id: field.id,
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        generatedId: generateFieldId(field)
      })));
      
      console.log('🔍 Validating', requiredFields.length, 'required fields...');
      
      for (const field of requiredFields) {
        const fieldId = generateFieldId(field);
        const value = allFormData[fieldId];
        
        console.log('🔍 Checking field:', { 
          fieldId, 
          label: field.label, 
          type: field.type, 
          hasValue: !!value,
          valueType: typeof value,
          hasFileData: !!(field.type === 'file' || field.type === 'image') && !!allFormData[`${fieldId}_file`],
          isReady: value?.ready,
          fieldValue: value,
          fileKey: `${fieldId}_file`,
          fileData: allFormData[`${fieldId}_file`],
          allFormDataKeys: Object.keys(allFormData).filter(key => key.includes(fieldId))
        });
        
        // For file/image fields, check if file was selected and is ready
        if (field.type === 'file' || field.type === 'image') {
          console.log('🔍 File field validation:', {
            fieldId,
            label: field.label,
            hasValue: !!value,
            valueReady: value?.ready,
            hasFileData: !!allFormData[`${fieldId}_file`],
            fileDataType: typeof allFormData[`${fieldId}_file`]
          });
          
          if (!value || !value.ready || !allFormData[`${fieldId}_file`]) {
            console.error('❌ File validation failed:', {
              fieldId,
              label: field.label,
              value,
              fileData: allFormData[`${fieldId}_file`],
              allFormDataKeys: Object.keys(allFormData)
            });
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

      // ✅ NEW: Validate payment receipt only on the final payment step
      const totalSteps = getTotalSteps();
      const hasPaymentQR = fest.registration.paymentQR;
      const isOnPaymentStep = isMultiStepForm() && hasPaymentQR && currentStep === totalSteps;
      
      console.log('💳 Payment validation check:', {
        hasPaymentQR,
        totalSteps,
        currentStep,
        isOnPaymentStep,
        hasPaymentReceiptUrl: !!paymentReceiptUrl,
        hasTransactionId: !!transactionId.trim()
      });
      
      // Only require payment receipt and transaction ID on the final payment step
      if (isOnPaymentStep) {
        if (!paymentReceiptUrl) {
          console.error('❌ Payment receipt missing on payment step');
          throw new Error('Payment receipt is required. Please upload your payment proof after scanning the QR code.');
        }
        if (!transactionId.trim()) {
          console.error('❌ Transaction ID missing on payment step');
          throw new Error('Transaction ID is required. Please enter your payment reference number.');
        }
      }

      setSubmissionProgress('Preparing form data...');
      // ✅ PERFORMANCE: Prepare form data efficiently
      const submissionFormData = new FormData();
      const textResponses = {};
      let totalFileSize = 0;
      let fileCount = 0;

      // Debug: Log all available form data and files
      console.log('🔍 DEBUG - All Form Data Keys:', Object.keys(allFormData));
      console.log('🔍 DEBUG - File Keys:', Object.keys(allFormData).filter(key => key.includes('_file')));
      console.log('🔍 DEBUG - Full allFormData:', allFormData);

      // formSchema already defined above for validation purposes

      // Process form fields with consistent field naming
      console.log('🔍 PROCESSING FIELDS - Starting:', {
        formSchemaLength: formSchema.length,
        allFormDataKeys: Object.keys(allFormData),
        fileFieldsInSchema: formSchema.filter(f => f.type === 'file' || f.type === 'image').map(f => ({
          label: f.label,
          fieldId: generateFieldId(f),
          lookingFor: `${generateFieldId(f)}_file`
        }))
      });
      
      formSchema.forEach(field => {
        const fieldId = generateFieldId(field);
        const value = allFormData[fieldId];
        
        // ✅ CRITICAL: Use the same field identifier for backend consistency
        // This should match what generateFieldId returns
        const backendFieldName = generateFieldId(field);
        
        if (field.type === 'file' || field.type === 'image') {
          // Add file to FormData if it exists
          const fileData = allFormData[`${fieldId}_file`];
          if (fileData) {
            submissionFormData.append(backendFieldName, fileData);
            const fileSizeInMB = (fileData.size / 1024 / 1024).toFixed(2);
            totalFileSize += fileData.size;
            fileCount++;
            console.log('📁 Added file to form data:', {
              fieldName: backendFieldName,
              fileName: fileData.name,
              fileSize: `${fileSizeInMB}MB`,
              actualSize: fileData.size,
              totalFileSize: `${(totalFileSize / 1024 / 1024).toFixed(2)}MB`
            });
          } else {
            console.log('⚠️ No file found for field:', {
              fieldId,
              label: field.label,
              lookingForKey: `${fieldId}_file`,
              allFormDataKeys: Object.keys(allFormData),
              allFormDataFileKeys: Object.keys(allFormData).filter(k => k.includes('_file'))
            });
          }
        } else {
          // Add text data to responses object using backend field name
          textResponses[backendFieldName] = value;
          console.log('📝 Added text response:', backendFieldName, typeof value === 'string' ? value.substring(0, 50) : value);
        }
      });

      // Add text responses as JSON
      submissionFormData.append('responses', JSON.stringify(textResponses));

      // ✅ NEW: Add transaction ID if available
      if (transactionId && transactionId.trim()) {
        submissionFormData.append('transactionId', transactionId.trim());
        console.log('💳 Added transaction ID to submission:', transactionId);
      } else {
        console.log('⚠️ No transaction ID provided');
      }

      // ✅ NEW: Add payment receipt URL if uploaded
      if (paymentReceiptUrl) {
        submissionFormData.append('paymentReceiptUrl', paymentReceiptUrl);
        console.log('💳 Added payment receipt URL to submission:', paymentReceiptUrl);
        console.log('💳 FormData now contains paymentReceiptUrl');
      } else {
        console.log('⚠️ No payment receipt URL to add to submission');
      }

      // ✅ PERFORMANCE: Show file submission progress
      if (fileCount > 0) {
        setSubmissionProgress(`Submitting ${fileCount} file(s) (${(totalFileSize / 1024 / 1024).toFixed(2)}MB)...`);
      } else {
        setSubmissionProgress('Submitting registration...');
      }
      // ✅ PERFORMANCE: Pre-validate files before submission
      const maxTotalSize = 50 * 1024 * 1024; // 50MB total limit
      if (totalFileSize > maxTotalSize) {
        throw new Error(`Total file size (${(totalFileSize / 1024 / 1024).toFixed(2)}MB) exceeds limit of 50MB. Please reduce file sizes.`);
      }

      // ✅ PERFORMANCE: Determine endpoint and make request
      const endpoint = isCompetitionRegistration 
        ? `${API_BASE_URL}/registrations/competitions/${competitionId}/register`
        : `${API_BASE_URL}/registrations/fests/${festId}/register`;

      console.log('🌐 Making registration request to:', endpoint);
      console.log('📊 Submission summary:', {
        textFields: Object.keys(textResponses).length,
        fileFields: fileCount,
        totalFileSize: `${(totalFileSize / 1024 / 1024).toFixed(2)}MB`,
        estimatedUploadTime: `${Math.ceil(totalFileSize / (1024 * 1024))}s`
      });


      // ✅ PERFORMANCE: Dynamic timeout based on file size
      // Base timeout: 90s (enough for backend file processing and response)
      // Plus additional time for file upload: 30s per MB
      // Backend will continue sending emails in background after response
      
      console.log('🔍 BEFORE TIMEOUT CALCULATION:', {
        totalFileSize: totalFileSize,
        totalFileSizeInMB: (totalFileSize / 1024 / 1024).toFixed(2),
        fileCount: fileCount,
        formSchemaLength: formSchema.length,
        allFormDataKeys: Object.keys(allFormData).length,
        allFormDataFileKeys: Object.keys(allFormData).filter(k => k.includes('_file')),
        isMultiStep: isMultiStepForm()
      });
      
      // ✅ OPTIMIZED: Backend now responds IMMEDIATELY (files upload in background)
      // Base timeout: 30s - server responds within seconds of receiving data
      // This is for network latency + server response time only
      // File uploads happen in background on server after response is sent to user
      const baseTimeout = 30000; // 30 seconds - backend responds immediately now
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Aborting request after ${(baseTimeout / 1000).toFixed(0)}s timeout`);
        controller.abort();
      }, baseTimeout);

      console.log(`⏱️ Optimized timeout: ${(baseTimeout / 1000).toFixed(0)}s (backend responds immediately, files upload in background)`);

      // ✅ PERFORMANCE: Track upload progress
      const startTime = Date.now();

      console.log('🌐 Making fetch request to:', endpoint);
      console.log('📤 FormData size:', submissionFormData.size || 'unknown');
      console.log('🔑 Authorization header present:', !!token);

      // ✅ PRODUCTION FIX: Show user that submission is in progress (don't timeout on their end)
      setSubmissionProgress('Submitting registration to server... (instant response)');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: submissionFormData,
        signal: controller.signal,
        credentials: 'include', // ✅ FIX: Include cookies for production auth
        mode: 'cors', // ✅ FIX: Enable CORS for production domains
      });

      clearTimeout(timeoutId);
      const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('📡 Registration response received:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText,
        uploadTime: `${uploadTime}s`,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        let errorMessage = 'Failed to submit registration';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('❌ Backend error details:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            endpoint: endpoint,
            timestamp: new Date().toISOString()
          });
          
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
      console.error('❌ Error name:', err.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      
      // Handle specific error types with better user feedback
      if (err.name === 'AbortError') {
        console.error('❌ Request was aborted/timed out after', ((Date.now() - startTime) / 1000).toFixed(1), 'seconds');
        console.log('ℹ️ Registration may have been saved on the server. Checking registered events...');
        setError('Registration is taking longer than expected. Your submission may have been saved. Please check your registered events in a moment. Contact support if needed.');
        // Don't prevent navigation - allow user to check registered events
        setTimeout(() => navigate('/registered-fest'), 3000);
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

  // Helper function for handling input changes (for single-step forms)
  const _handleInputChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
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
    <div className="min-h-screen bg-[#1B1C1E] py-2 sm:py-4 pb-40 sm:pb-32 md:pb-20">
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

            {/* ✅ NEW: Multi-Step Progress Indicator */}
            {isMultiStepForm() && (
              <div className="bg-[#1B1C1E] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Progress</h3>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Step {currentStep} of {getTotalSteps()}</span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                  <div 
                    className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / getTotalSteps()) * 100}%` }}
                  ></div>
                </div>
                
                {/* Step Indicators */}
                <div className="flex justify-between">
                  {/* Regular form steps */}
                  {fest.registration.steps.map((step) => (
                    <div key={step.stepNumber} className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        step.stepNumber === currentStep 
                          ? 'bg-[#0ECCEE] text-black' 
                          : completedSteps.has(step.stepNumber)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 text-gray-300'
                      }`}>
                        {completedSteps.has(step.stepNumber) ? '✓' : step.stepNumber}
                      </div>
                      <span className="text-xs text-gray-400 mt-1 text-center max-w-16 truncate">
                        {step.stepTitle}
                      </span>
                    </div>
                  ))}
                  
                  {/* Payment step indicator (if QR is configured) */}
                  {fest.registration.paymentQR && (
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        currentStep > fest.registration.steps.length
                          ? 'bg-[#0ECCEE] text-black' 
                          : completedSteps.has(fest.registration.steps.length + 1)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 text-gray-300'
                      }`}>
                        {completedSteps.has(fest.registration.steps.length + 1) ? '✓' : '💳'}
                      </div>
                      <span className="text-xs text-gray-400 mt-1 text-center max-w-16">
                        Payment
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ NEW: Current Step Title and Description */}
            {isMultiStepForm() && (
              <div className="bg-[#1B1C1E] rounded-lg p-4">
                {/* Step title and description */}
                {currentStep <= fest.registration.steps.length ? (
                  // Regular form step
                  <>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepTitle}
                    </h3>
                    {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription && (
                      <p className="text-sm text-gray-400 mb-4">
                        {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription}
                      </p>
                    )}
                  </>
                ) : (
                  // Payment step
                  <>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Payment
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Complete your payment to finalize your registration
                    </p>
                  </>
                )}
                
                {/* Current Step Fields - Only show if not payment step */}
                {currentStep <= fest.registration.steps.length && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {(() => {
                      const currentFields = getCurrentStepFields();
                      console.log('🔍 Current step fields:', currentFields);
                      console.log('🔍 Current step:', currentStep);
                      console.log('🔍 Total steps:', getTotalSteps());
                      
                      return currentFields.map((field) => {
                      const fieldId = generateFieldId(field);
                      const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image' || 
                                         field.type === 'checkbox' || field.type === 'radio';
                      
                      return (
                        <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                          {renderFormField(field, fieldId, getCurrentStepData(), handleStepFieldChange)}
                        </div>
                      );
                    });
                  })()}
                  </div>
                )}
              </div>
            )}

            {/* ✅ EXISTING: Single Step Form Fields */}
            {!isMultiStepForm() && (
              <div className="bg-[#1B1C1E] rounded-lg p-3 sm:p-4">
                <h3 className="text-base font-semibold text-white mb-3 border-b border-gray-700 pb-2">Registration Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {(() => {
                    const formFields = fest.registration.formSchema;
                    
                    return formFields.map((field) => {
                      const fieldId = generateFieldId(field);
                      const isFullWidth = field.type === 'textarea' || field.type === 'file' || field.type === 'image' || 
                                         field.type === 'checkbox' || field.type === 'radio';
                      
                      return (
                        <div key={fieldId} className={isFullWidth ? 'md:col-span-2' : ''}>
                          {renderFormField(field, fieldId, formData, (fieldId, value) => setFormData(prev => ({ ...prev, [fieldId]: value })))}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Payment QR Code Display - Only on dedicated payment step for multi-step forms */}
            {fest.registration.paymentQR && (
              !isMultiStepForm() || 
              (isMultiStepForm() && currentStep > fest.registration.steps.length)
            ) && (
              <div className="bg-[#1B1C1E] rounded-lg p-3 sm:p-4 border-2 border-yellow-600/30">
                <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
                  <h3 className="text-base font-semibold text-white">Payment Information</h3>
                </div>
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

                {/* ✅ NEW: Payment Receipt Upload Section */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Payment Receipt <span className="text-red-400">*</span>
                  </h4>
                  
                  {!paymentReceiptUrl ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center w-full">
                        <label 
                          htmlFor="payment-receipt-upload" 
                          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                            uploadingReceipt 
                              ? 'border-blue-400 bg-blue-900/20' 
                              : 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-800/70'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploadingReceipt ? (
                              <>
                                <Loader className="w-8 h-8 mb-2 text-blue-400 animate-spin" />
                                <p className="text-sm text-blue-400">Uploading receipt...</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                <p className="mb-2 text-sm text-gray-300">
                                  <span className="font-semibold">Click to upload</span> payment receipt
                                </p>
                                <p className="text-xs text-gray-400">PNG, JPG or PDF (Max 5MB)</p>
                              </>
                            )}
                          </div>
                          <input 
                            id="payment-receipt-upload" 
                            type="file" 
                            className="hidden" 
                            accept="image/jpeg,image/jpg,image/png,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                handlePaymentReceiptUpload(file);
                              }
                            }}
                            disabled={uploadingReceipt}
                          />
                        </label>
                      </div>
                      
                      {receiptError && (
                        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-2">
                          {receiptError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-green-400 font-medium">Payment receipt uploaded successfully</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {paymentReceipt?.name} ({(paymentReceipt?.size / 1024 / 1024).toFixed(2)}MB)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentReceiptUrl('');
                            setPaymentReceipt(null);
                            setReceiptError('');
                          }}
                          className="text-gray-400 hover:text-white text-sm underline"
                        >
                          Change
                        </button>
                      </div>
                      
                      {/* Preview for images */}
                      {paymentReceipt?.type.startsWith('image/') && (
                        <div className="flex justify-center">
                          <img 
                            src={paymentReceiptUrl} 
                            alt="Payment receipt preview" 
                            className="max-w-full max-h-32 object-contain rounded-lg border border-gray-600"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* ✅ NEW: Transaction ID Input - Always Visible Below Upload */}
                  {paymentReceiptUrl && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <label className="block text-sm font-semibold text-white mb-2">
                        Transaction ID <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Enter transaction ID from payment (e.g., UPI ref, bank ref, etc.)"
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]"
                      />
                      <p className="text-xs text-gray-400 mt-1">This helps us verify your payment</p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-400 mt-2">
                    Please upload a clear image or PDF of your payment receipt/screenshot after completing the payment.
                  </p>
                </div>
              </div>
            )}

            {/* ✅ NEW: Multi-Step Form Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 pb-44 md:pb-32">
              {/* Back Button */}
              <button
                type="button"
                onClick={isMultiStepForm() && currentStep > 1 ? handleStepBack : () => navigate(-1)}
                className="px-4 sm:px-6 py-2.5 rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition-colors text-sm sm:text-base"
                disabled={submitting}
              >
                {isMultiStepForm() && currentStep > 1 ? 'Previous Step' : 'Cancel'}
              </button>
              
              {/* Next/Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 sm:px-6 py-2.5 rounded-lg bg-[#0ECCEE] text-black font-semibold hover:bg-[#0ECCEE]/90 transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span className="hidden sm:inline">{submissionProgress || 'Submitting...'}</span>
                    <span className="sm:hidden">Submitting...</span>
                    
                    {/* Progress indicator */}
                    {submissionProgress && (
                      <div className="w-full mt-2">
                        <div className="bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="bg-[#0ECCEE] h-1.5 rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: submissionProgress.includes('Validating') ? '20%' :
                                     submissionProgress.includes('Preparing') ? '40%' :
                                     submissionProgress.includes('Submitting') ? '70%' :
                                     submissionProgress.includes('Processing') ? '90%' :
                                     submissionProgress.includes('completed') ? '100%' : '10%'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (() => {
                  console.log('🔍 DEBUG - Button text logic:', {
                    isMultiStep: isMultiStepForm(),
                    currentStep,
                    totalSteps: getTotalSteps(),
                    baseSteps: fest.registration.steps?.length || 0,
                    isNotFinalStep: currentStep < getTotalSteps(),
                    shouldShowNextStep: isMultiStepForm() && currentStep < getTotalSteps(),
                    hasPaymentQR: !!fest.registration.paymentQR,
                    isPaymentStep: isMultiStepForm() && fest.registration.paymentQR && currentStep > (fest.registration.steps?.length || 0)
                  });
                  
                  if (isMultiStepForm() && currentStep < getTotalSteps()) {
                    // Check if next step is payment step
                    const nextStepIsPayment = fest.registration.paymentQR && currentStep === (fest.registration.steps?.length || 0);
                    return nextStepIsPayment ? 'Continue to Payment' : 'Next Step';
                  }
                  
                  // Final step
                  const isPaymentStep = isMultiStepForm() && fest.registration.paymentQR && currentStep > (fest.registration.steps?.length || 0);
                  return isPaymentStep ? 'Complete Payment & Registration' : 'Submit Registration';
                })()}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
