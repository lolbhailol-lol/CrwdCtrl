/**
 * Fests feature root.
 *
 * - plugins/     → getFestPlugin() — named-fest behavior (MindSpark, …)
 * - mindspark/   → MindSpark-only roster UI (imported via the plugin)
 * - campus-hunt  → already under features/campus-hunt
 *
 * Pages stay in pages/fests & pages/fest-organizer. Do not add
 * isMindSparkFest() branches in shared registration/booking — extend the plugin.
 */
export * from './mindspark';
export {
  getFestPlugin,
  getFestPluginFromAny,
  defaultFestPlugin,
  mindsparkPlugin,
} from './plugins';
