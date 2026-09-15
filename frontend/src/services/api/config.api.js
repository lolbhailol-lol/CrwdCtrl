import { fetchCatalogJSON, seedCatalogCache } from './catalogCache.js';
import { mergePublicConfig } from '../../constants/publicAppConfig';

export const PUBLIC_CONFIG_PATH = '/config/public';
const LOCAL_KEY = 'crwdctrl_public_config_v1';

export function readCachedPublicConfig() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return mergePublicConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCachedPublicConfig(config) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(config));
  } catch {
    /* quota / private mode */
  }
}

export function seedPublicConfigCache(rawConfig) {
  const config = mergePublicConfig(rawConfig);
  seedCatalogCache(PUBLIC_CONFIG_PATH, { success: true, config });
  writeCachedPublicConfig(config);
  return config;
}

export async function fetchPublicConfig({ force = false } = {}) {
  try {
    const { data } = await fetchCatalogJSON(PUBLIC_CONFIG_PATH, { force, retries: 1 });
    const config = mergePublicConfig(data?.config || data);
    writeCachedPublicConfig(config);
    return config;
  } catch {
    return readCachedPublicConfig() || mergePublicConfig(null);
  }
}
