import { randomUUID } from 'node:crypto'
import { and, desc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm/utils'
import type { Db } from '../client'
import { payments, repairs, customers, type PaymentType, type RepairStatus } from '../schema'
import { BaseRepository } from './baseRepository'
import { activeRepairPaymentCondition } from './paymentAggregation'

export type Payment = typeof payments.$inferSelect
export type PaymentWithContext = Payment & {
  customerName: string
  customerPhone: string
  deviceBrand: string
  deviceModel: string
  /** Total non-deleted payments on this payment's repair (for the "N of M" ledger indicator). */
  repairPaymentCount: number
  /** This payment's chronological position among its repair's payments, 1-based. */
  repairPaymentIndex: number
  /** Parent repair's status — the Payments ledger badges 'cancelled' rows and excludes them from its active total. */
  repairStatus: RepairStatus
  /** Whether the parent repair is soft-deleted — treated like cancelled for badging/total purposes. */
  repairIsDeleted: boolean
}

export interface NewPaymentInput {
  repairId: string
  amount: number
  type: PaymentType
  paymentDate: string
  notes?: string | null
}

export type UpdatePaymentInput = Partial<Omit<NewPaymentInput, 'repairId'>>

export interface PaymentFilters {
  repairId?: string
  includeDeleted?: boolean
}

export interface PaymentListFilters {
  /** Matches against customer name/phone or device brand/model. */
  search?: string
  type?: PaymentType
  /** Inclusive paymentDate range, plain "YYYY-MM-DD" strings. */
  dateFrom?: string
  dateTo?: string
  includeDeleted?: boolean
}

export class PaymentRepository extends BaseRepository {
  constructor(db: Db) {
    super(db)
  }

  create(input: NewPaymentInput): Payment {
    const now = new Date().toISOString()
    return this.write<Payment>((tx) =>
      tx
        .insert(payments)
        .values({
          id: randomUUID(),
          repairId: input.repairId,
          amount: input.amount,
          type: input.type,
          paymentDate: input.paymentDate,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
          isDeleted: false
        })
        .returning()
        .get()
    )!
  }

  findById(id: string): Payment | null {
    const row = this.db.select().from(payments).where(eq(payments.id, id)).get()
    return row ?? null
  }

  findAll(filters: PaymentFilters = {}): Payment[] {
    const conditions = filters.includeDeleted ? [] : [eq(payments.isDeleted, false)]
    if (filters.repairId) conditions.push(eq(payments.repairId, filters.repairId))

    const query = this.db.select().from(payments)
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  /** Payment History for the Repair Detail view — most recent first. */
  findByRepairId(repairId: string): Payment[] {
    return this.db
      .select()
      .from(payments)
      .where(and(eq(payments.repairId, repairId), eq(payments.isDeleted, false)))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .all()
  }

  /**
   * The "All Payments" ledger (features/payments/PaymentsPage) — every
   * payment across every repair, joined with its repair/customer for
   * display, independent of any single repair's own Payment History card.
   * A real SQL join rather than N+1 lookups, same reasoning as
   * RepairRepository.findAllWithCustomer.
   */
  findAllWithContext(filters: PaymentListFilters = {}): PaymentWithContext[] {
    const conditions = filters.includeDeleted ? [] : [eq(payments.isDeleted, false)]
    if (filters.type) conditions.push(eq(payments.type, filters.type))
    if (filters.dateFrom) conditions.push(gte(payments.paymentDate, filters.dateFrom))
    if (filters.dateTo) conditions.push(lte(payments.paymentDate, filters.dateTo))
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(
        or(like(customers.name, term), like(customers.phone, term), like(repairs.deviceBrand, term), like(repairs.deviceModel, term))!
      )
    }

    const query = this.db
      .select({
        ...getTableColumns(payments),
        customerName: customers.name,
        customerPhone: customers.phone,
        deviceBrand: repairs.deviceBrand,
        deviceModel: repairs.deviceModel,
        // Surfaced so the ledger can badge cancelled/removed repairs' payments
        // and drop them from its active total, rather than showing them as
        // normal live revenue (point 6). The rows are intentionally still
        // returned — the money must not silently disappear from the audit trail.
        repairStatus: repairs.status,
        repairIsDeleted: repairs.isDeleted,
        // Correlated subqueries (not window functions) so the count/index cover
        // ALL of the repair's payments regardless of the active list filters —
        // "2 of 3" stays truthful even when a date/type filter hides siblings.
        repairPaymentCount: sql<number>`(select count(*) from payments p2 where p2.repair_id = ${payments.repairId} and p2.is_deleted = 0)`,
        repairPaymentIndex: sql<number>`(select count(*) from payments p2 where p2.repair_id = ${payments.repairId} and p2.is_deleted = 0 and (p2.payment_date < ${payments.paymentDate} or (p2.payment_date = ${payments.paymentDate} and p2.created_at <= ${payments.createdAt})))`
      })
      .from(payments)
      .innerJoin(repairs, eq(payments.repairId, repairs.id))
      .innerJoin(customers, eq(repairs.customerId, customers.id))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))

    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  /**
   * dateFrom/dateTo are plain "YYYY-MM-DD" strings, matching how
   * paymentDate is stored (a date-only <input type="date"> value, not a
   * full ISO timestamp) — comparing against full-timestamp bounds here
   * would silently misclassify same-day payments, since "2026-08-02" sorts
   * lexicographically *before* "2026-08-02T00:00:00.000Z".
   */
  sumByDateRange(dateFrom: string, dateTo: string): number {
    // Joins repairs so a cancelled/soft-deleted repair's payments are excluded
    // from Revenue (see activeRepairPaymentCondition — the root-cause fix for
    // phantom revenue). payments.repairId is a NOT NULL foreign key, so the
    // inner join never drops a legitimate payment.
    const row = this.db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .innerJoin(repairs, eq(payments.repairId, repairs.id))
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

  /** Total actually paid across all of a customer's repairs — a correlated subquery, not a join, so a repair with multiple payments never double-counts. */
  sumByCustomer(customerId: string): number {
    const customerRepairIds = this.db
      .select({ id: repairs.id })
      .from(repairs)
      // Excludes cancelled repairs too (not just soft-deleted), so a customer's
      // "Total Spent" reverses when one of their repairs is cancelled.
      .where(and(eq(repairs.customerId, customerId), activeRepairPaymentCondition()))

    const row = this.db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.isDeleted, false), inArray(payments.repairId, customerRepairIds)))
      .get()
    return row?.total ?? 0
  }

  update(id: string, patch: UpdatePaymentInput): Payment | null {
    return this.write<Payment>((tx) =>
      tx
        .update(payments)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(payments.id, id))
        .returning()
        .get() ?? null
    )
  }

  softDelete(id: string): Payment | null {
    return this.write<Payment>((tx) =>
      tx
        .update(payments)
        .set({ isDeleted: true, updatedAt: new Date().toISOString() })
        .where(eq(payments.id, id))
        .returning()
        .get() ?? null
    )
  }
}
