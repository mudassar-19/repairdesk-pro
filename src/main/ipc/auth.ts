import { ipcMain, safeStorage, app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export interface LocalSession {
  uid: string
  email: string
  deviceId: string
  refreshToken: string
  issuedAt: string
}

export interface DeviceOwner {
  ownerUid: string
  ownerEmail: string
  boundAt: string
}

export interface SaveSessionResult {
  ok: boolean
  /**
   * Why a save was refused, when ok is false. The device-lock decision is NO
   * longer made here — it is authoritative in Firestore and enforced in the
   * renderer (see features/auth/lib/deviceLock.ts) BEFORE this is called, so
   * the only refusal reason left is OS encryption being unavailable.
   */
  reason?: 'encryption-unavailable'
}

const sessionPath = (): string => path.join(app.getPath('userData'), 'session.enc')
const deviceIdPath = (): string => path.join(app.getPath('userData'), 'device-id.json')
const deviceOwnerPath = (): string => path.join(app.getPath('userData'), 'device-owner.json')

/**
 * Device-lock (Part H, redesigned): the AUTHORITATIVE binding now lives in
 * Firestore (device_locks/{deviceId}) and is checked/created in the renderer
 * before a session is ever saved — see features/auth/lib/deviceLock.ts. This
 * device-owner.json file is now only a LOCAL CACHE serving the offline-login
 * fast-path: it lets an already-verified device keep working without internet,
 * but it is never the sole basis for a NEW binding decision, so deleting or
 * editing it can't re-register a device (online, Firestore rejects a mismatch;
 * offline with no cache, login fails closed). It is rewritten from the
 * authoritative owner on every successful login, so a tampered value
 * self-corrects. The UID is not a secret; no master password is baked into the
 * build. Re-onboarding is an admin action: delete the Firestore doc in the
 * Firebase Console (auth:resetDeviceBinding only clears this local cache).
 */
function readDeviceOwner(): DeviceOwner | null {
  try {
    return JSON.parse(fs.readFileSync(deviceOwnerPath(), 'utf-8')) as DeviceOwner
  } catch {
    return null
  }
}

function bindDeviceOwner(session: LocalSession): void {
  const owner: DeviceOwner = { ownerUid: session.uid, ownerEmail: session.email, boundAt: new Date().toISOString() }
  fs.writeFileSync(deviceOwnerPath(), JSON.stringify(owner, null, 2))
}

/**
 * The offline-first login gate: a safeStorage-encrypted (OS keychain/DPAPI/
 * libsecret-backed) blob on disk, checked on every launch before any Firebase
 * call. Its mere presence and successful decryption is what lets the renderer
 * skip straight to the Dashboard — see features/auth/hooks/useAuthBootstrap.
 */
export function registerAuthIpc(): void {
  ipcMain.handle('auth:getLocalSession', (): LocalSession | null => {
    try {
      if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(sessionPath())) return null
      const encrypted = fs.readFileSync(sessionPath())
      const session = JSON.parse(safeStorage.decryptString(encrypted)) as LocalSession
      // Bind the device to the already-signed-in account if it isn't bound yet
      // — closes the gap where an install in active use has no recorded owner.
      if (!readDeviceOwner()) bindDeviceOwner(session)
      return session
    } catch {
      return null
    }
  })

  ipcMain.handle('auth:saveLocalSession', (_event, session: LocalSession): SaveSessionResult => {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, reason: 'encryption-unavailable' }

    // The device-lock decision already passed authoritatively (Firestore) in the
    // renderer before we got here, so the caller is allowed on this device.
    // Refresh the local offline cache to the authoritative owner — this also
    // corrects any tampered/stale device-owner.json to the real owner.
    bindDeviceOwner(session)

    const encrypted = safeStorage.encryptString(JSON.stringify(session))
    fs.writeFileSync(sessionPath(), encrypted)
    return { ok: true }
  })

  // Only clears the session marker — NOT the device-owner binding (logging out
  // must not unbind the device) and never the local database (one DB per
  // device, not per account: same data before and after sign-out).
  ipcMain.handle('auth:clearLocalSession', (): void => {
    if (fs.existsSync(sessionPath())) fs.unlinkSync(sessionPath())
  })

  ipcMain.handle('auth:getDeviceOwner', (): DeviceOwner | null => readDeviceOwner())

  // Clears ONLY the local offline cache — NOT the authoritative Firestore
  // binding, which the client is intentionally forbidden (by security rules)
  // from deleting. A true re-onboarding is an admin action: delete the
  // device_locks/{deviceId} doc in the Firebase Console, then the next online
  // login re-binds. Clearing the local cache alone can never re-register a
  // device, since Firestore still rejects a mismatched account online.
  // Intentionally not surfaced as a normal UI button.
  ipcMain.handle('auth:resetDeviceBinding', (): void => {
    if (fs.existsSync(deviceOwnerPath())) fs.unlinkSync(deviceOwnerPath())
  })

  // The device ID is stable for the life of the install — unlike the session,
  // it is NOT cleared on logout, since it identifies this machine, not a login.
  ipcMain.handle('auth:getDeviceId', (): string => {
    try {
      const existing = JSON.parse(fs.readFileSync(deviceIdPath(), 'utf-8')) as { deviceId: string }
      if (existing.deviceId) return existing.deviceId
    } catch {
      // no device-id.json yet — fall through and create one
    }
    const deviceId = randomUUID()
    fs.writeFileSync(deviceIdPath(), JSON.stringify({ deviceId, createdAt: new Date().toISOString() }))
    return deviceId
  })
}
