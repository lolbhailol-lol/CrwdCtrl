import { useCallback, useEffect, useState } from 'react';
import {
  clearHuntAuth as clearStoredHuntAuth,
  getHuntAuthEventName,
  getHuntClaims,
  isHuntAuthenticated as checkHuntAuthenticated,
  persistHuntAuth as persistStoredHuntAuth,
  readHuntAuth,
} from '../utils/huntAuth';

function readState() {
  const { token, meta } = readHuntAuth();
  return {
    token,
    meta,
    claims: token ? getHuntClaims(token) : null,
    isHuntAuthenticated: checkHuntAuthenticated(),
  };
}

/**
 * Hunt enrollment state — separate from CrwdCtrl platform auth (Google JWT).
 */
export default function useHuntAuth() {
  const [state, setState] = useState(readState);

  const sync = useCallback(() => {
    setState(readState());
  }, []);

  useEffect(() => {
    const eventName = getHuntAuthEventName();
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  const persistHuntAuth = useCallback((token, meta) => {
    persistStoredHuntAuth(token, meta);
    sync();
  }, [sync]);

  const clearHuntAuth = useCallback(() => {
    clearStoredHuntAuth();
    sync();
  }, [sync]);

  return {
    ...state,
    persistHuntAuth,
    clearHuntAuth,
    refresh: sync,
  };
}
