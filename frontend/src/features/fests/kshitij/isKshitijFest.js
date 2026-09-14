export const KSHITIJ_PUNE_MULTICITY_SLUG = 'kshitij-pune-multicity-event-2026';
export const KSHITIJ_PUNE_REGIONALS_SLUG = 'kshitij-pune-regionals-2026';

const KSHITIJ_SLUGS = new Set([
  KSHITIJ_PUNE_MULTICITY_SLUG,
  KSHITIJ_PUNE_REGIONALS_SLUG,
]);

export function isKshitijFest(festOrId, festMeta = null) {
  if (festOrId && typeof festOrId === 'object') {
    const slug = String(festOrId.slug || '').trim().toLowerCase();
    const name = String(festOrId.festName || festOrId.name || festOrId.title || '').trim().toLowerCase();
    return KSHITIJ_SLUGS.has(slug)
      || name.includes('kshitij pune regionals')
      || name.includes('kshitij pune multicity');
  }

  const token = String(festOrId || '').trim().toLowerCase();
  if (KSHITIJ_SLUGS.has(token)
    || token.includes('kshitij-pune-regionals')
    || token.includes('kshitij-pune-multicity-event')) return true;
  return festMeta && typeof festMeta === 'object' ? isKshitijFest(festMeta) : false;
}
