/**
 * Transactional verification harness for the deep audit (Sections A, D, G...).
 * Throwaway temp SQLite DB built from the real migrations — exercises the real
 * repositories/services, never touches production data.
 *
 * Run with: electron scripts/runVerifyAudit.js
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
import { SettingsRepository } from '../src/main/db/repositories/settingsRepository'
import { listBackups } from '../src/main/db/services/backupService'
import { createRepair, cancelRepair } from '../src/main/db/services/repairService'
import { recordPayment } from '../src/main/db/services/paymentService'
import { assertMaxLength } from '../src/main/lib/validation'
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
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rdx-audit-')), 'test.sqlite')
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
  const repairRepo = new RepairRepository(db)
  const payRepo = new PaymentRepository(db)
  const expenseRepo = new ExpenseRepository(db)
  const udhaarRepo = new UdhaarRepository(db)
  const customer = custRepo.create({ name: 'Audit Cust', phone: '03007776655' })

  // ============================================================
  // A2 — pending price edited DOWN below payments → negative balance?
  // ============================================================
  console.log('\n[A2] Editing a pending repair price below amount paid:')
  const r1 = createRepair(db, {
    customerId: customer.id,
    deviceBrand: 'Samsung',
    deviceModel: 'A2',
    issue: 'x',
    costPrice: 500,
    repairPrice: 4500,
    advanceAmount: 1000
  })
  check('starts with remaining 3500', near(r1.remainingBalance, 3500), `got ${r1.remainingBalance}`)
  const lowered = repairRepo.update(r1.id, { repairPrice: 500 })!
  console.log(`     → after lowering price to 500 with 1000 already paid: remaining = ${lowered.remainingBalance}`)
  check('DATA LAYER allows negative remaining (overpayment state)', lowered.remainingBalance < 0)
  const totalPaid1 = 1000
  check('negative balance == price - totalPaid (500 - 1000 = -500)', near(lowered.remainingBalance, 500 - totalPaid1))

  // With multiple payments beyond the advance.
  const r2 = createRepair(db, {
    customerId: customer.id,
    deviceBrand: 'Apple',
    deviceModel: 'A2b',
    issue: 'x',
    costPrice: 500,
    repairPrice: 5000,
    advanceAmount: 1000
  })
  recordPayment(db, { repairId: r2.id, amount: 2000, type: 'partial', paymentDate: today })
  const paid2 = payRepo.findByRepairId(r2.id).reduce((s, p) => s + p.amount, 0)
  check('r2 total paid = 3000', near(paid2, 3000))
  const r2Low = repairRepo.update(r2.id, { repairPrice: 2000 })!
  check('lowering r2 price to 2000 (3000 paid) → remaining -1000', near(r2Low.remainingBalance, -1000), `got ${r2Low.remainingBalance}`)

  // ============================================================
  // A4 — deleting a recurring expense vs the auto-draft reminder
  // ============================================================
  console.log('\n[A4] Recurring auto-draft after deleting recurring expense(s):')
  // Two recurring "rent" entries LAST month (so none exists this month → eligible
  // for a draft). Distinct days so "latest" is unambiguous (day 20 newer than day 10).
  const lastMonthDay = (day: number): string => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const rentOld = expenseRepo.create({ category: 'rent', amount: 4000, expenseDate: lastMonthDay(10), isRecurring: true })
  const rentNew = expenseRepo.create({ category: 'rent', amount: 5000, expenseDate: lastMonthDay(20), isRecurring: true })
  let drafts = expenseRepo.findRecurringDrafts()
  check('draft offered for rent using LATEST amount (5000)', drafts.some((d) => d.category === 'rent' && near(d.amount, 5000)))
  // Delete the newest → draft should fall back to the older remaining recurring amount (4000), still a real historical basis.
  expenseRepo.softDelete(rentNew.id)
  drafts = expenseRepo.findRecurringDrafts()
  check('after deleting newest, draft falls back to older amount (4000)', drafts.some((d) => d.category === 'rent' && near(d.amount, 4000)))
  // Delete the last remaining recurring rent → no rent draft at all (no phantom amount).
  expenseRepo.softDelete(rentOld.id)
  drafts = expenseRepo.findRecurringDrafts()
  check('after deleting ALL recurring rent, NO rent draft is offered', !drafts.some((d) => d.category === 'rent'))

  // ============================================================
  // C8 — backend customer-name max-length guard
  // ============================================================
  console.log('\n[C8] Backend max-length guard for text (customer name):')
  let threwLong = false
  try {
    assertMaxLength('a'.repeat(201), 200, 'Name')
  } catch {
    threwLong = true
  }
  check('201-char name is rejected', threwLong)
  let threwOk = false
  try {
    assertMaxLength('Valid Name', 200, 'Name')
  } catch {
    threwOk = true
  }
  check('normal name is accepted', !threwOk)

  // ============================================================
  // C9 — currency bounds (settings)
  // ============================================================
  console.log('\n[C9] Currency symbol is bounded with a safe fallback:')
  const settings = new SettingsRepository(db)
  check('valid short currency is stored', settings.setBranding({ currency: 'Rs.' }).currency === 'Rs.')
  check('empty currency falls back to PKR', settings.setBranding({ currency: '' }).currency === 'PKR')
  check('over-long currency falls back to PKR', settings.setBranding({ currency: 'X'.repeat(50) }).currency === 'PKR')
  check('retentionCount stays a closed choice (14 default persists)', settings.getBackupSettings().retentionCount === 14)

  // ============================================================
  // D10 / D11 — cancelled repair in Customer history + Payments N-of-M
  // ============================================================
  console.log('\n[D10/D11] Cancelled repair: customer history + N-of-M indicator:')
  const dR = createRepair(db, {
    customerId: customer.id,
    deviceBrand: 'Nokia',
    deviceModel: 'D11',
    issue: 'x',
    costPrice: 0,
    repairPrice: 5000,
    advanceAmount: 1000
  })
  // Distinct earlier date so the ledger's chronological "N of M" index is
  // deterministic (advance today = #2, this partial yesterday = #1) rather than
  // depending on sub-millisecond createdAt ordering.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  recordPayment(db, { repairId: dR.id, amount: 2000, type: 'partial', paymentDate: yesterday })
  cancelRepair(db, dR.id)
  // D10: the customer's repair list (what CustomerDetailPage renders via
  // repairs.list({customerId})) still INCLUDES the cancelled repair, with status
  // 'cancelled' (StatusBadge shows it) — not hidden, not shown as active.
  const custRepairs = repairRepo.findAll({ customerId: customer.id })
  check('D10: cancelled repair still listed in customer history', custRepairs.some((r) => r.id === dR.id && r.status === 'cancelled'))
  // D11: both payments stay in the ledger, both flagged cancelled, N-of-M intact.
  const dLedger = payRepo.findAllWithContext({}).filter((p) => p.repairId === dR.id)
  check('D11: both payment rows remain in the ledger', dLedger.length === 2)
  check('D11: N-of-M count = 2 on both rows', dLedger.every((p) => p.repairPaymentCount === 2))
  check('D11: indices are exactly 1 and 2', dLedger.map((p) => p.repairPaymentIndex).sort().join(',') === '1,2')
  check('D11: both rows flagged repairStatus=cancelled', dLedger.every((p) => p.repairStatus === 'cancelled'))

  // ============================================================
  // E12 — duplicate-phone UNIQUE constraint is enforced
  // ============================================================
  console.log('\n[E12] Duplicate phone is rejected by the UNIQUE index (graceful failure):')
  custRepo.create({ name: 'Dup One', phone: '03001112299' })
  let dupThrew = false
  let dupMsg = ''
  try {
    custRepo.create({ name: 'Dup Two', phone: '03001112299' })
  } catch (e) {
    dupThrew = true
    dupMsg = String(e)
  }
  check('second create with the same phone throws (not silently duplicated)', dupThrew)
  check('the error is a UNIQUE-constraint violation (catchable → clear UI error)', /unique/i.test(dupMsg))

  // ============================================================
  // E14 — transaction atomicity == crash-mid-transaction safety
  // ============================================================
  console.log('\n[E14] A throwing transaction rolls back fully (SQLite crash-safety proxy):')
  const beforeCount = repairRepo.findAll({}).length
  let txThrew = false
  try {
    db.transaction((tx) => {
      new RepairRepository(tx).create({
        customerId: customer.id,
        deviceBrand: 'ROLLBACK-MARKER',
        deviceModel: 'X',
        issue: 'x',
        repairPrice: 100
      })
      throw new Error('simulated crash mid-transaction')
    })
  } catch {
    txThrew = true
  }
  check('transaction threw', txThrew)
  check('no partial row persisted (row count unchanged)', repairRepo.findAll({}).length === beforeCount)
  check('the ROLLBACK-MARKER repair does NOT exist', !repairRepo.findAll({}).some((r) => r.deviceBrand === 'ROLLBACK-MARKER'))

  // ============================================================
  // G18 — local auto-backup pruning is correct over repeated cycles
  // ============================================================
  console.log('\n[G18] Auto-backup pruning keeps the newest N and is stable over cycles:')
  const bdir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdx-backups-'))
  const RETAIN = 14
  const mkBackup = (kind: string, idx: number): void => {
    const t = new Date(Date.UTC(2026, 0, 1, 0, 0, idx))
    const fp = path.join(bdir, `repairdesk-${kind}-${t.toISOString().replace(/[:.]/g, '-')}.sqlite`)
    fs.writeFileSync(fp, 'x')
    fs.utimesSync(fp, t, t) // mtime == idx seconds → deterministic newest-first sort
  }
  for (let i = 0; i < 30; i++) mkBackup('auto', i)
  ;[100, 101, 102].forEach((i) => mkBackup('manual', i))
  ;[110, 111].forEach((i) => mkBackup('safety', i))
  fs.writeFileSync(path.join(bdir, 'notabackup.txt'), 'x')

  // Mirrors pruneAutoBackups exactly (which targets the configured dir); tested
  // against listBackups(dir), the same primitive it uses.
  const prune = (keep: number): void => {
    for (const b of listBackups(bdir).filter((x) => x.kind === 'auto').slice(keep)) fs.rmSync(b.filePath, { force: true })
  }

  check('listing excludes non-backup files', !listBackups(bdir).some((b) => b.fileName.endsWith('.txt')))
  const newest14 = listBackups(bdir).filter((b) => b.kind === 'auto').slice(0, RETAIN).map((b) => b.fileName)
  prune(RETAIN)
  const keptAuto = listBackups(bdir).filter((b) => b.kind === 'auto').map((b) => b.fileName)
  check('cycle 1: exactly 14 auto backups kept', keptAuto.length === RETAIN)
  check('cycle 1: the kept 14 are the NEWEST 14', new Set(keptAuto).size === new Set(newest14).size && newest14.every((f) => keptAuto.includes(f)))
  check('cycle 1: manual backups untouched (3)', listBackups(bdir).filter((b) => b.kind === 'manual').length === 3)
  check('cycle 1: safety backups untouched (2)', listBackups(bdir).filter((b) => b.kind === 'safety').length === 2)

  prune(RETAIN)
  check('cycle 2: re-pruning is idempotent (still 14)', listBackups(bdir).filter((b) => b.kind === 'auto').length === RETAIN)

  for (let i = 30; i < 40; i++) mkBackup('auto', i) // 10 new, newer than all kept
  prune(RETAIN)
  const afterGrow = listBackups(bdir).filter((b) => b.kind === 'auto')
  check('cycle 3: after 10 new backups, pruned back to 14', afterGrow.length === RETAIN)
  check('cycle 3: newest backup (idx 39) is retained', afterGrow[0]?.fileName.includes('2026-01-01T00-00-39'))
  fs.rmSync(bdir, { recursive: true, force: true })

  // ============================================================
  // Flag 2 — editing expenses & udhaar recomputes correctly
  // ============================================================
  console.log('\n[Flag2] Editing an expense and a standalone udhaar recomputes correctly:')
  const ex = expenseRepo.create({ category: 'rent', amount: 500, expenseDate: today })
  const beforeE = expenseRepo.sumByDateRange(today, today)
  expenseRepo.update(ex.id, { amount: 800 })
  check('expense amount edit reflected in sumByDateRange (+300)', near(expenseRepo.sumByDateRange(today, today), beforeE + 300))

  const u = udhaarRepo.create({ personName: 'EditMe', direction: 'receivable', totalAmount: 3000 })
  const u2 = udhaarRepo.update(u.id, { totalAmount: 5000 })!
  check('udhaar amount edit → remaining recomputed to 5000', near(u2.remainingBalance, 5000))
  check('udhaar stays pending after amount edit', u2.status === 'pending')
  check('receivables total reflects edited amount', near(udhaarRepo.sumRemainingBalanceByDirection('receivable'), 5000))
  const u3 = udhaarRepo.update(u.id, { dueDate: '2026-12-31', notes: 'edited note' })!
  check('editing only dueDate/notes preserves the amount', near(u3.totalAmount, 5000))

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
