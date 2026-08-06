import { logActivity } from './activityLog'
import type { RestoreResult } from '../../../../main/db/services/backupService'

export interface CloudBackupResult {
  success: boolean
  error?: string
}

/**
 * Creates a fresh local snapshot of the live database and uploads it to the
 * connected client's own Google Drive (their dedicated "RepairDex Pro
 * Backups" folder — see main/services/googleDriveApi.ts). Used both by the
 * scheduled background check (useCloudBackupScheduler) and the manual "Back
 * Up to Cloud Now" button/reminder banner — same function either way. All
 * OAuth/Drive-API work happens in the main process; this is just the
 * activity-log wrapper around it.
 */
export async function runCloudBackupNow(): Promise<CloudBackupResult> {
  const result = await window.api.googleDrive.backupNow()
  if (result.success) {
    logActivity({ actionType: 'backup_created', entityType: 'backup', description: 'Cloud backup uploaded to Google Drive' })
  } else {
    logActivity({ actionType: 'backup_failed', entityType: 'backup', description: `Cloud backup failed: ${result.error}` })
  }
  return result
}

/** Downloads the latest backup from the connected client's Google Drive and restores it via the same validate/safety-backup/swap path as a local file restore. */
export async function restoreFromCloudBackup(): Promise<RestoreResult> {
  return window.api.googleDrive.restoreLatest()
}
