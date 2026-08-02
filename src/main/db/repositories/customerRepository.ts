import { randomUUID } from 'node:crypto'
import { and, eq, like, or } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { customers } from '../schema'

export type Customer = typeof customers.$inferSelect

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

export class CustomerRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: NewCustomerInput): Customer {
    const now = new Date().toISOString()
    return this.db
      .insert(customers)
      .values({
        id: randomUUID(),
        name: input.name,
        phone: input.phone,
        address: input.address ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        isDeleted: false
      })
      .returning()
      .get()
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
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  update(id: string, patch: UpdateCustomerInput): Customer | null {
    const row = this.db
      .update(customers)
      .set({ ...patch, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(customers.id, id))
      .returning()
      .get()
    return row ?? null
  }

  softDelete(id: string): Customer | null {
    const row = this.db
      .update(customers)
      .set({ isDeleted: true, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(customers.id, id))
      .returning()
      .get()
    return row ?? null
  }
}
