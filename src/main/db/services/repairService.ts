import type { AppDatabase, Db } from '../client'
import { RepairRepository, type NewRepairInput, type Repair } from '../repositories/repairRepository'
import { PaymentRepository } from '../repositories/paymentRepository'
import { todayLocalDateString } from '../../lib/date'
import {
  assertValidImei,
  assertAdvanceWithinPrice,
  assertNonNegativeMoney,
  assertNonEmpty
} from '../../lib/validation'

/**
 * Marker note put on the auto-recorded booking-advance payment so it can be
 * recognised (e.g. to keep it in step with the repair's advanceAmount field
 * on edit). Mirrors the linkedPaymentNote convention in udhaarService.
 */
export function advancePaymentNote(): string {
  return 'Advance recorded at booking [booking-advance]'
}

/**
 * Backend guards (second layer behind the New Order form): non-empty device
 * fields, IMEI digits-only, non-negative money, and the booking advance can't
 * exceed the price (which would produce a negative remaining balance and break
 * the money model). Exported so the combined atomic flows
 * (deliveryService.createRepairDeliveredPaid / createRepairOnCredit) validate
 * the same way before they create the repair.
 */
export function assertValidRepairInput(input: NewRepairInput): void {
  assertNonEmpty(input.deviceBrand, 'Device brand')
  assertNonEmpty(input.deviceModel, 'Device model')
  assertNonEmpty(input.issue, 'Issue description')
  assertValidImei(input.imei)
  assertNonNegativeMoney(input.repairPrice ?? 0, 'Total price')
  assertNonNegativeMoney(input.costPrice ?? 0, 'Cost price')
  assertNonNegativeMoney(input.advanceAmount ?? 0, 'Advance amount')
  assertAdvanceWithinPrice(input.advanceAmount ?? 0, input.repairPrice ?? 0)
}

/**
 * The repair-creation body, runnable inside an existing transaction (tx) so the
 * "create the order at the moment of a take-now delivery" POS flows can wrap
 * this + the delivery in ONE atomic transaction (see deliveryService). Inserts
 * the repair and, under the "every rupee is a Payment" model, records the
 * booking Advance as a real `advance` Payment, then recomputes remainingBalance
 * from the sum of payments (never double-subtracting the advance). Assumes the
 * input was already validated via assertValidRepairInput.
 */
export function createRepairTx(tx: Db, input: NewRepairInput): Repair {
  const repairRepo = new RepairRepository(tx)
  const repair = repairRepo.create(input)

  const advance = input.advanceAmount ?? 0
  if (advance <= 0) return repair

  const paymentRepo = new PaymentRepository(tx)
  paymentRepo.create({
    repairId: repair.id,
    amount: advance,
    type: 'advance',
    paymentDate: todayLocalDateString(),
    notes: advancePaymentNote()
  })
  // Fold the advance payment into remainingBalance (repairPrice - sumPayments).
  return repairRepo.update(repair.id, {}) ?? repair
}

/**
 * Creating a repair and recording its booking Advance are two tables changing
 * together (repairs + payments), so — exactly like paymentService.recordPayment
 * and udhaarService.recordUdhaarSettlement — this is the one place it happens,
 * wrapped in db.transaction(). This is the user-facing create path
 * (repairs:create IPC); seed/self-tests use the repository directly.
 */
export function createRepair(db: AppDatabase, input: NewRepairInput): Repair {
  assertValidRepairInput(input)
  return db.transaction((tx) => createRepairTx(tx, input))
}

export interface CancelRepairResult {
  repair: Repair
  /**
   * Sum of the repair's active payments at cancel time — the money that stops
   * counting as revenue/profit the moment status becomes 'cancelled'. Returned
   * so the caller can write a precise audit-trail entry ("Rs. X reversed from
   * revenue"). Payment rows are deliberately NOT deleted: they remain for the
   * audit trail and the Payments-page "Cancelled" badge; the reversal is purely
   * a reporting effect enforced by activeRepairPaymentCondition.
   */
  reversedAmount: number
}

/**
 * The single, canonical way to cancel a repair — used by every surface
 * (Repair Detail, Dashboard rows, Repairs list, POS) via ipc/repairs.ts. This
 * is the counterpart to the removed hard/soft-delete: a financial record is
 * never destroyed, it's moved to the terminal 'cancelled' state, which reverses
 * its revenue/profit impact everywhere at once (see paymentAggregation).
 *
 * Wrapped in a transaction so reading the reversed amount and flipping the
 * status can't interleave with a concurrent payment write. RepairRepository.update
 * enforces the delivered/cancelled status lock inside the same transaction, so a
 * delivered (or already-cancelled) repair can never be cancelled here — which is
 * also why a repair delivered on credit (and thus locked with a linked Udhaar)
 * can never reach this path.
 */
export function cancelRepair(db: AppDatabase, id: string): CancelRepairResult {
  return db.transaction((tx) => {
    const repairRepo = new RepairRepository(tx)
    const existing = repairRepo.findById(id)
    if (!existing) throw new Error(`Repair ${id} not found`)
    if (existing.status === 'cancelled') throw new Error(`Repair ${id} is already cancelled`)
    if (existing.status === 'delivered') throw new Error(`Repair ${id} is delivered and cannot be cancelled`)

    const paymentRepo = new PaymentRepository(tx)
    const reversedAmount = paymentRepo.findByRepairId(id).reduce((sum, payment) => sum + payment.amount, 0)

    const repair = repairRepo.update(id, { status: 'cancelled' })
    if (!repair) throw new Error(`Repair ${id} not found`)
    return { repair, reversedAmount }
  })
}
