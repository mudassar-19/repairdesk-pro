import { randomUUID } from 'node:crypto'
import { and, eq, gte, lte } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { expenses, type ExpenseCategory } from '../schema'

export type Expense = typeof expenses.$inferSelect

export interface NewExpenseInput {
  /** One of expenseCategoryValues, or any custom string — both are stored the same way. */
  category: ExpenseCategory | (string & {})
  amount: number
  description?: string | null
  expenseDate: string
  isRecurring?: boolean
  /** e.g. '2026-08', used for recurring rent/electricity reminder tracking. */
  recurringMonth?: string | null
}

export type UpdateExpenseInput = Partial<NewExpenseInput>

export interface ExpenseFilters {
  category?: string
  /** Inclusive expenseDate range, ISO strings. */
  from?: string
  to?: string
  includeDeleted?: boolean
}

export class ExpenseRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: NewExpenseInput): Expense {
    const now = new Date().toISOString()
    return this.db
      .insert(expenses)
      .values({
        id: randomUUID(),
        category: input.category,
        amount: input.amount,
        description: input.description ?? null,
        expenseDate: input.expenseDate,
        isRecurring: input.isRecurring ?? false,
        recurringMonth: input.recurringMonth ?? null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        isDeleted: false
      })
      .returning()
      .get()
  }

  findById(id: string): Expense | null {
    const row = this.db.select().from(expenses).where(eq(expenses.id, id)).get()
    return row ?? null
  }

  findAll(filters: ExpenseFilters = {}): Expense[] {
    const conditions = filters.includeDeleted ? [] : [eq(expenses.isDeleted, false)]
    if (filters.category) conditions.push(eq(expenses.category, filters.category))
    if (filters.from) conditions.push(gte(expenses.expenseDate, filters.from))
    if (filters.to) conditions.push(lte(expenses.expenseDate, filters.to))

    const query = this.db.select().from(expenses)
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  update(id: string, patch: UpdateExpenseInput): Expense | null {
    const row = this.db
      .update(expenses)
      .set({ ...patch, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(expenses.id, id))
      .returning()
      .get()
    return row ?? null
  }

  softDelete(id: string): Expense | null {
    const row = this.db
      .update(expenses)
      .set({ isDeleted: true, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(expenses.id, id))
      .returning()
      .get()
    return row ?? null
  }
}
