import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import {
  ExpenseRepository,
  type Expense,
  type ExpenseFilters,
  type NewExpenseInput,
  type UpdateExpenseInput
} from '../db/repositories/expenseRepository'
import { assertPositiveAmount, assertNonEmpty, assertNotFutureDate } from '../lib/validation'

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

  ipcMain.handle(
    'expenses:getRecurringDrafts',
    (): { category: string; amount: number }[] => repo().findRecurringDrafts()
  )

  ipcMain.handle('expenses:create', (_event, input: NewExpenseInput): Expense => {
    // Backend guards: a non-empty category, a positive amount, and a date that
    // isn't in the future (an expense is money already spent).
    assertNonEmpty(input.category, 'Category')
    assertPositiveAmount(input.amount, 'Expense amount')
    assertNotFutureDate(input.expenseDate, 'Expense date')
    return repo().create(input)
  })

  ipcMain.handle('expenses:update', (_event, id: string, patch: UpdateExpenseInput): Expense | null => {
    // Same non-bypassable guards as create, applied only to the fields present in
    // the patch, so an edit can never persist an invalid category/amount/date.
    if (patch.category !== undefined) assertNonEmpty(patch.category, 'Category')
    if (patch.amount !== undefined) assertPositiveAmount(patch.amount, 'Expense amount')
    if (patch.expenseDate !== undefined) assertNotFutureDate(patch.expenseDate, 'Expense date')
    return repo().update(id, patch)
  })

  ipcMain.handle('expenses:softDelete', (_event, id: string): Expense | null => repo().softDelete(id))
}
