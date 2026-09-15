/** Techfest IIT Bombay — named fest plugin detection */

export const TECHFEST_SLUG = 'techfest-iit-bombay-2026';

/**
 * True for Techfest by id, name, or slug.
 * @param {string|object|null} festOrId
 * @param {object|null} [festMeta]
 */
export function isTechfestFest(festOrId, festMeta = null) {
  if (festOrId && typeof festOrId === 'object') {
    const name = String(festOrId.festName || festOrId.name || festOrId.title || '').toLowerCase();
    const slug = String(festOrId.slug || '').toLowerCase();
    const college = String(festOrId.collegeName || '').toLowerCase();
    if (slug === TECHFEST_SLUG || slug.includes('techfest')) return true;
    if (name.includes('techfest') && (name.includes('bombay') || name.includes('iit') || college.includes('bombay'))) {
      return true;
    }
    if (name.includes('techfest iit')) return true;
    return false;
  }

  const token = String(festOrId || '').trim().toLowerCase();
  if (!token) {
    const meta = festMeta && typeof festMeta === 'object' ? festMeta : null;
    return meta ? isTechfestFest(meta) : false;
  }
  if (token === TECHFEST_SLUG || token.includes('techfest')) return true;

  const meta = festMeta && typeof festMeta === 'object' ? festMeta : null;
  if (!meta) return false;
  return isTechfestFest(meta);
}
