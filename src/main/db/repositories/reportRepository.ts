import type { Db } from '../client'
import type { RepairStatus } from '../schema'
import { RepairRepository } from './repairRepository'
import { PaymentRepository } from './paymentRepository'
import { ExpenseRepository } from './expenseRepository'

/**
 * Repairs (createdAt/updatedAt) are stored as full ISO timestamps; payments
 * and expenses use plain "YYYY-MM-DD" date-only values. A report spans both
 * kinds of table for the same logical period, so the caller (the renderer,
 * via shared/lib/reportPeriod.ts) resolves the period into both formats up
 * front — this repository never has to guess which format a given bound is in.
 */
export interface ReportDateBounds {
  isoFrom: string
  isoTo: string
  dateOnlyFrom: string
  dateOnlyTo: string
}

export interface ReportData {
  totalRevenue: number
  totalRepairProfit: number
  totalExpenses: number
  expensesByCategory: { category: string; total: number }[]
  netProfit: number
  topBrands: { brand: string; count: number }[]
  topModels: { brand: string; model: string; count: number }[]
  commonRepairTypes: { issue: string; count: number }[]
  statusCounts: Partial<Record<RepairStatus, number>>
}

const TOP_N = 5

/**
 * Reports need cross-entity aggregation (repairs + payments + expenses) for
 * an arbitrary caller-supplied window — unlike DashboardRepository's fixed
 * today/this-month scope, but the same architectural reasoning applies: this
 * is a coordinator over the per-entity repositories, not an owner of its own
 * table. None of these numbers belong to any single entity once revenue,
 * expenses, and profit are combined into one period's Net Profit and
 * brand/model/status breakdowns.
 */
export class ReportRepository {
  constructor(private readonly db: Db) {}

  generate(bounds: ReportDateBounds): ReportData {
    const repairRepo = new RepairRepository(this.db)
    const paymentRepo = new PaymentRepository(this.db)
    const expenseRepo = new ExpenseRepository(this.db)

    const totalRevenue = paymentRepo.sumByDateRange(bounds.dateOnlyFrom, bounds.dateOnlyTo)
    const expensesByCategory = expenseRepo.sumByCategoryInRange(bounds.dateOnlyFrom, bounds.dateOnlyTo)
    const totalExpenses = expensesByCategory.reduce((sum, row) => sum + row.total, 0)
    // See RepairRepository.calculateRealizedProfit — profit realized from
    // actual payments in this window, not from repair status changes, so it
    // can never exceed totalRevenue above.
    const totalRepairProfit = repairRepo.calculateRealizedProfit(bounds.dateOnlyFrom, bounds.dateOnlyTo)

    return {
      totalRevenue,
      totalRepairProfit,
      totalExpenses,
      expensesByCategory,
      // Repair cost is already netted out of totalRepairProfit — subtracting
      // Expenses from raw Revenue instead would double-count repair cost as
      // loss and overstate how bad a loss looks.
      netProfit: totalRepairProfit - totalExpenses,
      topBrands: repairRepo.topBrands(bounds.isoFrom, bounds.isoTo, TOP_N),
      topModels: repairRepo.topModels(bounds.isoFrom, bounds.isoTo, TOP_N),
      commonRepairTypes: repairRepo.commonRepairTypes(bounds.isoFrom, bounds.isoTo, TOP_N),
      statusCounts: repairRepo.countByStatusInRange(bounds.isoFrom, bounds.isoTo)
    }
  }
}
