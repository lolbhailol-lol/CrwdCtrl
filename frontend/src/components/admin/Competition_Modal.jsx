import { useEffect, useState, useCallback } from 'react';
import { X, Plus, Edit2, Trash2, ChevronRight, ChevronLeft, Upload, Loader } from 'lucide-react';

// Configure API base URL - Use Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
console.log('🔧 Competition_Modal - API_BASE_URL:', API_BASE_URL);

// Individual Form Field Component to prevent state sharing
const FormFieldEditor = ({ field, index, onUpdate, onRemove, onAddOption, onUpdateOption, onRemoveOption }) => {
  const handleInputChange = (fieldName, value) => {
    onUpdate(index, fieldName, value);
  };

  return (
    <div className="bg-[#2A2B2D] p-4 rounded-lg space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Field {index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-300"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Field Label"
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.label || ''}
          onChange={(e) => handleInputChange('label', e.target.value)}
        />
        <input
          type="text"
          placeholder="Field Name (no spaces)"
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.fieldName || ''}
          onChange={(e) => handleInputChange('fieldName', e.target.value.replace(/\s+/g, '_').toLowerCase())}
        />
        <select
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.type || 'text'}
          onChange={(e) => handleInputChange('type', e.target.value)}
        >
          <option value="text">Text</option>
          <option value="email">Email</option>
          <option value="tel">Phone Number</option>
          <option value="number">Number</option>
          <option value="textarea">Textarea</option>
          <option value="select">Select Dropdown</option>
          <option value="radio">Radio Buttons</option>
          <option value="checkbox">Checkbox</option>
          <option value="date">Date</option>
          <option value="file">File Upload</option>
          <option value="image">Image Upload</option>
        </select>
        <input
          type="text"
          placeholder="Placeholder text"
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.placeholder || ''}
          onChange={(e) => handleInputChange('placeholder', e.target.value)}
        />
      </div>

      <div className="flex items-center space-x-3">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={(e) => handleInputChange('required', e.target.checked)}
            className="w-4 h-4 text-[#0ECCEE] bg-[#1B1C1E] border-gray-700 rounded focus:ring-[#0ECCEE] focus:ring-2"
          />
          <span className="text-sm">Required Field</span>
        </label>
      </div>

      {/* Options for select, radio, checkbox */}
      {(['select', 'radio', 'checkbox'].includes(field.type)) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Options</label>
            <button
              type="button"
              onClick={() => onAddOption(index)}
              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors"
            >
              Add Option
            </button>
          </div>
          {field.options?.map((option, optionIndex) => (
            <div key={`${field.id}-option-${optionIndex}`} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Option ${optionIndex + 1}`}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                value={option || ''}
                onChange={(e) => onUpdateOption(index, optionIndex, e.target.value)}
              />
              <button
                type="button"
                onClick={() => onRemoveOption(index, optionIndex)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Step Field Editor Component for Multi-Step Forms
const StepFieldEditor = ({ field, stepIndex, fieldIndex, onUpdate, onRemove, onAddOption, onUpdateOption, onRemoveOption }) => {
  const handleInputChange = (fieldName, value) => {
    onUpdate(stepIndex, fieldIndex, fieldName, value);
  };

  return (
    <div className="bg-[#2A2B2D] p-4 rounded-lg space-y-3 ml-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Field {fieldIndex + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(stepIndex, fieldIndex)}
          className="text-red-400 hover:text-red-300"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Field Label"
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.label || ''}
          onChange={(e) => handleInputChange('label', e.target.value)}
        />
        <input
          type="text"
          placeholder="Field Name (no spaces)"
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.fieldName || ''}
          onChange={(e) => handleInputChange('fieldName', e.target.value.replace(/\s+/g, '_').toLowerCase())}
        />
        <select
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.type || 'text'}
          onChange={(e) => handleInputChange('type', e.target.value)}
        >
          <option value="text">Text</option>
          <option value="email">Email</option>
          <option value="tel">Phone Number</option>
          <option value="number">Number</option>
          <option value="textarea">Textarea</option>
          <option value="select">Select Dropdown</option>
          <option value="radio">Radio Buttons</option>
          <option value="checkbox">Checkbox</option>
          <option value="date">Date</option>
          <option value="file">File Upload</option>
          <option value="image">Image Upload</option>
        </select>
        <input
          type="text"
          placeholder="Placeholder text"
          className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={field.placeholder || ''}
          onChange={(e) => handleInputChange('placeholder', e.target.value)}
        />
      </div>

      <div className="flex items-center space-x-3">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={(e) => handleInputChange('required', e.target.checked)}
            className="w-4 h-4 text-[#0ECCEE] bg-[#1B1C1E] border-gray-700 rounded focus:ring-[#0ECCEE] focus:ring-2"
          />
          <span className="text-sm">Required Field</span>
        </label>
      </div>

      {/* Options for select, radio, checkbox */}
      {(['select', 'radio', 'checkbox'].includes(field.type)) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Options</label>
            <button
              type="button"
              onClick={() => onAddOption(stepIndex, fieldIndex)}
              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors"
            >
              Add Option
            </button>
          </div>
          {field.options?.map((option, optionIndex) => (
            <div key={`${field.id}-option-${optionIndex}`} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Option ${optionIndex + 1}`}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                value={option || ''}
                onChange={(e) => onUpdateOption(stepIndex, fieldIndex, optionIndex, e.target.value)}
              />
              <button
                type="button"
                onClick={() => onRemoveOption(stepIndex, fieldIndex, optionIndex)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function CompetitionModal({ fest, onClose }) {
  const [competitions, setCompetitions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [error, setError] = useState('');

  const fetchCompetitions = useCallback(async () => {
    try {
      console.log('Frontend - Fetching competitions for fest:', fest._id);
      const adminToken = localStorage.getItem('admin_token');
      
      if (!adminToken) {
        console.error('❌ No admin token found in localStorage');
        setError('Authentication expired. Please log in again.');
        // Redirect to admin login
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch(`${API_BASE_URL}/admin/fests/${fest._id}/competitions`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      console.log('Frontend - Fetch competitions response status:', response.status);

      if (response.status === 401) {
        console.error('❌ Admin token expired or invalid');
        localStorage.removeItem('admin_token');
        setError('Authentication expired. Please log in again.');
        // Redirect to admin login
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 1500);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch competitions');

      const data = await response.json();
      console.log('Frontend - Competitions data received:', data);
      setCompetitions(data.competitions || []);
    } catch (err) {
      console.error('Error fetching competitions:', err);
      setError(err.message || 'Failed to fetch competitions');
    }
  }, [fest._id]);

  useEffect(() => {
    if (fest?._id) {
      fetchCompetitions();
    }
  }, [fest, fetchCompetitions]);

  const deleteCompetition = async (id) => {
    if (!window.confirm('Are you sure you want to delete this competition?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/competitions/${id}`, {
        method: 'DELETE',
      headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete competition');

      fetchCompetitions();
    } catch (err) {
      console.error('Error deleting competition:', err);
      alert('Failed to delete competition');
    }
  };

  if (showForm) {
    return (
      <CompetitionForm
        fest={fest}
        competition={selectedCompetition}
        onClose={() => {
          setShowForm(false);
          setSelectedCompetition(null);
        }}
        onSaved={() => {
          fetchCompetitions();
          setShowForm(false);
          setSelectedCompetition(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1B1C1E] rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1B1C1E] border-b border-gray-800 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">Competitions - {fest?.festName}</h3>
            <p className="text-sm text-gray-400 mt-1">Manage competitions for this fest</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedCompetition(null);
                setShowForm(true);
              }}
              className="px-4 py-2 bg-[#0ECCEE] text-black rounded-lg font-semibold hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              Add Competition
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 mb-4">
              {error}
            </div>
          )}

          {competitions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No competitions yet. Add your first competition!
            </div>
          ) : (
            <div className="space-y-4">
              {competitions.map((comp) => (
                <div
                  key={comp._id}
                  className="bg-[#2A2B2D] rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold mb-2">{comp.name}</h4>
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{comp.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span>Type: <span className="text-white capitalize">{comp.competitionType}</span></span>
                        <span>Venue: <span className="text-white">{comp.venue}</span></span>
                        <span>Fee: <span className="text-white">₹{comp.registrationFee || 0}</span></span>
                        {comp.startTime && (
                          <span>Start: <span className="text-white">{new Date(comp.startTime).toLocaleString()}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedCompetition(comp);
                          setShowForm(true);
                        }}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteCompetition(comp._id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Competition Form Component with Multi-Step Wizard
function CompetitionForm({ fest, competition, onClose, onSaved }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    subtitle: '',
    description: '',
    competitionType: 'other',
    category: 'OTHER',
    prizePool: '',
    registrationFee: '',
    registrationLink: '',
    registrationType: 'fest', // 'fest' or 'custom'
    registration: {
      status: 'not_started', // 'not_started', 'external_link', 'internal_form', 'registration_closed'
      externalUrl: '',
      googleSheetsUrl: '',
      formType: 'SINGLE_STEP', // SINGLE_STEP | MULTI_STEP
      formSchema: [], // For single step forms
      steps: [], // For multi-step forms
      qrCode: '',
      qrCodeMessage: '',
      confirmationEmail: '',
      settings: {
        allowMultipleRegistrations: true,
        requireEmailVerification: false,
        autoConfirmation: true,
        maxRegistrations: null,
        registrationDeadline: null
      }
    },
    // Legacy registration for backward compatibility
    legacyRegistration: {
      status: 'NOT_STARTED'
    },
    dateTime: '',
    venue: '',
    commonRules: [],
    commonRulesMessage: '',
    competitionPhotos: [],
    rounds: [],
    contact: {
      name: '',
      phone: '',
      email: '',
      instagram: ''
    }
  });
  const [ruleInput, setRuleInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Add error boundary to catch any rendering errors
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
      if (error) {
        const timer = setTimeout(() => setError(''), 5000);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.error('Error in error timeout effect:', err);
      setHasError(true);
    }
  }, [error]);

  useEffect(() => {
    try {
      if (competition) {
        console.log('Competition_Modal - Editing competition:', competition);
        console.log('Competition_Modal - commonRulesMessage from competition:', competition.commonRulesMessage);
        console.log('Competition_Modal - rounds from competition:', competition.rounds);
        console.log('Competition_Modal - rounds detailed:', competition.rounds?.map(r => ({
          title: r.title,
          roundRulesMessage: r.roundRulesMessage,
          hasRoundRulesMessage: Object.prototype.hasOwnProperty.call(r, 'roundRulesMessage')
        })));
        
        // Safely extract form data with proper fallbacks
        const formData = {
          name: competition.name || '',
          subtitle: competition.subtitle || '',
          description: competition.description || '',
          competitionType: competition.competitionType || 'other',
          category: competition.category || 'OTHER',
          prizePool: competition.prizePool ? competition.prizePool.toString() : '',
          registrationFee: competition.registrationFee || '',
          registrationLink: competition.registrationLink || '',
          registrationType: competition.registrationType || 'fest',
          registration: {
            status: competition.registration?.status || 'not_started',
            externalUrl: competition.registration?.externalUrl || '',
            googleSheetsUrl: competition.registration?.googleSheetsUrl || '',
            formType: competition.registration?.formType || 'SINGLE_STEP',
            formSchema: Array.isArray(competition.registration?.formSchema) ? competition.registration.formSchema.map(field => ({
              ...field,
              id: field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              fieldName: field.fieldName || `field_${(field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).slice(0, 8)}`
            })) : [],
            steps: competition.registration?.steps?.map(step => ({
              ...step,
              fields: (step.fields || []).map(field => ({
                ...field,
                id: field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fieldName: field.fieldName || `field_${(field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).slice(0, 8)}`
              }))
            })) || [],
            qrCode: competition.registration?.qrCode || '',
            qrCodeMessage: competition.registration?.qrCodeMessage || '',
            confirmationEmail: competition.registration?.confirmationEmail || '',
            settings: {
              allowMultipleRegistrations: competition.registration?.settings?.allowMultipleRegistrations ?? true,
              requireEmailVerification: competition.registration?.settings?.requireEmailVerification ?? false,
              autoConfirmation: competition.registration?.settings?.autoConfirmation ?? true,
              maxRegistrations: competition.registration?.settings?.maxRegistrations || null,
              registrationDeadline: competition.registration?.settings?.registrationDeadline || null
            }
          },
          // Legacy registration for backward compatibility
          legacyRegistration: {
            status: competition.legacyRegistration?.status || competition.registration?.status || 'NOT_STARTED'
          },
          dateTime: competition.dateTime || '',
          venue: competition.venue || '',
          commonRules: Array.isArray(competition.commonRules) ? competition.commonRules : 
                      Array.isArray(competition.rules) ? competition.rules : [],
          commonRulesMessage: competition.commonRulesMessage || '',
          competitionPhotos: Array.isArray(competition.gallery) ? competition.gallery : 
                           competition.coverImage ? [competition.coverImage] : [],
          rounds: Array.isArray(competition.rounds) ? competition.rounds.map(round => ({
            roundNumber: round.roundNumber || 1,
            roundName: round.title || round.roundName || '',
            message: round.description || round.message || '',
            roundRules: Array.isArray(round.rules) ? round.rules : 
                       Array.isArray(round.roundRules) ? round.roundRules : [],
            roundRulesMessage: round.roundRulesMessage || '',
          })) : [],
          contact: {
            name: competition.contact?.name || '',
            phone: competition.contact?.phone || '',
            email: competition.contact?.email || '',
            instagram: competition.contact?.instagram || ''
          }
        };
        
        console.log('Competition_Modal - Form populated with data:', {
          commonRulesMessage: formData.commonRulesMessage,
          rounds: formData.rounds.map(r => ({
            roundName: r.roundName,
            roundRulesMessage: r.roundRulesMessage
          }))
        });
        
        setForm(formData);
        console.log('Competition_Modal - Form populated successfully with data:', formData);
      }
    } catch (err) {
      console.error('Error populating competition form:', err);
      setError('Failed to load competition data');
      setHasError(true);
    }
  }, [competition]);

  // Error boundary fallback
  if (hasError) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1B1C1E] rounded-xl p-6 max-w-md">
          <h3 className="text-xl font-bold text-red-400 mb-4">Error Loading Competition</h3>
          <p className="text-gray-300 mb-4">There was an error loading the competition form. Please try again.</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setHasError(false);
                setError('');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('images', file);
      });
      formData.append('folder', 'crwdctrl/competitions');

      const response = await fetch(`${API_BASE_URL}/admin/upload/images`, {
      method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload images');
      }

      const data = await response.json();
      const newUrls = data.urls.map(u => u.url);
      setForm({
        ...form,
        competitionPhotos: [...form.competitionPhotos, ...newUrls],
      });
    } catch (err) {
      console.error('Error uploading images:', err);
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index) => {
    setForm({
      ...form,
      competitionPhotos: form.competitionPhotos.filter((_, i) => i !== index),
    });
  };

  const addRule = () => {
    if (ruleInput.trim()) {
      setForm({ ...form, commonRules: [...form.commonRules, ruleInput.trim()] });
      setRuleInput('');
    }
  };

  const removeRule = (index) => {
    setForm({ ...form, commonRules: form.commonRules.filter((_, i) => i !== index) });
  };

  const addRound = () => {
    try {
      const currentRounds = form.rounds || [];
      const roundNumber = currentRounds.length + 1;
      const newRound = {
        roundNumber,
        roundName: '',
        roundRules: [],
        roundRulesMessage: '',
        message: '',
      };
      
      setForm({
        ...form,
        rounds: [...currentRounds, newRound],
      });
    } catch (err) {
      console.error('Error adding round:', err);
      setError('Failed to add round');
    }
  };

  const updateRound = (index, field, value) => {
    try {
      console.log(`Updating round ${index}, field: ${field}, value:`, value);
      const updatedRounds = [...(form.rounds || [])];
      
      // Ensure the round exists
      if (!updatedRounds[index]) {
        updatedRounds[index] = {
          roundNumber: index + 1,
          roundName: '',
          roundRules: [],
          roundRulesMessage: '',
          message: '',
        };
      }
      
      updatedRounds[index] = { 
        ...updatedRounds[index], 
        [field]: value 
      };
      
      console.log(`Round ${index} after update:`, updatedRounds[index]);
      setForm({ ...form, rounds: updatedRounds });
    } catch (err) {
      console.error('Error updating round:', err);
      setError('Failed to update round data');
    }
  };

  const addRoundRule = (roundIndex, rule) => {
    if (!rule.trim()) return;
    try {
      const updatedRounds = [...(form.rounds || [])];
      
      // Ensure the round exists
      if (!updatedRounds[roundIndex]) {
        updatedRounds[roundIndex] = {
          roundNumber: roundIndex + 1,
          roundName: '',
          roundRules: [],
          roundRulesMessage: '',
          message: '',
        };
      }
      
      // Ensure roundRules array exists
      if (!Array.isArray(updatedRounds[roundIndex].roundRules)) {
        updatedRounds[roundIndex].roundRules = [];
      }
      
      updatedRounds[roundIndex].roundRules = [
        ...updatedRounds[roundIndex].roundRules, 
        rule.trim()
      ];
      
      setForm({ ...form, rounds: updatedRounds });
    } catch (err) {
      console.error('Error adding round rule:', err);
      setError('Failed to add round rule');
    }
  };

  const removeRoundRule = (roundIndex, ruleIndex) => {
    try {
      const updatedRounds = [...(form.rounds || [])];
      
      if (updatedRounds[roundIndex] && Array.isArray(updatedRounds[roundIndex].roundRules)) {
        updatedRounds[roundIndex].roundRules = updatedRounds[roundIndex].roundRules.filter((_, i) => i !== ruleIndex);
        setForm({ ...form, rounds: updatedRounds });
      }
    } catch (err) {
      console.error('Error removing round rule:', err);
      setError('Failed to remove round rule');
    }
  };

  const removeRound = (index) => {
    try {
      const currentRounds = form.rounds || [];
      const updatedRounds = currentRounds.filter((_, i) => i !== index).map((round, idx) => ({
        ...round,
        roundNumber: idx + 1,
      }));
      setForm({ ...form, rounds: updatedRounds });
    } catch (err) {
      console.error('Error removing round:', err);
      setError('Failed to remove round');
    }
  };

  // ✅ NEW: Multi-step form management functions
  const addFormField = () => {
    const uuid = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newField = {
      id: uuid,
      label: '',
      fieldName: `field_${uuid.slice(0, 8)}`,
      type: 'text',
      required: false,
      options: [],
      placeholder: ''
    };
    
    if (form.registration.formType === 'SINGLE_STEP') {
      setForm(prevForm => ({
        ...prevForm,
        registration: {
          ...prevForm.registration,
          formSchema: [...(prevForm.registration.formSchema || []), newField]
        }
      }));
    }
  };

  const addStep = () => {
    const newStep = {
      stepNumber: (form.registration.steps || []).length + 1,
      stepTitle: `Step ${(form.registration.steps || []).length + 1}`,
      stepDescription: '',
      fields: []
    };
    
    setForm(prevForm => ({
      ...prevForm,
      registration: {
        ...prevForm.registration,
        steps: [...(prevForm.registration.steps || []), newStep]
      }
    }));
  };

  const updateStep = (stepIndex, fieldName, value) => {
    setForm(prevForm => {
      const newSteps = (prevForm.registration.steps || []).map((step, i) => {
        if (i === stepIndex) {
          return { ...step, [fieldName]: value };
        }
        return step;
      });
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          steps: newSteps
        }
      };
    });
  };

  const removeStep = (stepIndex) => {
    setForm(prevForm => ({
      ...prevForm,
      registration: {
        ...prevForm.registration,
        steps: (prevForm.registration.steps || []).filter((_, i) => i !== stepIndex).map((step, i) => ({
          ...step,
          stepNumber: i + 1
        }))
      }
    }));
  };

  const addFieldToStep = (stepIndex) => {
    const uuid = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newField = {
      id: uuid,
      label: '',
      fieldName: `field_${uuid.slice(0, 8)}`,
      type: 'text',
      required: false,
      options: [],
      placeholder: ''
    };

    setForm(prevForm => {
      const newSteps = (prevForm.registration.steps || []).map((step, i) => {
        if (i === stepIndex) {
          return { ...step, fields: [...(step.fields || []), newField] };
        }
        return step;
      });
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          steps: newSteps
        }
      };
    });
  };

  const updateStepField = (stepIndex, fieldIndex, fieldName, value) => {
    setForm(prevForm => {
      const newSteps = (prevForm.registration.steps || []).map((step, i) => {
        if (i === stepIndex) {
          const newFields = (step.fields || []).map((field, j) => {
            if (j === fieldIndex) {
              const updatedField = { ...field, [fieldName]: value };
              
              // Ensure fieldName is never empty
              if (fieldName === 'fieldName' && (!value || value.trim() === '')) {
                updatedField.fieldName = `field_${field.id.slice(0, 8)}`;
              }
              
              return updatedField;
            }
            return field;
          });
          return { ...step, fields: newFields };
        }
        return step;
      });
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          steps: newSteps
        }
      };
    });
  };

  const removeFieldFromStep = (stepIndex, fieldIndex) => {
    setForm(prevForm => {
      const newSteps = (prevForm.registration.steps || []).map((step, i) => {
        if (i === stepIndex) {
          return { ...step, fields: (step.fields || []).filter((_, j) => j !== fieldIndex) };
        }
        return step;
      });
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          steps: newSteps
        }
      };
    });
  };

  const addStepFieldOption = (stepIndex, fieldIndex) => {
    setForm(prevForm => {
      const newSteps = (prevForm.registration.steps || []).map((step, i) => {
        if (i === stepIndex) {
          const newFields = (step.fields || []).map((field, j) => {
            if (j === fieldIndex) {
              return {
                ...field,
                options: [...(field.options || []), '']
              };
            }
            return field;
          });
          return { ...step, fields: newFields };
        }
        return step;
      });
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          steps: newSteps
        }
      };
    });
  };

  const updateStepFieldOption = (stepIndex, fieldIndex, optionIndex, value) => {
    setForm(prevForm => {
      const newSteps = (prevForm.registration.steps || []).map((step, i) => {
        if (i === stepIndex) {
          const newFields = (step.fields || []).map((field, j) => {
            if (j === fieldIndex) {
              const newOptions = [...(field.options || [])];
              newOptions[optionIndex] = value;
              return { ...field, options: newOptions };
            }
            return field;
          });
          return { ...step, fields: newFields };
        }
        return step;
      });
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          steps: newSteps
        }
      };
    });
  };

  const removeStepFieldOption = (stepIndex, fieldIndex, optionIndex) => {
    setForm(prevForm => {
      const newSteps = (prevForm.registration.steps || []).map((step, i) => {
        if (i === stepIndex) {
          const newFields = (step.fields || []).map((field, j) => {
            if (j === fieldIndex) {
              return {
                ...field,
                options: (field.options || []).filter((_, k) => k !== optionIndex)
              };
            }
            return field;
          });
          return { ...step, fields: newFields };
        }
        return step;
      });
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          steps: newSteps
        }
      };
    });
  };

  // Handle form type change
  const handleFormTypeChange = (newFormType) => {
    setForm(prevForm => {
      if (newFormType === 'MULTI_STEP' && prevForm.registration.formType === 'SINGLE_STEP') {
        // Convert single step to multi-step
        const firstStep = {
          stepNumber: 1,
          stepTitle: 'Step 1',
          stepDescription: '',
          fields: prevForm.registration.formSchema || []
        };
        return {
          ...prevForm,
          registration: {
            ...prevForm.registration,
            formType: newFormType,
            steps: [firstStep]
          }
        };
      } else if (newFormType === 'SINGLE_STEP' && prevForm.registration.formType === 'MULTI_STEP') {
        // Convert multi-step to single step (flatten all fields)
        const allFields = (prevForm.registration.steps || []).reduce((acc, step) => [...acc, ...(step.fields || [])], []);
        return {
          ...prevForm,
          registration: {
            ...prevForm.registration,
            formType: newFormType,
            formSchema: allFields,
            steps: []
          }
        };
      }
      return { 
        ...prevForm, 
        registration: {
          ...prevForm.registration,
          formType: newFormType
        }
      };
    });
  };

  const updateFormField = (index, fieldName, value) => {
    setForm(prevForm => {
      const newFormSchema = (prevForm.registration.formSchema || []).map((field, i) => {
        if (i === index) {
          const updatedField = {
            ...field,
            [fieldName]: value
          };
          
          // Ensure fieldName is never empty - auto-generate if needed
          if (fieldName === 'fieldName' && (!value || value.trim() === '')) {
            updatedField.fieldName = `field_${field.id.slice(0, 8)}`;
          }
          
          return updatedField;
        }
        return field;
      });
      
      return {
        ...prevForm,
        registration: {
          ...prevForm.registration,
          formSchema: newFormSchema
        }
      };
    });
  };

  const removeFormField = (index) => {
    setForm(prevForm => ({
      ...prevForm,
      registration: {
        ...prevForm.registration,
        formSchema: (prevForm.registration.formSchema || []).filter((_, i) => i !== index)
      }
    }));
  };

  const addFieldOption = (fieldIndex) => {
    setForm(prevForm => {
      const newFormSchema = [...(prevForm.registration.formSchema || [])];
      if (!newFormSchema[fieldIndex].options) {
        newFormSchema[fieldIndex].options = [];
      }
      newFormSchema[fieldIndex] = {
        ...newFormSchema[fieldIndex],
        options: [...newFormSchema[fieldIndex].options, '']
      };
      return {
        ...prevForm,
        registration: {
          ...prevForm.registration,
          formSchema: newFormSchema
        }
      };
    });
  };

  const updateFieldOption = (fieldIndex, optionIndex, value) => {
    setForm(prevForm => {
      const newFormSchema = [...(prevForm.registration.formSchema || [])];
      if (!newFormSchema[fieldIndex].options) {
        newFormSchema[fieldIndex].options = [];
      }
      const newOptions = [...newFormSchema[fieldIndex].options];
      newOptions[optionIndex] = value;
      newFormSchema[fieldIndex] = {
        ...newFormSchema[fieldIndex],
        options: newOptions
      };
      return {
        ...prevForm,
        registration: {
          ...prevForm.registration,
          formSchema: newFormSchema
        }
      };
    });
  };

  const removeFieldOption = (fieldIndex, optionIndex) => {
    setForm(prevForm => {
      const newFormSchema = [...(prevForm.registration.formSchema || [])];
      if (newFormSchema[fieldIndex].options) {
        newFormSchema[fieldIndex] = {
          ...newFormSchema[fieldIndex],
          options: newFormSchema[fieldIndex].options.filter((_, i) => i !== optionIndex)
        };
      }
      return {
        ...prevForm,
        registration: {
          ...prevForm.registration,
          formSchema: newFormSchema
        }
      };
    });
  };

  const submit = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('Frontend - Form state before submit:', {
        commonRulesMessage: form.commonRulesMessage,
        rounds: form.rounds?.map(r => ({
          roundName: r.roundName,
          roundRulesMessage: r.roundRulesMessage
        }))
      });

      // ✅ ENHANCED: Add validation for dateTime and competitionType
      if (!form.name || !form.description || !form.prizePool || !form.registrationFee) {
        setError('Please fill Competition Name, Description, Prize Pool and Registration Fee');
        setLoading(false);
        return;
      }

      // ✅ NEW: Validate dateTime (required by backend model)
      if (!form.dateTime || form.dateTime.trim() === '') {
        setError('Please fill the Date and Time field');
        setLoading(false);
        return;
      }

      // ✅ NEW: Validate competitionType (required by backend model)
      if (!form.competitionType) {
        setError('Please select a Competition Type');
        setLoading(false);
        return;
      }

      // Validate custom registration fields
      if (form.registrationType === 'custom') {
        if (form.registration.status === 'external_link' && !form.registration.externalUrl) {
          setError('Please provide External Registration Link');
          setLoading(false);
          return;
        }
        
        if (form.registration.status === 'internal_form') {
          if (!form.registration.googleSheetsUrl) {
            setError('Please provide Google Sheets URL for internal form');
            setLoading(false);
            return;
          }
          
          // Validate form fields based on form type
          if (form.registration.formType === 'SINGLE_STEP') {
            if (!form.registration.formSchema || form.registration.formSchema.length === 0) {
              setError('Please add at least one form field for internal form');
              setLoading(false);
              return;
            }
            
            // Validate form fields
            for (let i = 0; i < form.registration.formSchema.length; i++) {
              const field = form.registration.formSchema[i];
              if (!field.label || !field.type) {
                setError(`Please complete field ${i + 1} (label and type are required)`);
                setLoading(false);
                return;
              }
            }
          } else if (form.registration.formType === 'MULTI_STEP') {
            if (!form.registration.steps || form.registration.steps.length === 0) {
              setError('Please add at least one step for multi-step form');
              setLoading(false);
              return;
            }
            
            // Validate each step
            for (let stepIndex = 0; stepIndex < form.registration.steps.length; stepIndex++) {
              const step = form.registration.steps[stepIndex];
              if (!step.stepTitle) {
                setError(`Please provide a title for step ${stepIndex + 1}`);
                setLoading(false);
                return;
              }
              
              if (!step.fields || step.fields.length === 0) {
                setError(`Please add at least one field to step ${stepIndex + 1}`);
                setLoading(false);
                return;
              }
              
              // Validate fields in this step
              for (let fieldIndex = 0; fieldIndex < step.fields.length; fieldIndex++) {
                const field = step.fields[fieldIndex];
                if (!field.label || !field.type) {
                  setError(`Please complete field ${fieldIndex + 1} in step ${stepIndex + 1} (label and type are required)`);
                  setLoading(false);
                  return;
                }
              }
            }
          }
        }
      }

      const payload = {
        name: form.name,
        subtitle: form.subtitle,
        description: form.description,
        competitionType: form.competitionType,
        category: form.category,
        prizePool: form.prizePool,
        registrationFee: form.registrationFee,
        registrationLink: form.registrationLink,
        registrationType: form.registrationType,
        registration: form.registration,
        // Legacy registration for backward compatibility
        legacyRegistration: form.legacyRegistration,
        dateTime: form.dateTime,
        venue: form.venue,
        coverImage: (form.competitionPhotos && form.competitionPhotos[0]) || '',
        gallery: form.competitionPhotos || [],
        commonRules: form.commonRules || [],
        commonRulesMessage: form.commonRulesMessage || '',
        rounds: (form.rounds || []).map(r => ({
          roundNumber: r?.roundNumber || 1,
          title: r?.roundName || '',
          description: r?.message || '',
          rules: r?.roundRules || [],
          roundRulesMessage: r?.roundRulesMessage || '',
          venue: form.venue,
        })),
        contact: form.contact || {
          name: '',
          phone: '',
          email: '',
          instagram: ''
        }
      };

      console.log('Frontend - Submitting competition payload:', payload);
      console.log('Frontend - Payload validation:', {
        hasName: !!payload.name,
        hasDescription: !!payload.description,
        hasPrizePool: !!payload.prizePool,
        hasRegistrationFee: !!payload.registrationFee,
        hasDateTime: !!payload.dateTime,
        hasCompetitionType: !!payload.competitionType
      });
      console.log('Frontend - commonRulesMessage:', form.commonRulesMessage);
      console.log('Frontend - rounds with roundRulesMessage:', (form.rounds || []).map(r => ({
        title: r?.roundName,
        roundRulesMessage: r?.roundRulesMessage
      })));
      console.log('Frontend - QR Code in payload:', payload.registration?.qrCode);
      console.log('Frontend - QR Code Message in payload:', payload.registration?.qrCodeMessage);

      const method = competition ? 'PUT' : 'POST';
      const url = competition
        ? `${API_BASE_URL}/admin/competitions/${competition._id}`
        : `${API_BASE_URL}/admin/fests/${fest._id}/competitions`;

      console.log('Frontend - Request URL:', url);
      console.log('Frontend - Request method:', method);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('Frontend - Response status:', response.status);
      console.log('Frontend - Response headers:', [...response.headers.entries()]);

      // Get response text first to debug
      const responseText = await response.text();
      console.log('Frontend - Raw response:', responseText.substring(0, 500));

      if (!response.ok) {
        let err;
        try {
          err = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Frontend - Failed to parse error response:', parseError);
          throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
        }
        console.log('Frontend - Error response:', err);
        
        // ✅ Enhanced error message with validation details
        let errorMessage = err.message || `Failed to save competition (${response.status})`;
        
        // If there are validation errors, include them
        if (err.validationErrors && Array.isArray(err.validationErrors)) {
          const fieldErrors = err.validationErrors.map(e => `${e.field}: ${e.message}`).join('; ');
          errorMessage = `${errorMessage} - ${fieldErrors}`;
        } else if (err.details) {
          errorMessage = `${errorMessage} - ${err.details}`;
        }
        
        console.error('Frontend - Final error message:', errorMessage);
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Frontend - Failed to parse success response:', parseError);
        throw new Error('Invalid response from server');
      }
      console.log('Frontend - Success response:', result);

      onSaved();
    } catch (err) {
      console.error('Frontend - Submit error:', err);
      setError(err.message || 'Failed to save competition');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Basic Info' },
    { number: 2, title: 'Images & Rules' },
    { number: 3, title: 'Rounds' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1B1C1E] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1B1C1E] border-b border-gray-800 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-2xl font-bold">
              {competition ? 'Edit Competition' : 'Create New Competition'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">Step {currentStep} of {steps.length}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      currentStep === step.number
                        ? 'bg-[#0ECCEE] text-black'
                        : currentStep > step.number
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {currentStep > step.number ? '✓' : step.number}
                  </div>
                  <span className={`text-xs mt-2 ${currentStep === step.number ? 'text-[#0ECCEE]' : 'text-gray-400'}`}>
                    {step.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.number ? 'bg-green-600' : 'bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h4 className="text-lg font-semibold border-b border-gray-700 pb-2">Basic Information</h4>
              
              <div>
                <label className="block text-sm font-medium mb-2">Competition Name *</label>
                <input
                  type="text"
                  placeholder="e.g., InSync, Head Bang"
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Subtitle</label>
                <input
                  type="text"
                  placeholder="e.g., Fast-paced basketball tournament - DAY 1"
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.subtitle || ''}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  rows={4}
                  placeholder="Describe the competition with formatting:&#10;&#10;Join us for an exciting competition featuring:&#10;• Multiple rounds of challenges&#10;• Expert judges&#10;• Amazing prizes"
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none font-mono text-sm"
                  style={{ whiteSpace: 'pre-wrap' }}
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formatting will be preserved exactly as entered
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={form.category || 'OTHER'}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="DANCE">DANCE</option>
                    <option value="MUSIC">MUSIC</option>
                    <option value="THEATRE">THEATRE</option>
                    <option value="ART">ART</option>
                    <option value="SPORTS">SPORTS</option>
                    <option value="ACADEMIC">ACADEMIC</option>
                    <option value="GAMING">GAMING</option>
                    <option value="QUIZ">QUIZ</option>
                    <option value="CULTURAL">CULTURAL</option>
                    <option value="TECHNICAL">TECHNICAL</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Competition Type *</label>
                  <select
                    className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={form.competitionType || 'other'}
                    onChange={(e) => setForm({ ...form, competitionType: e.target.value })}
                  >
                    <option value="">Select Competition Type</option>
                    <option value="hackathon">Hackathon</option>
                    <option value="coding">Coding</option>
                    <option value="quiz">Quiz</option>
                    <option value="debate">Debate</option>
                    <option value="design">Design</option>
                    <option value="dance">Dance</option>
                    <option value="music">Music</option>
                    <option value="sports">Sports</option>
                    <option value="art">Art</option>
                    <option value="theater">Theater</option>
                    <option value="cultural">Cultural</option>
                    <option value="business">Business</option>
                    <option value="esports">Esports</option>
                    <option value="management">Management</option>
                    <option value="media">Media</option>
                    <option value="literary">Literary</option>
                    <option value="fashion">Fashion</option>
                    <option value="finance">Finance</option>
                    <option value="marketing">Marketing</option>
                    <option value="marathon">Marathon</option>
                    <option value="technical">Technical</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Prize Pool *</label>
                  <textarea
                    rows={4}
                    placeholder="Enter prize pool details with formatting:&#10;&#10;Prize Pool - Individual Events – 1st Prize: ₹1,500 | 2nd Prize: ₹1,000&#10;Relay Events – 1st Prize: ₹2,500 | 2nd Prize: ₹1,500&#10;Medals for top 3 finishers in each category"
                    className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none font-mono text-sm"
                    style={{ whiteSpace: 'pre-wrap' }}
                    value={form.prizePool || ''}
                    onChange={(e) => setForm({ ...form, prizePool: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formatting will be preserved exactly as entered (line breaks, spaces, etc.)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Registration Fee *</label>
                  <input
                    type="text"
                    placeholder="e.g., Free or ₹200"
                    className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={form.registrationFee || ''}
                    onChange={(e) => setForm({ ...form, registrationFee: e.target.value })}
                  />
                </div>

                {/* Registration Configuration */}
                <div className="col-span-2">
                  <h5 className="text-md font-semibold mb-4 border-b border-gray-700 pb-2">Registration Configuration</h5>
                  
                  {/* Registration Type Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-3">Registration Type *</label>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="registrationType"
                          value="fest"
                          checked={form.registrationType === 'fest'}
                          onChange={(e) => setForm({ ...form, registrationType: e.target.value })}
                          className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                        />
                        <label className="ml-2 text-sm">Use Same Registration as Fest</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="registrationType"
                          value="custom"
                          checked={form.registrationType === 'custom'}
                          onChange={(e) => setForm({ ...form, registrationType: e.target.value })}
                          className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                        />
                        <label className="ml-2 text-sm">Create Own Registration</label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {form.registrationType === 'fest' 
                        ? 'Competition will use the parent fest\'s registration system' 
                        : 'Competition will have its own independent registration system'
                      }
                    </p>
                  </div>

                  {/* Custom Registration Configuration */}
                  {form.registrationType === 'custom' && (
                    <div className="space-y-4">
                      <label className="block text-sm font-medium mb-3">Registration Status *</label>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="registrationStatus"
                            value="not_started"
                            checked={form.registration?.status === 'not_started'}
                            onChange={(e) => setForm({ 
                              ...form, 
                              registration: { 
                                ...form.registration, 
                                status: e.target.value 
                              } 
                            })}
                            className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                          />
                          <label className="ml-2 text-sm">Not Started</label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="registrationStatus"
                            value="external_link"
                            checked={form.registration?.status === 'external_link'}
                            onChange={(e) => setForm({ 
                              ...form, 
                              registration: { 
                                ...form.registration, 
                                status: e.target.value 
                              } 
                            })}
                            className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                          />
                          <label className="ml-2 text-sm">External Link</label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="registrationStatus"
                            value="internal_form"
                            checked={form.registration?.status === 'internal_form'}
                            onChange={(e) => setForm({ 
                              ...form, 
                              registration: { 
                                ...form.registration, 
                                status: e.target.value 
                              } 
                            })}
                            className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                          />
                          <label className="ml-2 text-sm">Internal Form</label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="registrationStatus"
                            value="registration_closed"
                            checked={form.registration?.status === 'registration_closed'}
                            onChange={(e) => setForm({ 
                              ...form, 
                              registration: { 
                                ...form.registration, 
                                status: e.target.value 
                              } 
                            })}
                            className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                          />
                          <label className="ml-2 text-sm">Registration Closed</label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* External Link Input */}
                  {form.registrationType === 'custom' && form.registration?.status === 'external_link' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-2">External Registration Link *</label>
                      <input
                        type="url"
                        placeholder="https://forms.google.com/..."
                        className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                        value={form.registration?.externalUrl || ''}
                        onChange={(e) => setForm({ 
                          ...form, 
                          registration: { 
                            ...form.registration, 
                            externalUrl: e.target.value 
                          } 
                        })}
                      />
                    </div>
                  )}

                  {/* Internal Form Configuration */}
                  {form.registrationType === 'custom' && form.registration?.status === 'internal_form' && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Google Sheets URL *</label>
                        <input
                          type="url"
                          placeholder="https://docs.google.com/spreadsheets/..."
                          className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                          value={form.registration?.googleSheetsUrl || ''}
                          onChange={(e) => setForm({ 
                            ...form, 
                            registration: { 
                              ...form.registration, 
                              googleSheetsUrl: e.target.value 
                            } 
                          })}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Registration data will be automatically sent to this Google Sheet
                        </p>
                      </div>

                      {/* Form Type Selection */}
                      <div>
                        <label className="block text-sm font-medium mb-3">Form Type</label>
                        <div className="flex gap-4">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="formType"
                              value="SINGLE_STEP"
                              checked={form.registration?.formType === 'SINGLE_STEP'}
                              onChange={(e) => handleFormTypeChange(e.target.value)}
                              className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                            />
                            <span className="text-sm">Single Step Form</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="formType"
                              value="MULTI_STEP"
                              checked={form.registration?.formType === 'MULTI_STEP'}
                              onChange={(e) => handleFormTypeChange(e.target.value)}
                              className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                            />
                            <span className="text-sm">Multi-Step Form</span>
                          </label>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          {form.registration?.formType === 'SINGLE_STEP' 
                            ? 'All form fields will be displayed on a single page'
                            : 'Form will be split into multiple steps for better user experience'
                          }
                        </p>
                      </div>

                      {/* Single Step Form Fields */}
                      {form.registration?.formType === 'SINGLE_STEP' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Registration Form Fields</label>
                          <div className="bg-[#1B1C1E] rounded-lg p-4 border border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm text-gray-400">
                                Configure the fields that users will fill during registration
                              </p>
                              <button
                                type="button"
                                onClick={addFormField}
                                className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
                              >
                                <Plus size={16} />
                                Add Field
                              </button>
                            </div>

                            <div className="space-y-3">
                              {(form.registration?.formSchema || []).map((field, index) => (
                                <FormFieldEditor
                                  key={field.id || `field-${index}`}
                                  field={field}
                                  index={index}
                                  onUpdate={updateFormField}
                                  onRemove={removeFormField}
                                  onAddOption={addFieldOption}
                                  onUpdateOption={updateFieldOption}
                                  onRemoveOption={removeFieldOption}
                                />
                              ))}

                              {(form.registration?.formSchema || []).length === 0 && (
                                <div className="text-center py-6 text-gray-400">
                                  <p>No form fields added yet. Click "Add Field" to create your registration form.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Multi-Step Form Configuration */}
                      {form.registration?.formType === 'MULTI_STEP' && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <label className="block text-sm font-medium">Multi-Step Form Configuration</label>
                            <button
                              type="button"
                              onClick={addStep}
                              className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
                            >
                              <Plus size={16} />
                              Add Step
                            </button>
                          </div>

                          <div className="bg-[#1B1C1E] rounded-lg p-4 border border-gray-700">
                            <div className="space-y-4">
                              {(form.registration?.steps || []).map((step, stepIndex) => (
                                <div key={`step-${stepIndex}`} className="bg-[#2A2B2D] p-4 rounded-lg border border-gray-700">
                                  {/* Step Header */}
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-[#0ECCEE] text-black rounded-full flex items-center justify-center text-sm font-bold">
                                        {step.stepNumber}
                                      </div>
                                      <div className="flex-1">
                                        <input
                                          type="text"
                                          placeholder="Step Title"
                                          className="text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-gray-400 p-0"
                                          value={step.stepTitle}
                                          onChange={(e) => updateStep(stepIndex, 'stepTitle', e.target.value)}
                                        />
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeStep(stepIndex)}
                                      className="text-red-400 hover:text-red-300"
                                      title="Delete Step"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>

                                  {/* Step Description */}
                                  <div className="mb-4">
                                    <input
                                      type="text"
                                      placeholder="Step description (optional)"
                                      className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm"
                                      value={step.stepDescription}
                                      onChange={(e) => updateStep(stepIndex, 'stepDescription', e.target.value)}
                                    />
                                  </div>

                                  {/* Step Fields */}
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h6 className="text-sm font-medium text-gray-300">Fields in this step</h6>
                                      <button
                                        type="button"
                                        onClick={() => addFieldToStep(stepIndex)}
                                        className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors flex items-center gap-1"
                                      >
                                        <Plus size={12} />
                                        Add Field
                                      </button>
                                    </div>

                                    {(step.fields || []).map((field, fieldIndex) => (
                                      <StepFieldEditor
                                        key={field.id || `step-${stepIndex}-field-${fieldIndex}`}
                                        field={field}
                                        stepIndex={stepIndex}
                                        fieldIndex={fieldIndex}
                                        onUpdate={updateStepField}
                                        onRemove={removeFieldFromStep}
                                        onAddOption={addStepFieldOption}
                                        onUpdateOption={updateStepFieldOption}
                                        onRemoveOption={removeStepFieldOption}
                                      />
                                    ))}

                                    {(step.fields || []).length === 0 && (
                                      <div className="text-center py-4 text-gray-500 bg-[#1B1C1E] rounded-lg">
                                        <p className="text-sm">No fields in this step. Click "Add Field" to add form fields.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {(form.registration?.steps || []).length === 0 && (
                                <div className="text-center py-6 text-gray-400">
                                  <p>No steps created yet. Click "Add Step" to create your multi-step form.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* QR Code Configuration */}
                      <div>
                        <label className="block text-sm font-medium mb-2">QR Code (Optional)</label>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">QR Code Image</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  setUploadingImage(true);
                                  try {
                                    const formData = new FormData();
                                    formData.append('images', file);
                                    formData.append('folder', 'crwdctrl/competitions/qr-codes');

                                    const response = await fetch(`${API_BASE_URL}/admin/upload/images`, {
                                      method: 'POST',
                                      headers: {
                                        Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
                                      },
                                      body: formData,
                                    });

                                    if (!response.ok) throw new Error('Failed to upload QR code');

                                    const data = await response.json();
                                    const qrCodeUrl = data.urls[0].url;
                                    
                                    console.log('QR Code uploaded successfully:', qrCodeUrl);
                                    
                                    setForm({
                                      ...form,
                                      registration: {
                                        ...form.registration,
                                        qrCode: qrCodeUrl
                                      }
                                    });
                                  } catch (err) {
                                    setError('Failed to upload QR code: ' + err.message);
                                  } finally {
                                    setUploadingImage(false);
                                  }
                                }
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm"
                              disabled={uploadingImage}
                            />
                            {uploadingImage && (
                              <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                                <Loader className="w-4 h-4 animate-spin" />
                                Uploading QR code...
                              </div>
                            )}
                            {form.registration?.qrCode && (
                              <div className="mt-2 flex items-center gap-3">
                                <img 
                                  src={form.registration.qrCode} 
                                  alt="QR Code" 
                                  className="w-16 h-16 object-cover rounded border border-gray-700"
                                />
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setForm({
                                      ...form,
                                      registration: {
                                        ...form.registration,
                                        qrCode: ''
                                      }
                                    })}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      // Test QR code saving directly
                                      try {
                                        const testPayload = {
                                          registration: {
                                            ...form.registration,
                                            qrCode: form.registration.qrCode,
                                            qrCodeMessage: form.registration.qrCodeMessage
                                          }
                                        };
                                        
                                        console.log('Testing QR code save with payload:', testPayload);
                                        
                                        const response = await fetch(`${API_BASE_URL}/admin/competitions/${competition._id}`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
                                          },
                                          body: JSON.stringify(testPayload),
                                        });
                                        
                                        const result = await response.json();
                                        console.log('QR code test result:', result);
                                        alert('QR code test completed - check console');
                                      } catch (err) {
                                        console.error('QR code test error:', err);
                                        alert('QR code test failed - check console');
                                      }
                                    }}
                                    className="text-blue-400 hover:text-blue-300 text-sm"
                                  >
                                    Test Save
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium mb-1">QR Code Message (Optional)</label>
                            <textarea
                              rows={2}
                              placeholder="Message to display with QR code (e.g., 'Scan to join WhatsApp group')"
                              className="w-full px-3 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm resize-none"
                              value={form.registration?.qrCodeMessage || ''}
                              onChange={(e) => setForm({
                                ...form,
                                registration: {
                                  ...form.registration,
                                  qrCodeMessage: e.target.value
                                }
                              })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Confirmation Email Configuration */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Confirmation Email (Optional)</label>
                        <input
                          type="email"
                          placeholder="organizer@example.com"
                          className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                          value={form.registration?.confirmationEmail || ''}
                          onChange={(e) => setForm({
                            ...form,
                            registration: {
                              ...form.registration,
                              confirmationEmail: e.target.value
                            }
                          })}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Registration confirmation emails will be sent to this address
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Date & Time</label>
                  <input
                    type="text"
                    placeholder="e.g., December 10, 2025 • 08:00 AM or 'To be announced'"
                    className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={form.dateTime || ''}
                    onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Venue</label>
                  <input
                    type="text"
                    placeholder="e.g., Main Hall, Auditorium"
                    className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={form.venue || ''}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  />
                </div>
              </div>

              {/* Competition Contact Details */}
              <div>
                <h5 className="text-md font-semibold mb-4 border-b border-gray-700 pb-2">Competition Contact Details</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Contact Name</label>
                    <input
                      type="text"
                      placeholder="Contact person name"
                      className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                      value={form.contact?.name || ''}
                      onChange={(e) => setForm({ 
                        ...form, 
                        contact: { 
                          ...form.contact, 
                          name: e.target.value 
                        } 
                      })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="+91-1234567890"
                      className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                      value={form.contact?.phone || ''}
                      onChange={(e) => setForm({ 
                        ...form, 
                        contact: { 
                          ...form.contact, 
                          phone: e.target.value 
                        } 
                      })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Contact Email</label>
                    <input
                      type="email"
                      placeholder="contact@example.com"
                      className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                      value={form.contact?.email || ''}
                      onChange={(e) => setForm({ 
                        ...form, 
                        contact: { 
                          ...form.contact, 
                          email: e.target.value 
                        } 
                      })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Instagram Handle</label>
                    <input
                      type="text"
                      placeholder="@username or full URL"
                      className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                      value={form.contact?.instagram || ''}
                      onChange={(e) => setForm({ 
                        ...form, 
                        contact: { 
                          ...form.contact, 
                          instagram: e.target.value 
                        } 
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Images & Rules */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h4 className="text-lg font-semibold border-b border-gray-700 pb-2">Images & Common Rules</h4>

              {/* Competition Photos */}
              <div>
                <label className="block text-sm font-medium mb-2">Competition Photos</label>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
        <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageUpload(e.target.files)}
                    className="hidden"
                    id="competition-photos"
                    disabled={uploadingImage}
                  />
                  <label
                    htmlFor="competition-photos"
                    className={`cursor-pointer flex flex-col items-center gap-2 ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {uploadingImage ? (
                      <Loader className="w-8 h-8 animate-spin text-[#0ECCEE]" />
                    ) : (
                      <Upload className="w-8 h-8 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-400">
                      {uploadingImage ? 'Uploading...' : 'Click to upload images (multiple allowed)'}
                    </span>
                  </label>
                </div>

                {form.competitionPhotos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {form.competitionPhotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo}
                          alt={`Competition ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Common Rules */}
              <div>
                <label className="block text-sm font-medium mb-2">Common Rules</label>
                
                {/* Message Field for Bulk Rules */}
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-2 text-gray-400">
                    Paste rules here (optional) - preserves formatting
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Paste all common rules here with line breaks, bullets, etc.&#10;&#10;Example:&#10;• Rule 1: Participants must arrive 30 minutes early&#10;• Rule 2: Mobile phones are not allowed&#10;• Rule 3: Follow the dress code"
                    className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none font-mono text-sm"
                    style={{ whiteSpace: 'pre-wrap' }}
                    value={form.commonRulesMessage || ''}
                    onChange={(e) => {
                      console.log('CommonRulesMessage changed:', e.target.value);
                      setForm({ ...form, commonRulesMessage: e.target.value });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If this field has content, it will be displayed instead of individual rules below
                  </p>
                </div>

                {/* Individual Rules (existing method) */}
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-2 text-gray-400">
                    Or add rules one by one
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Add a rule"
                      className="flex-1 px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                      value={ruleInput}
                      onChange={(e) => setRuleInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addRule()}
                    />
                    <button
                      onClick={addRule}
                      className="px-4 py-2 bg-[#0ECCEE] text-black rounded-lg font-medium hover:bg-[#0ECCEE]/80 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(form.commonRules || []).map((rule, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-gray-800 rounded">
                        <span className="flex-1 text-sm">{rule}</span>
                        <button
                          onClick={() => removeRule(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Rounds */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold border-b border-gray-700 pb-2 flex-1">Competition Rounds</h4>
                <button
                  onClick={addRound}
                  className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Round
                </button>
              </div>

              {(form.rounds || []).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No rounds added yet. Click "Add Round" to create one.
                </div>
              ) : (
                <div className="space-y-4">
                  {(form.rounds || []).map((round, roundIndex) => (
                    <div key={roundIndex} className="bg-[#2A2B2D] rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-semibold">Round {round.roundNumber}</h5>
                        <button
                          onClick={() => removeRound(roundIndex)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Round Name *</label>
                          <input
                            type="text"
                            placeholder="e.g., Elimination Round, Final Round"
                            className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                            value={round?.roundName || ''}
                            onChange={(e) => updateRound(roundIndex, 'roundName', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Message/Description</label>
                          <textarea
                            rows={3}
                            placeholder="Describe this round with formatting:&#10;&#10;Round 1 - Elimination Round&#10;Time limit: 5 minutes&#10;Maximum team size: 4 members"
                            className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none font-mono text-sm"
                            style={{ whiteSpace: 'pre-wrap' }}
                            value={round?.message || ''}
                            onChange={(e) => updateRound(roundIndex, 'message', e.target.value)}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Formatting will be preserved exactly as entered
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Round Rules</label>
                          
                          {/* Message Field for Bulk Round Rules */}
                          <div className="mb-4">
                            <label className="block text-xs font-medium mb-2 text-gray-400">
                              Paste round rules here (optional) - preserves formatting
                            </label>
                            <textarea
                              rows={4}
                              placeholder="Paste all round rules here with line breaks, bullets, etc.&#10;&#10;Example:&#10;• Time limit: 5 minutes&#10;• Maximum team size: 4 members&#10;• Judging criteria: Creativity and execution"
                              className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none font-mono text-sm"
                              style={{ whiteSpace: 'pre-wrap' }}
                              value={round?.roundRulesMessage || ''}
                              onChange={(e) => {
                                console.log(`Round ${roundIndex} RulesMessage changed:`, e.target.value);
                                updateRound(roundIndex, 'roundRulesMessage', e.target.value);
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              If this field has content, it will be displayed instead of individual rules below
                            </p>
                          </div>

                          {/* Individual Round Rules (existing method) */}
                          <div className="mb-4">
                            <label className="block text-xs font-medium mb-2 text-gray-400">
                              Or add rules one by one
                            </label>
                            <RoundRulesInput
                              rules={round?.roundRules || []}
                              onAddRule={(rule) => addRoundRule(roundIndex, rule)}
                              onRemoveRule={(ruleIndex) => removeRoundRule(roundIndex, ruleIndex)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="sticky bottom-0 bg-[#1B1C1E] border-t border-gray-800 p-6 flex justify-between gap-3">
          <button
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : onClose()}
            className="px-6 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors flex items-center gap-2"
            disabled={loading}
          >
            <ChevronLeft size={20} />
            {currentStep > 1 ? 'Previous' : 'Cancel'}
          </button>

          {currentStep < steps.length ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-6 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
            >
              Next
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={loading || uploadingImage}
              className="px-6 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold hover:bg-[#0ECCEE]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : competition ? 'Update Competition' : 'Create Competition'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Round Rules Input Component
function RoundRulesInput({ rules, onAddRule, onRemoveRule }) {
  const [ruleInput, setRuleInput] = useState('');

  const handleAdd = () => {
    if (ruleInput.trim()) {
      onAddRule(ruleInput.trim());
      setRuleInput('');
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="Add a rule"
          className="flex-1 px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
          value={ruleInput}
          onChange={(e) => setRuleInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="px-3 py-2 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80"
        >
          Add
        </button>
      </div>
      <div className="space-y-1">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 bg-gray-800 rounded text-sm">
            <span className="flex-1">{rule}</span>
            <button
              onClick={() => onRemoveRule(idx)}
              className="text-red-400 hover:text-red-300"
            >
              ×
        </button>
          </div>
        ))}
      </div>
    </div>
  );
}
