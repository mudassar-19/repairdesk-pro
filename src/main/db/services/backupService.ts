import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { getDatabase, getDatabasePath, closeDatabase } from '../client'
import { ActivityLogRepository } from '../repositories/activityLogRepository'
import { SettingsRepository } from '../repositories/settingsRepository'

export type BackupKind = 'auto' | 'manual' | 'safety'

export interface BackupInfo {
  fileName: string
  filePath: string
  kind: BackupKind
  createdAt: string
  sizeBytes: number
}

export interface BackupResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface ValidationResult {
  valid: boolean
  reason?: string
}

export interface RestoreResult {
  success: boolean
  error?: string
}

/** Tables that must be present for a file to be recognized as a RepairDex Pro database. */
const REQUIRED_TABLES = ['customers', 'repairs', 'payments', 'expenses', 'activity_log']

/**
 * Core business tables. If ALL of these are empty there is nothing worth
 * backing up yet — deliberately excludes settings / activity_log / health_check,
 * which the app writes on its own (including the backup's own log entry), so a
 * fresh install still reads as "no data".
 */
const BUSINESS_TABLES = ['customers', 'repairs', 'payments', 'expenses', 'udhaar', 'udhaar_settlements'] as const

/**
 * True once the shop has any real records worth protecting. AUTOMATIC and
 * scheduled backups gate on this so a brand-new, empty install never creates a
 * meaningless backup of an empty database — the first real backup happens only
 * once there is actual data. Manual "Backup Now" (local or cloud) is
 * intentionally NOT gated: that's an explicit user action.
 */
export function hasBusinessData(): boolean {
  const client = getDatabase().$client
  return BUSINESS_TABLES.some((table) => client.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get() !== undefined)
}

const AUTO_BACKUP_STATE_KEY = 'backup.autoState'

const FREQUENCY_MS: Record<'daily' | 'weekly', number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
}

export function getDefaultBackupsDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** The user's configured default location (Phase 15 Settings), falling back to the built-in userData/backups folder if none was set. */
function getConfiguredBackupsDir(): string {
  const { customLocation } = new SettingsRepository(getDatabase()).getBackupSettings()
  if (!customLocation) return getDefaultBackupsDir()
  fs.mkdirSync(customLocation, { recursive: true })
  return customLocation
}

function formatTimestampForFilename(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function buildBackupFilename(kind: BackupKind, date: Date): string {
  return `repairdesk-${kind}-${formatTimestampForFilename(date)}.sqlite`
}

function parseBackupFilename(fileName: string): { kind: BackupKind } | null {
  const match = fileName.match(/^repairdesk-(auto|manual|safety)-.+\.sqlite$/)
  return match ? { kind: match[1] as BackupKind } : null
}

/**
 * Hot-backs-up the live database via better-sqlite3's own backup API (wraps
 * SQLite's sqlite3_backup_* C API) rather than a raw file copy — safe to call
 * while the app is actively reading/writing, and correctly captures data
 * still sitting in the WAL sidecar file that a plain fs.copyFile would miss.
 */
export async function createBackup(kind: BackupKind, destinationDir?: string): Promise<BackupResult> {
  try {
    const dir = destinationDir ?? getConfiguredBackupsDir()
    fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, buildBackupFilename(kind, new Date()))

    await getDatabase().$client.backup(filePath)

    logBackupActivity(kind === 'safety' ? 'safety_backup_created' : 'backup_created', filePath)
    return { success: true, filePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while creating backup'
    logBackupActivity('backup_failed', undefined, message)
    return { success: false, error: message }
  }
}

/**
 * A transient local file for the scheduled cloud backup upload — same hot
 * backup API as createBackup, but written to a fixed, non-timestamped name
 * outside the visible Available Backups list (listBackups only recognizes
 * the repairdesk-{kind}-{timestamp}.sqlite naming pattern). Overwritten on
 * every run and deleted by the caller right after a successful upload — this
 * is purely an upload artifact, never a user-facing backup of its own.
 */
export async function createCloudBackupStagingFile(): Promise<BackupResult> {
  try {
    const dir = getDefaultBackupsDir()
    const filePath = path.join(dir, '.cloud-upload-staging.sqlite')
    await getDatabase().$client.backup(filePath)
    return { success: true, filePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while preparing backup for upload'
    return { success: false, error: message }
  }
}

export function listBackups(dir?: string): BackupInfo[] {
  const targetDir = dir ?? getConfiguredBackupsDir()
  if (!fs.existsSync(targetDir)) return []

  return fs
    .readdirSync(targetDir)
    .map((fileName) => {
      const parsed = parseBackupFilename(fileName)
      if (!parsed) return null
      const filePath = path.join(targetDir, fileName)
      const stat = fs.statSync(filePath)
      return {
        fileName,
        filePath,
        kind: parsed.kind,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size
      } satisfies BackupInfo
    })
    .filter((entry): entry is BackupInfo => entry !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Opens the candidate as a brand-new read-only connection — never touches the
 * live database. Three checks, all must pass: the file opens as SQLite at
 * all, PRAGMA integrity_check reports no corruption, and the core RepairDex
 * Pro tables are present (rejects a valid-but-unrelated SQLite file). Always
 * closes the validation connection, success or failure.
 */
export function validateBackupFile(filePath: string): ValidationResult {
  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: 'File does not exist' }
  }

  let testDb: InstanceType<typeof Database> | null = null
  try {
    testDb = new Database(filePath, { readonly: true, fileMustExist: true })

    const integrity = testDb.pragma('integrity_check', { simple: true }) as string
    if (integrity !== 'ok') {
      return { valid: false, reason: `Database failed integrity check: ${integrity}` }
    }

    const tables = testDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name)
    const missing = REQUIRED_TABLES.filter((table) => !tables.includes(table))
    if (missing.length > 0) {
      return { valid: false, reason: `Not a RepairDex Pro database (missing tables: ${missing.join(', ')})` }
    }

    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Not a valid SQLite database file'
    }
  } finally {
    testDb?.close()
  }
}

/**
 * Validate -> safety-backup-of-current-data -> close live connection ->
 * swap files -> caller relaunches the app. The safety-backup step is not a
 * separate callable primitive — it always runs, in this order, before
 * anything destructive touches the live file. If it fails, this function
 * throws before the live database is touched at all.
 */
export async function restoreFromBackup(candidatePath: string): Promise<RestoreResult> {
  const validation = validateBackupFile(candidatePath)
  if (!validation.valid) {
    return { success: false, error: validation.reason }
  }

  const safetyBackup = await createBackup('safety')
  if (!safetyBackup.success) {
    return { success: false, error: `Aborted — could not create a safety backup first: ${safetyBackup.error}` }
  }

  logBackupActivity('restore_initiated', candidatePath)

  const liveDbPath = getDatabasePath()
  closeDatabase()

  try {
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = liveDbPath + suffix
      if (fs.existsSync(sidecar)) fs.rmSync(sidecar)
    }
    fs.copyFileSync(candidatePath, liveDbPath)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while restoring database'
    return { success: false, error: `Restore failed after safety backup was created (safety backup: ${safetyBackup.filePath}): ${message}` }
  }
}

/** Never touches manual or safety backups — only prunes the automatic-schedule ones. keep defaults to the user's configured retentionCount (Phase 15 Settings). */
export function pruneAutoBackups(keep?: number): void {
  const retention = keep ?? new SettingsRepository(getDatabase()).getBackupSettings().retentionCount
  const autoBackups = listBackups().filter((backup) => backup.kind === 'auto')
  const toDelete = autoBackups.slice(retention)
  for (const backup of toDelete) {
    fs.rmSync(backup.filePath, { force: true })
  }
}

/**
 * Called once shortly after the window is shown and on a recurring interval
 * while the app stays open (see main/index.ts) — a startup-only check would
 * never fire again for a shop that leaves the app running for days. The
 * minimum age before actually creating one is the user's configured
 * frequency (Daily/Weekly, Phase 15 Settings), not a hardcoded constant.
 */
export async function maybeRunAutomaticBackup(): Promise<void> {
  // Never back up a brand-new, empty database — a fresh install shouldn't
  // create a meaningless backup. The first automatic backup waits until there
  // is real business data to protect.
  if (!hasBusinessData()) return

  const settingsRepo = new SettingsRepository(getDatabase())
  const { frequency } = settingsRepo.getBackupSettings()
  const state = settingsRepo.get<{ lastAutoBackupAt: string }>(AUTO_BACKUP_STATE_KEY)
  const lastAt = state?.lastAutoBackupAt ? new Date(state.lastAutoBackupAt).getTime() : 0
  if (Date.now() - lastAt < FREQUENCY_MS[frequency]) return

  const result = await createBackup('auto')
  if (result.success) {
    settingsRepo.set(AUTO_BACKUP_STATE_KEY, { lastAutoBackupAt: new Date().toISOString() })
    pruneAutoBackups()
  }
}

function logBackupActivity(actionType: string, filePath?: string, error?: string): void {
  try {
    new ActivityLogRepository(getDatabase()).create({
      actionType,
      entityType: 'backup',
      entityId: null,
      description: error ? `Backup operation failed: ${error}` : `${actionType.replace(/_/g, ' ')}${filePath ? `: ${path.basename(filePath)}` : ''}`,
      metadata: filePath ? { filePath, error } : { error }
    })
  } catch {
    // Activity logging must never mask the real backup/restore result.
  }
}
