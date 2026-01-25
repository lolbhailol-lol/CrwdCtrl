import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Loader } from 'lucide-react';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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

// ✅ NEW: Step Field Editor Component for Multi-Step Forms
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

export default function FestFormModal({ fest, onClose, onSaved }) {
  // STEP STATE: simple multi-step wizard instead of one very long form
  const [step, setStep] = useState(1);

  // Form state aligned to new FEST DATA STRUCTURE
  const [form, setForm] = useState({
    // Core fest info
    festName: '',
    subtitle: '',
    collegeName: '',
    festDate: '', // display string like "Dec 10-12, 2025" or "To be announced"
    venueDetails: '',
    festType: 'cultural', // cultural | technical | sports
    ticketPrice: '',
    description: '',
    status: 'upcoming', // ongoing | upcoming | completed | lastyearhit
    registrationLink: '',
    // Registration Configuration
    registrationMode: 'NOT_STARTED', // EXTERNAL_LINK | INTERNAL_FORM | NOT_STARTED
    externalRegistrationLink: '',
    paymentQR: '',
    paymentQRMessage: '', // Message to display with QR code
    googleSheetsUrl: '',
    formInstructions: '', // Instructions to display at the start of internal form
    organizerEmail: '', // Email to send registration confirmations to
    // ✅ NEW: Multi-step form configuration
    formType: 'SINGLE_STEP', // SINGLE_STEP | MULTI_STEP
    formSchema: [], // For single step forms (backward compatible)
    steps: [], // For multi-step forms
    // Images
    festImages: [], // array of URLs (mapped to galleryImages/coverImage)
    coverImage: '',
    // Artists (lineup)
    artists: [],
    artistsHeading: "Artists You'll Love",
    // Competitions heading
    competitionsHeading: "Competitions",
    // Contacts (multiple)
    contacts: [],
    // Sponsors
    sponsors: [],
  });
  const [highlightInput, setHighlightInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form builder functions for registration configuration
  const addFormField = () => {
    const uuid = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newField = {
      id: uuid,
      label: '',
      fieldName: `field_${uuid.slice(0, 8)}`, // Auto-generate safe default
      type: 'text',
      required: false,
      options: [],
      placeholder: ''
    };
    
    console.log('Adding new field:', newField);
    
    if (form.formType === 'SINGLE_STEP') {
      setForm(prevForm => ({
        ...prevForm,
        formSchema: [...prevForm.formSchema, newField]
      }));
    }
  };

  // ✅ NEW: Multi-step form management functions
  const addStep = () => {
    const newStep = {
      stepNumber: form.steps.length + 1,
      stepTitle: `Step ${form.steps.length + 1}`,
      stepDescription: '',
      fields: []
    };
    
    setForm(prevForm => ({
      ...prevForm,
      steps: [...prevForm.steps, newStep]
    }));
  };

  const updateStep = (stepIndex, fieldName, value) => {
    setForm(prevForm => {
      const newSteps = prevForm.steps.map((step, i) => {
        if (i === stepIndex) {
          return { ...step, [fieldName]: value };
        }
        return step;
      });
      return { ...prevForm, steps: newSteps };
    });
  };

  const removeStep = (stepIndex) => {
    setForm(prevForm => ({
      ...prevForm,
      steps: prevForm.steps.filter((_, i) => i !== stepIndex).map((step, i) => ({
        ...step,
        stepNumber: i + 1
      }))
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
      const newSteps = prevForm.steps.map((step, i) => {
        if (i === stepIndex) {
          return { ...step, fields: [...step.fields, newField] };
        }
        return step;
      });
      return { ...prevForm, steps: newSteps };
    });
  };

  const updateStepField = (stepIndex, fieldIndex, fieldName, value) => {
    setForm(prevForm => {
      const newSteps = prevForm.steps.map((step, i) => {
        if (i === stepIndex) {
          const newFields = step.fields.map((field, j) => {
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
      return { ...prevForm, steps: newSteps };
    });
  };

  const removeFieldFromStep = (stepIndex, fieldIndex) => {
    setForm(prevForm => {
      const newSteps = prevForm.steps.map((step, i) => {
        if (i === stepIndex) {
          return { ...step, fields: step.fields.filter((_, j) => j !== fieldIndex) };
        }
        return step;
      });
      return { ...prevForm, steps: newSteps };
    });
  };

  const addStepFieldOption = (stepIndex, fieldIndex) => {
    setForm(prevForm => {
      const newSteps = prevForm.steps.map((step, i) => {
        if (i === stepIndex) {
          const newFields = step.fields.map((field, j) => {
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
      return { ...prevForm, steps: newSteps };
    });
  };

  const updateStepFieldOption = (stepIndex, fieldIndex, optionIndex, value) => {
    setForm(prevForm => {
      const newSteps = prevForm.steps.map((step, i) => {
        if (i === stepIndex) {
          const newFields = step.fields.map((field, j) => {
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
      return { ...prevForm, steps: newSteps };
    });
  };

  const removeStepFieldOption = (stepIndex, fieldIndex, optionIndex) => {
    setForm(prevForm => {
      const newSteps = prevForm.steps.map((step, i) => {
        if (i === stepIndex) {
          const newFields = step.fields.map((field, j) => {
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
      return { ...prevForm, steps: newSteps };
    });
  };

  // Handle form type change
  const handleFormTypeChange = (newFormType) => {
    setForm(prevForm => {
      if (newFormType === 'MULTI_STEP' && prevForm.formType === 'SINGLE_STEP') {
        // Convert single step to multi-step
        const firstStep = {
          stepNumber: 1,
          stepTitle: 'Step 1',
          stepDescription: '',
          fields: prevForm.formSchema || []
        };
        return {
          ...prevForm,
          formType: newFormType,
          steps: [firstStep]
        };
      } else if (newFormType === 'SINGLE_STEP' && prevForm.formType === 'MULTI_STEP') {
        // Convert multi-step to single step (flatten all fields)
        const allFields = prevForm.steps.reduce((acc, step) => [...acc, ...step.fields], []);
        return {
          ...prevForm,
          formType: newFormType,
          formSchema: allFields,
          steps: []
        };
      }
      return { ...prevForm, formType: newFormType };
    });
  };

  const updateFormField = (index, fieldName, value) => {
    setForm(prevForm => {
      const newFormSchema = prevForm.formSchema.map((field, i) => {
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
        formSchema: newFormSchema
      };
    });
  };

  const removeFormField = (index) => {
    setForm(prevForm => ({
      ...prevForm,
      formSchema: prevForm.formSchema.filter((_, i) => i !== index)
    }));
  };

  const addFieldOption = (fieldIndex) => {
    setForm(prevForm => {
      const newFormSchema = [...prevForm.formSchema];
      if (!newFormSchema[fieldIndex].options) {
        newFormSchema[fieldIndex].options = [];
      }
      newFormSchema[fieldIndex] = {
        ...newFormSchema[fieldIndex],
        options: [...newFormSchema[fieldIndex].options, '']
      };
      return {
        ...prevForm,
        formSchema: newFormSchema
      };
    });
  };

  const updateFieldOption = (fieldIndex, optionIndex, value) => {
    setForm(prevForm => {
      const newFormSchema = [...prevForm.formSchema];
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
        formSchema: newFormSchema
      };
    });
  };

  const removeFieldOption = (fieldIndex, optionIndex) => {
    setForm(prevForm => {
      const newFormSchema = [...prevForm.formSchema];
      if (newFormSchema[fieldIndex].options) {
        newFormSchema[fieldIndex] = {
          ...newFormSchema[fieldIndex],
          options: newFormSchema[fieldIndex].options.filter((_, i) => i !== optionIndex)
        };
      }
      return {
        ...prevForm,
        formSchema: newFormSchema
      };
    });
  };

  // Hydrate when editing
  useEffect(() => {
    if (error) {
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }
    if (fest) {
      console.log('🔄 Loading fest data into form:', fest);
      console.log('  - fest.artistsHeading:', fest.artistsHeading);
      console.log('  - fest.competitionsHeading:', fest.competitionsHeading);
      console.log('  - fest.contacts:', fest.contacts);
      
      setForm({
        festName: fest.festName || fest.festival_name || '',
        subtitle: fest.subtitle || '',
        collegeName: fest.collegeName || fest.organizing_body || '',
        festDate: fest.dateTime || fest.festDate || '',
        venueDetails: fest.venue || fest.location || '',
        festType: fest.festType || fest.category || 'cultural',
        ticketPrice: fest.ticketPrice || '',
        description: fest.description || fest.overview || '',
        status: fest.status === 'lastyearhit' ? 'completed' : fest.status || 'upcoming',
        registrationLink: fest.registrationLink || fest.websiteLink || '',
        // Registration Configuration
        registrationMode: fest.registration?.mode || 'NOT_STARTED',
        externalRegistrationLink: fest.registration?.externalLink || '',
        paymentQR: fest.registration?.paymentQR || '',
        paymentQRMessage: fest.registration?.paymentQRMessage || '',
        googleSheetsUrl: fest.registration?.googleSheetsUrl || '',
        formInstructions: fest.registration?.formInstructions || '',
        organizerEmail: fest.registration?.organizerEmail || '',
        // ✅ NEW: Multi-step form support
        formType: fest.registration?.formType || 'SINGLE_STEP',
        formSchema: fest.registration?.formSchema?.map(field => ({
          ...field,
          id: field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Ensure each field has a unique ID
          fieldName: field.fieldName || `field_${(field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).slice(0, 8)}` // Ensure safe fieldName
        })) || [],
        steps: fest.registration?.steps?.map(step => ({
          ...step,
          fields: step.fields?.map(field => ({
            ...field,
            id: field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fieldName: field.fieldName || `field_${(field.id || crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).slice(0, 8)}`
          })) || []
        })) || [],
        festImages: fest.galleryImages || fest.gallery || (fest.coverImage ? [fest.coverImage] : []),
        coverImage: fest.coverImage || fest.heroImage || '',
        // Fix artist mapping to preserve existing images
        artists: fest.artists ? fest.artists.map(artist => ({
          artistPhoto: artist.image || '',
          artistName: artist.name || '',
          genre: artist.genre || '',
          collegeName: artist.collegeName || '',
          message: artist.message || '',
        })) : [],
        artistsHeading: fest.artistsHeading || "Artists You'll Love",
        contacts: fest.contacts || [],
        // Fix sponsor mapping to preserve existing images
        sponsors: fest.sponsors ? fest.sponsors.map(sponsor => ({
          sponsorImage: sponsor.logo || '',
          sponsorName: sponsor.name || '',
        })) : [],
        competitionsHeading: fest.competitionsHeading || "Competitions",
      });
      
      console.log('✅ Form state set with values:');
      console.log('  - artistsHeading will be:', fest.artistsHeading || "Artists You'll Love");
      console.log('  - competitionsHeading will be:', fest.competitionsHeading || "Competitions");
      console.log('  - contacts will be:', fest.contacts || []);
    }
  }, [fest, error]);

  const addHighlight = () => {
    if (highlightInput.trim()) {
      setForm({
        ...form,
        highlights: [...form.highlights, highlightInput.trim()],
      });
      setHighlightInput('');
    }
  };

  const removeHighlight = (index) => {
    setForm({
      ...form,
      highlights: form.highlights.filter((_, i) => i !== index),
    });
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setForm({
        ...form,
        tags: [...form.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    setForm({
      ...form,
      tags: form.tags.filter((_, i) => i !== index),
    });
  };

  const addArtist = () => {
    setForm({
      ...form,
      artists: [
        ...form.artists,
        {
          artistPhoto: '',
          artistName: '',
          genre: '',
          collegeName: '',
          message: '',
        },
      ],
    });
  };

  const updateArtist = (index, field, value) => {
    const updatedArtists = [...form.artists];
    updatedArtists[index] = { ...updatedArtists[index], [field]: value };
    setForm({ ...form, artists: updatedArtists });
  };

  const removeArtist = (index) => {
    setForm({
      ...form,
      artists: form.artists.filter((_, i) => i !== index),
    });
  };

  const addContact = () => {
    setForm({
      ...form,
      contacts: [
        ...form.contacts,
        { name: '', phone: '', email: '', instagramId: '', role: '' },
      ],
    });
  };

  const updateContact = (index, field, value) => {
    const updated = [...form.contacts];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, contacts: updated });
  };

  const removeContact = (index) => {
    setForm({
      ...form,
      contacts: form.contacts.filter((_, i) => i !== index),
    });
  };

  const addSponsor = () => {
    setForm({
      ...form,
      sponsors: [...form.sponsors, { sponsorImage: '', sponsorName: '' }],
    });
  };

  const updateSponsor = (index, field, value) => {
    const updatedSponsors = [...form.sponsors];
    updatedSponsors[index] = { ...updatedSponsors[index], [field]: value };
    setForm({ ...form, sponsors: updatedSponsors });
  };

  const removeSponsor = (index) => {
    setForm({
      ...form,
      sponsors: form.sponsors.filter((_, i) => i !== index),
    });
  };

  const handleImageUpload = async (file, field, index = null) => {
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'crwdctrl/fests');

      const response = await fetch(`${API_BASE_URL}/admin/upload/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const data = await response.json();
      const imageUrl = data.url;

      // Handle different field types
      if (field === 'festImages' || field === 'galleryImages') {
        setForm({ ...form, festImages: [...(form.festImages || []), imageUrl], galleryImages: [...(form.galleryImages || []), imageUrl] });
      } else if (field.startsWith('artistPhoto_') && index !== null) {
        // Handle artist photo upload
        updateArtist(index, 'artistPhoto', imageUrl);
      } else if (field.startsWith('sponsorImage_') && index !== null) {
        // Handle sponsor image upload
        updateSponsor(index, 'sponsorImage', imageUrl);
      } else {
        setForm({ ...form, [field]: imageUrl });
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMultipleImageUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploadingImage(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('images', file);
      });
      formData.append('folder', 'crwdctrl/fests');

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
        festImages: [...(form.festImages || []), ...newUrls],
        galleryImages: [...(form.galleryImages || []), ...newUrls]
      });
    } catch (err) {
      console.error('Error uploading images:', err);
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImage(false);
    }
  };

  const submit = async () => {
  console.log('🚀 Submit function called');
  setError('');
  setLoading(true);

  try {
    // Check if admin token exists
    const adminToken = localStorage.getItem('admin_token');
    console.log('🔑 Admin token check:', adminToken ? 'Present' : 'Missing');
    if (!adminToken) {
      console.error('❌ No admin token found');
      setError('Admin session expired. Please log in again.');
      setLoading(false);
      return;
    }

    console.log('📋 Submitting fest form with data:', form);
    
    // Required validation
    if (
      !form.festName ||
      !form.collegeName ||
      !form.festType ||
      !form.venueDetails ||
      !form.description
    ) {
      console.error('❌ Required fields missing');
      setError('Please fill all required fields');
      setLoading(false);
      return;
    }

    // Validate internal form mandatory fields
    if (form.registrationMode === 'INTERNAL_FORM') {
      console.log('🔍 Validating internal form fields...');
      if (!form.paymentQR) {
        console.error('❌ Payment QR missing');
        setError('Payment QR code is required for internal form registration');
        setLoading(false);
        return;
      }
      if (!form.googleSheetsUrl) {
        console.error('❌ Google Sheets URL missing');
        setError('Google Sheets URL is required for internal form registration');
        setLoading(false);
        return;
      }
      if (!form.organizerEmail) {
        console.error('❌ Organizer email missing');
        setError('Organizer email is required for internal form registration');
        setLoading(false);
        return;
      }
      // Validate email format
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(form.organizerEmail)) {
        console.error('❌ Invalid organizer email format');
        setError('Please provide a valid organizer email address');
        setLoading(false);
        return;
      }
      // Validate Google Sheets URL format
      const validUrlPattern = /^https:\/\/docs\.google\.com\/spreadsheets\/(d\/[a-zA-Z0-9-_]+|u\/\d+\/d\/[a-zA-Z0-9-_]+)/;
      if (!validUrlPattern.test(form.googleSheetsUrl)) {
        console.error('❌ Invalid Google Sheets URL format');
        setError('Please provide a valid Google Sheets URL (e.g., https://docs.google.com/spreadsheets/d/your-sheet-id/edit)');
        setLoading(false);
        return;
      }
    }

    console.log('✅ All validations passed');

    // ✅ FINAL PAYLOAD — MATCHES BACKEND 100%
    const payload = {
      festName: form.festName,
      subtitle: form.subtitle,
      collegeName: form.collegeName,
      festType: form.festType,
      festDate: form.festDate,        // ✅ single date field
      venue: form.venueDetails,
      ticketPrice: form.ticketPrice,
      description: form.description,
      registrationLink: form.registrationLink,
      status: form.status,

      coverImage: form.coverImage || form.festImages[0] || '',
      galleryImages: form.festImages,

      // 🎤 Artists - preserve existing images
      artists: form.artists.map(a => ({
        name: a.artistName,
        genre: a.genre,
        image: a.artistPhoto, // Keep existing image URL
        collegeName: a.collegeName,
        message: a.message,
      })),
      // ✅ FIXED: Direct assignment without fallback to default
      artistsHeading: form.artistsHeading,

      // 📞 Contacts
      contacts: form.contacts,

      // 🤝 Sponsors - preserve existing images
      sponsors: form.sponsors.map(s => ({
        name: s.sponsorName,
        logo: s.sponsorImage, // Keep existing image URL
      })),
      // ✅ FIXED: Direct assignment without fallback to default
      competitionsHeading: form.competitionsHeading,

      // 📝 Registration Configuration
      registration: {
        mode: form.registrationMode,
        externalLink: form.externalRegistrationLink,
        paymentQR: form.paymentQR,
        paymentQRMessage: form.paymentQRMessage,
        googleSheetsUrl: form.googleSheetsUrl,
        formInstructions: form.formInstructions,
        organizerEmail: form.organizerEmail,
          // ✅ FIXED: Preserve form schema regardless of form type
        formType: form.formType,
        formSchema: form.formSchema || [],
        steps: form.steps || []
      },
    };

    const method = fest ? 'PUT' : 'POST';
    const url = fest
      ? `${API_BASE_URL}/admin/fests/${fest._id}`
      : `${API_BASE_URL}/admin/fests`;

    console.log('🌐 Making API call to:', url);
    console.log('📤 Method:', method);
    console.log('📦 Payload:', payload);
    console.log('🔍 DEBUG - Registration data in payload:');
    console.log('  - registration.formType:', payload.registration.formType);
    console.log('  - registration.formSchema:', payload.registration.formSchema);
    console.log('  - registration.steps:', payload.registration.steps);
    console.log('  - form.formType:', form.formType);
    console.log('  - form.formSchema:', form.formSchema);
    console.log('  - form.steps:', form.steps);
    console.log('🔍 DEBUG - Key fields in payload:');
    console.log('  - artistsHeading:', payload.artistsHeading, '(type:', typeof payload.artistsHeading, ')');
    console.log('  - competitionsHeading:', payload.competitionsHeading, '(type:', typeof payload.competitionsHeading, ')');
    console.log('  - contacts:', payload.contacts, '(type:', typeof payload.contacts, ', length:', payload.contacts?.length, ')');
    console.log('  - registration.mode:', payload.registration.mode, '(type:', typeof payload.registration.mode, ')');
    console.log('  - form.artistsHeading:', form.artistsHeading, '(type:', typeof form.artistsHeading, ')');
    console.log('  - form.competitionsHeading:', form.competitionsHeading, '(type:', typeof form.competitionsHeading, ')');
    console.log('  - form.contacts:', form.contacts, '(type:', typeof form.contacts, ', length:', form.contacts?.length, ')');
    console.log('  - form.registrationMode:', form.registrationMode, '(type:', typeof form.registrationMode, ')');
    console.log('🔑 Admin token:', adminToken ? `Present (${adminToken.substring(0, 20)}...)` : 'Missing');

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);
    console.log('📡 Response headers:', response.headers);

    // Debug: Check what we actually received
    const responseText = await response.text();
    console.log('📡 Raw response:', responseText);

    if (!response.ok) {
      let err;
      try {
        err = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse error response as JSON:', parseError);
        throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
      }
      console.error('❌ API Error:', err);
      throw new Error(err.message || 'Failed to save fest');
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse success response as JSON:', parseError);
      throw new Error('Invalid JSON response from server');
    }
    console.log('✅ Success result:', result);

    // ✅ CRITICAL: Add cache busting to ensure changes are visible immediately
    console.log('🔄 Clearing browser cache and triggering refresh...');
    
    // Clear any cached data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    // Force a small delay to ensure backend has processed the changes
    await new Promise(resolve => setTimeout(resolve, 500));

    onSaved();
    onClose();

  } catch (err) {
    console.error('💥 Error saving fest:', err);
    setError(err.message || 'Failed to save fest');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1B1C1E] rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1B1C1E] border-b border-gray-800 p-6 flex items-center justify-between z-10">
          <h3 className="text-2xl font-bold">
            {fest ? 'Edit Fest' : 'Create New Fest'}
        </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    step === s ? 'bg-[#0ECCEE] text-black' : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {s === 1 && 'Fest Details'}
                  {s === 2 && 'Artists'}
                  {s === 3 && 'Contacts'}
                  {s === 4 && 'Sponsors'}
                  {s === 5 && 'Registration'}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">Step {step} of 5</span>
          </div>

          {/* STEP 1: Fest core details */}
          {step === 1 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold border-b border-gray-700 pb-2">Fest Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Fest Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Aarohan 2026"
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.festName}
                  onChange={(e) => setForm({ ...form, festName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Festival Name (Display)</label>
                <input
                  type="text"
                  placeholder="e.g., AAROHAN 2026"
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">College Name *</label>
                <input
                  type="text"
                  placeholder="e.g., MIT-WPU"
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.collegeName}
                  onChange={(e) => setForm({ ...form, collegeName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fest Date / Schedule</label>
                <input
                  type="text"
                  placeholder='e.g., "Dec 10-12, 2025" or "To be announced"'
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.festDate}
                  onChange={(e) => setForm({ ...form, festDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fest Type *</label>
                <select
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.festType}
                  onChange={(e) => setForm({ ...form, festType: e.target.value, category: e.target.value })}
                >
                  <option value="cultural">Cultural</option>
                  <option value="technical">Technical</option>
                  <option value="sports">Sports</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status *</label>
                <select
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="beyondcampus">Beyond Campus</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Venue Details *</label>
                <input
                  type="text"
                  placeholder="e.g., Symbiosis Junior College, Kiwale"
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.venueDetails}
                  onChange={(e) => setForm({ ...form, venueDetails: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Registration Link</label>
                <input
                  type="url"
                  placeholder="https://forms.google.com/..."
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.registrationLink}
                  onChange={(e) => setForm({ ...form, registrationLink: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Fest Images (can add more than one)</label>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleMultipleImageUpload(e.target.files)}
                    className="hidden"
                    id="fest-images"
                    disabled={uploadingImage}
                  />
                  <label
                    htmlFor="fest-images"
                    className={`cursor-pointer flex flex-col items-center gap-2 ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {uploadingImage ? (
                      <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-400">
                      {uploadingImage ? 'Uploading...' : 'Click to upload fest images (multiple allowed)'}
                    </span>
                  </label>
                </div>
                {form.festImages && form.festImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {form.festImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Fest ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                        <button
                          onClick={() => setForm({ ...form, festImages: form.festImages.filter((_, i) => i !== idx) })}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                rows={4}
                placeholder="Brief description of the fest..."
                className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          )}

          {/* STEP 2: Artist lineup */}
          {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold border-b border-gray-700 pb-2 flex-1">Artists</h4>
              <button
                onClick={addArtist}
                className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Add Artist
              </button>
            </div>
            
            {/* Artists Section Heading */}
            <div className="bg-[#2A2B2D] p-4 rounded-lg">
              <label className="block text-sm font-medium mb-2">Artists Section Heading</label>
              <input
                type="text"
                value={form.artistsHeading || ""}
                onChange={(e) => {
                  console.log('🎨 Artists heading changed:', e.target.value);
                  setForm({ ...form, artistsHeading: e.target.value });
                }}
                className="w-full p-3 bg-[#1B1C1E] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#0ECCEE] focus:outline-none"
                placeholder="Artists You'll Love"
              />
              <p className="text-xs text-gray-400 mt-1">This heading will appear above the artists section. Leave empty to use default: "Artists You'll Love"</p>
            </div>

            {form.artists.map((artist, index) => (
              <div key={index} className="bg-[#2A2B2D] p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Artist {index + 1}</span>
                  <button
                    onClick={() => removeArtist(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Artist Name"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={artist.artistName}
                    onChange={(e) => updateArtist(index, 'artistName', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Genre"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={artist.genre}
                    onChange={(e) => updateArtist(index, 'genre', e.target.value)}
                  />
                  <div>
                    <input
                      type="text"
                      placeholder="Artist Photo URL"
                      className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none mb-2"
                      value={artist.artistPhoto}
                      onChange={(e) => updateArtist(index, 'artistPhoto', e.target.value)}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          handleImageUpload(e.target.files[0], `artistPhoto_${index}`, index);
                        }
                      }}
                      className="hidden"
                      id={`artist-photo-${index}`}
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor={`artist-photo-${index}`}
                      className={`text-xs text-[#0ECCEE] cursor-pointer hover:underline ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploadingImage ? 'Uploading...' : 'Or upload image'}
                    </label>
                    {artist.artistPhoto && (
                      <div className="mt-2">
                        <img src={artist.artistPhoto} alt="Artist preview" className="w-16 h-16 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="College Name"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={artist.collegeName}
                    onChange={(e) => updateArtist(index, 'collegeName', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Message / Highlight"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={artist.message}
                    onChange={(e) => updateArtist(index, 'message', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          )}

          {/* STEP 3: Contacts */}
          {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold border-b border-gray-700 pb-2 flex-1">Contact Details</h4>
              <button
                onClick={addContact}
                className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Add Contact
              </button>
            </div>
            {form.contacts.map((contact, index) => (
              <div key={index} className="bg-[#2A2B2D] p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Contact {index + 1}</span>
                  <button
                    onClick={() => removeContact(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Name"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={contact.name}
                    onChange={(e) => updateContact(index, 'name', e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={contact.phone}
                    onChange={(e) => updateContact(index, 'phone', e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={contact.email}
                    onChange={(e) => updateContact(index, 'email', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Instagram ID"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={contact.instagramId}
                    onChange={(e) => updateContact(index, 'instagramId', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Role (e.g., General Secretary, Coordinator)"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={contact.role}
                    onChange={(e) => updateContact(index, 'role', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          )}

          {/* STEP 4: Sponsors */}
          {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold border-b border-gray-700 pb-2 flex-1">Sponsors</h4>
              <button
                onClick={addSponsor}
                className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Add Sponsor
              </button>
            </div>
            {form.sponsors.map((sponsor, index) => (
              <div key={index} className="bg-[#2A2B2D] p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Sponsor {index + 1}</span>
                  <button
                    onClick={() => removeSponsor(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Sponsor Name"
                    className="px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                    value={sponsor.sponsorName}
                    onChange={(e) => updateSponsor(index, 'sponsorName', e.target.value)}
                  />
                  <div>
                    <input
                      type="text"
                      placeholder="Logo / Image URL"
                      className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none mb-2"
                      value={sponsor.sponsorImage}
                      onChange={(e) => updateSponsor(index, 'sponsorImage', e.target.value)}
                    />
          <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          handleImageUpload(e.target.files[0], `sponsorImage_${index}`, index);
                        }
                      }}
                      className="hidden"
                      id={`sponsor-image-${index}`}
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor={`sponsor-image-${index}`}
                      className={`text-xs text-[#0ECCEE] cursor-pointer hover:underline ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploadingImage ? 'Uploading...' : 'Or upload image'}
                    </label>
                    {sponsor.sponsorImage && (
                      <div className="mt-2">
                        <img src={sponsor.sponsorImage} alt="Sponsor preview" className="w-16 h-16 object-cover rounded-lg" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* STEP 5: Registration Configuration */}
          {step === 5 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold border-b border-gray-700 pb-2">Registration Configuration</h4>
            
            {/* Registration Mode Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium mb-2">Registration Mode *</label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="registrationMode"
                    value="NOT_STARTED"
                    checked={form.registrationMode === 'NOT_STARTED'}
                    onChange={(e) => setForm({ ...form, registrationMode: e.target.value })}
                    className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                  />
                  <span className="text-sm">Registration Not Started</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="registrationMode"
                    value="EXTERNAL_LINK"
                    checked={form.registrationMode === 'EXTERNAL_LINK'}
                    onChange={(e) => setForm({ ...form, registrationMode: e.target.value })}
                    className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                  />
                  <span className="text-sm">External Registration Link</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="registrationMode"
                    value="INTERNAL_FORM"
                    checked={form.registrationMode === 'INTERNAL_FORM'}
                    onChange={(e) => setForm({ ...form, registrationMode: e.target.value })}
                    className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                  />
                  <span className="text-sm">Internal Website Form</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="registrationMode"
                    value="CLOSED"
                    checked={form.registrationMode === 'CLOSED'}
                    onChange={(e) => setForm({ ...form, registrationMode: e.target.value })}
                    className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                  />
                  <span className="text-sm">Registration Closed</span>
                </label>
              </div>
            </div>

            {/* External Link Input */}
            {form.registrationMode === 'EXTERNAL_LINK' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-2">External Registration Link *</label>
                <input
                  type="url"
                  placeholder="https://forms.google.com/..."
                  className="w-full px-4 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                  value={form.externalRegistrationLink}
                  onChange={(e) => setForm({ ...form, externalRegistrationLink: e.target.value })}
                />
              </div>
            )}

            {/* Form Builder */}
            {form.registrationMode === 'INTERNAL_FORM' && (
              <div className="space-y-6">
                {/* Section 1: Basic Configuration */}
                <div className="bg-[#2A2B2D] p-4 rounded-lg">
                  <h5 className="text-lg font-medium mb-4 text-[#0ECCEE] border-b border-gray-600 pb-2">Basic Configuration</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Form Instructions */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium mb-2">Form Instructions</label>
                      <textarea
                        rows={3}
                        placeholder="Enter instructions that will be displayed at the start of the registration form..."
                        className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none text-sm"
                        value={form.formInstructions}
                        onChange={(e) => setForm({ ...form, formInstructions: e.target.value })}
                      />
                      <p className="text-xs text-gray-400">These instructions will appear at the top of the registration form</p>
                    </div>

                    {/* Organizer Email */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium mb-2">Organizer Email *</label>
                      <input
                        type="email"
                        placeholder="organizer@college.edu"
                        className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                        value={form.organizerEmail}
                        onChange={(e) => setForm({ ...form, organizerEmail: e.target.value })}
                      />
                      <p className="text-xs text-gray-400">Registration confirmation emails will be sent to this email</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Google Sheets Integration */}
                <div className="bg-[#2A2B2D] p-4 rounded-lg">
                  <h5 className="text-lg font-medium mb-4 text-[#0ECCEE] border-b border-gray-600 pb-2">Google Sheets Integration</h5>
                  
                  {/* Google Sheets URL */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium mb-2">Google Sheets URL *</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                        className="flex-1 px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none"
                        value={form.googleSheetsUrl}
                        onChange={(e) => setForm({ ...form, googleSheetsUrl: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!form.googleSheetsUrl) {
                            setError('Please enter a Google Sheets URL first');
                            return;
                          }
                          
                          setUploadingImage(true);
                          try {
                            const response = await fetch(`${API_BASE_URL}/registrations/admin/test-google-sheets`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
                              },
                              body: JSON.stringify({ googleSheetsUrl: form.googleSheetsUrl }),
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                              setError(`✅ Connection successful! Sheet: "${result.title}"`);
                            } else {
                              setError(`❌ Connection failed: ${result.error}`);
                            }
                          } catch (err) {
                            setError('❌ Failed to test connection');
                          } finally {
                            setUploadingImage(false);
                          }
                        }}
                        disabled={uploadingImage}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {uploadingImage ? 'Testing...' : 'Test'}
                      </button>
                    </div>
                    <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-xs text-green-300">
                      <p className="font-medium mb-2">📋 Setup Instructions:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Create a new Google Sheet</li>
                        <li>Share with: <code className="bg-gray-800 px-1 rounded text-xs">crwdctrl-sheets@crwdctrl-sheets.iam.gserviceaccount.com</code></li>
                        <li>Give "Editor" permissions</li>
                        <li>Copy and paste the URL here</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Section 3: Form Type Selection */}
                <div className="bg-[#2A2B2D] p-4 rounded-lg">
                  <h5 className="text-lg font-medium mb-4 text-[#0ECCEE] border-b border-gray-600 pb-2">Form Configuration</h5>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-3">Form Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="formType"
                            value="SINGLE_STEP"
                            checked={form.formType === 'SINGLE_STEP'}
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
                            checked={form.formType === 'MULTI_STEP'}
                            onChange={(e) => handleFormTypeChange(e.target.value)}
                            className="w-4 h-4 text-[#0ECCEE] bg-[#2A2B2D] border-gray-700 focus:ring-[#0ECCEE] focus:ring-2"
                          />
                          <span className="text-sm">Multi-Step Form</span>
                        </label>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {form.formType === 'SINGLE_STEP' 
                          ? 'All form fields will be displayed on a single page'
                          : 'Form will be split into multiple steps for better user experience'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 4: Form Fields - Single Step */}
                {form.formType === 'SINGLE_STEP' && (
                  <div className="bg-[#2A2B2D] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-lg font-medium text-[#0ECCEE] border-b border-gray-600 pb-2 flex-1">Registration Form Fields</h5>
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
                      {form.formSchema.map((field, index) => (
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

                      {form.formSchema.length === 0 && (
                        <div className="text-center py-6 text-gray-400">
                          <p>No form fields added yet. Click "Add Field" to create your registration form.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 4: Form Steps - Multi Step */}
                {form.formType === 'MULTI_STEP' && (
                  <div className="bg-[#2A2B2D] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-lg font-medium text-[#0ECCEE] border-b border-gray-600 pb-2 flex-1">Multi-Step Form Configuration</h5>
                      <button
                        type="button"
                        onClick={addStep}
                        className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2"
                      >
                        <Plus size={16} />
                        Add Step
                      </button>
                    </div>

                    <div className="space-y-4">
                      {form.steps.map((step, stepIndex) => (
                        <div key={`step-${stepIndex}`} className="bg-[#1B1C1E] p-4 rounded-lg border border-gray-700">
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
                              className="w-full px-3 py-2 rounded-lg bg-[#2A2B2D] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm"
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

                            {step.fields.map((field, fieldIndex) => (
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

                            {step.fields.length === 0 && (
                              <div className="text-center py-4 text-gray-500 bg-[#2A2B2D] rounded-lg">
                                <p className="text-sm">No fields in this step. Click "Add Field" to add form fields.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {form.steps.length === 0 && (
                        <div className="text-center py-6 text-gray-400">
                          <p>No steps created yet. Click "Add Step" to create your multi-step form.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 5: Payment Information - Compact */}
                <div className="bg-[#2A2B2D] p-4 rounded-lg">
                  <h5 className="text-lg font-medium mb-4 text-[#0ECCEE] border-b border-gray-600 pb-2">Payment Information</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Payment QR Upload - Compact */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium mb-2">Payment QR Code *</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setUploadingImage(true);
                              try {
                                const formData = new FormData();
                                formData.append('image', file);
                                formData.append('folder', 'crwdctrl/payment-qr');

                                const response = await fetch(`${API_BASE_URL}/admin/upload/image`, {
                                  method: 'POST',
                                  headers: {
                                    Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
                                  },
                                  body: formData,
                                });

                                if (!response.ok) throw new Error('Upload failed');
                                const data = await response.json();
                                setForm({ ...form, paymentQR: data.url });
                              } catch (err) {
                                setError('Failed to upload payment QR');
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                          }}
                          className="hidden"
                          id="paymentQR"
                        />
                        <label
                          htmlFor="paymentQR"
                          className="px-3 py-2 bg-[#1B1C1E] border border-gray-700 rounded-lg cursor-pointer hover:bg-[#3A3B3D] transition-colors flex items-center gap-2 text-sm"
                        >
                          {uploadingImage ? <Loader className="w-4 h-4 animate-spin" /> : <Upload size={16} />}
                          {uploadingImage ? 'Uploading...' : 'Upload QR'}
                        </label>
                        {form.paymentQR && (
                          <div className="flex items-center gap-2">
                            <img src={form.paymentQR} alt="Payment QR" className="w-10 h-10 object-cover rounded" />
                            <span className="text-xs text-green-400">✓ Uploaded</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Upload QR code for payment processing</p>
                    </div>

                    {/* Payment QR Message */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium mb-2">Payment Instructions</label>
                      <textarea
                        rows={3}
                        placeholder="Enter payment instructions (e.g., Scan QR to pay ₹500 registration fee...)"
                        className="w-full px-3 py-2 rounded-lg bg-[#1B1C1E] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none resize-none text-sm"
                        value={form.paymentQRMessage}
                        onChange={(e) => setForm({ ...form, paymentQRMessage: e.target.value })}
                      />
                      <p className="text-xs text-gray-400">This message will be displayed with the QR code</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info message based on mode */}
            {form.registrationMode === 'NOT_STARTED' && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-300">
                  Registration is not started. The "Register Now" button will be disabled for users.
                </p>
              </div>
            )}

            {form.registrationMode === 'CLOSED' && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-300">
                  Registration is closed. The button will show "Registration Closed" and be disabled for users.
                </p>
              </div>
            )}

            {/* Competitions Section Heading */}
            <div className="bg-[#2A2B2D] p-4 rounded-lg">
              <label className="block text-sm font-medium mb-2">Competitions Section Heading</label>
              <input
                type="text"
                value={form.competitionsHeading || ""}
                onChange={(e) => {
                  console.log('🏆 Competitions heading changed:', e.target.value);
                  setForm({ ...form, competitionsHeading: e.target.value });
                }}
                className="w-full p-3 bg-[#1B1C1E] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#0ECCEE] focus:outline-none"
                placeholder="Competitions"
              />
              <p className="text-xs text-gray-400 mt-1">This heading will appear above the competitions section. Leave empty to use default: "Competitions"</p>
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#1B1C1E] border-t border-gray-800 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || uploadingImage}
            className="px-6 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold hover:bg-[#0ECCEE]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Fest'}
          </button>
        </div>
      </div>
    </div>
  );
}
