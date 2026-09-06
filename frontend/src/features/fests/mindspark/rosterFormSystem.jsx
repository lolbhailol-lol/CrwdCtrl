/**
 * MindSpark-only: competition team size → per-person registration form system.
 * Other fests keep FestFormModal / Competition_Modal classic formSchema builders.
 */
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { needsParticipantCountStep, buildTeamSizeLabel, getRosterBounds } from '../../../utils/teamSize';
import { getCompetitionFeeTiers } from '../../../utils/competitionFeeTiers';

export const PERSON_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'select', label: 'Dropdown (MCQ)' },
  { value: 'radio', label: 'Multiple choice' },
];

export const FIELD_SCOPES = [
  { value: 'person', label: 'Per person' },
  { value: 'team', label: 'Once per registration' },
];

/** Default per-person fields (name, email, phone, college) */
export const DEFAULT_PERSON_FIELDS = [
  {
    id: 'pf_name',
    key: 'name',
    label: 'Full name',
    type: 'text',
    placeholder: 'Full name',
    required: true,
  },
  {
    id: 'pf_email',
    key: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'email@college.edu',
    required: true,
  },
  {
    id: 'pf_phone',
    key: 'phone',
    label: 'Phone number',
    type: 'tel',
    placeholder: '10-digit mobile',
    required: true,
  },
  {
    id: 'pf_college',
    key: 'college',
    label: 'College name',
    type: 'text',
    placeholder: 'College / institution',
    required: true,
  },
];

function slugKey(label, fallback = 'field') {
  const base = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  return base || fallback;
}

function parseOptions(raw) {
  if (Array.isArray(raw)) {
    return raw.map((o) => String(o || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(/\r?\n|,/).map((o) => o.trim()).filter(Boolean);
  }
  return [];
}

export function normalizePersonField(raw, index = 0) {
  const id = String(raw?.id || `pf_${index}_${Date.now()}`);
  const label = String(raw?.label || '').trim() || `Field ${index + 1}`;
  let key = String(raw?.key || raw?.fieldName || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!key) key = slugKey(label, `field_${index + 1}`);
  const type = PERSON_FIELD_TYPES.some((t) => t.value === raw?.type) ? raw.type : 'text';
  const scope = raw?.scope === 'team' ? 'team' : 'person';
  const options = type === 'select' || type === 'radio' ? parseOptions(raw?.options) : [];
  return {
    id,
    key,
    label,
    type,
    scope,
    options,
    placeholder: String(raw?.placeholder || '').trim(),
    required: raw?.required !== false,
  };
}

export function normalizePersonFields(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_PERSON_FIELDS.map((f, i) => normalizePersonField(f, i));
  }
  const seen = new Set();
  return list.map((raw, i) => {
    let field = normalizePersonField(raw, i);
    let key = field.key;
    let n = 2;
    while (seen.has(key)) {
      key = `${field.key}_${n}`;
      n += 1;
    }
    seen.add(key);
    return { ...field, key };
  });
}

/** Resolve editable person-field schema from a competition (or defaults) */
export function getPersonFields(competition) {
  return normalizePersonFields(competition?.registration?.personFields);
}

export function getTeamScopedFields(competition) {
  return getPersonFields(competition).filter((f) => f.scope === 'team');
}

export function getPersonScopedFields(competition) {
  return getPersonFields(competition).filter((f) => f.scope !== 'team');
}

/** Extra step only for once-per-registration MCQs — team name lives on the people-count step */
export function needsTeamDetailsStep(competition) {
  return getTeamScopedFields(competition).length > 0;
}

export function teamFieldMissingLabel(value, field) {
  const val = String(value ?? '').trim();
  if (!field.required) return null;
  if (!val) return `${field.label} (required)`;
  if ((field.type === 'select' || field.type === 'radio') && field.options?.length && !field.options.includes(val)) {
    return `a valid ${field.label.toLowerCase()} (required)`;
  }
  if (field.type === 'text' && val.length < 2) return `${field.label} (required)`;
  return null;
}

export function validateTeamName(formData) {
  const chosen = Math.max(0, Number(formData?.team_size) || 0);
  if (chosen <= 1) return null;
  const teamName = String(formData?.team_name || '').trim();
  if (teamName.length < 2) return 'Team name (required)';
  return null;
}

export function validateTeamDetails(formData, competition) {
  const nameErr = validateTeamName(formData);
  if (nameErr) return nameErr;
  const teamResponses = formData?.team_responses && typeof formData.team_responses === 'object'
    ? formData.team_responses
    : {};
  for (const field of getTeamScopedFields(competition)) {
    const missing = teamFieldMissingLabel(teamResponses[field.key], field);
    if (missing) return missing;
  }
  return null;
}

export function emptyTeamMember(personFields = DEFAULT_PERSON_FIELDS) {
  const fields = normalizePersonFields(personFields);
  const out = {};
  fields.forEach((f) => {
    out[f.key] = '';
  });
  return out;
}

export function normalizeTeamMember(raw, personFields = DEFAULT_PERSON_FIELDS) {
  const fields = normalizePersonFields(personFields);
  const base = emptyTeamMember(fields);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    fields.forEach((f) => {
      base[f.key] = String(raw[f.key] ?? '').trim();
    });
    // legacy string-only name slot
    if (!base.name && typeof raw === 'object' && raw.name == null && Object.keys(raw).length === 0) {
      /* keep empty */
    }
    return base;
  }
  if (typeof raw === 'string') {
    const nameField = fields.find((f) => f.key === 'name') || fields[0];
    if (nameField) base[nameField.key] = String(raw).trim();
  }
  return base;
}

export function teamMemberMissingLabel(raw, personFields = DEFAULT_PERSON_FIELDS) {
  const fields = normalizePersonFields(personFields).filter((f) => f.scope !== 'team');
  const m = normalizeTeamMember(raw, fields);
  for (const f of fields) {
    if (!f.required) continue;
    const val = String(m[f.key] || '').trim();
    if (!val) return `${f.label} (required)`;
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return `a valid ${f.label.toLowerCase()} (required)`;
    }
    if (f.type === 'tel') {
      const digits = val.replace(/\D/g, '');
      if (digits.length < 10) return `${f.label} (required, 10+ digits)`;
    }
    if (f.type === 'text' && val.length < 2) return `${f.label} (required)`;
    if ((f.type === 'select' || f.type === 'radio') && f.options?.length && !f.options.includes(val)) {
      return `a valid ${f.label.toLowerCase()} (required)`;
    }
  }
  return null;
}

export function isTeamMemberComplete(raw, personFields = DEFAULT_PERSON_FIELDS) {
  return teamMemberMissingLabel(raw, personFields) == null;
}

const inputClass = (isDark) =>
  `w-full px-3 py-2.5 md:py-3 rounded-xl border text-sm ${
    isDark
      ? 'bg-[#1D1E20] border-gray-700 text-white placeholder:text-gray-500 [color-scheme:dark]'
      : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 [color-scheme:light]'
  }`;

/** Step 1 — People count stepper */
export function TeamSizeSelect({ competition, formData, setFormData, isDark }) {
  const needsStep = needsParticipantCountStep(competition);
  const { min, max } = getRosterBounds(competition);
  const personFields = getPersonFields(competition);
  const chosen = Math.max(0, Number(formData.team_size) || 0) || min;

  const setSize = (n) => {
    const size = Math.min(max, Math.max(min, Number(n) || min));
    const prevMembers = Array.isArray(formData.team_members) ? formData.team_members : [];
    const nextMembers = prevMembers.map((m) => normalizeTeamMember(m, personFields));
    while (nextMembers.length < size) nextMembers.push(emptyTeamMember(personFields));
    setFormData((prev) => ({
      ...prev,
      team_size: size,
      team_members: nextMembers.slice(0, size),
      team_name: size > 1 ? (prev.team_name || '') : '',
    }));
  };

  useEffect(() => {
    if (!needsStep) return;
    if (!formData.team_size) setSize(min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsStep, min, max, competition?._id || competition?.id]);

  if (!needsStep) return null;

  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Team
        </p>
        <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {competition?.name || 'Competition'}
        </p>
      </div>
      <div className="px-4 py-4 md:px-6 md:py-5">
        <p className={`text-[11px] mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>People</p>
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Decrease"
            onClick={() => setSize(chosen - 1)}
            disabled={chosen <= min}
            className={`w-10 h-10 md:w-11 md:h-11 rounded-l-xl flex items-center justify-center border transition-colors disabled:opacity-40 ${
              isDark ? 'bg-[#1D1E20] border-gray-700 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'
            }`}
          >
            <ChevronLeft size={16} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
          </button>
          <div
            className={`w-14 h-10 md:h-11 flex items-center justify-center border-y ${
              isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-white border-gray-300'
            }`}
          >
            <span className={`text-base font-semibold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {chosen}
            </span>
          </div>
          <button
            type="button"
            aria-label="Increase"
            onClick={() => setSize(chosen + 1)}
            disabled={chosen >= max}
            className={`w-10 h-10 md:w-11 md:h-11 rounded-r-xl flex items-center justify-center border transition-colors disabled:opacity-40 ${
              isDark ? 'bg-[#1D1E20] border-gray-700 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'
            }`}
          >
            <ChevronRight size={14} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
          </button>
        </div>
        <p className={`text-[10px] mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Allowed: {buildTeamSizeLabel(competition?.teamSizeMin, competition?.teamSizeMax)}
        </p>
        {chosen > 1 ? (
          <div className="mt-4">
            <p className={`text-[11px] mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Team name
              <span className="text-red-400 ml-0.5">*</span>
            </p>
            <input
              type="text"
              value={formData.team_name || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, team_name: e.target.value }))}
              placeholder="Your team name"
              className={inputClass(isDark)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Extra step — pick a student-category fee (e.g. Game of Innovation). */
export function FeeTierStep({ competition, formData, setFormData, isDark }) {
  const tiers = getCompetitionFeeTiers(competition);
  if (!tiers.length) return null;

  const selected = String(formData.feeTierId || '');

  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Category
        </p>
        <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Student category
        </p>
        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Registration fee depends on the category you select
        </p>
      </div>
      <div className="px-4 py-4 md:px-6 md:py-5 md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0">
        {tiers.map((tier) => {
          const active = selected === tier.id;
          return (
            <label
              key={tier.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition ${
                active
                  ? 'border-[#0ECCEE] bg-[#0ECCEE]/10'
                  : isDark
                    ? 'border-gray-700/70 bg-[#1D1E20] hover:border-gray-600'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <input
                  type="radio"
                  name="fee_tier"
                  value={tier.id}
                  checked={active}
                  onChange={() => setFormData((prev) => ({
                    ...prev,
                    feeTierId: tier.id,
                    feeTierLabel: tier.label,
                  }))}
                  className="text-[#0ECCEE] focus:ring-[#0ECCEE]"
                />
                <span className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  {tier.label}
                </span>
              </span>
              <span className="text-sm font-bold tabular-nums text-[#0ECCEE] shrink-0">
                ₹{Number(tier.amount).toLocaleString('en-IN')}/-
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Extra step — once-per-registration MCQs (subcategory). Team name is on the people-count step. */
export function TeamDetailsStep({ competition, formData, setFormData, isDark }) {
  const teamFields = getTeamScopedFields(competition);
  const teamResponses = formData.team_responses && typeof formData.team_responses === 'object'
    ? formData.team_responses
    : {};

  if (teamFields.length === 0) return null;

  const setTeamField = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      team_responses: { ...(prev.team_responses || {}), [key]: value },
    }));
  };

  const Req = () => <span className="text-red-400 ml-0.5">*</span>;

  const renderTeamField = (field) => {
    const value = teamResponses[field.key] || '';
    if (field.type === 'select') {
      return (
        <select
          value={value}
          onChange={(e) => setTeamField(field.key, e.target.value)}
          className={inputClass(isDark)}
        >
          <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (field.type === 'radio') {
      return (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              <input
                type="radio"
                name={`team_field_${field.key}`}
                value={opt}
                checked={value === opt}
                onChange={(e) => setTeamField(field.key, e.target.value)}
                className="text-[#0ECCEE] focus:ring-[#0ECCEE]"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    return (
      <input
        type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
        value={value}
        onChange={(e) => setTeamField(field.key, e.target.value)}
        placeholder={field.placeholder || field.label}
        inputMode={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : undefined}
        autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'on'}
        className={inputClass(isDark)}
      />
    );
  };

  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Registration details
        </p>
        <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {competition?.name || 'Competition'}
        </p>
      </div>
      <div className="px-4 py-4 md:px-6 md:py-5 md:grid md:grid-cols-2 md:gap-4 space-y-3 md:space-y-0">
        {teamFields.map((field) => (
          <div key={field.id || field.key} className={field.type === 'radio' ? 'md:col-span-2' : ''}>
            <p className={`text-[11px] mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {field.label}
              {field.required ? <Req /> : null}
            </p>
            {renderTeamField(field)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One step — one person's fields from competition.registration.personFields */
export function RosterPersonStep({ personIndex, competition, formData, setFormData, isDark }) {
  const { min, max } = getRosterBounds(competition);
  const personFields = getPersonScopedFields(competition);
  const chosen = Math.min(max, Math.max(min, Number(formData.team_size) || min || 1));
  const members = (Array.isArray(formData.team_members) ? formData.team_members : []).map((m) =>
    normalizeTeamMember(m, personFields),
  );
  const person = members[personIndex] || emptyTeamMember(personFields);
  const label = chosen === 1 ? 'Your details' : `Person ${personIndex + 1}`;

  const setField = (key, value) => {
    const next = [...members];
    while (next.length < chosen) next.push(emptyTeamMember(personFields));
    next[personIndex] = { ...normalizeTeamMember(next[personIndex], personFields), [key]: value };
    setFormData((prev) => ({ ...prev, team_members: next.slice(0, chosen), team_size: chosen }));
  };

  useEffect(() => {
    if (personIndex < 0) return;
    const next = (Array.isArray(formData.team_members) ? formData.team_members : []).map((m) =>
      normalizeTeamMember(m, personFields),
    );
    while (next.length < chosen) next.push(emptyTeamMember(personFields));
    const needsNorm =
      next.length !== members.length ||
      Number(formData.team_size) !== chosen ||
      (Array.isArray(formData.team_members) && formData.team_members.some((m) => typeof m === 'string'));
    if (needsNorm) {
      setFormData((prev) => ({ ...prev, team_size: chosen, team_members: next.slice(0, chosen) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personIndex, chosen, personFields.map((f) => f.key).join('|')]);

  if (personIndex < 0) return null;

  const Req = () => <span className="text-red-400 ml-0.5">*</span>;


  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {label}
        </p>
        <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {personIndex === 0 ? 'Your information' : `Team member ${personIndex + 1}`}
        </p>
        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Fields marked <span className="text-red-400">*</span> are compulsory
        </p>
      </div>
      <div className="px-4 py-4 md:px-6 md:py-5 space-y-3 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-3 md:space-y-0">
        {personFields.map((field, fi) => (
          <div
            key={field.id || field.key}
            className={field.type === 'radio' || field.type === 'textarea' ? 'md:col-span-2' : ''}
          >
            <p className={`text-[11px] mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {field.label}
              {personIndex === 0 && field.key === 'name' ? ' (you)' : ''}
              {field.required ? <Req /> : null}
            </p>
            {field.type === 'select' ? (
              <select
                value={person[field.key] || ''}
                onChange={(e) => setField(field.key, e.target.value)}
                autoFocus={fi === 0}
                className={inputClass(isDark)}
              >
                <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}`}</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'radio' ? (
              <div className="space-y-2">
                {(field.options || []).map((opt) => (
                  <label key={opt} className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    <input
                      type="radio"
                      name={`person_${personIndex}_${field.key}`}
                      value={opt}
                      checked={(person[field.key] || '') === opt}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="text-[#0ECCEE] focus:ring-[#0ECCEE]"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
                name={`person_${personIndex}_${field.key}`}
                value={person[field.key] || ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder || field.label}
                autoFocus={fi === 0}
                inputMode={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : undefined}
                autoComplete={
                  field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.key === 'college' ? 'organization' : 'name'
                }
                className={inputClass(isDark)}
              />
            )}
          </div>
        ))}
        {chosen > 1 ? (
          <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {personIndex + 1} of {chosen}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Admin / fest-organizer editor — modify which fields each person fills.
 * Bound to competition.registration.personFields
 */
export function RosterFieldsEditor({ personFields, onChange, className = '', teamSizeMin = 1, teamSizeMax = 1 }) {
  const fields = normalizePersonFields(personFields);
  const isGroup = Math.max(Number(teamSizeMin) || 1, Number(teamSizeMax) || 1) >= 2;

  const update = (next) => onChange(normalizePersonFields(next));

  const patch = (index, patchObj) => {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patchObj } : f));
    if (patchObj.label != null && !fields[index].keyLocked) {
      const autoKey = slugKey(patchObj.label, fields[index].key);
      // only auto-key if still looks generated
      if (!fields[index].key || fields[index].key.startsWith('field_') || fields[index].key === slugKey(fields[index].label)) {
        next[index] = { ...next[index], key: autoKey };
      }
    }
    update(next);
  };

  const addField = () => {
    update([
      ...fields,
      normalizePersonField(
        {
          id: `pf_${Date.now()}`,
          key: `field_${fields.length + 1}`,
          label: `Field ${fields.length + 1}`,
          type: 'text',
          required: true,
          placeholder: '',
        },
        fields.length,
      ),
    ]);
  };

  const removeField = (index) => {
    if (fields.length <= 1) return;
    update(fields.filter((_, i) => i !== index));
  };

  const resetDefaults = () => update(DEFAULT_PERSON_FIELDS);

  return (
    <div className={`rounded-xl border border-gray-700 bg-[#151617] p-4 space-y-3 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0ECCEE]">Registration form fields</p>
          <p className="text-xs text-gray-500 mt-1">
            {isGroup
              ? 'Group comps: people count + team name, then these fields once per person.'
              : 'Solo comps show these fields once.'}
          </p>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="shrink-0 text-xs text-gray-400 hover:text-[#0ECCEE] underline"
        >
          Reset defaults
        </button>
      </div>

      {isGroup ? (
        <div className="rounded-lg border border-[#0ECCEE]/30 bg-[#0ECCEE]/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#0ECCEE] font-medium">Team step (group only)</span>
            <span className="text-[10px] text-gray-500">Always on</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Label</label>
              <input
                type="text"
                value="Team name"
                readOnly
                className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white opacity-90"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Key (saved on registration)</label>
              <input
                type="text"
                value="team_name"
                readOnly
                className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white font-mono opacity-90"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            Shown just below people count when the team is 2 or more. Compulsory. Organizer dashboard lists this as the team title.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">
          Set Team max to 2 or more to collect a team name on registration.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border border-gray-700 bg-[#1D1E20] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Field {index + 1}</span>
              <button
                type="button"
                onClick={() => removeField(index)}
                disabled={fields.length <= 1}
                className="p-1 rounded text-gray-500 hover:text-red-400 disabled:opacity-30"
                aria-label="Remove field"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => patch(index, { label: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white focus:border-[#0ECCEE] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Key (saved on registration)</label>
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) =>
                    patch(index, {
                      key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                      keyLocked: true,
                    })
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white focus:border-[#0ECCEE] focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Type</label>
                <select
                  value={field.type}
                  onChange={(e) => patch(index, { type: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white focus:border-[#0ECCEE] focus:outline-none"
                >
                  {PERSON_FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Ask</label>
                <select
                  value={field.scope || 'person'}
                  onChange={(e) => patch(index, { scope: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white focus:border-[#0ECCEE] focus:outline-none"
                >
                  {FIELD_SCOPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Placeholder</label>
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={(e) => patch(index, { placeholder: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white focus:border-[#0ECCEE] focus:outline-none"
                />
              </div>
            </div>
            {(field.type === 'select' || field.type === 'radio') ? (
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Options (one per line)</label>
                <textarea
                  value={(field.options || []).join('\n')}
                  onChange={(e) => patch(index, { options: parseOptions(e.target.value) })}
                  rows={3}
                  placeholder={'Option A\nOption B\nOption C'}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#151617] border border-gray-700 text-sm text-white focus:border-[#0ECCEE] focus:outline-none resize-y"
                />
              </div>
            ) : null}
            <label className="inline-flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={field.required !== false}
                onChange={(e) => patch(index, { required: e.target.checked })}
                className="rounded border-gray-600 text-[#0ECCEE] focus:ring-[#0ECCEE]"
              />
              Compulsory
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addField}
        className="inline-flex items-center gap-1.5 text-sm text-[#0ECCEE] hover:underline"
      >
        <Plus size={14} />
        Add field
      </button>
    </div>
  );
}
