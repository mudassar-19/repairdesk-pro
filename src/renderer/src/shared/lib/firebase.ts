import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, getFirestore } from 'firebase/firestore'

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

// The ONLY business use of Firestore in this otherwise offline-first app: the
// tamper-resistant device-lock (see features/auth/lib/deviceLock.ts). One tiny
// collection, `device_locks/{deviceId}`, is the authoritative source of truth
// for which account a device is bound to — deliberately server-side so deleting
// the local device-owner.json cache can't re-register a device. No customer,
// repair, payment, expense, or udhaar data ever touches Firestore.
/**
 * Firestore's default WebChannel streaming transport is unreliable inside
 * Electron's renderer on some client machines/networks (corporate proxies,
 * Windows Chromium quirks) — it can throw `unavailable` ("client is offline")
 * even when the network is fine, which the device-lock then mistakes for being
 * offline. Firebase Auth is unaffected because it uses plain HTTPS, not
 * WebChannel — which is exactly why login can succeed while the device-lock
 * write silently never reaches the server. Auto-detect long-polling makes
 * Firestore fall back to ordinary HTTP requests when streaming is being
 * blocked, so the read/write actually reaches the server. initializeFirestore
 * must run before any getFirestore(app); the catch handles dev HMR re-runs.
 */
export const firestore = (() => {
  try {
    return initializeFirestore(firebaseApp, { experimentalAutoDetectLongPolling: true })
  } catch {
    return getFirestore(firebaseApp)
  }
})()

export function verifyFirebaseInitialized(): { ok: boolean; appName: string } {
  return { ok: Boolean(firebaseApp), appName: firebaseApp.name }
}
