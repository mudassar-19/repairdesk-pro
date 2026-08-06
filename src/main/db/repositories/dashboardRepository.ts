import { and, count, eq, gte, lte } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { repairs, type RepairStatus } from '../schema'
import { formatLocalDate } from '../../lib/date'
import { PaymentRepository } from './paymentRepository'
import { ExpenseRepository } from './expenseRepository'
import { RepairRepository } from './repairRepository'

export interface DashboardSummary {
  todayRepairsCount: number
  pendingRepairsCount: number
  readyForPickupCount: number
  todayRevenue: number
  todayProfit: number
  monthlyRevenue: number
  monthlyProfit: number
  monthlyExpenses: number
  netProfit: number
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

/**
 * Dashboard-only aggregate queries — deliberately separate from
 * RepairRepository, which owns individual repair records/CRUD. Everything
 * here is a COUNT/SUM/GROUP BY computed in SQL, never a full table load
 * summed in JS, so this stays fast as the repairs table grows.
 */
export class DashboardRepository {
  constructor(private readonly db: AppDatabase) {}

  getSummary(): DashboardSummary {
    const now = new Date()
    const todayFrom = startOfDay(now).toISOString()
    const todayTo = endOfDay(now).toISOString()
    const todayDate = formatLocalDate(now)
    const monthStartDate = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))

    const statusCounts = this.getStatusCounts()
    const paymentRepo = new PaymentRepository(this.db)
    const expenseRepo = new ExpenseRepository(this.db)
    const repairRepo = new RepairRepository(this.db)

    const monthlyRevenue = paymentRepo.sumByDateRange(monthStartDate, todayDate)
    const monthlyExpenses = expenseRepo.sumByDateRange(monthStartDate, todayDate)
    // Profit realized this month (see calculateRealizedProfit) — based on
    // actual payments received, the same event Revenue is measured from, so
    // this can never come out larger than monthlyRevenue.
    const monthlyProfit = repairRepo.calculateRealizedProfit(monthStartDate, todayDate)

    return {
      todayRepairsCount: this.countCreatedBetween(todayFrom, todayTo),
      pendingRepairsCount: statusCounts.pending ?? 0,
      // Repurposed, not renamed: under the 4-state model "completed" means
      // exactly what "ready for pickup" used to mean — work is done, the
      // repair is just waiting on the customer — so the same card keeps
      // its label and just counts the new status value.
      readyForPickupCount: statusCounts.completed ?? 0,
      todayRevenue: paymentRepo.sumByDateRange(todayDate, todayDate),
      todayProfit: repairRepo.calculateRealizedProfit(todayDate, todayDate),
      monthlyRevenue,
      monthlyProfit,
      monthlyExpenses,
      // Monthly Profit already has repair costs netted out (it's
      // repairPrice - costPrice, realized proportionally to payments
      // received) — subtracting Expenses from raw Revenue here would double
      // count repair cost as "loss" on top of it already being excluded
      // from profit, overstating how bad a loss looks. Net Profit is what's
      // left of the money actually earned after operating expenses.
      netProfit: monthlyProfit - monthlyExpenses
    }
  }

  /** One GROUP BY query for every status count the dashboard needs, instead of one COUNT query per status. */
  private getStatusCounts(): Partial<Record<RepairStatus, number>> {
    const rows = this.db
      .select({ status: repairs.status, total: count() })
      .from(repairs)
      .where(eq(repairs.isDeleted, false))
      .groupBy(repairs.status)
      .all()
    return Object.fromEntries(rows.map((row) => [row.status, row.total]))
  }

  private countCreatedBetween(dateFrom: string, dateTo: string): number {
    const row = this.db
      .select({ total: count() })
      .from(repairs)
      .where(and(eq(repairs.isDeleted, false), gte(repairs.createdAt, dateFrom), lte(repairs.createdAt, dateTo)))
      .get()
    return row?.total ?? 0
  }
}
