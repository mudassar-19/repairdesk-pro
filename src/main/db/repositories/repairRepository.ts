import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { repairs, type RepairStatus, type RepairPriority } from '../schema'

export type Repair = typeof repairs.$inferSelect

export interface NewRepairInput {
  customerId: string
  deviceBrand: string
  deviceModel: string
  issue: string
  accessories?: string | null
  imei?: string | null
  status?: RepairStatus
  costPrice?: number
  repairPrice?: number
  advanceAmount?: number
  priority?: RepairPriority
  estimatedDeliveryDate?: string | null
  deliveryTime?: string | null
  notes?: string | null
}

export type UpdateRepairInput = Partial<NewRepairInput>

export interface RepairFilters {
  customerId?: string
  status?: RepairStatus
  includeDeleted?: boolean
}

export class RepairRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: NewRepairInput): Repair {
    const now = new Date().toISOString()
    const repairPrice = input.repairPrice ?? 0
    const advanceAmount = input.advanceAmount ?? 0

    return this.db
      .insert(repairs)
      .values({
        id: randomUUID(),
        customerId: input.customerId,
        deviceBrand: input.deviceBrand,
        deviceModel: input.deviceModel,
        issue: input.issue,
        accessories: input.accessories ?? null,
        imei: input.imei ?? null,
        status: input.status ?? 'pending',
        costPrice: input.costPrice ?? 0,
        repairPrice,
        advanceAmount,
        remainingBalance: repairPrice - advanceAmount,
        priority: input.priority ?? 'normal',
        estimatedDeliveryDate: input.estimatedDeliveryDate ?? null,
        deliveryTime: input.deliveryTime ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        isDeleted: false
      })
      .returning()
      .get()
  }

  findById(id: string): Repair | null {
    const row = this.db.select().from(repairs).where(eq(repairs.id, id)).get()
    return row ?? null
  }

  findAll(filters: RepairFilters = {}): Repair[] {
    const conditions = filters.includeDeleted ? [] : [eq(repairs.isDeleted, false)]
    if (filters.customerId) conditions.push(eq(repairs.customerId, filters.customerId))
    if (filters.status) conditions.push(eq(repairs.status, filters.status))

    const query = this.db.select().from(repairs)
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  update(id: string, patch: UpdateRepairInput): Repair | null {
    const existing = this.findById(id)
    if (!existing) return null

    const repairPrice = patch.repairPrice ?? existing.repairPrice
    const advanceAmount = patch.advanceAmount ?? existing.advanceAmount

    const row = this.db
      .update(repairs)
      .set({
        ...patch,
        remainingBalance: repairPrice - advanceAmount,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending'
      })
      .where(eq(repairs.id, id))
      .returning()
      .get()
    return row ?? null
  }

  softDelete(id: string): Repair | null {
    const row = this.db
      .update(repairs)
      .set({ isDeleted: true, updatedAt: new Date().toISOString(), syncStatus: 'pending' })
      .where(eq(repairs.id, id))
      .returning()
      .get()
    return row ?? null
  }
}
