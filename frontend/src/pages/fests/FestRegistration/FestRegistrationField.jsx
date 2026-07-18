import { Loader } from 'lucide-react';
import { scrollFieldIntoView } from '../../../utils/registrationDraft';

export default function FestRegistrationField({
  field,
  fieldId,
  currentData,
  onFieldChange,
  isDark,
  fest,
  uploadingFiles,
  onFileUpload,
}) {
  return (
    <div className="space-y-2">
      <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {field.label}
        {field.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        {renderField(field, fieldId, currentData, onFieldChange, {
          isDark,
          fest,
          uploadingFiles,
          onFileUpload,
        })}
      </div>
    </div>
  );
}

function renderField(field, fieldId, currentData, onFieldChange, ctx) {
  const { isDark, fest, uploadingFiles, onFileUpload } = ctx;
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
            onFocus={scrollFieldIntoView}
            required={field.required}
            autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'on'}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
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
            onFocus={scrollFieldIntoView}
            required={field.required}
            rows={3}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm resize-none transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
          />
        );
      
      case 'select':
        return (
          <select
            id={fieldId}
            name={fieldId}
            value={value}
            onChange={(e) => onFieldChange(fieldId, e.target.value)}
            onFocus={scrollFieldIntoView}
            required={field.required}
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
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
                  className={`w-4 h-4 text-[#0ECCEE] focus:ring-[#0ECCEE] focus:ring-2 ${isDark ? 'bg-[#1D1E20] border-gray-600' : 'bg-white border-gray-300'}`}
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
                    className={`w-4 h-4 text-[#0ECCEE] rounded focus:ring-[#0ECCEE] focus:ring-2 ${isDark ? 'bg-[#1D1E20] border-gray-600' : 'bg-white border-gray-300'}`}
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
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
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
                  onFileUpload(file, fieldId);
                }
              }}
              required={field.required}
              className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[#0ECCEE] file:text-black hover:file:bg-[#0ECCEE]/80 transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
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
      
      case 'group': {
        // Group field type - allows multiple entries with sub-fields
        const groupEntries = Array.isArray(value) ? value : [];
        
        return (
          <div className="space-y-4">
            {groupEntries.map((entry, entryIndex) => (
              <div key={`group-entry-${fieldId}-${entryIndex}`} className={`p-4 rounded-lg border ${isDark ? 'bg-[#111213] border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
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
                            className={`w-full px-3 py-2 rounded-lg border focus:border-[#0ECCEE] focus:outline-none text-sm ${isDark ? 'bg-[#1D1E20] border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
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
                          className={`w-full px-3 py-2 rounded-lg border focus:border-[#0ECCEE] focus:outline-none text-sm ${isDark ? 'bg-[#1D1E20] border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
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
      }

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
                className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
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
                  className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900'}`}
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
            className={`w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`}
          />
        );
  }
}
