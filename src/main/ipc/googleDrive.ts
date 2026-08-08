import { ipcMain } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getFreshAccessToken,
  loadGoogleDriveSession,
  type ConnectResult
} from '../services/googleDriveAuth'
import { uploadBackup, downloadLatestBackup, getRemoteBackupInfo, type RemoteBackupInfo } from '../services/googleDriveApi'
import { createCloudBackupStagingFile, restoreFromBackup, type RestoreResult } from '../db/services/backupService'
import { relaunchAfterRestore } from './backup'
import { getDatabase } from '../db/client'
import { SettingsRepository } from '../db/repositories/settingsRepository'

export interface GoogleDriveStatus {
  connected: boolean
  /** The connected account's email, or (when disconnected) the last account that was connected before access was lost/revoked — lets Settings show who to reconnect as. */
  email: string | null
  revoked: boolean
}

export interface CloudBackupResult {
  success: boolean
  error?: string
}

export interface RemoteBackupInfoResult {
  connected: boolean
  /** The latest backup in the connected account's Drive, or null if none exists yet. */
  backup: RemoteBackupInfo | null
  error?: string
}

function repo() {
  return new SettingsRepository(getDatabase())
}

/** Maps a getFreshAccessToken() failure to the user-facing message shown next to the cloud backup/restore buttons — never a raw network/API error. */
function accessErrorMessage(errorKind: 'not_connected' | 'revoked' | 'network', message: string): string {
  if (errorKind === 'not_connected') return 'Google Drive is not connected. Connect it in Settings first.'
  if (errorKind === 'revoked') return 'Google Drive access was revoked. Please reconnect in Settings.'
  return message
}

export function registerGoogleDriveIpc(): void {
  ipcMain.handle('googleDrive:connect', async (): Promise<ConnectResult> => {
    const result = await connectGoogleDrive()
    if (result.success) {
      repo().setGoogleDriveState({ lastConnectedEmail: result.email, revoked: false })
    }
    return result
  })

  ipcMain.handle('googleDrive:getStatus', (): GoogleDriveStatus => {
    const session = loadGoogleDriveSession()
    if (session) return { connected: true, email: session.email, revoked: false }

    const state = repo().getGoogleDriveState()
    return { connected: false, email: state.lastConnectedEmail, revoked: state.revoked }
  })

  ipcMain.handle('googleDrive:disconnect', async (): Promise<void> => {
    await disconnectGoogleDrive()
    repo().setGoogleDriveState({ lastConnectedEmail: null, revoked: false })
  })

  ipcMain.handle('googleDrive:backupNow', async (): Promise<CloudBackupResult> => {
    const tokenResult = await getFreshAccessToken()
    if ('error' in tokenResult) {
      if (tokenResult.error === 'revoked') repo().setGoogleDriveState({ revoked: true })
      return { success: false, error: accessErrorMessage(tokenResult.error, tokenResult.message) }
    }

    const staging = await createCloudBackupStagingFile()
    if (!staging.success || !staging.filePath) {
      return { success: false, error: staging.error ?? 'Could not create a local backup to upload' }
    }

    try {
      await uploadBackup(tokenResult.accessToken, staging.filePath)
      repo().setCloudBackupState({ lastCloudBackupAt: new Date().toISOString() })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error while uploading to Google Drive' }
    } finally {
      if (fs.existsSync(staging.filePath)) fs.unlinkSync(staging.filePath)
    }
  })

  // Fresh-device check (Part F): does the connected account already hold a
  // backup? Used right after connecting to offer "Restore this backup?".
  ipcMain.handle('googleDrive:getRemoteBackupInfo', async (): Promise<RemoteBackupInfoResult> => {
    const tokenResult = await getFreshAccessToken()
    if ('error' in tokenResult) {
      if (tokenResult.error === 'revoked') repo().setGoogleDriveState({ revoked: true })
      return { connected: false, backup: null, error: accessErrorMessage(tokenResult.error, tokenResult.message) }
    }
    try {
      return { connected: true, backup: await getRemoteBackupInfo(tokenResult.accessToken) }
    } catch (err) {
      return {
        connected: true,
        backup: null,
        error: err instanceof Error ? err.message : 'Could not check Google Drive for an existing backup'
      }
    }
  })

  ipcMain.handle('googleDrive:restoreLatest', async (): Promise<RestoreResult> => {
    const tokenResult = await getFreshAccessToken()
    if ('error' in tokenResult) {
      if (tokenResult.error === 'revoked') repo().setGoogleDriveState({ revoked: true })
      return { success: false, error: accessErrorMessage(tokenResult.error, tokenResult.message) }
    }

    const tempPath = path.join(os.tmpdir(), `repairdesk-drive-restore-${randomUUID()}.sqlite`)
    try {
      const bytes = await downloadLatestBackup(tokenResult.accessToken)
      fs.writeFileSync(tempPath, bytes)
      const result = await restoreFromBackup(tempPath)
      if (result.success) relaunchAfterRestore()
      return result
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error while restoring from Google Drive' }
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
    }
  })
}
