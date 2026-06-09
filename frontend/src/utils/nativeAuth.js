/** Prevents AuthContext from duplicating native Google login backend sync. */
export const NATIVE_AUTH_ACTIVE_KEY = 'crwdctrl_native_auth';

export function setNativeAuthInProgress(active) {
  if (active) {
    sessionStorage.setItem(NATIVE_AUTH_ACTIVE_KEY, '1');
  } else {
    sessionStorage.removeItem(NATIVE_AUTH_ACTIVE_KEY);
  }
}

export function isNativeAuthInProgress() {
  return sessionStorage.getItem(NATIVE_AUTH_ACTIVE_KEY) === '1';
}
