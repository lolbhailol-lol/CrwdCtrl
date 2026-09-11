import {
    GoogleAuthProvider,
    signInWithCredential,
} from "firebase/auth";
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth } from "./app.js";

/** Native Google Sign-In (Android/iOS) — avoids WebView redirect to localhost. */
export const signInWithGoogleNative = async () => {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    const pluginUser = result.user;

    if (!idToken) {
        return {
            success: false,
            error: 'Google sign-in did not return a token. Please try again.',
            method: 'native-google-no-token',
        };
    }

    let firebaseUser = auth.currentUser;

    // Sync Firebase JS SDK (needed for getIdToken) — never hang the UI
    try {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await Promise.race([
            signInWithCredential(auth, credential),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firebase SDK sync timed out')), 12000),
            ),
        ]);
        firebaseUser = userCredential.user;
    } catch (syncErr) {
        console.warn('[Google Native] JS SDK sync skipped:', syncErr.message);
    }

    if (!firebaseUser && pluginUser) {
        firebaseUser = {
            uid: pluginUser.uid,
            email: pluginUser.email,
            displayName: pluginUser.displayName,
            photoURL: pluginUser.photoUrl ?? null,
            emailVerified: pluginUser.emailVerified ?? false,
            getIdToken: async (forceRefresh = false) => {
                if (auth.currentUser?.getIdToken) {
                    return auth.currentUser.getIdToken(forceRefresh);
                }
                const tokenResult = await FirebaseAuthentication.getIdToken({ forceRefresh });
                return tokenResult.token;
            },
        };
    }

    if (!firebaseUser) {
        return {
            success: false,
            error: 'Google sign-in could not complete. Please try again.',
            method: 'native-google-no-user',
        };
    }

    return {
        success: true,
        user: firebaseUser,
        credential: result.credential || null,
        needsVerification: false,
        method: 'native-google',
    };
};
