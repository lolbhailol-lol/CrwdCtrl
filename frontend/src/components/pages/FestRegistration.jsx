import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function FestRegistration() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const competitionId = searchParams.get('competition');
  const { isAuthenticated, isLoading: authLoading, token: authToken, isAuthProcessing, isRedirectProcessing } = useAuth();
  const { isDark } = useDarkMode();
  
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
        isAuthProcessing,
        isRedirectProcessing,
        hasToken: !!authToken,
        hasLocalToken: !!localStorage.getItem('crwdctrl_token'),
        hasLocalUser: !!localStorage.getItem('crwdctrl_user')
      });

      // ✅ CRITICAL: Wait for ALL auth processes to finish before making decisions
      // authLoading = initial load, isAuthProcessing = Firebase restoring session, isRedirectProcessing = OAuth redirect
      if (authLoading || isAuthProcessing || isRedirectProcessing) {
        console.log('⏳ Auth still loading, waiting...', { authLoading, isAuthProcessing, isRedirectProcessing });
        return;
      }

      // ✅ FIX: Check AuthContext FIRST, then fallback to localStorage
      const localToken = localStorage.getItem('crwdctrl_token');
      const localUser = localStorage.getItem('crwdctrl_user');
      const hasAuth = isAuthenticated || !!authToken || !!localToken;
      
      // If no authentication data at all (neither context nor localStorage), redirect to login
      if (!hasAuth) {
        console.log('❌ No authentication data found, redirecting to login');
        setError('Please log in to register for events');
        // Save current URL for redirect after login
        sessionStorage.setItem('auth_redirect_url', window.location.pathname + window.location.search);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      // ✅ User is authenticated via context or localStorage, proceed
      console.log('✅ Authentication confirmed, proceeding with registration', {
        viaContext: isAuthenticated,
        viaToken: !!authToken,
        viaLocalStorage: !!localToken
      });
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
  }, [festId, competitionId, authLoading, isAuthenticated, isAuthProcessing, isRedirectProcessing]);

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
      // More robust label sanitization - avoid duplicate 'field_' prefix
      let labelToSanitize = field.label;
      if (labelToSanitize.startsWith('field_')) {
        labelToSanitize = labelToSanitize.substring(6); // Remove 'field_' prefix
      }
      return `field_${labelToSanitize.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
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
        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
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
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm resize-none transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
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
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
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
              <label key={index} className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg border transition-colors ${isDark ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'}`}>
                <input
                  type="radio"
                  name={fieldId}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onFieldChange(fieldId, e.target.value)}
                  required={field.required}
                  className={`w-4 h-4 text-[#0ECCEE] focus:ring-[#0ECCEE] focus:ring-2 ${isDark ? 'bg-[#2A2B2D] border-gray-600' : 'bg-white border-gray-300'}`}
                />
                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{option}</span>
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
                <label key={index} className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg border transition-colors ${isDark ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'}`}>
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
                    className={`w-4 h-4 text-[#0ECCEE] rounded focus:ring-[#0ECCEE] focus:ring-2 ${isDark ? 'bg-[#2A2B2D] border-gray-600' : 'bg-white border-gray-300'}`}
                  />
                  <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{option}</span>
                </label>
              );
            })}
          </div>
        );
      
      case 'date': {
        // Validate and sanitize date value - only allow YYYY-MM-DD format
        let sanitizedValue = value;
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          console.warn(`⚠️ Invalid date value for field "${field.label}": "${value}", resetting to empty`);
          sanitizedValue = '';
        }
        return (
          <input
            type="date"
            id={fieldId}
            name={fieldId}
            value={sanitizedValue}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            required={field.required}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
          />
        );
      }
      
      case 'file':
      case 'image':
        return (
          <div className="space-y-2">
            <input
              type="file"
              id={fieldId}
              name={fieldId}
              data-field-id={fieldId}
              accept={field.type === 'image' ? 'image/*' : '*/*'}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  handleFileUpload(file, fieldId);
                }
              }}
              required={field.required}
              className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[#0ECCEE] file:text-black hover:file:bg-[#0ECCEE]/80 transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
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
      
      case 'group':
        // Group field type - allows multiple entries with sub-fields
        const groupEntries = Array.isArray(value) ? value : [];
        
        return (
          <div className="space-y-4">
            {groupEntries.map((entry, entryIndex) => (
              <div key={`group-entry-${fieldId}-${entryIndex}`} className={`p-4 rounded-lg border ${isDark ? 'bg-[#1B1C1E] border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[#0ECCEE]">Entry {entryIndex + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      // Remove entry inline
                      const newEntries = groupEntries.filter((_, i) => i !== entryIndex);
                      onFieldChange(fieldId, newEntries);
                    }}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <span>×</span> Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {field.subFields?.map((subField, subIndex) => {
                    // Use subField.fieldName if available, otherwise fall back to label-based name or index
                    const actualFieldName = subField.fieldName || subField.label?.replace(/\s+/g, '_').toLowerCase() || `subfield_${subIndex}`;
                    const subFieldKey = `${fieldId}-${entryIndex}-${actualFieldName}-${subIndex}`;
                    const subFieldValue = entry?.[actualFieldName] ?? '';
                    
                    // Handle select/dropdown type for subfields
                    if (subField.type === 'select' || subField.type === 'competition_dropdown') {
                      // Get options - either from competitions or from subField.options
                      let selectOptions = [];
                      if (subField.optionsSource === 'competitions' || subField.type === 'competition_dropdown') {
                        // Get competitions from fest data
                        const allCompetitions = [];
                        if (fest?.competitions) {
                          Object.values(fest.competitions).forEach(categoryComps => {
                            if (Array.isArray(categoryComps)) {
                              allCompetitions.push(...categoryComps);
                            }
                          });
                        }
                        selectOptions = allCompetitions.map(comp => ({
                          value: comp._id || comp.id,
                          label: comp.name || comp.title
                        }));
                      } else if (subField.options) {
                        selectOptions = subField.options.map(opt => 
                          typeof opt === 'string' ? { value: opt, label: opt } : opt
                        );
                      }
                      
                      return (
                        <div key={subFieldKey}>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {subField.label}
                            {subField.required && <span className="text-red-400 ml-1">*</span>}
                          </label>
                          <select
                            id={subFieldKey}
                            name={subFieldKey}
                            value={subFieldValue}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              const newEntries = groupEntries.map((ent, idx) => {
                                if (idx === entryIndex) {
                                  return {
                                    ...ent,
                                    [actualFieldName]: newValue
                                  };
                                }
                                return { ...ent };
                              });
                              onFieldChange(fieldId, newEntries);
                            }}
                            required={subField.required}
                            className={`w-full px-3 py-2 rounded-lg border focus:border-[#0ECCEE] focus:outline-none text-sm ${isDark ? 'bg-[#2A2B2D] border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                          >
                            <option value="">{subField.placeholder || `Select ${subField.label}`}</option>
                            {selectOptions.map((opt, optIdx) => (
                              <option key={optIdx} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={subFieldKey}>
                        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {subField.label}
                          {subField.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <input
                          id={subFieldKey}
                          name={subFieldKey}
                          type={subField.type || 'text'}
                          placeholder={subField.placeholder}
                          value={subFieldValue}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            // Update entry inline with proper cloning
                            const newEntries = groupEntries.map((ent, idx) => {
                              if (idx === entryIndex) {
                                return {
                                  ...ent,
                                  [actualFieldName]: newValue
                                };
                              }
                              return { ...ent };
                            });
                            onFieldChange(fieldId, newEntries);
                          }}
                          required={subField.required}
                          className={`w-full px-3 py-2 rounded-lg border focus:border-[#0ECCEE] focus:outline-none text-sm ${isDark ? 'bg-[#2A2B2D] border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                // Add entry inline with proper field names
                const newEntry = {};
                field.subFields?.forEach((subField, subIndex) => {
                  const actualFieldName = subField.fieldName || subField.label?.replace(/\s+/g, '_').toLowerCase() || `subfield_${subIndex}`;
                  newEntry[actualFieldName] = '';
                });
                onFieldChange(fieldId, [...groupEntries, newEntry]);
              }}
              className={`w-full py-2 px-4 border-2 border-dashed hover:border-[#0ECCEE] rounded-lg hover:text-[#0ECCEE] transition-colors text-sm flex items-center justify-center gap-2 ${isDark ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}
            >
              <span>+</span> Add {field.label || 'Entry'}
            </button>
            {field.required && groupEntries.length === 0 && (
              <p className="text-xs text-yellow-400">At least one entry is required</p>
            )}
          </div>
        );
      
      case 'category_competition_selector': {
        // Cascading selector: first select category, then competition from that category
        const currentValue = typeof value === 'object' ? value : { category: '', competition: '' };
        
        // Use manually defined categoryOptions from the field configuration
        const categoryOptions = field.categoryOptions || [];
        
        const selectedCategory = currentValue.category || '';
        const selectedCategoryData = categoryOptions.find(cat => cat.categoryName === selectedCategory);
        const competitionsInCategory = selectedCategoryData?.competitions || [];
        
        return (
          <div className="space-y-4">
            {/* Category Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Select Category
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <select
                id={`${fieldId}-category`}
                name={`${fieldId}-category`}
                value={selectedCategory}
                onChange={(e) => {
                  // When category changes, reset competition selection
                  onFieldChange(fieldId, { category: e.target.value, competition: '' });
                }}
                required={field.required}
                className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
              >
                <option value="">-- Select a Category --</option>
                {categoryOptions.map((cat, index) => (
                  <option key={index} value={cat.categoryName}>
                    {cat.categoryName} ({cat.competitions?.length || 0})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Competition Selection - only show if category is selected */}
            {selectedCategory && competitionsInCategory.length > 0 && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Competition
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <select
                  id={`${fieldId}-competition`}
                  name={`${fieldId}-competition`}
                  value={currentValue.competition || ''}
                  onChange={(e) => {
                    onFieldChange(fieldId, { ...currentValue, competition: e.target.value });
                  }}
                  required={field.required}
                  className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
                >
                  <option value="">-- Select a Competition --</option>
                  {competitionsInCategory.map((comp, index) => (
                    <option key={index} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {selectedCategory && competitionsInCategory.length === 0 && (
              <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                No competitions available in this category.
              </p>
            )}
            
            {categoryOptions.length === 0 && (
              <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                No categories configured. Please contact the administrator.
              </p>
            )}
          </div>
        );
      }
      
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
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#2A2B2D] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
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
        credentials: 'omit', // ✅ iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
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
          // Initialize fields based on type
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else if (field.type === 'checkbox') {
            initialData[fieldId] = [];
          } else if (field.type === 'category_competition_selector') {
            initialData[fieldId] = { category: '', competition: '' };
          } else if (field.type === 'group') {
            initialData[fieldId] = [];
          } else {
            initialData[fieldId] = '';
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
        credentials: 'omit', // ✅ iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
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
        credentials: 'omit', // ✅ iOS/Safari fix - no credentials for public API
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
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
          // Initialize fields based on type
          if (field.type === 'file' || field.type === 'image') {
            initialData[fieldId] = null;
          } else if (field.type === 'checkbox') {
            initialData[fieldId] = [];
          } else if (field.type === 'category_competition_selector') {
            initialData[fieldId] = { category: '', competition: '' };
          } else if (field.type === 'group') {
            initialData[fieldId] = [];
          } else {
            initialData[fieldId] = '';
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
          'Authorization': `Bearer ${authToken || localStorage.getItem('crwdctrl_token')}`
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
    const formSubmissionStartTime = Date.now(); // Track submission time for error reporting
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
          } else if (field.type === 'category_competition_selector') {
            if (!value || typeof value !== 'object' || !value.category || !value.competition) {
              setError(`${field.label} is required - please select both category and competition`);
              return;
            }
          } else if (field.type === 'group') {
            if (!value || !Array.isArray(value) || value.length === 0) {
              setError(`${field.label} is required - please add at least one entry`);
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
        } else if (field.type === 'category_competition_selector') {
          if (!value || typeof value !== 'object' || !value.category || !value.competition) {
            setError(`${field.label} is required - please select both category and competition`);
            return;
          }
        } else if (field.type === 'group') {
          if (!value || !Array.isArray(value) || value.length === 0) {
            setError(`${field.label} is required - please add at least one entry`);
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
      // ✅ FIX: Use authToken from context FIRST, fallback to localStorage
      const token = authToken || localStorage.getItem('crwdctrl_token');
      const user = localStorage.getItem('crwdctrl_user');
      
      // ✅ NEW: Get all form data once at the beginning (single-step or combined multi-step)
      const allFormData = getAllFormData();
      
      console.log('🔑 Auth check for submission:', { 
        hasToken: !!token, 
        hasUser: !!user,
        tokenSource: authToken ? 'context' : 'localStorage',
        tokenLength: token?.length 
      });
      
      if (!token) {
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
        } else if (field.type === 'category_competition_selector') {
          // For category_competition_selector, check both category AND competition are selected
          if (!value || typeof value !== 'object' || !value.category || !value.competition) {
            throw new Error(`${field.label} is required - please select both category and competition`);
          }
        } else if (field.type === 'group') {
          // For group fields, check if at least one entry exists
          if (!value || !Array.isArray(value) || value.length === 0) {
            throw new Error(`${field.label} is required - please add at least one entry`);
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
          
          // Debug: Check what we have
          console.log('🔍 FILE DEBUG:', {
            fieldId,
            fieldLabel: field.label,
            hasFileData: !!fileData,
            fileDataType: typeof fileData,
            isFile: fileData instanceof File,
            isBlob: fileData instanceof Blob,
            fileDataSize: fileData?.size || 'N/A',
            fileDataName: fileData?.name || 'N/A'
          });
          
          if (fileData && fileData.size > 0) {
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
            console.log('⚠️ No valid file found for field:', {
              fieldId,
              label: field.label,
              lookingForKey: `${fieldId}_file`,
              hasFileData: !!fileData,
              fileSize: fileData?.size,
              allFormDataKeys: Object.keys(allFormData),
              allFormDataFileKeys: Object.keys(allFormData).filter(k => k.includes('_file'))
            });
            
            // ✅ FALLBACK: Try to get file from DOM input element
            try {
              const fileInput = document.querySelector(`input[data-field-id="${fieldId}"]`);
              if (fileInput?.files?.length > 0) {
                const file = fileInput.files[0];
                console.log('✅ FALLBACK: Found file in DOM:', {
                  fieldId,
                  fileName: file.name,
                  fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
                });
                submissionFormData.append(backendFieldName, file);
                totalFileSize += file.size;
                fileCount++;
              }
            } catch (error) {
              console.log('ℹ️ No fallback file input found for:', fieldId, error?.message);
            }
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
      console.log('� [DEBUG] Submission details:', {
        endpoint: endpoint,
        isCompetition: isCompetitionRegistration,
        competitionId: competitionId,
        festId: festId,
        hasCompetitionId: !!competitionId,
        competitionIdType: typeof competitionId,
        competitionIdLength: competitionId?.length,
        competitionIdValue: competitionId
      });
      console.log('�📊 Submission summary:', {
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
      // Base timeout: 120s - allowing time for server processing and slow connections
      // Backend responds with registration ID immediately, files upload in background
      // File uploads happen in background on server after response is sent to user
      const baseTimeout = 120000; // 120 seconds - reasonable timeout for production stability
      const controller = new AbortController();
      
      // ✅ PERFORMANCE: Track upload progress (define BEFORE fetch so it's available in error handler)
      const startTime = Date.now();
      
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Aborting request after ${(baseTimeout / 1000).toFixed(0)}s timeout`);
        controller.abort();
      }, baseTimeout);

      console.log(`⏱️ Request timeout: ${(baseTimeout / 1000).toFixed(0)}s (backend responds immediately, files upload in background)`);

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
        const elapsedTime = ((Date.now() - formSubmissionStartTime) / 1000).toFixed(1);
        console.error('❌ Request was aborted/timed out after', elapsedTime, 'seconds');
        console.log('ℹ️ Registration may have been saved on the server. Checking registered events...');
        setError('Registration is taking longer than expected. Your submission may have been saved. Please check your registered events in a moment. Contact support if needed.');
        // Don't prevent navigation - allow user to check registered events
        setTimeout(() => navigate('/registered-fest'), 3000);
      } else if (err.message.includes('Authentication') || err.message.includes('session') || err.message.includes('token')) {
        setError('Your session has expired. Please log in again.');
        // Clear invalid tokens
        localStorage.removeItem('crwdctrl_token');
        localStorage.removeItem('crwdctrl_user');
        // Save current URL for redirect after login
        sessionStorage.setItem('auth_redirect_url', window.location.pathname + window.location.search);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
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
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
      </div>
    );
  }

  if (!fest) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Fest Not Found</h1>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>The requested fest could not be found or may have been removed.</p>
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
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Registration Not Available</h1>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            This fest does not accept internal form registrations.
          </p>
          <div className={`rounded-lg p-4 mb-6 border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}`}>
            <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              Current registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              Expected mode: <span className="font-mono">INTERNAL_FORM</span>
            </p>
          </div>
          {fest.registration?.mode === 'EXTERNAL_LINK' && fest.registration?.externalLink && (
            <div className="mb-6">
              <p className={`mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Registration is available via external link:</p>
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
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
          <div className="text-center max-w-md mx-auto p-6">
            <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Competition Registration Not Available</h1>
            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              This competition uses fest registration, but the fest does not accept internal form registrations.
            </p>
            <div className={`rounded-lg p-4 mb-6 border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}`}>
              <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Fest registration mode: <span className="font-mono">{fest.registration?.mode || 'NOT_SET'}</span>
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
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
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
          <div className="text-center max-w-md mx-auto p-6">
            <h1 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Competition Registration Not Available</h1>
            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              This competition has custom registration, but internal form registration is not enabled.
            </p>
            <div className={`rounded-lg p-4 mb-6 border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-300'}`}>
              <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Competition registration status: <span className="font-mono">{competition?.registration?.status || 'NOT_SET'}</span>
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
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
    console.log('🎉 SUCCESS PAGE - Fest data:', fest);
    console.log('🎉 SUCCESS PAGE - WhatsApp link check:', {
      hasFest: !!fest,
      hasRegistration: !!fest?.registration,
      whatsappLink: fest?.registration?.whatsappCommunityLink,
      linkType: typeof fest?.registration?.whatsappCommunityLink,
      linkLength: fest?.registration?.whatsappCommunityLink?.length
    });
    
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>🎉 Registration Successful!</h1>
          <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Your registration for <span className="text-[#0ECCEE] font-semibold">
              {isCompetitionRegistration ? competition?.name : fest.festName}
            </span> has been submitted successfully.
          </p>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            You will be redirected to your registered events shortly...
          </p>

          {/* WhatsApp Group Link */}
          {fest?.registration?.whatsappCommunityLink && (
            <div className={`rounded-lg p-4 mb-6 border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-300'}`}>
              <p className={`text-sm mb-3 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                Join to know about the event updates, timings and schedule
              </p>
              <a
                href={fest.registration.whatsappCommunityLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Join WhatsApp Community
              </a>
            </div>
          )}

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
    <div className={`min-h-screen py-2 sm:py-4 pb-40 sm:pb-32 md:pb-20 ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 mt-1 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
          >
            <ArrowLeft className={`w-5 h-5 sm:w-6 sm:h-6 ${isDark ? 'text-white' : 'text-gray-900'}`} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Register for {isCompetitionRegistration ? competition?.name : fest.festName}
            </h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {isCompetitionRegistration 
                ? `${competition?.name} - ${fest.festName} (${fest.collegeName})`
                : fest.collegeName
              }
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`rounded-lg p-3 mb-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
            {error}
          </div>
        )}



        {/* Registration Form */}
        <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-[#2A2B2D]' : 'bg-white shadow-sm'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Form Instructions */}
            {fest.registration.formInstructions && (
              <div className={`rounded-lg p-3 sm:p-4 border ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-300'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <div>
                    <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Instructions</h3>
                    <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-blue-100' : 'text-blue-600'}`}>
                      {fest.registration.formInstructions}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ NEW: Multi-Step Progress Indicator */}
            {isMultiStepForm() && (
              <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</h3>
                  <div className="text-right">
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {currentStep} of {getTotalSteps()}</span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
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
                            : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {completedSteps.has(step.stepNumber) ? '✓' : step.stepNumber}
                      </div>
                      <span className={`text-xs mt-1 text-center max-w-16 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
                            : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {completedSteps.has(fest.registration.steps.length + 1) ? '✓' : '💳'}
                      </div>
                      <span className={`text-xs mt-1 text-center max-w-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Payment
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ NEW: Current Step Title and Description */}
            {isMultiStepForm() && (
              <div className={`rounded-lg p-4 ${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-50'}`}>
                {/* Step title and description */}
                {currentStep <= fest.registration.steps.length ? (
                  // Regular form step
                  <>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepTitle}
                    </h3>
                    {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription && (
                      <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {fest.registration.steps.find(s => s.stepNumber === currentStep)?.stepDescription}
                      </p>
                    )}
                  </>
                ) : (
                  // Payment step
                  <>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Payment
                    </h3>
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
              <div className={`rounded-lg p-3 sm:p-4 ${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-50'}`}>
                <h3 className={`text-base font-semibold mb-3 pb-2 border-b ${isDark ? 'text-white border-gray-700' : 'text-gray-900 border-gray-200'}`}>Registration Details</h3>
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
              <div className={`rounded-lg p-3 sm:p-4 border-2 ${isDark ? 'bg-[#1B1C1E] border-yellow-600/30' : 'bg-gray-50 border-yellow-400/50'}`}>
                <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Information</h3>
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
                    <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {fest.registration.paymentQRMessage ? (
                        <div className="whitespace-pre-wrap">{fest.registration.paymentQRMessage}</div>
                      ) : (
                        <p>Scan this QR code to complete your payment</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ✅ NEW: Payment Receipt Upload Section */}
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
                              : isDark ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-800/70' : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
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
                                <Upload className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                <p className={`mb-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                  <span className="font-semibold">Click to upload</span> payment receipt
                                </p>
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PNG, JPG or PDF (Max 5MB)</p>
                              </>
                            )}
                          </div>
                          <input 
                            id="payment-receipt-upload" 
                            type="file" 
                            data-field-id="payment-receipt"
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
                        <div className={`text-sm rounded-lg p-2 border ${isDark ? 'text-red-400 bg-red-900/20 border-red-800' : 'text-red-600 bg-red-50 border-red-300'}`}>
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
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
                          className={`text-sm underline ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
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
                            className={`max-w-full max-h-32 object-contain rounded-lg border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* ✅ NEW: Transaction ID Input - Always Visible Below Upload */}
                  {paymentReceiptUrl && (
                    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Transaction ID <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Enter transaction ID from payment (e.g., UPI ref, bank ref, etc.)"
                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE] ${isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                      />
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>This helps us verify your payment</p>
                    </div>
                  )}
                  
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Please upload a clear image or PDF of your payment receipt/screenshot after completing the payment.
                  </p>
                </div>
              </div>
            )}

            {/* WhatsApp Community Link - Show after payment section */}
            {fest?.registration?.whatsappCommunityLink && fest.registration.paymentQR && (
              !isMultiStepForm() || (isMultiStepForm() && currentStep > fest.registration.steps.length)
            ) && (
              <div className={`rounded-lg p-4 border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-300'}`}>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#25D366' }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <div className="flex-1">
                    <h4 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Join Our WhatsApp Community
                    </h4>
                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      Join to know about the event updates, timings and schedule
                    </p>
                    <a
                      href={fest.registration.whatsappCommunityLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      Join Community
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ NEW: Multi-Step Form Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 pb-44 md:pb-32">
              {/* Back Button */}
              <button
                type="button"
                onClick={isMultiStepForm() && currentStep > 1 ? handleStepBack : () => navigate(-1)}
                className={`px-4 sm:px-6 py-2.5 rounded-lg border transition-colors text-sm sm:text-base ${isDark ? 'border-gray-700 text-white hover:bg-gray-800' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}
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
                        <div className={`rounded-full h-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
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
