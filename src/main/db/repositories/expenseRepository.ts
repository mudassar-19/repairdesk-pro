import { randomUUID } from 'node:crypto'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { expenses, type ExpenseCategory } from '../schema'
import { formatLocalDate } from '../../lib/date'
import { BaseRepository } from './baseRepository'

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
  /** Inclusive expenseDate range — plain "YYYY-MM-DD" strings, matching how expenseDate is stored. */
  from?: string
  to?: string
  includeDeleted?: boolean
}

export class ExpenseRepository extends BaseRepository {
  constructor(db: Db) {
    super(db)
  }

  create(input: NewExpenseInput): Expense {
    const now = new Date().toISOString()
    return this.write<Expense>((tx) =>
      tx
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
          isDeleted: false
        })
        .returning()
        .get()
    )!
  }

  findById(id: string): Expense | null {
    const row = this.db.select().from(expenses).where(eq(expenses.id, id)).get()
    return row ?? null
  }

  findAll(filters: ExpenseFilters = {}): Expense[] {
    const conditions = this.buildConditions(filters)
    const query = this.db.select().from(expenses)
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  findByCategory(category: string): Expense[] {
    return this.findAll({ category })
  }

  findByDateRange(dateFrom: string, dateTo: string): Expense[] {
    return this.findAll({ from: dateFrom, to: dateTo })
  }

  /** Running total for the Expense List's currently active filters, and the Dashboard's Monthly Expenses card. */
  sumByDateRange(dateFrom: string, dateTo: string, category?: string): number {
    const row = this.db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(...this.buildConditions({ from: dateFrom, to: dateTo, category })))
      .get()
    return row?.total ?? 0
  }

  /**
   * A lightweight EXISTS-style check (LIMIT 1, not a row fetch) for the
   * recurring rent/electricity reminder — true if `category` already has a
   * non-deleted entry whose expenseDate falls anywhere in the current
   * calendar month.
   */
  hasEntryForCurrentMonth(category: string): boolean {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    const row = this.db
      .select({ id: expenses.id })
      .from(expenses)
      .where(
        and(
          eq(expenses.isDeleted, false),
          eq(expenses.category, category),
          gte(expenses.expenseDate, monthStart),
          lte(expenses.expenseDate, monthEnd)
        )
      )
      .limit(1)
      .get()
    return Boolean(row)
  }

  /**
   * Recurring auto-draft (Part J#16): every category the shop has ever marked
   * "recurring" that has NOT been logged yet this calendar month, paired with
   * the amount from its most recent recurring entry — so the Dashboard can
   * offer a one-click pre-filled draft instead of a bare reminder. Returns []
   * for a brand-new shop that hasn't marked anything recurring yet.
   */
  findRecurringDrafts(): { category: string; amount: number }[] {
    const recurring = this.db
      .select({ category: expenses.category, amount: expenses.amount })
      .from(expenses)
      .where(and(eq(expenses.isDeleted, false), eq(expenses.isRecurring, true)))
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
      .all()

    const latestByCategory = new Map<string, number>()
    for (const row of recurring) {
      if (!latestByCategory.has(row.category)) latestByCategory.set(row.category, row.amount)
    }

    const drafts: { category: string; amount: number }[] = []
    for (const [category, amount] of latestByCategory) {
      if (!this.hasEntryForCurrentMonth(category)) drafts.push({ category, amount })
    }
    return drafts
  }

  /** Expense breakdown by category for the Reports module — GROUP BY in SQL, not a lump sum plus manual bucketing in JS. */
  sumByCategoryInRange(dateFrom: string, dateTo: string): { category: string; total: number }[] {
    return this.db
      .select({ category: expenses.category, total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(eq(expenses.isDeleted, false), gte(expenses.expenseDate, dateFrom), lte(expenses.expenseDate, dateTo)))
      .groupBy(expenses.category)
      .orderBy(desc(sql`sum(${expenses.amount})`))
      .all()
  }

  update(id: string, patch: UpdateExpenseInput): Expense | null {
    return this.write<Expense>((tx) =>
      tx
        .update(expenses)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(expenses.id, id))
        .returning()
        .get() ?? null
    )
  }

  softDelete(id: string): Expense | null {
    return this.write<Expense>((tx) =>
      tx
        .update(expenses)
        .set({ isDeleted: true, updatedAt: new Date().toISOString() })
        .where(eq(expenses.id, id))
        .returning()
        .get() ?? null
    )
  }

  private buildConditions(filters: ExpenseFilters) {
    const conditions = filters.includeDeleted ? [] : [eq(expenses.isDeleted, false)]
    if (filters.category) conditions.push(eq(expenses.category, filters.category))
    if (filters.from) conditions.push(gte(expenses.expenseDate, filters.from))
    if (filters.to) conditions.push(lte(expenses.expenseDate, filters.to))
    return conditions
  }
}
