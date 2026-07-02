const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

export function festRegDraftKey(festId, competitionId) {
  return `crwdctrl_reg_draft_fest_${festId}_${competitionId || 'fest'}`;
}

export function competitionRegDraftKey(competitionId) {
  return `crwdctrl_reg_draft_comp_${competitionId}`;
}

function serializeFieldSlice(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith('_file')) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.ready) continue;
      continue;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value)
    ) {
      out[key] = value;
    }
  }
  return out;
}

export function saveRegistrationDraft(key, payload) {
  if (!key) return;
  try {
    const formData = serializeFieldSlice(payload.formData);
    const stepData = {};
    if (payload.stepData && typeof payload.stepData === 'object') {
      for (const [step, fields] of Object.entries(payload.stepData)) {
        stepData[step] = serializeFieldSlice(fields);
      }
    }
    sessionStorage.setItem(
      key,
      JSON.stringify({
        formData,
        stepData,
        currentStep: payload.currentStep ?? 1,
        completedSteps: Array.isArray(payload.completedSteps)
          ? payload.completedSteps
          : [...(payload.completedSteps || [])],
        ts: Date.now(),
      }),
    );
  } catch {
    /* quota or private mode */
  }
}

export function loadRegistrationDraft(key) {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft?.ts || Date.now() - draft.ts > DRAFT_MAX_AGE_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearRegistrationDraft(key) {
  if (!key) return;
  sessionStorage.removeItem(key);
}

/** Flatten draft text answers for pay-and-register fallback after redirect checkout. */
export function extractDraftTextResponses(draft) {
  if (!draft) return {};
  const merged = { ...(draft.formData || {}) };
  if (draft.stepData && typeof draft.stepData === 'object') {
    Object.values(draft.stepData).forEach((fields) => {
      if (fields && typeof fields === 'object') Object.assign(merged, fields);
    });
  }
  const responses = {};
  for (const [key, value] of Object.entries(merged)) {
    if (key.endsWith('_file')) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && (value.ready || value.uploaded || value.url)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) {
      responses[key] = value;
    }
  }
  return responses;
}

export function applyRegistrationDraft(draft, { setFormData, setStepData, setCurrentStep, setCompletedSteps }) {
  if (!draft) return false;
  if (draft.formData && Object.keys(draft.formData).length > 0) {
    setFormData((prev) => ({ ...prev, ...draft.formData }));
  }
  if (draft.stepData && Object.keys(draft.stepData).length > 0) {
    setStepData((prev) => {
      const merged = { ...prev };
      for (const [step, fields] of Object.entries(draft.stepData)) {
        merged[step] = { ...(merged[step] || {}), ...fields };
      }
      return merged;
    });
  }
  if (draft.currentStep) setCurrentStep(draft.currentStep);
  if (draft.completedSteps?.length) {
    setCompletedSteps(new Set(draft.completedSteps));
  }
  return true;
}

/** Keep focused field visible when mobile keyboard opens */
export function scrollFieldIntoView(e) {
  const el = e?.target;
  if (!el?.scrollIntoView) return;
  window.setTimeout(() => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 280);
}
