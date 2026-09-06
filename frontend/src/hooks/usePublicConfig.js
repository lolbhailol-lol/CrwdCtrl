import { useEffect, useState } from 'react';
import { DEFAULT_PUBLIC_CONFIG, mergePublicConfig } from '../constants/publicAppConfig';
import {
  fetchPublicConfig,
  readCachedPublicConfig,
} from '../services/api/config.api';

/**
 * Public UI copy/config with hardcoded fallbacks.
 * Missing or failed backend config never blanks the current UI.
 */
export function usePublicConfig() {
  const [config, setConfig] = useState(() => readCachedPublicConfig() || DEFAULT_PUBLIC_CONFIG);

  useEffect(() => {
    let cancelled = false;

    const apply = (next) => {
      if (!cancelled) setConfig(mergePublicConfig(next));
    };

    fetchPublicConfig().then(apply);

    const refresh = () => {
      fetchPublicConfig({ force: true }).then(apply);
    };
    const onStorage = (e) => {
      if (e.key === 'admin_data_updated' && e.newValue) refresh();
    };

    window.addEventListener('admin_data_updated', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('admin_data_updated', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return config;
}
