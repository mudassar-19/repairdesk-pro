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

  ipcMain.handle('repairs:create', (_event, input: NewRepairInput): Repair => repo().create(input))

  ipcMain.handle(
    'repairs:update',
    (_event, id: string, patch: UpdateRepairInput): Repair | null => repo().update(id, patch)
  )

  ipcMain.handle('repairs:softDelete', (_event, id: string): Repair | null => repo().softDelete(id))
}
