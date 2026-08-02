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
 * columns for white-label flexibility.
 */
const brandingSchema = z.object({
  shopName: z.string().default('RepairDesk Pro'),
  logoPath: z.string().nullable().default(null),
  currency: z.string().default('PKR')
})
export type BrandingSettings = z.infer<typeof brandingSchema>

const BRANDING_KEY = 'branding'

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
      .values({ key, value: JSON.stringify(value), updatedAt: now, syncStatus: 'pending' })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(value), updatedAt: now, syncStatus: 'pending' }
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
}
