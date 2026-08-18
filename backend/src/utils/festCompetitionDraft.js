/**
 * Sanitize fest/competition registration drafts stored on PaymentOrder.
 * Keeps MindSpark roster fields (team_members, team_responses) for webhook fulfill.
 */

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeFileMeta(value) {
  if (!isPlainObject(value)) return false;
  return Boolean(value.fileName || value.uploaded || value.ready || value.fileType);
}

function sanitizeDraftValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    const items = value.map(sanitizeDraftValue).filter((item) => item !== undefined);
    return items;
  }
  if (looksLikeFileMeta(value)) return undefined;
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key.endsWith('_file')) continue;
      const next = sanitizeDraftValue(nested);
      if (next !== undefined) out[key] = next;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function sanitizeFestCompetitionDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const formData = raw.formData && typeof raw.formData === 'object' ? raw.formData : raw.values;
  const stepData = raw.stepData && typeof raw.stepData === 'object' ? raw.stepData : null;

  const cleanForm = {};
  if (formData && typeof formData === 'object') {
    for (const [key, value] of Object.entries(formData)) {
      if (key.endsWith('_file')) continue;
      const next = sanitizeDraftValue(value);
      if (next !== undefined) cleanForm[key] = next;
    }
  }

  const cleanSteps = {};
  if (stepData) {
    for (const [step, fields] of Object.entries(stepData)) {
      if (!fields || typeof fields !== 'object') continue;
      const slice = {};
      for (const [key, value] of Object.entries(fields)) {
        if (key.endsWith('_file')) continue;
        const next = sanitizeDraftValue(value);
        if (next !== undefined) slice[key] = next;
      }
      if (Object.keys(slice).length) cleanSteps[step] = slice;
    }
  }

  if (!Object.keys(cleanForm).length && !Object.keys(cleanSteps).length) return null;

  return {
    formData: cleanForm,
    stepData: cleanSteps,
    currentStep: raw.currentStep ?? 1,
    festId: raw.festId ? String(raw.festId).trim() : '',
    competitionId: raw.competitionId ? String(raw.competitionId).trim() : '',
    couponCode: raw.couponCode ? String(raw.couponCode).trim().toUpperCase() : '',
  };
}

function draftToResponses(draft) {
  if (!draft) return {};
  const merged = { ...(draft.formData || {}) };
  if (draft.stepData && typeof draft.stepData === 'object') {
    for (const fields of Object.values(draft.stepData)) {
      if (fields && typeof fields === 'object') Object.assign(merged, fields);
    }
  }
  return merged;
}

module.exports = {
  sanitizeDraftValue,
  sanitizeFestCompetitionDraft,
  draftToResponses,
};
