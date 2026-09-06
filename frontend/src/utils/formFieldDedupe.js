/** Shared run/fest form field helpers — collapse duplicate name/email/phone fields. */

export const DEFAULT_RUN_FORM_FIELDS = [
  {
    id: 'default_full_name',
    label: 'Full Name',
    fieldName: 'full_name',
    type: 'text',
    required: true,
    placeholder: 'Enter your full name',
  },
  {
    id: 'default_contact',
    label: 'Contact No.',
    fieldName: 'contact_no',
    type: 'tel',
    required: true,
    placeholder: '10-digit mobile number',
  },
  {
    id: 'default_email',
    label: 'E-mail',
    fieldName: 'email',
    type: 'email',
    required: true,
    placeholder: 'your@email.com',
  },
];

export function responseAliasGroup(key) {
  const k = String(key || '').trim().toLowerCase();
  if (/^(full_?name|name)$/.test(k)) return 'name';
  if (/^(e-?mail|email)$/.test(k)) return 'email';
  if (/^(contact_?no|phone|mobile|tel)$/.test(k)) return 'phone';
  return null;
}

/** Drop duplicate name/email/phone fields that share the same fieldName or label. */
export function dedupeFormFields(fields = []) {
  const seenKeys = new Set();
  const seenLabels = new Set();
  const out = [];
  for (const field of fields) {
    if (!field) continue;
    const key = String(field.fieldName || field.id || '').trim().toLowerCase();
    const label = String(field.label || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (key && seenKeys.has(key)) continue;
    if (label && seenLabels.has(label)) continue;
    const aliasGroup = key.match(/^(full_?name|name)$/)
      ? 'name'
      : key.match(/^(e-?mail|email)$/)
        ? 'email'
        : key.match(/^(contact_?no|phone|mobile|tel)$/)
          ? 'phone'
          : label.match(/^(full name|name)$/)
            ? 'name'
            : label.match(/^(e-?mail|email)$/)
              ? 'email'
              : label.match(/^(contact|phone|mobile)/)
                ? 'phone'
                : null;
    if (aliasGroup && seenKeys.has(`__alias_${aliasGroup}`)) continue;
    if (key) seenKeys.add(key);
    if (label) seenLabels.add(label);
    if (aliasGroup) seenKeys.add(`__alias_${aliasGroup}`);
    out.push(field);
  }
  return out;
}

/** Prefer canonical keys when responses contain aliases (name + full_name). */
export function dedupeResponseEntries(entries = []) {
  const byAlias = new Map();
  const out = [];
  const preferredFor = { name: 'full_name', email: 'email', phone: 'contact_no' };

  for (const [key, value] of entries) {
    const alias = responseAliasGroup(key);
    if (!alias) {
      out.push([key, value]);
      continue;
    }
    const preferred = preferredFor[alias];
    const existing = byAlias.get(alias);
    if (!existing) {
      byAlias.set(alias, [key, value]);
      continue;
    }
    if (key === preferred) {
      byAlias.set(alias, [key, value ?? existing[1]]);
    } else if (existing[0] !== preferred && (value || !existing[1])) {
      byAlias.set(alias, [existing[0], value ?? existing[1]]);
    }
  }
  for (const entry of byAlias.values()) out.push(entry);
  return out;
}

/** True when a form field is the default name / email / phone contact trio. */
export function isDefaultContactField(field) {
  if (!field) return false;
  const key = String(field.fieldName || field.id || '').trim().toLowerCase();
  const label = String(field.label || '').trim().toLowerCase();
  if (responseAliasGroup(key)) return true;
  if (/^(full name|name)$/.test(label)) return true;
  if (/^(e-?mail|email)$/.test(label)) return true;
  if (/^(contact|phone|mobile)/.test(label)) return true;
  return false;
}

/** Map AuthContext / Google user → run form responses for organizer dashboard. */
export function profileToRunFormData(user) {
  if (!user) return {};
  const name = String(user.name || user.fullName || '').trim();
  const email = String(user.email || '').trim();
  const phone = String(user.phoneNumber || user.phone || user.mobile || '').trim();
  const out = {};
  if (name) {
    out.full_name = name;
    out.name = name;
  }
  if (email) out.email = email;
  if (phone) {
    out.contact_no = phone;
    out.phone = phone;
  }
  return out;
}

/**
 * Free run + logged-in profile has name+email, and form has no custom required fields
 * beyond the default contact trio → skip details step.
 */
export function canExpressBookFreeRun({ user, formSchema = [], isFree = false } = {}) {
  if (!isFree || !user) return false;
  const profile = profileToRunFormData(user);
  if (!profile.full_name || !profile.email) return false;
  const customRequired = (formSchema || []).filter(
    (f) => f?.required && !isDefaultContactField(f),
  );
  return customRequired.length === 0;
}

/** Merge default run fields with custom schema, then dedupe. */
export function mergeRunFormFields(customSchema = []) {
  const custom = (customSchema || []).filter((f) => f?.label?.trim() && f?.fieldName?.trim());
  if (custom.length === 0) return [...DEFAULT_RUN_FORM_FIELDS];
  return dedupeFormFields([...DEFAULT_RUN_FORM_FIELDS, ...custom]);
}
