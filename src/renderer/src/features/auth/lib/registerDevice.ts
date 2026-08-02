import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { firestore } from '@shared/lib/firebase'

/**
 * Writes to users/{uid}/devices/{deviceId} — a structure that already
 * supports multiple devices per user, even though Phase 2 has no UI for it.
 * Best-effort: called right after a successful login, which already proves
 * connectivity, but a transient Firestore failure here must never block
 * the login itself (the caller wraps this in try/catch).
 */
export async function registerDevice(uid: string, deviceId: string): Promise<void> {
  await setDoc(
    doc(firestore, 'users', uid, 'devices', deviceId),
    {
      deviceId,
      platform: navigator.platform,
      lastSeenAt: serverTimestamp()
    },
    { merge: true }
  )
}
