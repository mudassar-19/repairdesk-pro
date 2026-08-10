/**
 * Real transactional verification of the cancellation / delete financial-reversal
 * fix, run against a THROWAWAY temp SQLite DB built from the real migrations — so
 * it exercises the actual repositories/services (Dashboard, Reports, Analytics,
 * Payments, Customer spend) exactly as the app does, without ever touching the
 * user's production database.
 *
 * Run with: electron scripts/runVerifyCancellationReversal.js
 */
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/main/db/schema'
import type { AppDatabase } from '../src/main/db/client'
import { CustomerRepository } from '../src/main/db/repositories/customerRepository'
import { RepairRepository } from '../src/main/db/repositories/repairRepository'
import { PaymentRepository } from '../src/main/db/repositories/paymentRepository'
import { ExpenseRepository } from '../src/main/db/repositories/expenseRepository'
import { UdhaarRepository } from '../src/main/db/repositories/udhaarRepository'
import { DashboardRepository } from '../src/main/db/repositories/dashboardRepository'
import { ReportRepository } from '../src/main/db/repositories/reportRepository'
import { AnalyticsRepository } from '../src/main/db/repositories/analyticsRepository'
import { createRepair, cancelRepair } from '../src/main/db/services/repairService'
import { deliverWithFullPayment } from '../src/main/db/services/deliveryService'
import { todayLocalDateString } from '../src/main/lib/date'

const MIGRATIONS = path.join(__dirname, '../src/main/db/migrations')

let pass = 0
let fail = 0
function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    pass += 1
    console.log(`  ✓ ${label}`)
  } else {
    fail += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}
function sumTrend(points: { value: number }[]): number {
  return points.reduce((s, p) => s + p.value, 0)
}

function todayBounds(today: string): { isoFrom: string; isoTo: string; dateOnlyFrom: string; dateOnlyTo: string } {
  return {
    isoFrom: new Date(today + 'T00:00:00.000Z').toISOString(),
    isoTo: new Date(today + 'T23:59:59.999Z').toISOString(),
    dateOnlyFrom: today,
    dateOnlyTo: today
  }
}

function makeTestDb(): { db: AppDatabase; file: string } {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rdx-cancel-')), 'test.sqlite')
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = OFF')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS })
  return { db, file }
}

function run(): void {
  const { db, file } = makeTestDb()
  const today = todayLocalDateString()
  const bounds = todayBounds(today)
  const custRepo = new CustomerRepository(db)
  const payRepo = new PaymentRepository(db)
  const repairRepo = new RepairRepository(db)
  const expenseRepo = new ExpenseRepository(db)
  const udhaarRepo = new UdhaarRepository(db)
  const dashboard = new DashboardRepository(db)
  const reports = new ReportRepository(db)
  const analytics = new AnalyticsRepository(db)

  const customer = custRepo.create({ name: 'Cancel Test', phone: '03009998877' })

  // ============================================================
  // 1. THE EXACT REPORTED SCENARIO — price 4500 / cost 2300 / advance 1000
  // ============================================================
  console.log('\n[1] Repair created with advance shows up in every money aggregate:')
  const r1 = createRepair(db, {
    customerId: customer.id,
    deviceBrand: 'Samsung',
    deviceModel: 'A50',
    issue: 'Screen',
    costPrice: 2300,
    repairPrice: 4500,
    advanceAmount: 1000
  })
  const expectedProfit = (1000 * (4500 - 2300)) / 4500 // 488.888...
  let sum = dashboard.getSummary()
  check('todayRevenue = 1000', near(sum.todayRevenue, 1000), `got ${sum.todayRevenue}`)
  check('todayProfit = realized 488.89', near(sum.todayProfit, expectedProfit), `got ${sum.todayProfit}`)
  check('monthlyRevenue = 1000', near(sum.monthlyRevenue, 1000), `got ${sum.monthlyRevenue}`)
  check('monthlyProfit = 488.89', near(sum.monthlyProfit, expectedProfit), `got ${sum.monthlyProfit}`)
  check('netProfit = 488.89', near(sum.netProfit, expectedProfit), `got ${sum.netProfit}`)
  check('customer Total Spent = 1000', near(payRepo.sumByCustomer(customer.id), 1000))
  check('reports totalRevenue = 1000', near(reports.generate(bounds).totalRevenue, 1000))
  check('reports totalRepairProfit = 488.89', near(reports.generate(bounds).totalRepairProfit, expectedProfit))
  check('analytics revenueTrend total = 1000', near(sumTrend(analytics.revenueTrend('day')), 1000))
  check('analytics profitTrend total = 488.89', near(sumTrend(analytics.profitTrend('day')), expectedProfit))
  check('analytics topCustomers includes 1000', near(analytics.topCustomersBySpend(10)[0]?.total ?? -1, 1000))

  // ============================================================
  // 2. CANCEL — every figure must reverse to zero
  // ============================================================
  console.log('\n[2] Cancelling the repair reverses ALL money aggregates:')
  const cancelResult = cancelRepair(db, r1.id)
  check('cancel returns reversedAmount = 1000', near(cancelResult.reversedAmount, 1000), `got ${cancelResult.reversedAmount}`)
  check('repair status now cancelled', cancelResult.repair.status === 'cancelled', cancelResult.repair.status)

  sum = dashboard.getSummary()
  check('todayRevenue reversed to 0', near(sum.todayRevenue, 0), `got ${sum.todayRevenue}`)
  check('todayProfit reversed to 0', near(sum.todayProfit, 0), `got ${sum.todayProfit}`)
  check('monthlyRevenue reversed to 0', near(sum.monthlyRevenue, 0), `got ${sum.monthlyRevenue}`)
  check('monthlyProfit reversed to 0', near(sum.monthlyProfit, 0), `got ${sum.monthlyProfit}`)
  check('netProfit reversed to 0', near(sum.netProfit, 0), `got ${sum.netProfit}`)
  check('pending count is 0 (repair no longer active)', (sum.pendingRepairsCount ?? 0) === 0)
  check('customer Total Spent reversed to 0', near(payRepo.sumByCustomer(customer.id), 0))
  check('reports totalRevenue reversed to 0', near(reports.generate(bounds).totalRevenue, 0))
  check('reports totalRepairProfit reversed to 0', near(reports.generate(bounds).totalRepairProfit, 0))
  check('reports netProfit reversed to 0', near(reports.generate(bounds).netProfit, 0))
  check('analytics revenueTrend reversed to 0', near(sumTrend(analytics.revenueTrend('day')), 0))
  check('analytics profitTrend reversed to 0', near(sumTrend(analytics.profitTrend('day')), 0))
  check('analytics topCustomers excludes cancelled repair', (analytics.topCustomersBySpend(10).length === 0))

  console.log('\n[3] Payment row is preserved (audit trail) and flagged cancelled:')
  const ledger = payRepo.findAllWithContext({})
  check('payment row still present in ledger', ledger.length === 1, `got ${ledger.length}`)
  check('ledger payment carries repairStatus=cancelled', ledger[0]?.repairStatus === 'cancelled', ledger[0]?.repairStatus)
  check('underlying payment NOT soft-deleted', payRepo.findByRepairId(r1.id).length === 1)

  console.log('\n[4] Cancel is locked/terminal and cannot double-apply:')
  let threwOnSecondCancel = false
  try {
    cancelRepair(db, r1.id)
  } catch {
    threwOnSecondCancel = true
  }
  check('cancelling an already-cancelled repair throws', threwOnSecondCancel)

  const r2 = createRepair(db, {
    customerId: customer.id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone X',
    issue: 'Battery',
    costPrice: 500,
    repairPrice: 2000,
    advanceAmount: 2000
  })
  deliverWithFullPayment(db, r2.id)
  let threwOnDeliveredCancel = false
  try {
    cancelRepair(db, r2.id)
  } catch {
    threwOnDeliveredCancel = true
  }
  check('cancelling a delivered repair throws (protects linked udhaar path)', threwOnDeliveredCancel)
  check('delivered repair revenue still counts (2000)', near(dashboard.getSummary().todayRevenue, 2000), `got ${dashboard.getSummary().todayRevenue}`)

  // ============================================================
  // 5. EXPENSE DELETE reverses Monthly Expenses / Net Profit
  // ============================================================
  console.log('\n[5] Deleting an expense reverses Monthly Expenses / Net Profit:')
  const netBefore = dashboard.getSummary().netProfit
  const expBefore = dashboard.getSummary().monthlyExpenses
  const exp = expenseRepo.create({ category: 'rent', amount: 700, expenseDate: today })
  let sumE = dashboard.getSummary()
  check('monthlyExpenses rose by 700', near(sumE.monthlyExpenses, expBefore + 700), `got ${sumE.monthlyExpenses}`)
  check('netProfit dropped by 700', near(sumE.netProfit, netBefore - 700), `got ${sumE.netProfit}`)
  check('reports totalExpenses includes 700', near(reports.generate(bounds).totalExpenses, expBefore + 700))
  expenseRepo.softDelete(exp.id)
  sumE = dashboard.getSummary()
  check('monthlyExpenses reversed after delete', near(sumE.monthlyExpenses, expBefore), `got ${sumE.monthlyExpenses}`)
  check('netProfit restored after delete', near(sumE.netProfit, netBefore), `got ${sumE.netProfit}`)
  check('reports totalExpenses reversed after delete', near(reports.generate(bounds).totalExpenses, expBefore))

  // ============================================================
  // 6. UDHAAR DELETE reverses Total Receivables / Payables
  // ============================================================
  console.log('\n[6] Deleting an Udhaar entry reverses Receivables/Payables:')
  const recvBefore = udhaarRepo.sumRemainingBalanceByDirection('receivable')
  const u = udhaarRepo.create({ personName: 'Ali', direction: 'receivable', totalAmount: 3000 })
  check('receivables rose by 3000', near(udhaarRepo.sumRemainingBalanceByDirection('receivable'), recvBefore + 3000))
  udhaarRepo.softDelete(u.id)
  check('receivables reversed after delete', near(udhaarRepo.sumRemainingBalanceByDirection('receivable'), recvBefore))

  const p = udhaarRepo.create({ personName: 'Supplier', direction: 'payable', totalAmount: 1500 })
  const payBefore = udhaarRepo.sumRemainingBalanceByDirection('payable')
  check('payables includes the new 1500', near(payBefore, 1500))
  udhaarRepo.softDelete(p.id)
  check('payables reversed after delete', near(udhaarRepo.sumRemainingBalanceByDirection('payable'), 0))

  // cleanup
  db.$client.close()
  fs.rmSync(path.dirname(file), { recursive: true, force: true })

  console.log(`\n──────── RESULT: ${pass} passed, ${fail} failed ────────`)
}

app.whenReady().then(() => {
  app.dock?.hide()
  try {
    run()
    app.exit(fail === 0 ? 0 : 1)
  } catch (err) {
    console.error('\n[verify] CRASHED:', err)
    app.exit(1)
  }
})
