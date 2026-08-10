import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, gte, like, lt, lte, notInArray, or, sql } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm/utils'
import type { Db } from '../client'
import { repairs, customers, payments, type RepairStatus, type RepairPriority } from '../schema'
import { BaseRepository } from './baseRepository'
import { activeRepairPaymentCondition } from './paymentAggregation'

export type Repair = typeof repairs.$inferSelect
export type RepairWithCustomer = Repair & { customerName: string; customerPhone: string }

export interface NewRepairInput {
  customerId: string
  deviceBrand: string
  deviceModel: string
  issue: string
  accessories?: string | null
  imei?: string | null
  status?: RepairStatus
  costPrice?: number
  repairPrice?: number
  advanceAmount?: number
  priority?: RepairPriority
  estimatedDeliveryDate?: string | null
  deliveryTime?: string | null
  notes?: string | null
}

export type UpdateRepairInput = Partial<NewRepairInput>

export interface RepairFilters {
  customerId?: string
  status?: RepairStatus
  /** Exact device brand match, for the Repair List's brand filter. */
  brand?: string
  /** Inclusive createdAt range, ISO strings — powers the Today/This Week/This Month/Custom presets in the UI. */
  dateFrom?: string
  dateTo?: string
  includeDeleted?: boolean
}

export class RepairRepository extends BaseRepository {
  constructor(db: Db) {
    super(db)
  }

  create(input: NewRepairInput): Repair {
    const now = new Date().toISOString()
    const repairPrice = input.repairPrice ?? 0
    const advanceAmount = input.advanceAmount ?? 0

    return this.write<Repair>((tx) =>
      tx
        .insert(repairs)
        .values({
          id: randomUUID(),
          customerId: input.customerId,
          deviceBrand: input.deviceBrand,
          deviceModel: input.deviceModel,
          issue: input.issue,
          accessories: input.accessories ?? null,
          imei: input.imei ?? null,
          status: input.status ?? 'pending',
          costPrice: input.costPrice ?? 0,
          repairPrice,
          advanceAmount,
          // No payments exist yet at creation, so the full price is owed. The
          // booking advance (if any) is recorded as a real `advance` Payment
          // immediately after, inside services/repairService.createRepair,
          // which then recomputes this to repairPrice - advance. advanceAmount
          // above is stored only as a display record of that booking advance.
          remainingBalance: repairPrice,
          priority: input.priority ?? 'normal',
          estimatedDeliveryDate: input.estimatedDeliveryDate ?? null,
          deliveryTime: input.deliveryTime ?? null,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
          isDeleted: false
        })
        .returning()
        .get()
    )!
  }

  findById(id: string): Repair | null {
    const row = this.db.select().from(repairs).where(eq(repairs.id, id)).get()
    return row ?? null
  }

  findAll(filters: RepairFilters = {}): Repair[] {
    const conditions = this.buildConditions(filters)
    const query = this.db.select().from(repairs)
    const filtered = conditions.length ? query.where(and(...conditions)) : query
    // Default newest-first for the Repairs list.
    return filtered.orderBy(desc(repairs.createdAt)).all()
  }

  /**
   * Same filters as findAll, plus a free-text search across device
   * brand/model, repair id, IMEI, and the linked customer's name/phone — the
   * Repair List needs the customer columns anyway, so this is a real SQL
   * join rather than a second app-level lookup.
   */
  findAllWithCustomer(filters: RepairFilters & { search?: string } = {}): RepairWithCustomer[] {
    const conditions = this.buildConditions(filters)
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(
        or(
          like(repairs.deviceBrand, term),
          like(repairs.deviceModel, term),
          like(repairs.id, term),
          like(repairs.imei, term),
          like(customers.name, term),
          like(customers.phone, term)
        )!
      )
    }

    const query = this.db
      .select({ ...getTableColumns(repairs), customerName: customers.name, customerPhone: customers.phone })
      .from(repairs)
      .innerJoin(customers, eq(repairs.customerId, customers.id))

    const filtered = conditions.length ? query.where(and(...conditions)) : query
    // Default newest-first for the Repairs list.
    return filtered.orderBy(desc(repairs.createdAt)).all()
  }

  /**
   * remainingBalance = repairPrice - (sum of recorded payments) on every
   * update. The initial Advance is no longer subtracted separately here —
   * as of the "every rupee is a Payment" model it is recorded as a real
   * `advance` Payment row at booking (see services/repairService.createRepair),
   * so subtracting advanceAmount too would double-count it. advanceAmount is
   * kept on the row purely as a display record of the booking advance. This
   * recompute runs on every update (not just when pricing changes) so editing
   * device/pricing details after payments exist never silently erases what's
   * already been paid.
   *
   * Also the single enforcement point for the delivered/cancelled status
   * lock: this is the only method any status-changing update reaches
   * (ipc/repairs.ts's repairs:update handler calls it directly, and nothing
   * else in the app writes to this table's status column), so throwing here
   * — inside the write() transaction, before any write happens —
   * makes the lock impossible to bypass from the UI, a future IPC call, or
   * any other code path, not just a client-side restriction.
   */
  update(id: string, patch: UpdateRepairInput): Repair | null {
    return this.write<Repair>((tx) => {
      const existing = tx.select().from(repairs).where(eq(repairs.id, id)).get()
      if (!existing) return null

      if (
        (existing.status === 'delivered' || existing.status === 'cancelled') &&
        patch.status !== undefined &&
        patch.status !== existing.status
      ) {
        throw new Error(`Repair ${id} is already ${existing.status} and cannot change status further`)
      }

      const repairPrice = patch.repairPrice ?? existing.repairPrice
      const totalPaid = this.sumPayments(tx, id)

      return (
        tx
          .update(repairs)
          .set({
            ...patch,
            remainingBalance: repairPrice - totalPaid,
            updatedAt: new Date().toISOString()
          })
          .where(eq(repairs.id, id))
          .returning()
          .get() ?? null
      )
    })
  }

  private sumPayments(db: Db, repairId: string): number {
    const row = db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.repairId, repairId), eq(payments.isDeleted, false)))
      .get()
    return row?.total ?? 0
  }

  /**
   * Repairs due today that still need an action — the Dashboard's most
   * operationally important list, so it's a dedicated indexed+filtered query
   * (estimatedDeliveryDate is an exact "YYYY-MM-DD" string, set by a plain
   * date input) rather than filtering a larger result set in JS. Excludes
   * delivered/cancelled only: a "completed" repair due today still needs the
   * handover (Mark as Delivered) action, unlike under the old 6-state model
   * where "completed" was itself the terminal state.
   */
  findTodaysDeliveries(today: string): RepairWithCustomer[] {
    return this.db
      .select({ ...getTableColumns(repairs), customerName: customers.name, customerPhone: customers.phone })
      .from(repairs)
      .innerJoin(customers, eq(repairs.customerId, customers.id))
      .where(
        and(
          eq(repairs.isDeleted, false),
          eq(repairs.estimatedDeliveryDate, today),
          notInArray(repairs.status, ['delivered', 'cancelled'])
        )
      )
      .all()
  }

  /**
   * Overdue Delivery Reminder (Dashboard): estimatedDeliveryDate is a plain
   * 'YYYY-MM-DD' string, so a lexicographic `<` comparison against today's
   * date string is a correct chronological comparison too — no date parsing
   * needed, and repairs_estimated_delivery_date_idx keeps this an index
   * range scan rather than a full table scan. NULL estimatedDeliveryDate
   * (never set) never matches `<`, so those repairs are correctly excluded
   * without an extra isNotNull check.
   */
  findOverdueUnresolved(today: string): RepairWithCustomer[] {
    return this.db
      .select({ ...getTableColumns(repairs), customerName: customers.name, customerPhone: customers.phone })
      .from(repairs)
      .innerJoin(customers, eq(repairs.customerId, customers.id))
      .where(
        and(
          eq(repairs.isDeleted, false),
          lt(repairs.estimatedDeliveryDate, today),
          notInArray(repairs.status, ['delivered', 'cancelled'])
        )
      )
      .orderBy(repairs.estimatedDeliveryDate)
      .all()
  }

  /**
   * The Dashboard's "Repairs Needing Action" list — only repairs still awaiting
   * the owner's action (pending/completed; delivered and cancelled are done and
   * excluded), ordered by estimatedDeliveryDate ascending so the most overdue /
   * soonest-due hand-overs sit at the top. estimatedDeliveryDate is a plain
   * 'YYYY-MM-DD' string, so ascending string order IS chronological. Repairs
   * with no delivery date set sort LAST (`… is null` yields 1 after 0), since
   * they carry no time pressure; newest-created breaks ties. Sorted/limited in
   * SQL, not in JS.
   */
  findNeedingActionWithCustomer(limit: number): RepairWithCustomer[] {
    return this.db
      .select({ ...getTableColumns(repairs), customerName: customers.name, customerPhone: customers.phone })
      .from(repairs)
      .innerJoin(customers, eq(repairs.customerId, customers.id))
      .where(and(eq(repairs.isDeleted, false), notInArray(repairs.status, ['delivered', 'cancelled'])))
      .orderBy(sql`${repairs.estimatedDeliveryDate} is null`, asc(repairs.estimatedDeliveryDate), desc(repairs.createdAt))
      .limit(limit)
      .all()
  }

  /**
   * "Realized" profit — profit attributed to actual money received, not to
   * repair-status transitions. The previous version of this method
   * (calculateDeliveredProfit) summed repairPrice - costPrice for every
   * repair marked 'delivered' in the window, regardless of whether that
   * repair had actually been paid for. That let a single unpaid delivered
   * repair with a large repairPrice inflate "profit" for a window where the
   * customer had paid nothing yet — the exact reason Monthly Profit could
   * show as vastly larger than Monthly Revenue (which only ever counts real
   * Payment rows), an impossible result for a real business.
   *
   * The fix: profit realization follows the same event Revenue already
   * follows — a Payment being recorded — not a status change. Each payment
   * contributes its own proportional share of that repair's total margin:
   *   payment.amount * (repairPrice - costPrice) / repairPrice
   * so a repair only contributes its full profit once it's been fully paid,
   * and a partial payment contributes a matching partial share of the
   * profit. dateFrom/dateTo are plain 'YYYY-MM-DD' strings compared against
   * payments.paymentDate, exactly like PaymentRepository.sumByDateRange, so
   * this is always measuring the same population of transactions as
   * Revenue over the same window — the two can never be checked against
   * mismatched date semantics again.
   *
   * This also guarantees realized profit can never exceed revenue for the
   * same window: as long as costPrice >= 0 (the only value forms ever
   * write), each payment's margin ratio (repairPrice - costPrice) /
   * repairPrice is <= 1, so summing it can never exceed summing the raw
   * payment amounts. NULLIF guards the (rare, likely-free-repair)
   * repairPrice = 0 case so that division never produces NULL/a crash —
   * such a payment simply contributes 0 profit.
   */
  calculateRealizedProfit(dateFrom: string, dateTo: string): number {
    const row = this.db
      .select({
        total: sql<number>`coalesce(sum(${payments.amount} * (${repairs.repairPrice} - ${repairs.costPrice}) / nullif(${repairs.repairPrice}, 0)), 0)`
      })
      .from(payments)
      .innerJoin(repairs, eq(payments.repairId, repairs.id))
      // activeRepairPaymentCondition excludes cancelled/soft-deleted repairs so
      // realized profit reverses in lockstep with revenue when a repair is cancelled.
      .where(
        and(
          eq(payments.isDeleted, false),
          activeRepairPaymentCondition(),
          gte(payments.paymentDate, dateFrom),
          lte(payments.paymentDate, dateTo)
        )
      )
      .get()
    return row?.total ?? 0
  }

  /** Most-repaired brands, by repairs created in the window — Reports' Top Brands section. */
  topBrands(dateFrom: string, dateTo: string, limit: number): { brand: string; count: number }[] {
    return this.db
      .select({ brand: repairs.deviceBrand, count: count() })
      .from(repairs)
      .where(and(eq(repairs.isDeleted, false), gte(repairs.createdAt, dateFrom), lte(repairs.createdAt, dateTo)))
      .groupBy(repairs.deviceBrand)
      .orderBy(desc(count()))
      .limit(limit)
      .all()
  }

  /** Grouped by (brand, model) pair, not model name alone, so e.g. two brands' same-named models never collide. */
  topModels(dateFrom: string, dateTo: string, limit: number): { brand: string; model: string; count: number }[] {
    return this.db
      .select({ brand: repairs.deviceBrand, model: repairs.deviceModel, count: count() })
      .from(repairs)
      .where(and(eq(repairs.isDeleted, false), gte(repairs.createdAt, dateFrom), lte(repairs.createdAt, dateTo)))
      .groupBy(repairs.deviceBrand, repairs.deviceModel)
      .orderBy(desc(count()))
      .limit(limit)
      .all()
  }

  /**
   * issue is free text, so exact-string grouping alone would split
   * "Cracked screen" from "cracked screen" as different issues. Grouping on
   * LOWER(TRIM(issue)) is a cheap, honest improvement (case/whitespace
   * insensitive) without attempting true semantic/fuzzy clustering, which
   * would need NLP tooling this app doesn't have — genuinely different
   * phrasings of the same problem ("Screen crack" vs "Cracked screen")
   * still show as separate rows.
   */
  commonRepairTypes(dateFrom: string, dateTo: string, limit: number): { issue: string; count: number }[] {
    const normalized = sql<string>`lower(trim(${repairs.issue}))`
    return this.db
      .select({ issue: normalized, count: count() })
      .from(repairs)
      .where(and(eq(repairs.isDeleted, false), gte(repairs.createdAt, dateFrom), lte(repairs.createdAt, dateTo)))
      .groupBy(normalized)
      .orderBy(desc(count()))
      .limit(limit)
      .all()
  }

  /** Status breakdown for repairs created in the window — the Report's per-period status counts (distinct from the Dashboard's all-time-active version). */
  countByStatusInRange(dateFrom: string, dateTo: string): Partial<Record<RepairStatus, number>> {
    const rows = this.db
      .select({ status: repairs.status, total: count() })
      .from(repairs)
      .where(and(eq(repairs.isDeleted, false), gte(repairs.createdAt, dateFrom), lte(repairs.createdAt, dateTo)))
      .groupBy(repairs.status)
      .all()
    return Object.fromEntries(rows.map((row) => [row.status, row.total]))
  }

  /**
   * How many NOT-yet-finished repairs a customer has (anything not delivered or
   * cancelled, excluding soft-deleted). Used to block archiving a customer who
   * still has work in progress — see the customers:softDelete guard.
   */
  countActiveByCustomer(customerId: string): number {
    const row = this.db
      .select({ total: count() })
      .from(repairs)
      .where(
        and(
          eq(repairs.customerId, customerId),
          eq(repairs.isDeleted, false),
          notInArray(repairs.status, ['delivered', 'cancelled'])
        )
      )
      .get()
    return row?.total ?? 0
  }

  /** Populates the Repair List's brand filter dropdown from what's actually in use. */
  listDistinctBrands(): string[] {
    const rows = this.db
      .selectDistinct({ brand: repairs.deviceBrand })
      .from(repairs)
      .where(eq(repairs.isDeleted, false))
      .all()
    return rows.map((row) => row.brand).sort()
  }

  softDelete(id: string): Repair | null {
    return this.write<Repair>((tx) =>
      tx
        .update(repairs)
        .set({ isDeleted: true, updatedAt: new Date().toISOString() })
        .where(eq(repairs.id, id))
        .returning()
        .get() ?? null
    )
  }

  private buildConditions(filters: RepairFilters) {
    const conditions = filters.includeDeleted ? [] : [eq(repairs.isDeleted, false)]
    if (filters.customerId) conditions.push(eq(repairs.customerId, filters.customerId))
    if (filters.status) conditions.push(eq(repairs.status, filters.status))
    if (filters.brand) conditions.push(eq(repairs.deviceBrand, filters.brand))
    if (filters.dateFrom) conditions.push(gte(repairs.createdAt, filters.dateFrom))
    if (filters.dateTo) conditions.push(lte(repairs.createdAt, filters.dateTo))
    return conditions
  }
}
