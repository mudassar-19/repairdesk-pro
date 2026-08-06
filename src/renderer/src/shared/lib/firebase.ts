import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/**
 * Config comes from .env (VITE_FIREBASE_*), never hardcoded — see .env.example
 * for the Firebase console fields each value maps to. Until a real project is
 * configured, .env holds inert placeholder values so the SDK still initializes
 * (Phase 1's health check) even though real auth calls will fail. No
 * storageBucket field — Firebase Storage isn't used by this app (see
 * firebaseAuth below).
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)

// Login/session only — Firebase Storage is no longer used at all: scheduled
// full-database backups upload to each client's own Google Drive instead
// (see main/services/googleDriveApi.ts), not a shared/central bucket. No
// business data (customers, repairs, payments, expenses, udhaar) is read
// from or written to Firebase.
export const firebaseAuth = getAuth(firebaseApp)

export function verifyFirebaseInitialized(): { ok: boolean; appName: string } {
  return { ok: Boolean(firebaseApp), appName: firebaseApp.name }
}
