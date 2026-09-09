/**
 * Fests feature root.
 *
 * - pages/      → public fest + competition + stall pages
 * - organizer/  → fest-organizer portal
 * - components/ → fest-scoped UI (SimilarFests, etc.)
 * - plugins/    → getFestPlugin() — MindSpark, Techfest, …
 * - mindspark/ / techfest/ → plugin modules
 *
 * Shared shell (home, auth, payment, admin) stays under pages/.
 */
export * from './mindspark';
export * from './techfest';
export {
  getFestPlugin,
  getFestPluginFromAny,
  defaultFestPlugin,
  mindsparkPlugin,
  techfestPlugin,
} from './plugins';
