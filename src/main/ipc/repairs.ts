import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import {
  RepairRepository,
  type Repair,
  type RepairWithCustomer,
  type RepairFilters,
  type NewRepairInput,
  type UpdateRepairInput
} from '../db/repositories/repairRepository'
import { createRepair } from '../db/services/repairService'
import {
  deliverWithFullPayment,
  deliverOnCredit,
  createRepairOnCredit,
  createRepairDeliveredPaid,
  type DeliverResult,
  type DeliverOnCreditInput,
  type DeliverOnCreditResult,
  type CreateRepairOnCreditInput
} from '../db/services/deliveryService'

/**
 * All repair reads/writes for the renderer go through here — no direct
 * database access from the renderer process. Activity logging (creation,
 * edits, status changes) is fired from the renderer call sites via the
 * existing activity:log channel, matching the Customers module pattern.
 */
export function registerRepairsIpc(): void {
  const repo = () => new RepairRepository(getDatabase())

  ipcMain.handle('repairs:list', (_event, filters?: RepairFilters): Repair[] => repo().findAll(filters))

  ipcMain.handle(
    'repairs:listWithCustomer',
    (_event, filters?: RepairFilters & { search?: string }): RepairWithCustomer[] =>
      repo().findAllWithCustomer(filters)
  )

  ipcMain.handle('repairs:getById', (_event, id: string): Repair | null => repo().findById(id))

  ipcMain.handle('repairs:listBrands', (): string[] => repo().listDistinctBrands())

  // Routed through the service (not repo().create) so the booking Advance is
  // atomically recorded as an `advance` Payment — see repairService.createRepair.
  ipcMain.handle('repairs:create', (_event, input: NewRepairInput): Repair => createRepair(getDatabase(), input))

  ipcMain.handle(
    'repairs:update',
    (_event, id: string, patch: UpdateRepairInput): Repair | null => repo().update(id, patch)
  )

  ipcMain.handle('repairs:softDelete', (_event, id: string): Repair | null => repo().softDelete(id))

  // Atomic delivery flows (Part A): full-payment-at-pickup, or split part
  // payment + linked receivable udhaar for the credit case.
  ipcMain.handle(
    'repairs:deliverWithFullPayment',
    (_event, repairId: string): DeliverResult => deliverWithFullPayment(getDatabase(), repairId)
  )
  ipcMain.handle(
    'repairs:deliverOnCredit',
    (_event, input: DeliverOnCreditInput): DeliverOnCreditResult => deliverOnCredit(getDatabase(), input)
  )

  // Atomic POS take-now flows: create the repair AND deliver (paid-in-full or
  // on-credit) in one transaction, so cancelling the credit-split modal leaves
  // nothing behind and a failed delivery never orphans a bare pending repair.
  ipcMain.handle(
    'repairs:createOnCredit',
    (_event, input: CreateRepairOnCreditInput): DeliverOnCreditResult => createRepairOnCredit(getDatabase(), input)
  )
  ipcMain.handle(
    'repairs:createDeliveredPaid',
    (_event, input: NewRepairInput): DeliverResult => createRepairDeliveredPaid(getDatabase(), input)
  )
}
