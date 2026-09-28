import { isMindSparkFest } from '../mindspark/isMindSparkFest';
import { isTechfestFest } from '../techfest/isTechfestFest';
import { isKshitijFest } from '../kshitij/isKshitijFest';
import { isAarohanFest } from '../aarohan/isAarohanFest';
import { defaultFestPlugin } from './defaultPlugin';
import { mindsparkPlugin } from './mindsparkPlugin';
import { techfestPlugin } from './techfestPlugin';
import { kshitijPlugin } from './kshitijPlugin';
import { aarohanPlugin } from './aarohanPlugin';

/**
 * Resolve the named-fest plugin for a fest id, fest object, or competition.fest.
 * Generic pages should use this instead of isMindSparkFest() for behavior.
 */
export function getFestPlugin(festOrId, festMeta = null) {
  const namedPlugin = isMindSparkFest(festOrId, festMeta)
    ? mindsparkPlugin
    : isTechfestFest(festOrId, festMeta)
      ? techfestPlugin
      : isKshitijFest(festOrId, festMeta)
        ? kshitijPlugin
        : isAarohanFest(festOrId, festMeta)
          ? aarohanPlugin
          : null;
  return namedPlugin ? { ...defaultFestPlugin, ...namedPlugin } : defaultFestPlugin;
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

export { defaultFestPlugin, mindsparkPlugin, techfestPlugin, kshitijPlugin, aarohanPlugin };
