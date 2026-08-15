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

const FEST_REG_SUCCESS_KEY = 'crwdctrl_fest_reg_success';
const FEST_REG_SUCCESS_MAX_AGE_MS = 30 * 60 * 1000;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
/** Keep in sync with features/fests/mindspark — used only for id↔slug aliasing. */
const MINDSPARK_FEST_ID = '6a7f1010ed26d983b34e55c2';

function isMongoObjectId(value) {
  return OBJECT_ID_RE.test(String(value || '').trim());
}

/** Build every known route key for a fest so slug ↔ ObjectId remounts still restore success. */
function buildFestSuccessAliases({ festId, festMongoId, festAliases } = {}) {
  const aliases = new Set();
  const add = (v) => {
    const s = String(v || '').trim();
    if (s) aliases.add(s);
  };
  add(festId);
  add(festMongoId);
  if (Array.isArray(festAliases)) festAliases.forEach(add);

  const all = [...aliases];
  const touchesMindSpark = all.some(
    (a) => a === MINDSPARK_FEST_ID || a.toLowerCase().includes('mindspark'),
  );
  if (touchesMindSpark) {
    add(MINDSPARK_FEST_ID);
    add('mindspark');
  }
  // If only one ObjectId was provided, keep it under both fields via aliases set
  return [...aliases];
}

/**
 * Persist post-payment success so Cashfree return / slug remount still shows
 * WhatsApp + View bookings instead of dropping back to the form.
 */
export function saveFestRegistrationSuccess({
  festId,
  festMongoId,
  competitionId,
  registrationId,
  festAliases,
}) {
  if (!festId && !festMongoId && !competitionId) return;

  const routeKey = festId ? String(festId).trim() : '';
  let mongo = festMongoId ? String(festMongoId).trim() : '';
  if (!mongo && isMongoObjectId(routeKey)) mongo = routeKey;
  // Prefer an ObjectId from aliases when route key is a slug
  if (!mongo && Array.isArray(festAliases)) {
    const found = festAliases.map(String).find((a) => isMongoObjectId(a));
    if (found) mongo = found;
  }

  const aliases = buildFestSuccessAliases({
    festId: routeKey,
    festMongoId: mongo,
    festAliases,
  });

  try {
    sessionStorage.setItem(
      FEST_REG_SUCCESS_KEY,
      JSON.stringify({
        festId: routeKey || mongo || '',
        festMongoId: mongo || (isMongoObjectId(routeKey) ? routeKey : ''),
        festAliases: aliases,
        competitionId: competitionId ? String(competitionId) : '',
        registrationId: registrationId ? String(registrationId) : '',
        ts: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function loadFestRegistrationSuccess(festId, competitionId = null) {
  try {
    const raw = sessionStorage.getItem(FEST_REG_SUCCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > FEST_REG_SUCCESS_MAX_AGE_MS) {
      sessionStorage.removeItem(FEST_REG_SUCCESS_KEY);
      return null;
    }

    const wantComp = competitionId ? String(competitionId) : '';
    const gotComp = parsed.competitionId ? String(parsed.competitionId) : '';

    // Competition registration: match on competition id (URL may use fest slug or ObjectId)
    if (wantComp) {
      if (gotComp && wantComp === gotComp) return parsed;
      return null;
    }

    // Fest-only registration — reject if stored entry was for a competition
    if (gotComp) return null;

    const routeKey = festId ? String(festId).trim() : '';
    if (!routeKey) return parsed;

    const aliases = buildFestSuccessAliases({
      festId: parsed.festId,
      festMongoId: parsed.festMongoId,
      festAliases: parsed.festAliases,
    });

    if (aliases.includes(routeKey)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearFestRegistrationSuccess() {
  try {
    sessionStorage.removeItem(FEST_REG_SUCCESS_KEY);
  } catch {
    /* ignore */
  }
}
