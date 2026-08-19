function isHeadingTerm(text) {
  const t = String(text || '').trim();
  if (!t || t.includes('\n')) return false;
  if (t.length > 80) return false;
  if (/[.!?]$/.test(t)) return false;
  return t.split(/\s+/).length <= 8;
}

function splitDetailBullets(details) {
  const text = String(details || '').trim();
  if (!text) return [];
  const parts = text.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

/**
 * Pair short headings with the following paragraph so T&Cs render as
 * main points (Refund, Equipment, Safety…) with details nested inside.
 */
export function groupTermsAndConditions(terms = []) {
  const raw = (Array.isArray(terms) ? terms : [terms])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (item.includes('\n')) {
      const [title, ...rest] = item.split('\n');
      out.push({ title: title.trim(), details: rest.join('\n').trim() });
      continue;
    }
    if (isHeadingTerm(item) && i + 1 < raw.length && !isHeadingTerm(raw[i + 1])) {
      out.push({ title: item, details: raw[i + 1] });
      i += 1;
      continue;
    }
    out.push({ title: '', details: item });
  }
  return out.map((section) => ({
    ...section,
    bullets: splitDetailBullets(section.details),
  }));
}

export function termsToTextarea(terms = []) {
  return groupTermsAndConditions(terms)
    .map((section) => (section.title ? `${section.title}\n${section.details}` : section.details))
    .join('\n\n');
}

export function textareaToTerms(text = '') {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}
