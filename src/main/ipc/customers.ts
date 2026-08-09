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
import { RepairRepository } from '../db/repositories/repairRepository'
import { assertValidMobilePhone, assertNonEmpty, hasLetter } from '../lib/validation'

function assertValidCustomerName(name: string): void {
  assertNonEmpty(name, 'Name')
  if (!hasLetter(name)) throw new Error('Name must contain letters, not just numbers or symbols.')
}

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

  // Backend guard (second layer behind the form): user-entered phones must be a
  // well-formed mobile number. Internal callers (seed, dev self-tests) write
  // synthetic phones through the repository directly and bypass this on purpose.
  ipcMain.handle('customers:create', (_event, input: NewCustomerInput): Customer => {
    assertValidCustomerName(input.name)
    assertValidMobilePhone(input.phone)
    return repo().create(input)
  })

  ipcMain.handle('customers:update', (_event, id: string, patch: UpdateCustomerInput): Customer | null => {
    if (patch.name !== undefined) assertValidCustomerName(patch.name)
    if (patch.phone !== undefined) assertValidMobilePhone(patch.phone)
    return repo().update(id, patch)
  })

  // Guard: don't archive a customer who still has work in progress — otherwise
  // those pending/completed repairs would point at a customer hidden from the
  // list. Delivered/cancelled repairs are historical and don't block deletion.
  ipcMain.handle('customers:softDelete', (_event, id: string): Customer | null => {
    const active = new RepairRepository(getDatabase()).countActiveByCustomer(id)
    if (active > 0) {
      throw new Error(
        `This customer has ${active} active repair${active === 1 ? '' : 's'}. Deliver or cancel them before deleting the customer.`
      )
    }
    return repo().softDelete(id)
  })
}
