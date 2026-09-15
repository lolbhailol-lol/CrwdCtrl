export const TREK_FORM_FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'tel', label: 'Phone Number' },
    { value: 'number', label: 'Number' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'select', label: 'Dropdown' },
    { value: 'radio', label: 'Radio Buttons' },
    { value: 'checkbox', label: 'Checkboxes' },
    { value: 'agree', label: 'I Agree / Consent' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'url', label: 'URL / Link' },
    { value: 'file', label: 'File Upload' },
    { value: 'image', label: 'Image Upload' },
];

export const TREK_FORM_OPTION_FIELD_TYPES = ['select', 'radio', 'checkbox'];

export function createEmptyTrekFormField() {
    return {
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: '',
        fieldName: '',
        type: 'text',
        required: false,
        options: [],
        placeholder: '',
    };
}

export function createAgreeTrekFormField() {
    return {
        ...createEmptyTrekFormField(),
        type: 'agree',
        label: 'I agree to the terms and conditions',
        fieldName: 'i_agree',
        required: true,
        placeholder: '',
    };
}

export function isTrekFormFieldEmpty(field, value) {
    if (field.type === 'checkbox') {
        return !Array.isArray(value) || value.length === 0;
    }
    if (field.type === 'agree') {
        return value !== true && value !== 'yes' && value !== 'true';
    }
    if (value === null || value === undefined) return true;
    return !String(value).trim();
}
