/**
 * One-off, idempotent backfill for repair-linked receivable udhaar that were
 * settled BEFORE udhaarService.recordUdhaarSettlement started mirroring those
 * settlements into repair Payments. For every settlement on a receivable
 * udhaar with a repairId, it ensures a matching Payment exists on the linked
 * repair, so the repair's remainingBalance clears and the collected money
 * shows up in Revenue/Profit (which are measured off Payment rows) — exactly
 * what the live code now does going forward.
 *
 * Idempotent: each mirror payment is tagged via linkedPaymentNote(settlementId)
 * and a settlement that already has its tagged payment is skipped, so running
 * this twice (or after the forward fix already handled some) never
 * double-records. Uses the real RepairRepository/PaymentRepository so
 * remainingBalance recomputation matches the app precisely, and caps each
 * payment at the repair's live remaining balance so it can never go negative.
 *
 * Scope: pass a settlement date to limit to that day (e.g. --date=2026-08-08),
 * or omit it to cover every repair-linked receivable settlement. Read-only
 * dry run unless --confirm is given.
 *
 * Run with: electron scripts/runBackfillLinkedUdhaarPayments.js --confirm [--date=YYYY-MM-DD]
 */
import { app } from 'electron'
import fs from 'node:fs'
import { and, eq, like } from 'drizzle-orm'

import { initDatabase, getDatabasePath, type AppDatabase } from '../src/main/db/client'
import { udhaar, udhaarSettlements, payments } from '../src/main/db/schema'
import { RepairRepository } from '../src/main/db/repositories/repairRepository'
import { PaymentRepository } from '../src/main/db/repositories/paymentRepository'
import { ActivityLogRepository } from '../src/main/db/repositories/activityLogRepository'
import { linkedPaymentNote } from '../src/main/db/services/udhaarService'

const args = process.argv.slice(2)
const confirmed = args.includes('--confirm')
const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1] ?? null

interface PlannedRow {
  settlementId: string
  settlementDate: string
  personName: string
  repairId: string
  settlementAmount: number
  repairRemainingBefore: number
  paymentAmount: number
  action: 'create' | 'skip-existing' | 'skip-no-balance'
}

function safetyBackupCopy(dbPath: string): string | null {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = dbPath.replace(/\.sqlite$/, `-pre-backfill-${stamp}.sqlite`)
    fs.copyFileSync(dbPath, dest)
    return dest
  } catch {
    return null
  }
}

/**
 * Every receivable udhaar settlement that is linked to a repair, oldest
 * first — processing in settlement order means when one repair has several
 * settlements the running remainingBalance cap is applied in the same order
 * the money actually came in.
 */
function loadLinkedSettlements(db: AppDatabase) {
  const conditions = [
    eq(udhaarSettlements.isDeleted, false),
    eq(udhaar.direction, 'receivable')
  ]
  if (dateArg) conditions.push(eq(udhaarSettlements.settlementDate, dateArg))

  return db
    .select({
      settlementId: udhaarSettlements.id,
      settlementDate: udhaarSettlements.settlementDate,
      settlementAmount: udhaarSettlements.amount,
      personName: udhaar.personName,
      repairId: udhaar.repairId
    })
    .from(udhaarSettlements)
    .innerJoin(udhaar, eq(udhaar.id, udhaarSettlements.udhaarId))
    .where(and(...conditions))
    .orderBy(udhaarSettlements.settlementDate, udhaarSettlements.createdAt)
    .all()
    .filter((r): r is typeof r & { repairId: string } => r.repairId !== null)
}

function alreadyMirrored(db: AppDatabase, settlementId: string): boolean {
  const row = db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.isDeleted, false), like(payments.notes, `%[udhaar-settlement:${settlementId}]%`)))
    .get()
  return row !== undefined
}

app.setName('repairdex-pro')

app.whenReady()
  .then(() => {
    app.dock?.hide()
    const db = initDatabase()

    const rows = loadLinkedSettlements(db)
    const repairRepo = new RepairRepository(db)
    const planned: PlannedRow[] = []

    // The plan pass mutates nothing but reads the live remaining balance,
    // which the create pass will lower — so track a per-repair running
    // remaining here to plan multiple settlements on one repair correctly.
    const runningRemaining = new Map<string, number>()

    for (const row of rows) {
      const repair = repairRepo.findById(row.repairId)
      if (!repair || repair.isDeleted) continue

      if (alreadyMirrored(db, row.settlementId)) {
        planned.push({
          ...row,
          repairRemainingBefore: runningRemaining.get(row.repairId) ?? repair.remainingBalance,
          paymentAmount: 0,
          action: 'skip-existing'
        })
        continue
      }

      const remaining = runningRemaining.get(row.repairId) ?? repair.remainingBalance
      const paymentAmount = Math.min(row.settlementAmount, remaining)
      if (paymentAmount <= 0) {
        planned.push({ ...row, repairRemainingBefore: remaining, paymentAmount: 0, action: 'skip-no-balance' })
        continue
      }
      runningRemaining.set(row.repairId, remaining - paymentAmount)
      planned.push({ ...row, repairRemainingBefore: remaining, paymentAmount, action: 'create' })
    }

    const toCreate = planned.filter((p) => p.action === 'create')
    console.log(`\nRepair-linked receivable settlements considered: ${planned.length}`)
    console.log(`  already mirrored (skipped): ${planned.filter((p) => p.action === 'skip-existing').length}`)
    console.log(`  no repair balance left (skipped): ${planned.filter((p) => p.action === 'skip-no-balance').length}`)
    console.log(`  mirror payments to create: ${toCreate.length}`)
    for (const p of toCreate) {
      console.log(
        `    - ${p.settlementDate}  ${p.personName}  settle=${p.settlementAmount}  ` +
          `repairRemaining=${p.repairRemainingBefore} -> payment=${p.paymentAmount}`
      )
    }

    if (!confirmed) {
      console.log('\nDry run (no --confirm) — nothing written. Re-run with --confirm to apply.')
      app.exit(0)
      return
    }
    if (toCreate.length === 0) {
      console.log('\nNothing to backfill.')
      app.exit(0)
      return
    }

    const backup = safetyBackupCopy(getDatabasePath())
    if (backup) console.log(`\nSafety copy saved to: ${backup}`)

    let created = 0
    let totalCollected = 0
    for (const p of toCreate) {
      db.transaction((tx) => {
        const paymentRepo = new PaymentRepository(tx)
        const rRepo = new RepairRepository(tx)
        const live = rRepo.findById(p.repairId)
        if (!live || live.isDeleted) return
        const amount = Math.min(p.settlementAmount, live.remainingBalance)
        if (amount <= 0) return
        const payment = paymentRepo.create({
          repairId: p.repairId,
          amount,
          type: amount >= live.remainingBalance ? 'full' : 'partial',
          paymentDate: p.settlementDate,
          notes: linkedPaymentNote(p.settlementId)
        })
        rRepo.update(p.repairId, {})
        created += 1
        totalCollected += amount
        new ActivityLogRepository(tx).create({
          actionType: 'payment_recorded',
          entityType: 'repair',
          entityId: p.repairId,
          description: `Payment of ${amount.toFixed(2)} backfilled from repair-linked udhaar settlement for ${p.personName}`,
          metadata: { paymentId: payment.id, amount, settlementId: p.settlementId, backfill: true }
        })
      })
    }

    console.log(`\nDone. Created ${created} mirror payment(s), total collected reflected: ${totalCollected.toFixed(2)}`)
    app.exit(0)
  })
  .catch((err) => {
    console.error('\n[backfill] FAILED:', err)
    app.exit(1)
  })
