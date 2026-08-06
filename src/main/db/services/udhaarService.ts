import type { AppDatabase } from '../client'
import { UdhaarRepository } from '../repositories/udhaarRepository'
import { UdhaarSettlementRepository, type UdhaarSettlement } from '../repositories/udhaarSettlementRepository'
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
}

/**
 * Mirrors paymentService.recordPayment exactly: inserting a settlement and
 * recomputing the parent udhaar's remainingBalance/status are two tables
 * changing together, so this is the one place that happens, wrapped in
 * db.transaction() — either both writes land or neither does. This is a
 * completely separate ledger from a linked repair's own Payments (Phase 7):
 * settling a udhaar entry never touches the repairs or payments tables, even
 * when udhaar.repairId points at one.
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

    return { settlement, udhaar: updatedUdhaar }
  })
}
