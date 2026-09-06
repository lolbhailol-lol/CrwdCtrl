/**
 * Techfest-only roster helpers (leader full details vs member name+contact).
 * Does not modify MindSpark rosterFormSystem.
 */
import { useEffect } from 'react';
import {
  normalizePersonFields,
  normalizeTeamMember,
  emptyTeamMember,
  getPersonScopedFields,
  teamMemberMissingLabel as mindsparkTeamMemberMissingLabel,
} from '../mindspark/rosterFormSystem';
import { getRosterBounds } from '../../../utils/teamSize';

function attachRoles(competition) {
  const rawList = Array.isArray(competition?.registration?.personFields)
    ? competition.registration.personFields
    : [];
  const normalized = getPersonScopedFields(competition);
  return normalized.map((field) => {
    const src =
      rawList.find((r) => String(r?.key || r?.fieldName || '').toLowerCase() === field.key)
      || rawList.find((r) => String(r?.id || '') === String(field.id || ''));
    const roles = (Array.isArray(src?.roles) ? src.roles : [])
      .map((r) => String(r || '').trim().toLowerCase())
      .filter((r) => r === 'leader' || r === 'member');
    return { ...field, roles };
  });
}

export function fieldsForPersonIndex(personFields, personIndex = 0) {
  const fields = normalizePersonFields(personFields).filter((f) => f.scope !== 'team');
  const withRoles = fields.map((f, i) => {
    if (Array.isArray(f.roles)) return f;
    const raw = Array.isArray(personFields) ? personFields[i] : null;
    const roles = (Array.isArray(raw?.roles) ? raw.roles : [])
      .map((r) => String(r || '').trim().toLowerCase())
      .filter((r) => r === 'leader' || r === 'member');
    return { ...f, roles };
  });
  const isLead = Number(personIndex) === 0;
  return withRoles.filter((f) => {
    const roles = Array.isArray(f.roles) ? f.roles : [];
    if (!roles.length) return true;
    return isLead ? roles.includes('leader') : roles.includes('member');
  });
}

export function techfestTeamMemberMissingLabel(raw, personFields, personIndex = 0) {
  const fields = fieldsForPersonIndex(personFields, personIndex);
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
    if (f.key === 'pin' || f.key === 'pincode') {
      const digits = val.replace(/\D/g, '');
      if (digits.length !== 6) return `${f.label} (required, 6 digits)`;
    }
    if (f.type === 'text' && val.length < 2) return `${f.label} (required)`;
  }
  return null;
}

/** MindSpark-safe wrapper: only Techfest applies role filtering. */
export function rosterMemberMissingLabel(raw, personFields, personIndex = 0, { techfest = false } = {}) {
  if (techfest) return techfestTeamMemberMissingLabel(raw, personFields, personIndex);
  return mindsparkTeamMemberMissingLabel(raw, personFields);
}

const inputClass = (isDark) =>
  `w-full px-3 py-2.5 md:py-3 rounded-xl border text-sm ${
    isDark
      ? 'bg-[#1D1E20] border-gray-700 text-white placeholder:text-gray-500 [color-scheme:dark]'
      : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 [color-scheme:light]'
  }`;

/** Techfest roster step — group lead full fields; others name + contact. */
export function TechfestRosterPersonStep({ personIndex, competition, formData, setFormData, isDark }) {
  const { min, max } = getRosterBounds(competition);
  const allPersonFields = attachRoles(competition);
  const personFields = fieldsForPersonIndex(allPersonFields, personIndex);
  const chosen = Math.min(max, Math.max(min, Number(formData.team_size) || min || 1));
  const members = (Array.isArray(formData.team_members) ? formData.team_members : []).map((m) =>
    normalizeTeamMember(m, allPersonFields),
  );
  const person = members[personIndex] || emptyTeamMember(allPersonFields);
  const isLead = personIndex === 0;
  const label = chosen === 1 ? 'Your details' : isLead ? 'Group lead' : `Team member ${personIndex + 1}`;

  const setField = (key, value) => {
    const next = [...members];
    while (next.length < chosen) next.push(emptyTeamMember(allPersonFields));
    next[personIndex] = { ...normalizeTeamMember(next[personIndex], allPersonFields), [key]: value };
    setFormData((prev) => ({ ...prev, team_members: next.slice(0, chosen), team_size: chosen }));
  };

  useEffect(() => {
    if (personIndex < 0) return;
    const next = (Array.isArray(formData.team_members) ? formData.team_members : []).map((m) =>
      normalizeTeamMember(m, allPersonFields),
    );
    while (next.length < chosen) next.push(emptyTeamMember(allPersonFields));
    const needsNorm =
      next.length !== members.length
      || Number(formData.team_size) !== chosen
      || (Array.isArray(formData.team_members) && formData.team_members.some((m) => typeof m === 'string'));
    if (needsNorm) {
      setFormData((prev) => ({ ...prev, team_size: chosen, team_members: next.slice(0, chosen) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personIndex, chosen, allPersonFields.map((f) => f.key).join('|')]);

  if (personIndex < 0) return null;

  const Req = () => <span className="text-red-400 ml-0.5">*</span>;

  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {label}
        </p>
        <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {chosen === 1
            ? 'Your information'
            : isLead
              ? 'Group lead — full details'
              : 'Name & contact only'}
        </p>
        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Fields marked <span className="text-red-400">*</span> are compulsory
        </p>
      </div>
      <div className="px-4 py-4 md:px-6 md:py-5 space-y-3 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-3 md:space-y-0">
        {personFields.map((field, fi) => (
          <div key={field.id || field.key} className={field.type === 'radio' ? 'md:col-span-2' : ''}>
            <p className={`text-[11px] mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {field.label}
              {isLead && field.key === 'name' ? ' (you)' : ''}
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
            ) : (
              <input
                type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
                name={`person_${personIndex}_${field.key}`}
                value={person[field.key] || ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder || field.label}
                autoFocus={fi === 0}
                inputMode={
                  field.type === 'tel' || field.key === 'pin' || field.key === 'pincode'
                    ? 'numeric'
                    : field.type === 'email'
                      ? 'email'
                      : undefined
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
