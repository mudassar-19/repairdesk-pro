import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import {
  CustomerRepository,
  type Customer,
  type CustomerWithStats,
  type CustomerFilters,
  type NewCustomerInput,
  type UpdateCustomerInput
} from '../db/repositories/customerRepository'

/**
 * All customer reads/writes for the renderer go through here — no direct
 * database access from the renderer process. Activity logging (customer
 * created/updated) is fired from the renderer call sites via the existing
 * activity:log channel, matching the Phase 2 login/logout pattern, not
 * baked into these handlers.
 */
export function registerCustomersIpc(): void {
  const repo = () => new CustomerRepository(getDatabase())

  ipcMain.handle('customers:list', (_event, filters?: CustomerFilters): Customer[] => repo().findAll(filters))

  ipcMain.handle(
    'customers:listWithStats',
    (_event, filters?: CustomerFilters): CustomerWithStats[] => repo().findAllWithStats(filters)
  )

  ipcMain.handle('customers:getById', (_event, id: string): Customer | null => repo().findById(id))

  ipcMain.handle('customers:findByPhone', (_event, phone: string): Customer | null => repo().findByPhone(phone))

  ipcMain.handle('customers:create', (_event, input: NewCustomerInput): Customer => repo().create(input))

  ipcMain.handle(
    'customers:update',
    (_event, id: string, patch: UpdateCustomerInput): Customer | null => repo().update(id, patch)
  )

  ipcMain.handle('customers:softDelete', (_event, id: string): Customer | null => repo().softDelete(id))
}
