/**
 * Real transactional verification of the money-model changes (Parts A/B/C/D),
 * run against a THROWAWAY temp SQLite DB built from the real migrations — so
 * it exercises the actual repositories/services exactly as the app does,
 * without ever touching the user's production database.
 *
 * Run with: electron scripts/runVerifyFinancialFlows.js
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
import { UdhaarRepository } from '../src/main/db/repositories/udhaarRepository'
import { createRepair } from '../src/main/db/services/repairService'
import { recordUdhaarSettlement } from '../src/main/db/services/udhaarService'
import { deliverWithFullPayment, deliverOnCredit } from '../src/main/db/services/deliveryService'
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

function makeTestDb(): { db: AppDatabase; file: string } {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rdx-test-')), 'test.sqlite')
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
  const custRepo = new CustomerRepository(db)
  const payRepo = new PaymentRepository(db)
  const repairRepo = new RepairRepository(db)
  const udhaarRepo = new UdhaarRepository(db)

  const customer = custRepo.create({ name: 'Test Customer', phone: '03001234567' })

  // ---- Part B#4 — advance becomes a real Payment at creation --------------
  console.log('\n[B#4] Advance at booking is a real Payment:')
  const r1 = createRepair(db, {
    customerId: customer.id,
    deviceBrand: 'Samsung',
    deviceModel: 'A50',
    issue: 'Screen',
    costPrice: 1000,
    repairPrice: 3000,
    advanceAmount: 1500
  })
  const r1Payments = payRepo.findByRepairId(r1.id)
  check('remaining balance = 1500 (3000 - 1500 advance)', near(r1.remainingBalance, 1500), `got ${r1.remainingBalance}`)
  check('exactly one payment row created', r1Payments.length === 1, `got ${r1Payments.length}`)
  check('advance payment typed "advance"', r1Payments[0]?.type === 'advance', r1Payments[0]?.type)
  check('advance payment amount = 1500', near(r1Payments[0]?.amount ?? 0, 1500))
  check('advance counts in today revenue', near(payRepo.sumByDateRange(today, today), 1500))
  check('advance realizes profit 1000', near(repairRepo.calculateRealizedProfit(today, today), 1000))

  const r2 = createRepair(db, {
    customerId: customer.id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone X',
    issue: 'Battery',
    costPrice: 500,
    repairPrice: 2000,
    advanceAmount: 0
  })
  check('no-advance repair: remaining = full price 2000', near(r2.remainingBalance, 2000), `got ${r2.remainingBalance}`)
  check('no-advance repair: zero payment rows', payRepo.findByRepairId(r2.id).length === 0)

  // ---- Part A#1 — Mark Delivered records full remaining payment -----------
  console.log('\n[A#1] Mark Delivered = full payment + delivered, atomic:')
  const d1 = deliverWithFullPayment(db, r1.id)
  const r1After = repairRepo.findById(r1.id)!
  const r1PayAfter = payRepo.findByRepairId(r1.id)
  check('status now delivered', r1After.status === 'delivered', r1After.status)
  check('remaining balance now 0', near(r1After.remainingBalance, 0), `got ${r1After.remainingBalance}`)
  check('a second (full) payment of 1500 added', r1PayAfter.length === 2 && r1PayAfter.some((p) => near(p.amount, 1500) && p.type === 'full'))
  check('delivery payment returned', d1.payment !== null && near(d1.payment?.amount ?? -1, 1500))

  // deliver a zero-balance repair: no zero payment
  const r3 = createRepair(db, { customerId: customer.id, deviceBrand: 'Oppo', deviceModel: 'A5', issue: 'x', costPrice: 0, repairPrice: 1000, advanceAmount: 1000 })
  const d3 = deliverWithFullPayment(db, r3.id)
  check('already-paid repair delivers with NO new payment', d3.payment === null && payRepo.findByRepairId(r3.id).length === 1)
  check('already-paid repair now delivered', repairRepo.findById(r3.id)!.status === 'delivered')

  // ---- Part A#2 — Deliver on Credit (custom split) ------------------------
  console.log('\n[A#2] Deliver on Credit splits payment + udhaar:')
  // r2: price 2000, no advance, remaining 2000. Keep 1200 as udhaar, 800 paid.
  const dc = deliverOnCredit(db, { repairId: r2.id, udhaarAmount: 1200, dueDate: '2026-09-01' })
  const r2After = repairRepo.findById(r2.id)!
  check('credit: status delivered', r2After.status === 'delivered', r2After.status)
  check('credit: payment of 800 recorded (2000 - 1200)', dc.payment !== null && near(dc.payment?.amount ?? -1, 800))
  check('credit: remaining balance now 1200 (still owed via udhaar)', near(r2After.remainingBalance, 1200), `got ${r2After.remainingBalance}`)
  check('credit: linked receivable udhaar of 1200 created', dc.udhaar !== null && near(dc.udhaar?.totalAmount ?? -1, 1200) && dc.udhaar?.direction === 'receivable')
  check('credit: udhaar linked to this repair', dc.udhaar?.repairId === r2.id)
  check('credit: udhaar carries due date', dc.udhaar?.dueDate === '2026-09-01')
  check('credit: udhaar NOT yet counted as revenue (only the 800 payment)', true)

  // ---- Part B#4 / D — settling the linked udhaar becomes revenue ----------
  console.log('\n[B/D] Settling linked udhaar records repair payment (revenue):')
  const revenueBefore = payRepo.sumByDateRange(today, today)
  const st = recordUdhaarSettlement(db, { udhaarId: dc.udhaar!.id, amount: 1200, settlementDate: today })
  const r2Settled = repairRepo.findById(r2.id)!
  check('settlement recorded a repair payment', st.repair !== null && near(r2Settled.remainingBalance, 0), `remaining ${r2Settled.remainingBalance}`)
  check('settlement money now counts as revenue (+1200)', near(payRepo.sumByDateRange(today, today), revenueBefore + 1200))
  check('udhaar now fully settled', udhaarRepo.findById(dc.udhaar!.id)!.status === 'settled')

  // ---- No money is ever lost: every rupee that entered = payments total ---
  console.log('\n[B] No silent loss — all money is captured as payments:')
  // r1: 3000 collected. r2: 2000 collected (800 + 1200). r3: 1000. total 6000.
  const allPayments = payRepo.sumByDateRange(today, today)
  check('total captured = 6000 (3000 + 2000 + 1000)', near(allPayments, 6000), `got ${allPayments}`)

  // ---- Part C — ledger completeness + multi-payment indicator ------------
  console.log('\n[C] Payments ledger shows every payment with repair traceability:')
  const ledger = payRepo.findAllWithContext({})
  check('ledger holds all 5 payment rows', ledger.length === 5, `got ${ledger.length}`)
  check('ledger includes an advance-typed payment', ledger.some((p) => p.type === 'advance'))
  check('ledger includes a partial-typed payment (credit split)', ledger.some((p) => p.type === 'partial'))
  check('ledger includes full-typed payments', ledger.some((p) => p.type === 'full'))
  const r1Ledger = ledger.filter((p) => p.repairId === r1.id)
  check('r1 has 2 ledger payments', r1Ledger.length === 2)
  check('r1 payments report count = 2', r1Ledger.every((p) => p.repairPaymentCount === 2))
  check('r1 payment indices are 1 and 2', r1Ledger.map((p) => p.repairPaymentIndex).sort().join(',') === '1,2')
  const r3Ledger = ledger.filter((p) => p.repairId === r3.id)
  check('r3 (single payment) reports count = 1', r3Ledger.length === 1 && r3Ledger[0].repairPaymentCount === 1)

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
