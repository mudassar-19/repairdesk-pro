import type { AppDatabase } from '../client'
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
 * Creating a repair and recording its booking Advance are two tables changing
 * together (repairs + payments), so — exactly like paymentService.recordPayment
 * and udhaarService.recordUdhaarSettlement — this is the one place it happens,
 * wrapped in db.transaction(). Under the "every rupee is a Payment" model the
 * Advance typed at booking is not a special subtracted field; it is a real
 * `advance` Payment, so it counts toward Revenue/Profit immediately and shows
 * in the Payments ledger. remainingBalance is then recomputed from the sum of
 * payments (see RepairRepository.update), never double-subtracting the advance.
 */
export function createRepair(db: AppDatabase, input: NewRepairInput): Repair {
  // Backend guards (second layer behind the New Order form): IMEI digits-only,
  // and the booking advance can't exceed the price (which would produce a
  // negative remaining balance and break the money model). This is the
  // user-facing create path (repairs:create IPC); seed/self-tests use the
  // repository directly and are unaffected.
  assertNonEmpty(input.deviceBrand, 'Device brand')
  assertNonEmpty(input.deviceModel, 'Device model')
  assertNonEmpty(input.issue, 'Issue description')
  assertValidImei(input.imei)
  assertNonNegativeMoney(input.repairPrice ?? 0, 'Total price')
  assertNonNegativeMoney(input.costPrice ?? 0, 'Cost price')
  assertNonNegativeMoney(input.advanceAmount ?? 0, 'Advance amount')
  assertAdvanceWithinPrice(input.advanceAmount ?? 0, input.repairPrice ?? 0)

  return db.transaction((tx) => {
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
  })
}
