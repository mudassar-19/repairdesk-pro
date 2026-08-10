import { and, count, desc, eq, gte, sql, type AnyColumn } from 'drizzle-orm'
import type { Db } from '../client'
import { repairs, payments, customers } from '../schema'
import { RepairRepository } from './repairRepository'
import { activeRepairPaymentCondition } from './paymentAggregation'

export type TimeSeriesGranularity = 'day' | 'month'
export interface TimeSeriesPoint {
  bucket: string
  value: number
}
export interface RepairVolumePoint {
  bucket: string
  created: number
  completed: number
}
export interface RepeatCustomerStats {
  customersWithRepairs: number
  repeatCustomers: number
  ratePercent: number
}
export interface TopCustomer {
  customerId: string
  customerName: string
  total: number
}

const BUCKET_COUNT: Record<TimeSeriesGranularity, number> = { day: 30, month: 12 }
const STRFTIME_FORMAT: Record<TimeSeriesGranularity, string> = { day: '%Y-%m-%d', month: '%Y-%m' }
/** Well before any realistic shop data — used to mean "all time" for brandBreakdown without a second query shape. */
const EPOCH = '2000-01-01T00:00:00.000Z'

/**
 * Time-series aggregation for the Analytics screen — a different query
 * SHAPE from Phase 9's ReportRepository (one point-in-time snapshot of
 * totals for a single period) even though both are cross-entity
 * coordinators over the same per-entity repositories, for the same reason
 * DashboardRepository and ReportRepository are already kept separate:
 * forcing "give me one period's totals" and "give me N periods' worth of
 * buckets" under one class would produce an incoherent API. Where the
 * underlying aggregation already exists (Top Brands), this calls straight
 * into RepairRepository rather than re-implementing it.
 *
 * Bucketing note: repairs/customers store real UTC instants
 * (new Date().toISOString()); payments/expenses store naive local date
 * strings from a plain <input type="date">, with no timezone conversion
 * anywhere else in the app. SQLite's strftime() has no timezone awareness
 * by default — it just reads the calendar date embedded in the stored
 * string — so grouping a UTC instant column without the 'localtime'
 * modifier buckets by *UTC* calendar day. For this app's primary
 * deployment timezone (Pakistan, UTC+5), that would silently misattribute
 * the last ~5 hours of each local business day into the next day's bucket.
 * 'localtime' converts the UTC instant to the machine's local timezone
 * (this is a single-shop desktop app, so "the machine" and "the shop" are
 * the same timezone) before truncating — applied only to the UTC-instant
 * columns, never to payments/expenses' already-local date strings.
 */
export class AnalyticsRepository {
  constructor(private readonly db: Db) {}

  revenueTrend(granularity: TimeSeriesGranularity): TimeSeriesPoint[] {
    const { keys, dateOnlyFrom } = this.buildBuckets(granularity)
    const bucketExpr = this.bucketExpr(granularity, payments.paymentDate, false)

    // Joins repairs (via the NOT NULL repairId FK) so cancelled/soft-deleted
    // repairs' payments are excluded from the Revenue Trend, matching the Dashboard.
    const rows = this.db
      .select({ bucket: bucketExpr, value: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .innerJoin(repairs, eq(payments.repairId, repairs.id))
      .where(and(eq(payments.isDeleted, false), activeRepairPaymentCondition(), gte(payments.paymentDate, dateOnlyFrom)))
      .groupBy(bucketExpr)
      .all()

    return this.fillBuckets(keys, rows)
  }

  /**
   * Same realized-profit definition as RepairRepository.calculateRealizedProfit
   * (profit attributed to actual payments received, not to repair status
   * changes), bucketed instead of summed to one number. Bucketed by
   * payments.paymentDate — the exact same column and bucketing mode
   * (isUtcInstant: false) as revenueTrend above — so the Revenue and Profit
   * lines on this chart are always comparing the same buckets of the same
   * underlying transactions, never a repair-delivery-date line held up
   * against a payment-date line.
   */
  profitTrend(granularity: TimeSeriesGranularity): TimeSeriesPoint[] {
    const { keys, dateOnlyFrom } = this.buildBuckets(granularity)
    const bucketExpr = this.bucketExpr(granularity, payments.paymentDate, false)

    const rows = this.db
      .select({
        bucket: bucketExpr,
        value: sql<number>`coalesce(sum(${payments.amount} * (${repairs.repairPrice} - ${repairs.costPrice}) / nullif(${repairs.repairPrice}, 0)), 0)`
      })
      .from(payments)
      .innerJoin(repairs, eq(payments.repairId, repairs.id))
      .where(and(eq(payments.isDeleted, false), activeRepairPaymentCondition(), gte(payments.paymentDate, dateOnlyFrom)))
      .groupBy(bucketExpr)
      .all()

    return this.fillBuckets(keys, rows)
  }

  /** Two series (created vs. completed count) sharing one set of buckets, to spot busy/slow periods and completion lag together. */
  repairVolumeTrend(granularity: TimeSeriesGranularity): RepairVolumePoint[] {
    const { keys, isoFrom } = this.buildBuckets(granularity)

    const createdExpr = this.bucketExpr(granularity, repairs.createdAt, true)
    const createdRows = this.db
      .select({ bucket: createdExpr, value: count() })
      .from(repairs)
      .where(and(eq(repairs.isDeleted, false), gte(repairs.createdAt, isoFrom)))
      .groupBy(createdExpr)
      .all()

    const completedExpr = this.bucketExpr(granularity, repairs.updatedAt, true)
    const completedRows = this.db
      .select({ bucket: completedExpr, value: count() })
      .from(repairs)
      .where(and(eq(repairs.isDeleted, false), eq(repairs.status, 'completed'), gte(repairs.updatedAt, isoFrom)))
      .groupBy(completedExpr)
      .all()

    const createdMap = new Map(createdRows.map((row) => [row.bucket, row.value]))
    const completedMap = new Map(completedRows.map((row) => [row.bucket, row.value]))
    return keys.map((bucket) => ({
      bucket,
      created: createdMap.get(bucket) ?? 0,
      completed: completedMap.get(bucket) ?? 0
    }))
  }

  newCustomersTrend(granularity: TimeSeriesGranularity): TimeSeriesPoint[] {
    const { keys, isoFrom } = this.buildBuckets(granularity)
    const bucketExpr = this.bucketExpr(granularity, customers.createdAt, true)

    const rows = this.db
      .select({ bucket: bucketExpr, value: count() })
      .from(customers)
      .where(and(eq(customers.isDeleted, false), gte(customers.createdAt, isoFrom)))
      .groupBy(bucketExpr)
      .all()

    return this.fillBuckets(keys, rows)
  }

  /**
   * "Repeat customer rate" is defined here as: of customers who have had AT
   * LEAST ONE repair, what percentage have had MORE than one. Customers with
   * zero repairs are excluded from the denominator — they haven't had a
   * first visit yet, so they're neither "repeat" nor "one-time," and
   * including them would just dilute the rate with people who aren't repair
   * customers at all yet.
   *
   * Implemented as a GROUP BY (one row per customer with >=1 repair — a
   * small, bounded result set, not the raw repairs table) followed by a
   * trivial reduce over that already-aggregated array, the same pattern
   * DashboardRepository.getStatusCounts already uses.
   */
  repeatCustomerRate(): RepeatCustomerStats {
    const rows = this.db
      .select({ customerId: repairs.customerId, repairCount: count() })
      .from(repairs)
      .where(eq(repairs.isDeleted, false))
      .groupBy(repairs.customerId)
      .all()

    const customersWithRepairs = rows.length
    const repeatCustomers = rows.filter((row) => row.repairCount > 1).length
    const ratePercent = customersWithRepairs > 0 ? (repeatCustomers / customersWithRepairs) * 100 : 0

    return { customersWithRepairs, repeatCustomers, ratePercent }
  }

  /** SUM(payments.amount) grouped by customer via repairs — a real join is safe here since payments (the many side) drives the aggregation, nothing fans out. */
  topCustomersBySpend(limit: number): TopCustomer[] {
    return this.db
      .select({
        customerId: customers.id,
        customerName: customers.name,
        total: sql<number>`coalesce(sum(${payments.amount}), 0)`
      })
      .from(payments)
      .innerJoin(repairs, eq(payments.repairId, repairs.id))
      .innerJoin(customers, eq(repairs.customerId, customers.id))
      // activeRepairPaymentCondition adds the cancelled-repair exclusion on top of isDeleted.
      .where(and(eq(payments.isDeleted, false), activeRepairPaymentCondition(), eq(customers.isDeleted, false)))
      .groupBy(customers.id)
      .orderBy(desc(sql`sum(${payments.amount})`))
      .limit(limit)
      .all()
  }

  /** Delegates to the existing Top Brands query (Phase 9) rather than re-implementing it — all-time, not date-scoped, since Brand Statistics has no date picker of its own. */
  brandBreakdown(limit: number): { brand: string; count: number }[] {
    return new RepairRepository(this.db).topBrands(EPOCH, new Date().toISOString(), limit)
  }

  private bucketExpr(granularity: TimeSeriesGranularity, column: AnyColumn, isUtcInstant: boolean) {
    const format = STRFTIME_FORMAT[granularity]
    return isUtcInstant
      ? sql<string>`strftime(${format}, ${column}, 'localtime')`
      : sql<string>`strftime(${format}, ${column})`
  }

  private fillBuckets(keys: string[], rows: { bucket: string; value: number }[]): TimeSeriesPoint[] {
    const map = new Map(rows.map((row) => [row.bucket, row.value]))
    return keys.map((bucket) => ({ bucket, value: map.get(bucket) ?? 0 }))
  }

  private formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /**
   * Generates the full expected bucket list as LOCAL calendar-date strings
   * (so zero-activity days/months still appear as 0 rather than a gap in
   * the chart) — never round-tripped through .toISOString(), which would
   * reintroduce the UTC/local mismatch this class's bucketExpr('localtime')
   * is specifically avoiding. isoFrom/dateOnlyFrom are WHERE-clause lower
   * bounds only; they can be approximate (a few hours early is harmless)
   * since fillBuckets discards anything outside the generated key list
   * regardless — only the keys themselves need to be exact.
   */
  private buildBuckets(granularity: TimeSeriesGranularity): {
    keys: string[]
    isoFrom: string
    dateOnlyFrom: string
  } {
    const count = BUCKET_COUNT[granularity]
    const now = new Date()
    const keys: string[] = []
    let startDate: Date

    if (granularity === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1))
      for (let i = 0; i < count; i++) {
        keys.push(this.formatLocalDate(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i)))
      }
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1)
      for (let i = 0; i < count; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
    }

    const lowerBound = new Date(startDate)
    lowerBound.setHours(0, 0, 0, 0)
    return { keys, isoFrom: lowerBound.toISOString(), dateOnlyFrom: this.formatLocalDate(lowerBound) }
  }
}
