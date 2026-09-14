export const KSHITIJ_PUNE_REGIONALS_SLUG = 'kshitij-pune-regionals-2026';

export function isKshitijFest(festOrId, festMeta = null) {
  if (festOrId && typeof festOrId === 'object') {
    const slug = String(festOrId.slug || '').trim().toLowerCase();
    const name = String(festOrId.festName || festOrId.name || festOrId.title || '').trim().toLowerCase();
    return slug === KSHITIJ_PUNE_REGIONALS_SLUG || name.includes('kshitij pune regionals');
  }

  const token = String(festOrId || '').trim().toLowerCase();
  if (token === KSHITIJ_PUNE_REGIONALS_SLUG || token.includes('kshitij-pune-regionals')) return true;
  return festMeta && typeof festMeta === 'object' ? isKshitijFest(festMeta) : false;
}
