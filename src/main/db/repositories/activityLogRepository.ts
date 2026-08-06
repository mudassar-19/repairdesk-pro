import { and, desc, eq, gte, like, lte, lt } from 'drizzle-orm'
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

export interface ActivityPageFilters {
  entityType?: string
  actionType?: string
  /** Matched against description, case-insensitive substring. */
  search?: string
  /** Full ISO timestamp bounds, inclusive — see shared/lib/dateRangePresets.getDateRangeBounds. */
  dateFrom?: string
  dateTo?: string
  /** Last-seen row's id from the previous page; omit for the first page. */
  cursor?: number
  pageSize: number
}

export interface ActivityPageResult {
  rows: ActivityLogRow[]
  /** id to pass as the next page's cursor, or null when this was the last page. */
  nextCursor: number | null
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

  /**
   * Cursor-paginated query for the Phase 13 Activity Timeline — id (not
   * performedAt) is the cursor, since it's set in the same insert call and is
   * therefore an equally monotonic but guaranteed-unique ordering, immune to
   * rows inserted concurrently while a user scrolls (unlike OFFSET, which
   * silently skips/duplicates rows as new activity gets prepended above the
   * window). Fetches one extra row to detect whether a next page exists,
   * avoiding a separate COUNT query.
   */
  findPage(filters: ActivityPageFilters): ActivityPageResult {
    const conditions = []
    if (filters.entityType) conditions.push(eq(activityLog.entityType, filters.entityType))
    if (filters.actionType) conditions.push(eq(activityLog.actionType, filters.actionType))
    if (filters.dateFrom) conditions.push(gte(activityLog.performedAt, filters.dateFrom))
    if (filters.dateTo) conditions.push(lte(activityLog.performedAt, filters.dateTo))
    if (filters.search) conditions.push(like(activityLog.description, `%${filters.search}%`))
    if (filters.cursor !== undefined) conditions.push(lt(activityLog.id, filters.cursor))

    const fetched = this.db
      .select()
      .from(activityLog)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(activityLog.id))
      .limit(filters.pageSize + 1)
      .all()

    const hasMore = fetched.length > filters.pageSize
    const rows = hasMore ? fetched.slice(0, filters.pageSize) : fetched
    const lastRow = rows[rows.length - 1]
    return { rows, nextCursor: hasMore && lastRow ? lastRow.id : null }
  }
}
