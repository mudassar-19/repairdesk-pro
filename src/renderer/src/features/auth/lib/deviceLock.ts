import { doc, getDocFromServer, setDoc, serverTimestamp, type FirestoreError } from 'firebase/firestore'
import { firestore } from '@shared/lib/firebase'
import {
  DeviceLockOfflineError,
  verifyDeviceBinding,
  type DeviceBinding,
  type DeviceLockGateway,
  type DeviceLockIdentity,
  type DeviceLockVerdict
} from './deviceLockDecision'

const DEVICE_LOCKS_COLLECTION = 'device_locks'

/** Firestore error codes that mean "we couldn't reach the server", i.e. treat as offline. */
function isOfflineError(err: unknown): boolean {
  const code = (err as FirestoreError | undefined)?.code
  return code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled'
}

/**
 * Production gateway: authoritative binding lives in Firestore
 * (device_locks/{deviceId}); the offline fast-path cache is the main process's
 * device-owner.json, read via preload. getDocFromServer forces a real server
 * read (never the SDK's local Firestore cache) so an offline device is detected
 * as offline rather than silently trusting stale server data.
 */
export const firestoreDeviceLockGateway: DeviceLockGateway = {
  async fetchBinding(deviceId: string): Promise<DeviceBinding | null> {
    try {
      const snap = await getDocFromServer(doc(firestore, DEVICE_LOCKS_COLLECTION, deviceId))
      if (!snap.exists()) return null
      const data = snap.data()
      return { ownerUid: String(data.ownerUid), ownerEmail: data.ownerEmail ? String(data.ownerEmail) : undefined }
    } catch (err) {
      if (isOfflineError(err)) throw new DeviceLockOfflineError()
      throw err
    }
  },

  async createBinding(identity: DeviceLockIdentity): Promise<void> {
    // Reached only after a successful (online) server read returned "no
    // binding", so this write is online. Rules enforce ownerUid == the
    // authenticating uid and create-only-when-absent.
    await setDoc(doc(firestore, DEVICE_LOCKS_COLLECTION, identity.deviceId), {
      ownerUid: identity.uid,
      ownerEmail: identity.email,
      deviceId: identity.deviceId,
      boundAt: serverTimestamp(),
      boundAtClient: new Date().toISOString()
    })
  },

  async readLocalCache(): Promise<DeviceBinding | null> {
    const owner = await window.api.auth.getDeviceOwner()
    return owner ? { ownerUid: owner.ownerUid, ownerEmail: owner.ownerEmail } : null
  }
}

/** Verify (and first-bind) this device against the authoritative Firestore lock. */
export function verifyDevice(identity: DeviceLockIdentity): Promise<DeviceLockVerdict> {
  return verifyDeviceBinding(identity, firestoreDeviceLockGateway)
}
