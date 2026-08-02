import { and, desc, eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { activityLog } from '../schema'

export type ActivityLogRow = typeof activityLog.$inferSelect

export interface NewActivityLogInput {
  actionType: string
  entityType: string
  entityId?: string | null
  description: string
  metadata?: Record<string, unknown>
}

export interface ActivityLogFilters {
  entityType?: string
  entityId?: string
  limit?: number
}

/** Append-only — no update/softDelete. Entries are historical facts, not editable records. */
export class ActivityLogRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: NewActivityLogInput): ActivityLogRow {
    return this.db
      .insert(activityLog)
      .values({
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        description: input.description,
        performedAt: new Date().toISOString(),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null
      })
      .returning()
      .get()
  }

  findAll(filters: ActivityLogFilters = {}): ActivityLogRow[] {
    const conditions = []
    if (filters.entityType) conditions.push(eq(activityLog.entityType, filters.entityType))
    if (filters.entityId) conditions.push(eq(activityLog.entityId, filters.entityId))

    const base = this.db.select().from(activityLog)
    const filtered = conditions.length ? base.where(and(...conditions)) : base
    const ordered = filtered.orderBy(desc(activityLog.performedAt))
    return filters.limit ? ordered.limit(filters.limit).all() : ordered.all()
  }
}
