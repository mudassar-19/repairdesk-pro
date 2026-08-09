import type { AppDatabase } from '../client'
import { PaymentRepository, type NewPaymentInput, type Payment } from '../repositories/paymentRepository'
import { RepairRepository, type Repair } from '../repositories/repairRepository'
import { assertPositiveAmount, assertNotFutureDate } from '../../lib/validation'

export interface RecordPaymentResult {
  payment: Payment
  repair: Repair
}

/**
 * Recording a payment touches two tables (payments + repairs.remainingBalance),
 * so it doesn't belong to either repository alone — this is the one place
 * that operation happens, wrapped in db.transaction(). better-sqlite3 is
 * synchronous, so the callback either runs to completion and commits, or
 * throws and SQLite rolls back everything inside it: if the repair update
 * fails after the payment insert, or the app crashes mid-write, there is
 * no window where a payment row exists without the balance reflecting it —
 * the two writes are one SQLite transaction, not two independently
 * coordinated ones.
 *
 * RepairRepository.update() already recomputes remainingBalance from
 * repairPrice/advanceAmount/sum-of-payments on every call (see its own
 * comment), so calling it with an empty patch here is enough to fold the
 * just-inserted payment into the balance — no duplicated math.
 */
export function recordPayment(db: AppDatabase, input: NewPaymentInput): RecordPaymentResult {
  // Backend guards: a payment must move a positive amount and can't be dated in
  // the future (which would misattribute revenue to a day that hasn't happened).
  assertPositiveAmount(input.amount, 'Payment amount')
  assertNotFutureDate(input.paymentDate, 'Payment date')

  return db.transaction((tx) => {
    const paymentRepo = new PaymentRepository(tx)
    const repairRepo = new RepairRepository(tx)

    const repair = repairRepo.findById(input.repairId)
    if (!repair) throw new Error(`Repair ${input.repairId} not found`)

    const payment = paymentRepo.create(input)
    const updatedRepair = repairRepo.update(repair.id, {})
    if (!updatedRepair) throw new Error(`Failed to update repair ${repair.id} after recording payment`)

    return { payment, repair: updatedRepair }
  })
}
