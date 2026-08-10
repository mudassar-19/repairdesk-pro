/**
 * Scale/performance sanity check (audit Section G). Seeds a large synthetic
 * dataset into a throwaway temp SQLite DB (built from the real migrations) and
 * times the hot read paths the way the app actually calls them. Flags any query
 * that would degrade badly at scale.
 *
 * Run with: electron scripts/runVerifyPerf.js
 */
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/main/db/schema'
import type { AppDatabase } from '../src/main/db/client'
import { customers, repairs, payments, expenses } from '../src/main/db/schema'
import { RepairRepository } from '../src/main/db/repositories/repairRepository'
import { CustomerRepository } from '../src/main/db/repositories/customerRepository'
import { PaymentRepository } from '../src/main/db/repositories/paymentRepository'
import { DashboardRepository } from '../src/main/db/repositories/dashboardRepository'
import { ReportRepository } from '../src/main/db/repositories/reportRepository'
import { AnalyticsRepository } from '../src/main/db/repositories/analyticsRepository'

const MIGRATIONS = path.join(__dirname, '../src/main/db/migrations')
const N_CUSTOMERS = 3000
const N_REPAIRS = 5000
const SLOW_MS = 500 // anything above this is flagged for attention

let flagged = 0
function time<T>(label: string, fn: () => T): T {
  const t0 = Date.now()
  const out = fn()
  const dt = Date.now() - t0
  const rows = Array.isArray(out) ? ` (${out.length} rows)` : ''
  const mark = dt > SLOW_MS ? '  ⚠️ SLOW' : ''
  if (dt > SLOW_MS) flagged += 1
  console.log(`  ${dt.toString().padStart(5)} ms  ${label}${rows}${mark}`)
  return out
}

function makeTestDb(): { db: AppDatabase; file: string } {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rdx-perf-')), 'test.sqlite')
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = OFF')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS })
  return { db, file }
}

const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Oppo', 'Vivo', 'Nokia', 'Infinix']
const MODELS = ['A50', 'iPhone 12', 'Redmi 9', 'A5', 'Y20', 'G21', 'Hot 10']

function seed(db: AppDatabase): void {
  const now = new Date()
  const iso = (daysAgo: number): string => new Date(now.getTime() - daysAgo * 86400000).toISOString()
  const dateOnly = (daysAgo: number): string => iso(daysAgo).slice(0, 10)

  db.transaction((tx) => {
    const custIds: string[] = []
    for (let i = 0; i < N_CUSTOMERS; i++) {
      const id = randomUUID()
      custIds.push(id)
      tx.insert(customers)
        .values({
          id,
          name: `Customer ${i}`,
          phone: `03${String(100000000 + i).slice(0, 9)}`,
          address: null,
          notes: null,
          createdAt: iso(i % 365),
          updatedAt: iso(i % 365),
          isDeleted: false
        })
        .run()
    }

    for (let i = 0; i < N_REPAIRS; i++) {
      const id = randomUUID()
      const price = 1000 + (i % 40) * 250
      const cost = Math.floor(price * 0.5)
      const advance = i % 3 === 0 ? Math.floor(price / 2) : i % 3 === 1 ? price : 0
      const daysAgo = i % 400
      const status = ['pending', 'completed', 'delivered', 'cancelled'][i % 4] as (typeof schema.repairStatusValues)[number]
      tx.insert(repairs)
        .values({
          id,
          customerId: custIds[i % N_CUSTOMERS],
          deviceBrand: BRANDS[i % BRANDS.length],
          deviceModel: MODELS[i % MODELS.length],
          issue: 'Cracked screen',
          accessories: null,
          imei: null,
          status,
          costPrice: cost,
          repairPrice: price,
          advanceAmount: advance,
          remainingBalance: price - advance,
          priority: 'normal',
          estimatedDeliveryDate: dateOnly(daysAgo - 3),
          deliveryTime: null,
          notes: null,
          createdAt: iso(daysAgo),
          updatedAt: iso(daysAgo),
          isDeleted: false
        })
        .run()
      // 0–2 payments per repair.
      if (advance > 0) {
        tx.insert(payments)
          .values({ id: randomUUID(), repairId: id, amount: advance, type: 'advance', paymentDate: dateOnly(daysAgo), notes: null, createdAt: iso(daysAgo), updatedAt: iso(daysAgo), isDeleted: false })
          .run()
      }
      if (i % 5 === 0) {
        tx.insert(payments)
          .values({ id: randomUUID(), repairId: id, amount: 200, type: 'partial', paymentDate: dateOnly(daysAgo), notes: null, createdAt: iso(daysAgo), updatedAt: iso(daysAgo), isDeleted: false })
          .run()
      }
    }

    for (let i = 0; i < 500; i++) {
      tx.insert(expenses)
        .values({ id: randomUUID(), category: ['rent', 'electricity', 'supplies'][i % 3], amount: 1000 + i, description: null, expenseDate: dateOnly(i % 300), isRecurring: false, recurringMonth: null, createdAt: iso(i % 300), updatedAt: iso(i % 300), isDeleted: false })
        .run()
    }
  })
}

function run(): void {
  const { db, file } = makeTestDb()
  console.log(`\nSeeding ${N_CUSTOMERS} customers, ${N_REPAIRS} repairs, ~${Math.floor(N_REPAIRS * 1.1)} payments…`)
  const tSeed = Date.now()
  seed(db)
  console.log(`Seeded in ${Date.now() - tSeed} ms\n`)

  const repairRepo = new RepairRepository(db)
  const custRepo = new CustomerRepository(db)
  const payRepo = new PaymentRepository(db)
  const dashboard = new DashboardRepository(db)
  const reports = new ReportRepository(db)
  const analytics = new AnalyticsRepository(db)

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().slice(0, 10)
  const bounds = {
    isoFrom: new Date(now.getFullYear(), 0, 1).toISOString(),
    isoTo: now.toISOString(),
    dateOnlyFrom: `${now.getFullYear()}-01-01`,
    dateOnlyTo: today
  }

  console.log('Hot read paths:')
  time('Dashboard getSummary()', () => dashboard.getSummary())
  time('Repairs list — all (findAllWithCustomer {})', () => repairRepo.findAllWithCustomer({}))
  time('Repairs list — search "iPhone"', () => repairRepo.findAllWithCustomer({ search: 'iPhone' }))
  time('Repairs list — status filter', () => repairRepo.findAllWithCustomer({ status: 'pending' }))
  time('Customers list — all', () => custRepo.findAll({}))
  time('Customers list — search "Customer 12"', () => custRepo.findAll({ search: 'Customer 12' }))
  time('Customers listWithStats (repair counts)', () => custRepo.findAllWithStats({}))
  time('Payments ledger — all (findAllWithContext, correlated subqueries)', () => payRepo.findAllWithContext({}))
  time('Payments ledger — search', () => payRepo.findAllWithContext({ search: 'Samsung' }))
  time('Reports generate (YTD)', () => reports.generate(bounds))
  time('Analytics revenueTrend(day)', () => analytics.revenueTrend('day'))
  time('Analytics profitTrend(month)', () => analytics.profitTrend('month'))
  time('Analytics topCustomersBySpend(10)', () => analytics.topCustomersBySpend(10))
  time('Monthly revenue sumByDateRange', () => payRepo.sumByDateRange(monthStart, today))

  db.$client.close()
  fs.rmSync(path.dirname(file), { recursive: true, force: true })
  console.log(`\n──────── ${flagged === 0 ? 'All hot paths under ' + SLOW_MS + 'ms' : flagged + ' path(s) flagged SLOW'} ────────`)
}

app.whenReady().then(() => {
  app.dock?.hide()
  try {
    run()
    app.exit(0)
  } catch (err) {
    console.error('\n[perf] CRASHED:', err)
    app.exit(1)
  }
})
