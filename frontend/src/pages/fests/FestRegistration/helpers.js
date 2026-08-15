import {
  discardStalePaymentRecovery,
  getPendingPayment,
  shouldResumePendingPayment,
} from '../../../utils/deepLinks';
import {
  loadFestRegistrationSuccess,
  clearFestRegistrationSuccess,
} from '../../../utils/registrationDraft';

export function getInitialFestRegistrationUi(pathname, search, navigationState = null, options = {}) {
  const freshStart =
    navigationState?.freshRegistration
    || navigationState?.prefetch
    || navigationState?.paymentCancelled;

  if (freshStart) {
    clearFestRegistrationSuccess();
  }

  const restoredSuccess =
    !freshStart && (
      navigationState?.registrationComplete
        ? {
            registrationId: navigationState.registrationId || null,
            festId: options.festId || '',
            competitionId: options.competitionId || navigationState.competitionId || '',
          }
        : loadFestRegistrationSuccess(
            options.festId,
            options.competitionId || navigationState?.competitionId || null,
          )
    );

  if (restoredSuccess || navigationState?.registrationComplete) {
    return {
      completingPayment: false,
      success: true,
      registrationId: restoredSuccess?.registrationId || navigationState?.registrationId || null,
    };
  }

  discardStalePaymentRecovery({ pathname, search, navigationState });
  const currentPath = `${pathname}${search}`;
  const resumingPayment = shouldResumePendingPayment(
    getPendingPayment(),
    currentPath,
    search,
  );
  return { completingPayment: resumingPayment, success: false, registrationId: null };
}

export function generateFieldId(field) {
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
}

export function getSchemaFieldsFromRegistration(registration = {}) {
  if (registration.formType === 'MULTI_STEP' && registration.steps?.length) {
    return registration.steps.flatMap((step) => step.fields || []);
  }
  return registration.formSchema || [];
}

export function buildInitialFormData(registration) {
  const initialData = {};
  getSchemaFieldsFromRegistration(registration).forEach((field) => {
    const fieldId = generateFieldId(field);
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
  return initialData;
}

/** Merge API schema defaults with existing user input — never wipe typed fields on background refresh. */
export function mergeFormDataWithSchema(prev, registration) {
  const schemaDefaults = buildInitialFormData(registration);
  if (!prev || Object.keys(prev).length === 0) return schemaDefaults;

  const merged = { ...schemaDefaults };
  for (const [key, value] of Object.entries(prev)) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      merged[key] = value;
    }
  }
  return merged;
}

export function compressImage(file) {
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
}
