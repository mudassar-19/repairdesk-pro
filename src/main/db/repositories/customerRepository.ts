import { randomUUID } from 'node:crypto'
import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm/utils'
import type { Db } from '../client'
import { customers, repairs } from '../schema'
import { BaseRepository } from './baseRepository'

export type Customer = typeof customers.$inferSelect
export type CustomerWithStats = Customer & { repairCount: number; lastVisit: string | null }

export interface NewCustomerInput {
  name: string
  phone: string
  address?: string | null
  notes?: string | null
}

export type UpdateCustomerInput = Partial<NewCustomerInput>

export interface CustomerFilters {
  /** Matches against name or phone. */
  search?: string
  includeDeleted?: boolean
}

export class CustomerRepository extends BaseRepository {
  constructor(db: Db) {
    super(db)
  }

  create(input: NewCustomerInput): Customer {
    const now = new Date().toISOString()
    return this.write<Customer>((tx) =>
      tx
        .insert(customers)
        .values({
          id: randomUUID(),
          name: input.name,
          phone: input.phone,
          address: input.address ?? null,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
          isDeleted: false
        })
        .returning()
        .get()
    )!
  }

  findById(id: string): Customer | null {
    const row = this.db.select().from(customers).where(eq(customers.id, id)).get()
    return row ?? null
  }

  /**
   * Exact match, deliberately including soft-deleted rows — the phone unique
   * index has no isDeleted filter, so this is the only lookup that reflects
   * what the database will actually reject on create().
   */
  findByPhone(phone: string): Customer | null {
    const row = this.db.select().from(customers).where(eq(customers.phone, phone)).get()
    return row ?? null
  }

  findAll(filters: CustomerFilters = {}): Customer[] {
    const conditions = filters.includeDeleted ? [] : [eq(customers.isDeleted, false)]
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(or(like(customers.name, term), like(customers.phone, term))!)
    }
    const query = this.db.select().from(customers)
    const filtered = conditions.length ? query.where(and(...conditions)) : query
    // Default newest-first for the Customers list.
    return filtered.orderBy(desc(customers.createdAt)).all()
  }

  /**
   * Same filters as findAll, plus each customer's repair count and most
   * recent repair date — for the Customers list's Total Repairs/Last Visit
   * columns. A LEFT JOIN (not inner), so a customer with zero repairs still
   * appears with repairCount 0 and lastVisit null instead of being dropped
   * entirely — COUNT/MAX both correctly ignore the NULL repairs columns a
   * LEFT JOIN produces for those rows. Soft-deleted repairs are excluded
   * from both the count and the max so a deleted repair can't inflate a
   * customer's count or resurrect as their "last visit."
   */
  findAllWithStats(filters: CustomerFilters = {}): CustomerWithStats[] {
    const conditions = filters.includeDeleted ? [] : [eq(customers.isDeleted, false)]
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(or(like(customers.name, term), like(customers.phone, term))!)
    }

    const query = this.db
      .select({
        ...getTableColumns(customers),
        repairCount: sql<number>`count(${repairs.id})`,
        lastVisit: sql<string | null>`max(${repairs.createdAt})`
      })
      .from(customers)
      .leftJoin(repairs, and(eq(repairs.customerId, customers.id), eq(repairs.isDeleted, false)))
      .groupBy(customers.id)

    const filtered = conditions.length ? query.where(and(...conditions)) : query
    // Default newest-first for the Customers list.
    return filtered.orderBy(desc(customers.createdAt)).all()
  }

  update(id: string, patch: UpdateCustomerInput): Customer | null {
    return this.write<Customer>((tx) =>
      tx
        .update(customers)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(customers.id, id))
        .returning()
        .get() ?? null
    )
  }

  softDelete(id: string): Customer | null {
    return this.write<Customer>((tx) =>
      tx
        .update(customers)
        .set({ isDeleted: true, updatedAt: new Date().toISOString() })
        .where(eq(customers.id, id))
        .returning()
        .get() ?? null
    )
  }
}
