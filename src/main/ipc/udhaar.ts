import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import { todayLocalDateString } from '../lib/date'
import { UdhaarRepository, type Udhaar, type NewUdhaarInput, type UpdateUdhaarInput, type UdhaarFilters } from '../db/repositories/udhaarRepository'
import { UdhaarSettlementRepository, type UdhaarSettlement } from '../db/repositories/udhaarSettlementRepository'
import { recordUdhaarSettlement, type RecordSettlementInput, type RecordSettlementResult } from '../db/services/udhaarService'
import { assertValidMobilePhone, assertPositiveAmount, assertNonEmpty } from '../lib/validation'
import type { UdhaarDirection } from '../db/schema'

export interface UdhaarSummary {
  totalReceivables: number
  totalPayables: number
}

/**
 * Settling a udhaar entry goes through udhaarService (one atomic transaction
 * across udhaar + udhaar_settlements), not UdhaarSettlementRepository.create()
 * directly — same reasoning as payments/repairs: keeps remainingBalance from
 * ever going stale relative to its settlement history.
 */
export function registerUdhaarIpc(): void {
  ipcMain.handle('udhaar:create', (_event, input: NewUdhaarInput): Udhaar => {
    // Backend guards: a named person, a positive amount, and (if entered) a
    // valid "Someone Else" phone. Due date may be in the past (overdue tracking).
    assertNonEmpty(input.personName, 'Person name')
    assertPositiveAmount(input.totalAmount, 'Udhaar amount')
    if (input.personPhone) assertValidMobilePhone(input.personPhone)
    return new UdhaarRepository(getDatabase()).create(input)
  })

  ipcMain.handle('udhaar:getById', (_event, id: string): Udhaar | null => new UdhaarRepository(getDatabase()).findById(id))

  ipcMain.handle('udhaar:list', (_event, filters?: UdhaarFilters): Udhaar[] => new UdhaarRepository(getDatabase()).findAll(filters))

  ipcMain.handle(
    'udhaar:findByRepairId',
    (_event, repairId: string): Udhaar[] => new UdhaarRepository(getDatabase()).findByRepairId(repairId)
  )

  ipcMain.handle('udhaar:update', (_event, id: string, patch: UpdateUdhaarInput): Udhaar | null => {
    const repo = new UdhaarRepository(getDatabase())
    if (patch.personName !== undefined) assertNonEmpty(patch.personName, 'Person name')
    if (patch.personPhone) assertValidMobilePhone(patch.personPhone)
    if (patch.totalAmount !== undefined) {
      assertPositiveAmount(patch.totalAmount, 'Udhaar amount')
      const existing = repo.findById(id)
      if (existing) {
        // A linked entry's amount is bound to its repair — never editable here,
        // even via a direct IPC call (the form also locks it).
        if (existing.repairId) throw new Error('A repair-linked Udhaar amount cannot be edited.')
        // Never drop the total below what's already been settled.
        if (patch.totalAmount < existing.amountSettled) {
          throw new Error('Udhaar amount cannot be less than what has already been settled.')
        }
      }
    }
    return repo.update(id, patch)
  })

  ipcMain.handle('udhaar:softDelete', (_event, id: string): Udhaar | null => new UdhaarRepository(getDatabase()).softDelete(id))

  ipcMain.handle(
    'udhaar:findSettlements',
    (_event, udhaarId: string): UdhaarSettlement[] => new UdhaarSettlementRepository(getDatabase()).findByUdhaarId(udhaarId)
  )

  ipcMain.handle(
    'udhaar:recordSettlement',
    (_event, input: RecordSettlementInput): RecordSettlementResult => recordUdhaarSettlement(getDatabase(), input)
  )

  ipcMain.handle('udhaar:getOverdue', (): Udhaar[] => {
    return new UdhaarRepository(getDatabase()).findOverdueUnresolved(todayLocalDateString())
  })

  ipcMain.handle('udhaar:getSummary', (): UdhaarSummary => {
    const repo = new UdhaarRepository(getDatabase())
    return {
      totalReceivables: repo.sumRemainingBalanceByDirection('receivable' satisfies UdhaarDirection),
      totalPayables: repo.sumRemainingBalanceByDirection('payable' satisfies UdhaarDirection)
    }
  })
}
