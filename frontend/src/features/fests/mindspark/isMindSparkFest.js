/** MindSpark fest — roster / person-form registration path only */

export const MINDSPARK_FEST_ID = '6a7f1010ed26d983b34e55c2';

/**
 * True for MindSpark by id, name, or slug.
 * @param {string|object|null} festOrId - fest id string, or fest-like object
 * @param {object|null} [festMeta] - optional meta when first arg is only an id
 */
export function isMindSparkFest(festOrId, festMeta = null) {
  if (festOrId && typeof festOrId === 'object') {
    const id = festOrId._id || festOrId.id || festOrId.festId;
    if (id && typeof id === 'object' && id.$oid) {
      if (String(id.$oid) === MINDSPARK_FEST_ID) return true;
    }
    if (String(id || '') === MINDSPARK_FEST_ID) return true;
    const name = String(festOrId.festName || festOrId.name || '').toLowerCase();
    const slug = String(festOrId.slug || '').toLowerCase();
    return name.includes('mindspark') || slug.includes('mindspark');
  }

  const token = String(festOrId || '').trim();
  if (token === MINDSPARK_FEST_ID) return true;
  // Cashfree return hits /fest/mindspark/register (or mindspark-2026) before fest JSON loads.
  if (token.toLowerCase().includes('mindspark')) return true;

  const meta = festMeta && typeof festMeta === 'object' ? festMeta : null;
  if (!meta) return false;
  return isMindSparkFest(meta);
}
