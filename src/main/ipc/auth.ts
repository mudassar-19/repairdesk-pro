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
  /** Why a save was refused, when ok is false. */
  reason?: 'encryption-unavailable' | 'device-locked'
  /** For 'device-locked', the account this device is already bound to (so the UI can name it). */
  ownerEmail?: string
}

const sessionPath = (): string => path.join(app.getPath('userData'), 'session.enc')
const deviceIdPath = (): string => path.join(app.getPath('userData'), 'device-id.json')
const deviceOwnerPath = (): string => path.join(app.getPath('userData'), 'device-owner.json')

/**
 * Device-lock (Part H): each install is bound to the Firebase UID of the FIRST
 * account that signs in on it, so entering someone else's (otherwise valid)
 * credentials on that device is refused. Deliberately a plain JSON file, not
 * encrypted or obfuscated — the UID is not a secret, and no master password is
 * baked into the build (which would be extractable and give false security).
 * This is casual-reuse prevention for a personally-onboarded distribution
 * model, not an unbypassable control. To re-onboard a device, the distributor
 * deletes device-owner.json (see auth:resetDeviceBinding).
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

    const owner = readDeviceOwner()
    if (owner && owner.ownerUid !== session.uid) {
      // Valid credentials, wrong device — refuse without ever writing a session.
      return { ok: false, reason: 'device-locked', ownerEmail: owner.ownerEmail }
    }
    if (!owner) bindDeviceOwner(session)

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

  // Distributor re-onboarding: drop the binding so the next login re-binds the
  // device to a new account. Intentionally not surfaced as a normal UI button.
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
