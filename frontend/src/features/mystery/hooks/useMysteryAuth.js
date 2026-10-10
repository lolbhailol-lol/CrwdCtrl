import { useCallback, useEffect, useState } from 'react';
import {
  clearMysteryAuth as clearStored,
  getMysteryAuthEventName,
  getMysteryClaims,
  isMysteryAuthenticated as checkAuthenticated,
  persistMysteryAuth as persistStored,
  readMysteryAuth,
} from '../utils/mysteryAuth';

function readState() {
  const { token, meta } = readMysteryAuth();
  return {
    token,
    meta,
    claims: token ? getMysteryClaims(token) : null,
    isMysteryAuthenticated: checkAuthenticated(),
  };
}

export default function useMysteryAuth() {
  const [state, setState] = useState(readState);

  const sync = useCallback(() => setState(readState()), []);

  useEffect(() => {
    const eventName = getMysteryAuthEventName();
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  const persistMysteryAuth = useCallback((token, meta) => {
    persistStored(token, meta);
    sync();
  }, [sync]);

  const clearMysteryAuth = useCallback(() => {
    clearStored();
    sync();
  }, [sync]);

  return { ...state, persistMysteryAuth, clearMysteryAuth, refresh: sync };
}