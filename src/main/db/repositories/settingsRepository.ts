import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { AppDatabase } from '../client'
import { settings } from '../schema'

/**
 * One example domain schema (shop branding) to establish the pattern: every
 * future settings domain (receipt config, theme, backup config) gets its own
 * Zod schema + getter/setter pair here, all backed by the same generic key-value
 * rows below. New fields inside a domain, or entirely new domains, never
 * need a migration — see Phase 3 write-up for why this beats wide typed
 * columns for white-label flexibility. Phase 15 adds three more such domains
 * (receipt, backup, and the extended branding fields) without touching
 * schema.ts at all — this is exactly the flexibility the pattern was for.
 */
const brandingSchema = z.object({
  shopName: z.string().default('RepairDex Pro'),
  logoPath: z.string().nullable().default(null),
  currency: z.string().default('PKR'),
  /** Flows live into the CSS token system (theme.css's --color-primary-*) — see shared/lib/brandColor.ts. */
  primaryColor: z.string().default('#0d9488'),
  address: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default('')
})
export type BrandingSettings = z.infer<typeof brandingSchema>

const BRANDING_KEY = 'branding'

/**
 * Plain, user-typed text — not run through the bilingual dictionary system,
 * since there's no way to auto-translate a shop owner's own warranty note.
 * Displayed on the receipt exactly as entered, in whatever language/script
 * they type it in (the app's Urdu font rendering already handles that).
 */
const receiptSettingsSchema = z.object({
  headerText: z.string().default(''),
  footerText: z.string().default('')
})
export type ReceiptSettings = z.infer<typeof receiptSettingsSchema>

const RECEIPT_SETTINGS_KEY = 'receiptSettings'

/**
 * frequency/retentionCount are small closed choices, not raw hours/counts —
 * see Phase 15 write-up for why: a non-technical shop owner has no way to
 * judge whether "6" or "0.5" is a sane value for either of these, but
 * Daily/Weekly and 7/14/30 are all self-evidently reasonable. customLocation
 * null means "use the built-in userData/backups folder".
 *
 * cloudBackupEnabled/scheduledTimes govern the separate scheduled cloud
 * backup feature (replacing the old Firestore sync engine) — scheduledTimes
 * is a list of 24-hour "HH:mm" strings, each one a daily upload time. Each
 * scheduled run replaces the single latest backup in Drive (there is no
 * accumulating cloud history — see services/googleDriveApi.ts). Default
 * 1 PM / 6 PM / 8 PM covers a typical shop day (midday, evening close-ish,
 * and after close); the owner can add/remove/change them freely in Settings.
 */
const backupSettingsSchema = z.object({
  customLocation: z.string().nullable().default(null),
  frequency: z.enum(['daily', 'weekly']).default('daily'),
  retentionCount: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14),
  cloudBackupEnabled: z.boolean().default(true),
  scheduledTimes: z.array(z.string()).default(['13:00', '18:00', '20:00'])
})
export type BackupSettings = z.infer<typeof backupSettingsSchema>

const BACKUP_SETTINGS_KEY = 'backupSettings'

const CLOUD_BACKUP_STATE_KEY = 'cloudBackup.state'

export interface CloudBackupState {
  lastCloudBackupAt: string | null
}

/**
 * Survives independently of the encrypted refresh-token file (main/services/
 * googleDriveAuth.ts) so Settings can still show *who* was connected and
 * *that* access was revoked even after the token itself has been deleted —
 * "Not connected" (never set up) and "Disconnected, please reconnect"
 * (revoked) need to read differently to the shop owner.
 */
const googleDriveStateSchema = z.object({
  lastConnectedEmail: z.string().nullable().default(null),
  revoked: z.boolean().default(false)
})
export type GoogleDriveState = z.infer<typeof googleDriveStateSchema>

const GOOGLE_DRIVE_STATE_KEY = 'googleDrive.state'

export class SettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  get<T = unknown>(key: string): T | null {
    const row = this.db.select().from(settings).where(eq(settings.key, key)).get()
    return row ? (JSON.parse(row.value) as T) : null
  }

  set<T>(key: string, value: T): void {
    const now = new Date().toISOString()
    this.db
      .insert(settings)
      .values({ key, value: JSON.stringify(value), updatedAt: now })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(value), updatedAt: now }
      })
      .run()
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(
      this.db
        .select()
        .from(settings)
        .all()
        .map((row) => [row.key, JSON.parse(row.value)])
    )
  }

  getBranding(): BrandingSettings {
    return brandingSchema.parse(this.get<Partial<BrandingSettings>>(BRANDING_KEY) ?? {})
  }

  setBranding(patch: Partial<BrandingSettings>): BrandingSettings {
    const next = brandingSchema.parse({ ...this.getBranding(), ...patch })
    this.set(BRANDING_KEY, next)
    return next
  }

  getReceiptSettings(): ReceiptSettings {
    return receiptSettingsSchema.parse(this.get<Partial<ReceiptSettings>>(RECEIPT_SETTINGS_KEY) ?? {})
  }

  setReceiptSettings(patch: Partial<ReceiptSettings>): ReceiptSettings {
    const next = receiptSettingsSchema.parse({ ...this.getReceiptSettings(), ...patch })
    this.set(RECEIPT_SETTINGS_KEY, next)
    return next
  }

  getBackupSettings(): BackupSettings {
    return backupSettingsSchema.parse(this.get<Partial<BackupSettings>>(BACKUP_SETTINGS_KEY) ?? {})
  }

  setBackupSettings(patch: Partial<BackupSettings>): BackupSettings {
    const next = backupSettingsSchema.parse({ ...this.getBackupSettings(), ...patch })
    this.set(BACKUP_SETTINGS_KEY, next)
    return next
  }

  getCloudBackupState(): CloudBackupState {
    return this.get<CloudBackupState>(CLOUD_BACKUP_STATE_KEY) ?? { lastCloudBackupAt: null }
  }

  setCloudBackupState(state: CloudBackupState): void {
    this.set(CLOUD_BACKUP_STATE_KEY, state)
  }

  getGoogleDriveState(): GoogleDriveState {
    return googleDriveStateSchema.parse(this.get<Partial<GoogleDriveState>>(GOOGLE_DRIVE_STATE_KEY) ?? {})
  }

  setGoogleDriveState(patch: Partial<GoogleDriveState>): GoogleDriveState {
    const next = googleDriveStateSchema.parse({ ...this.getGoogleDriveState(), ...patch })
    this.set(GOOGLE_DRIVE_STATE_KEY, next)
    return next
  }
}
