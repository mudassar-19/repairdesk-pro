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

const sessionPath = (): string => path.join(app.getPath('userData'), 'session.enc')
const deviceIdPath = (): string => path.join(app.getPath('userData'), 'device-id.json')

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
      return JSON.parse(safeStorage.decryptString(encrypted)) as LocalSession
    } catch {
      return null
    }
  })

  ipcMain.handle('auth:saveLocalSession', (_event, session: LocalSession): void => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level encryption is not available on this device')
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(session))
    fs.writeFileSync(sessionPath(), encrypted)
  })

  ipcMain.handle('auth:clearLocalSession', (): void => {
    if (fs.existsSync(sessionPath())) fs.unlinkSync(sessionPath())
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
