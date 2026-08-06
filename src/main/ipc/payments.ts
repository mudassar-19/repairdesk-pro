import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import {
  PaymentRepository,
  type Payment,
  type PaymentWithContext,
  type PaymentListFilters,
  type NewPaymentInput
} from '../db/repositories/paymentRepository'
import { recordPayment, type RecordPaymentResult } from '../db/services/paymentService'

/**
 * Recording a payment goes through the paymentService (a single atomic
 * transaction across payments + repairs), not PaymentRepository.create()
 * directly — that's what keeps remainingBalance from ever going stale.
 */
export function registerPaymentsIpc(): void {
  ipcMain.handle(
    'payments:findByRepairId',
    (_event, repairId: string): Payment[] => new PaymentRepository(getDatabase()).findByRepairId(repairId)
  )

  ipcMain.handle(
    'payments:listWithContext',
    (_event, filters?: PaymentListFilters): PaymentWithContext[] => new PaymentRepository(getDatabase()).findAllWithContext(filters)
  )

  ipcMain.handle(
    'payments:sumByCustomer',
    (_event, customerId: string): number => new PaymentRepository(getDatabase()).sumByCustomer(customerId)
  )

  ipcMain.handle(
    'payments:record',
    (_event, input: NewPaymentInput): RecordPaymentResult => recordPayment(getDatabase(), input)
  )
}
