/**
 * Pure device-lock decision logic — no Firebase / no window.api imports, so it
 * can be exercised deterministically in tests against a fake gateway. The real
 * Firestore + local-cache wiring lives in deviceLock.ts.
 *
 * Firestore is the AUTHORITATIVE source of truth for which account a device is
 * bound to. The local device-owner.json cache (read via the gateway) is only a
 * fast-path for logins made while OFFLINE on a device that was already verified
 * online at least once — it is never allowed to be the sole basis for a NEW
 * binding decision, so deleting it can never re-register a device (see the
 * matrix in verifyDeviceBinding).
 */

export interface DeviceLockIdentity {
  uid: string
  email: string
  deviceId: string
}

export interface DeviceBinding {
  ownerUid: string
  ownerEmail?: string
}

export type DeviceLockVerdict =
  | { status: 'allowed'; source: 'firestore-existing' | 'firestore-new' | 'offline-cache' }
  | { status: 'locked'; ownerEmail?: string }
  | { status: 'error'; code: 'offline-first-login' | 'verification-failed'; message: string }

/** Thrown by a gateway's fetchBinding when Firestore can't be reached (offline). */
export class DeviceLockOfflineError extends Error {
  constructor(message = 'Firestore unreachable') {
    super(message)
    this.name = 'DeviceLockOfflineError'
  }
}

/**
 * Abstracts the two data sources the decision needs. The production
 * implementation (deviceLock.ts) backs fetchBinding/createBinding with the
 * Firestore SDK and readLocalCache with window.api.auth.getDeviceOwner.
 */
export interface DeviceLockGateway {
  /** Authoritative server read. Returns null when no binding exists yet. Throws DeviceLockOfflineError when offline. */
  fetchBinding(deviceId: string): Promise<DeviceBinding | null>
  /** First-bind: write the authoritative binding to Firestore for this account. */
  createBinding(identity: DeviceLockIdentity): Promise<void>
  /** The local offline fast-path cache (device-owner.json), or null if absent/deleted. */
  readLocalCache(): Promise<DeviceBinding | null>
}

/**
 * Decide whether `identity` may sign in on this device, and create the binding
 * on first use. See the matrix in the redesign notes:
 *
 *  - Online, no binding      -> create for this account, allow
 *  - Online, binding == uid  -> allow
 *  - Online, binding != uid  -> LOCKED (authoritative — local file is ignored)
 *  - Offline, cache == uid   -> allow (already-verified device)
 *  - Offline, cache != uid   -> LOCKED
 *  - Offline, no cache       -> fail closed (a new device can't bind offline)
 */
export async function verifyDeviceBinding(
  identity: DeviceLockIdentity,
  gateway: DeviceLockGateway
): Promise<DeviceLockVerdict> {
  try {
    const binding = await gateway.fetchBinding(identity.deviceId)
    if (binding) {
      if (binding.ownerUid === identity.uid) {
        return { status: 'allowed', source: 'firestore-existing' }
      }
      // Authoritative mismatch — reject regardless of what the local file says
      // (or whether it was deleted). This is the anti-tamper guarantee.
      return { status: 'locked', ownerEmail: binding.ownerEmail }
    }
    // No authoritative binding yet -> first-bind this device to this account.
    await gateway.createBinding(identity)
    return { status: 'allowed', source: 'firestore-new' }
  } catch (err) {
    if (!(err instanceof DeviceLockOfflineError)) {
      return {
        status: 'error',
        code: 'verification-failed',
        message: err instanceof Error ? err.message : 'Device verification failed'
      }
    }
    // OFFLINE: fall back to the local cache, but ONLY for an already-verified
    // device. A missing cache means either a brand-new device or a tampered
    // (deleted) file — in both cases we fail closed rather than bind offline.
    const cache = await gateway.readLocalCache()
    if (!cache) {
      return {
        status: 'error',
        code: 'offline-first-login',
        message: 'This device must be online the first time you sign in, to register it to your account.'
      }
    }
    if (cache.ownerUid === identity.uid) {
      return { status: 'allowed', source: 'offline-cache' }
    }
    return { status: 'locked', ownerEmail: cache.ownerEmail }
  }
}
