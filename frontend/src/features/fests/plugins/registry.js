import { isMindSparkFest } from '../mindspark/isMindSparkFest';
import { defaultFestPlugin } from './defaultPlugin';
import { mindsparkPlugin } from './mindsparkPlugin';

/**
 * Resolve the named-fest plugin for a fest id, fest object, or competition.fest.
 * Generic pages should use this instead of isMindSparkFest() for behavior.
 */
export function getFestPlugin(festOrId, festMeta = null) {
  if (isMindSparkFest(festOrId, festMeta)) return mindsparkPlugin;
  return defaultFestPlugin;
}

/** First matching named plugin among candidates (fest, competition.fest, ids). */
export function getFestPluginFromAny(...candidates) {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const plugin = getFestPlugin(candidate);
    if (plugin.id !== 'default') return plugin;
  }
  return defaultFestPlugin;
}

export { defaultFestPlugin, mindsparkPlugin };
