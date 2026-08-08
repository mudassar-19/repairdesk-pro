import type { AppDatabase } from '../client'
import { UdhaarRepository } from '../repositories/udhaarRepository'
import { UdhaarSettlementRepository, type UdhaarSettlement } from '../repositories/udhaarSettlementRepository'
import { PaymentRepository, type Payment } from '../repositories/paymentRepository'
import { RepairRepository, type Repair } from '../repositories/repairRepository'
import type { Udhaar } from '../repositories/udhaarRepository'

export interface RecordSettlementInput {
  udhaarId: string
  amount: number
  settlementDate: string
  notes?: string | null
}

export interface RecordSettlementResult {
  settlement: UdhaarSettlement
  udhaar: Udhaar
  /**
   * The linked repair, if this was a repair-linked *receivable* settlement
   * that recorded a mirror payment (see linkedPaymentNote). null/undefined
   * otherwise — standalone udhaar and payables never touch a repair.
   */
  repair?: Repair | null
}

/**
 * How an auto-recorded repair payment is tagged in its notes so it can be
 * traced back to the udhaar settlement that created it — and so the one-off
 * backfill (scripts/backfillLinkedUdhaarPayments) stays idempotent by
 * skipping any settlement that already has its mirror payment.
 */
export function linkedPaymentNote(settlementId: string): string {
  return `Auto-recorded from repair-linked udhaar settlement [udhaar-settlement:${settlementId}]`
}

/**
 * Inserting a settlement and recomputing the parent udhaar's
 * remainingBalance/status are two tables changing together, so this is the
 * one place that happens, wrapped in db.transaction() — either both writes
 * land or neither does.
 *
 * When the entry is a *receivable* linked to a repair (udhaar.repairId set —
 * created by deliveryService.deliverOnCredit when a repair is delivered on
 * credit), settling it here is the customer paying off that repair balance, so the
 * same transaction also records a mirror Payment against the repair. That
 * keeps the two ledgers in sync (the repair no longer shows as unpaid) and
 * makes the collection show up in Revenue/Profit, which are measured off
 * Payment rows. The payment is capped at the repair's current
 * remainingBalance so an over-settlement (allowed on the udhaar side) can
 * never push the repair balance negative. Standalone udhaar and payables
 * never touch the repairs/payments tables.
 */
export function recordUdhaarSettlement(db: AppDatabase, input: RecordSettlementInput): RecordSettlementResult {
  return db.transaction((tx) => {
    const udhaarRepo = new UdhaarRepository(tx)
    const settlementRepo = new UdhaarSettlementRepository(tx)

    const entry = udhaarRepo.findById(input.udhaarId)
    if (!entry) throw new Error(`Udhaar entry ${input.udhaarId} not found`)

    const settlement = settlementRepo.create(input)
    const updatedUdhaar = udhaarRepo.update(entry.id, {})
    if (!updatedUdhaar) throw new Error(`Failed to update udhaar ${entry.id} after recording settlement`)

    let repair: Repair | null = null
    if (entry.direction === 'receivable' && entry.repairId) {
      const repairRepo = new RepairRepository(tx)
      const linkedRepair = repairRepo.findById(entry.repairId)
      if (linkedRepair && !linkedRepair.isDeleted && linkedRepair.remainingBalance > 0) {
        const paymentAmount = Math.min(input.amount, linkedRepair.remainingBalance)
        if (paymentAmount > 0) {
          const paymentRepo = new PaymentRepository(tx)
          const created: Payment = paymentRepo.create({
            repairId: linkedRepair.id,
            amount: paymentAmount,
            type: paymentAmount >= linkedRepair.remainingBalance ? 'full' : 'partial',
            paymentDate: input.settlementDate,
            notes: linkedPaymentNote(settlement.id)
          })
          // Fold the just-inserted payment into remainingBalance the same way
          // paymentService.recordPayment does — update({}) recomputes it.
          repair = repairRepo.update(created.repairId, {})
        } else {
          repair = linkedRepair
        }
      } else {
        repair = linkedRepair
      }
    }

    return { settlement, udhaar: updatedUdhaar, repair }
  })
}
