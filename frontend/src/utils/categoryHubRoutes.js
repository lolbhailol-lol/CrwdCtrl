/** Top-level category hub routes — home chip in search row, no bottom nav. */
export const CATEGORY_HUB_PATHS = ['/fests', '/sports', '/treks', '/events'];

export function isCategoryHubRoute(pathname = '') {
  return CATEGORY_HUB_PATHS.includes(pathname);
}
