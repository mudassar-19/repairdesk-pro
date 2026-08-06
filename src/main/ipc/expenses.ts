import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import {
  ExpenseRepository,
  type Expense,
  type ExpenseFilters,
  type NewExpenseInput,
  type UpdateExpenseInput
} from '../db/repositories/expenseRepository'

export function registerExpensesIpc(): void {
  const repo = () => new ExpenseRepository(getDatabase())

  ipcMain.handle('expenses:list', (_event, filters?: ExpenseFilters): Expense[] => repo().findAll(filters))

  ipcMain.handle('expenses:getById', (_event, id: string): Expense | null => repo().findById(id))

  ipcMain.handle(
    'expenses:sumByDateRange',
    (_event, dateFrom: string, dateTo: string, category?: string): number =>
      repo().sumByDateRange(dateFrom, dateTo, category)
  )

  ipcMain.handle(
    'expenses:hasEntryForCurrentMonth',
    (_event, category: string): boolean => repo().hasEntryForCurrentMonth(category)
  )

  ipcMain.handle('expenses:create', (_event, input: NewExpenseInput): Expense => repo().create(input))

  ipcMain.handle(
    'expenses:update',
    (_event, id: string, patch: UpdateExpenseInput): Expense | null => repo().update(id, patch)
  )

  ipcMain.handle('expenses:softDelete', (_event, id: string): Expense | null => repo().softDelete(id))
}
