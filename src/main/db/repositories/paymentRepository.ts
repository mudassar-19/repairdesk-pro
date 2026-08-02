import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { payments, type PaymentType } from '../schema'

export type Payment = typeof payments.$inferSelect

export interface NewPaymentInput {
  repairId: string
  amount: number
  type: PaymentType
  paymentDate: string
  notes?: string | null
}

export type UpdatePaymentInput = Partial<Omit<NewPaymentInput, 'repairId'>>

export interface PaymentFilters {
  repairId?: string
  includeDeleted?: boolean
}

export class PaymentRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: NewPaymentInput): Payment {
    const now = new Date().toISOString()
    return this.db
      .insert(payments)
      .values({
        id: randomUUID(),
        repairId: input.repairId,
        amount: input.amount,
        type: input.type,
        paymentDate: input.paymentDate,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        isDeleted: false
      })
      .returning()
      .get()
  }

  findById(id: string): Payment | null {
    const row = this.db.select().from(payments).where(eq(payments.id, id)).get()
    return row ?? null
  }

  findAll(filters: PaymentFilters = {}): Payment[] {
    const conditions = filters.includeDeleted ? [] : [eq(payments.isDeleted, false)]
    if (filters.repairId) conditions.push(eq(payments.repairId, filters.repairId))

    const query = this.db.select().from(payments)
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  update(id: string, patch: UpdatePaymentInput): Payment | null {
    const row = this.db
      .update(payments)
      .set({ ...patch, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(payments.id, id))
      .returning()
      .get()
    return row ?? null
  }

  softDelete(id: string): Payment | null {
    const row = this.db
      .update(payments)
      .set({ isDeleted: true, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(payments.id, id))
      .returning()
      .get()
    return row ?? null
  }
}
