import { ipcMain, dialog, app } from 'electron'
import {
  createBackup,
  listBackups,
  restoreFromBackup,
  hasBusinessData,
  type BackupInfo,
  type BackupResult,
  type RestoreResult
} from '../db/services/backupService'
import { getDatabase } from '../db/client'
import { SettingsRepository, type CloudBackupState } from '../db/repositories/settingsRepository'

/**
 * Manual local backups/restores triggered from Settings, plus
 * getCloudBackupState (read by both the Google Drive cloud-backup UI and the
 * missed-backup scheduler/banner to know when the last successful cloud
 * backup ran). The actual Google Drive upload/download lives entirely in
 * ipc/googleDrive.ts — it calls createCloudBackupStagingFile/
 * restoreFromBackup directly, in-process, rather than round-tripping bytes
 * through IPC the way the old renderer-driven Firebase Storage flow did.
 * Automatic scheduled LOCAL backups are wired up separately in
 * main/index.ts, since they run on app startup/timer rather than in
 * response to a renderer action.
 */
export function registerBackupIpc(): void {
  ipcMain.handle('backup:createManual', (_event, destinationDir?: string): Promise<BackupResult> => {
    return createBackup('manual', destinationDir)
  })

  ipcMain.handle('backup:list', (): BackupInfo[] => listBackups())

  ipcMain.handle('backup:chooseDirectory', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choose Backup Location',
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled ? null : (filePaths[0] ?? null)
  })

  ipcMain.handle('backup:chooseRestoreFile', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup File',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
    })
    return canceled ? null : (filePaths[0] ?? null)
  })

  ipcMain.handle('backup:restore', async (_event, filePath: string): Promise<RestoreResult> => {
    const result = await restoreFromBackup(filePath)
    if (result.success) {
      relaunchAfterRestore()
    }
    return result
  })

  ipcMain.handle('backup:getCloudBackupState', (): CloudBackupState => {
    return new SettingsRepository(getDatabase()).getCloudBackupState()
  })

  // Lets the scheduled cloud-backup check skip a still-empty database too.
  ipcMain.handle('backup:hasBusinessData', (): boolean => hasBusinessData())
}

/** Give the IPC reply a moment to flush back to the renderer (so it can show
 * a "restarting..." message) before the process actually exits — the
 * restart itself is what guarantees every part of the app (React state, the
 * main process's db handle) starts clean against the restored data instead
 * of risking stale in-memory state. Exported for the Google Drive restore
 * path (ipc/googleDrive.ts), which reaches the same post-restore state via a
 * different upstream source (Drive instead of a local file/bytes). */
export function relaunchAfterRestore(): void {
  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 300)
}
