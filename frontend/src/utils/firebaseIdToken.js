/**
 * Attach Firebase ID token for backend cryptographic verification.
 */
export async function withFirebaseIdToken(payload, firebaseUser) {
  if (!firebaseUser?.getIdToken) {
    return payload;
  }
  try {
    const idToken = await firebaseUser.getIdToken();
    return { ...payload, idToken };
  } catch (err) {
    console.error('[firebaseIdToken] Failed to get ID token:', err.message);
    return payload;
  }
}
