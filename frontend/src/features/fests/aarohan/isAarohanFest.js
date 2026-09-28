/** Aarohan named-fest detection. */

export const AAROHAN_SLUG = 'aarohan-2027';

export function isAarohanFest(festOrId, festMeta = null) {
  if (festOrId && typeof festOrId === 'object') {
    const name = String(festOrId.festName || festOrId.name || festOrId.title || '').toLowerCase();
    const slug = String(festOrId.slug || '').toLowerCase();
    return slug === AAROHAN_SLUG
      || slug.includes('aarohan')
      || name.includes('aarohan');
  }

  const token = String(festOrId || '').trim().toLowerCase();
  if (token === AAROHAN_SLUG || token.includes('aarohan')) return true;
  return festMeta ? isAarohanFest(festMeta) : false;
}
