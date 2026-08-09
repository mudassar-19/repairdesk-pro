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
