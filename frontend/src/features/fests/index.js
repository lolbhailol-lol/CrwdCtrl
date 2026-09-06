/**
 * Fests feature root.
 *
 * - plugins/     → getFestPlugin() — named-fest behavior (MindSpark, Techfest, …)
 * - mindspark/   → MindSpark-only roster UI (imported via the plugin)
 * - techfest/    → Techfest IIT Bombay modules + Accommodation chip
 * - campus-hunt  → already under features/campus-hunt
 *
 * Pages stay in pages/fests & pages/fest-organizer. Do not add
 * isMindSparkFest() branches in shared registration/booking — extend the plugin.
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
