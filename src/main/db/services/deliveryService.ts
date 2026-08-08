import type { AppDatabase } from '../client'
import { RepairRepository, type Repair } from '../repositories/repairRepository'
import { PaymentRepository, type Payment } from '../repositories/paymentRepository'
import { UdhaarRepository, type Udhaar } from '../repositories/udhaarRepository'
import { CustomerRepository } from '../repositories/customerRepository'
import { todayLocalDateString } from '../../lib/date'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface DeliverResult {
  repair: Repair
  /** The full payment recorded at delivery, or null when nothing was owed. */
  payment: Payment | null
}

/**
 * "Mark as Delivered" — the walk-in case where the customer pays the whole
 * remaining balance and takes the device. In ONE transaction it records a
 * `full` Payment for the current remaining balance (skipped entirely when the
 * repair is already fully paid, so no zero-amount row is ever created) and
 * flips the status to delivered. remainingBalance is recomputed from payments
 * by RepairRepository.update, landing at 0.
 */
export function deliverWithFullPayment(db: AppDatabase, repairId: string): DeliverResult {
  return db.transaction((tx) => {
    const repairRepo = new RepairRepository(tx)
    const repair = repairRepo.findById(repairId)
    if (!repair || repair.isDeleted) throw new Error(`Repair ${repairId} not found`)

    let payment: Payment | null = null
    if (repair.remainingBalance > 0) {
      payment = new PaymentRepository(tx).create({
        repairId,
        amount: repair.remainingBalance,
        type: 'full',
        paymentDate: todayLocalDateString(),
        notes: 'Paid in full at delivery'
      })
    }
    const updated = repairRepo.update(repairId, { status: 'delivered' })
    return { repair: updated ?? repair, payment }
  })
}

export interface DeliverOnCreditInput {
  repairId: string
  /** How much of the remaining balance the customer is leaving unpaid (tracked as receivable udhaar). */
  udhaarAmount: number
  /** Optional due date for the created udhaar, so it can surface in overdue reminders. */
  dueDate?: string | null
}

export interface DeliverOnCreditResult {
  repair: Repair
  /** The partial payment for the paid portion, or null when the whole balance was left on credit. */
  payment: Payment | null
  /** The linked receivable udhaar for the unpaid portion, or null when nothing was left on credit. */
  udhaar: Udhaar | null
}

/**
 * "Deliver on Credit" — the customer pays part (or none) of the balance and
 * takes the rest on udhaar. In ONE transaction it:
 *   1. records the paid portion (remaining − udhaarAmount) as a `partial` Payment,
 *   2. creates a receivable Udhaar linked to this repair for udhaarAmount,
 *   3. marks the repair delivered.
 * udhaarAmount is clamped to [0, remaining] so an out-of-range value can never
 * make the payment negative. When that later udhaar is settled,
 * udhaarService.recordUdhaarSettlement records a matching repair payment, so
 * the credit money becomes Revenue only once it is actually collected.
 */
export function deliverOnCredit(db: AppDatabase, input: DeliverOnCreditInput): DeliverOnCreditResult {
  return db.transaction((tx) => {
    const repairRepo = new RepairRepository(tx)
    const repair = repairRepo.findById(input.repairId)
    if (!repair || repair.isDeleted) throw new Error(`Repair ${input.repairId} not found`)

    const remaining = repair.remainingBalance
    const udhaarAmount = round2(Math.min(Math.max(input.udhaarAmount, 0), remaining))
    const paymentAmount = round2(remaining - udhaarAmount)

    let payment: Payment | null = null
    if (paymentAmount > 0) {
      payment = new PaymentRepository(tx).create({
        repairId: input.repairId,
        amount: paymentAmount,
        type: 'partial',
        paymentDate: todayLocalDateString(),
        notes: 'Partial payment at delivery (balance on credit)'
      })
    }

    let udhaar: Udhaar | null = null
    if (udhaarAmount > 0) {
      const customer = new CustomerRepository(tx).findById(repair.customerId)
      udhaar = new UdhaarRepository(tx).create({
        personName: customer?.name ?? 'Unknown Customer',
        personPhone: customer?.phone ?? null,
        customerId: repair.customerId,
        direction: 'receivable',
        totalAmount: udhaarAmount,
        dueDate: input.dueDate ?? null,
        repairId: input.repairId,
        notes: null
      })
    }

    const updated = repairRepo.update(input.repairId, { status: 'delivered' })
    return { repair: updated ?? repair, payment, udhaar }
  })
}
