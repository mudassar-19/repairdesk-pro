import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Config comes from .env (VITE_FIREBASE_*), never hardcoded — see .env.example
 * for the Firebase console fields each value maps to. Until a real project is
 * configured, .env holds inert placeholder values so the SDK still initializes
 * (Phase 1's health check) even though real auth/Firestore calls will fail.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(firebaseApp)
export const firestore = getFirestore(firebaseApp)

export function verifyFirebaseInitialized(): { ok: boolean; appName: string } {
  return { ok: Boolean(firebaseApp), appName: firebaseApp.name }
}
