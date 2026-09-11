import { isMindSparkFest } from '../mindspark/isMindSparkFest';
import { isTechfestFest } from '../techfest/isTechfestFest';
import { defaultFestPlugin } from './defaultPlugin';
import { mindsparkPlugin } from './mindsparkPlugin';
import { techfestPlugin } from './techfestPlugin';

/**
 * Resolve the named-fest plugin for a fest id, fest object, or competition.fest.
 * Generic pages should use this instead of isMindSparkFest() for behavior.
 */
export function getFestPlugin(festOrId, festMeta = null) {
  if (isMindSparkFest(festOrId, festMeta)) return mindsparkPlugin;
  if (isTechfestFest(festOrId, festMeta)) return techfestPlugin;
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

export { defaultFestPlugin, mindsparkPlugin, techfestPlugin };
