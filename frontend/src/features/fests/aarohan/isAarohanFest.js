/** Aarohan named-fest detection. */

export const AAROHAN_SLUG = 'aarohan-2027';
export const AAROHAN_FEST_ID = '6a6f9708884bbe0ca158dba8';
export const AAROHAN_MUMBAI_MULTICITY_FEST_ID = '6ac22157ec8160dfd660d0d4';
const AAROHAN_FEST_IDS = new Set([AAROHAN_FEST_ID, AAROHAN_MUMBAI_MULTICITY_FEST_ID]);

export function isAarohanFest(festOrId, festMeta = null) {
  if (festOrId && typeof festOrId === 'object') {
    const name = String(festOrId.festName || festOrId.name || festOrId.title || '').toLowerCase();
    const slug = String(festOrId.slug || '').toLowerCase();
    return AAROHAN_FEST_IDS.has(String(festOrId._id || festOrId.id || ''))
      || slug === AAROHAN_SLUG
      || slug.includes('aarohan')
      || name.includes('aarohan');
  }

  const token = String(festOrId || '').trim().toLowerCase();
  if (AAROHAN_FEST_IDS.has(token) || token === AAROHAN_SLUG || token.includes('aarohan')) return true;
  return festMeta ? isAarohanFest(festMeta) : false;
}
