import { randomUUID } from 'node:crypto'
import { and, eq, gte, like, lte, or } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm/utils'
import type { AppDatabase } from '../client'
import { repairs, customers, type RepairStatus, type RepairPriority } from '../schema'

export type Repair = typeof repairs.$inferSelect
export type RepairWithCustomer = Repair & { customerName: string; customerPhone: string }

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
  /** Exact device brand match, for the Repair List's brand filter. */
  brand?: string
  /** Inclusive createdAt range, ISO strings — powers the Today/This Week/This Month/Custom presets in the UI. */
  dateFrom?: string
  dateTo?: string
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
    const conditions = this.buildConditions(filters)
    const query = this.db.select().from(repairs)
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  /**
   * Same filters as findAll, plus a free-text search across device
   * brand/model, repair id, IMEI, and the linked customer's name/phone — the
   * Repair List needs the customer columns anyway, so this is a real SQL
   * join rather than a second app-level lookup.
   */
  findAllWithCustomer(filters: RepairFilters & { search?: string } = {}): RepairWithCustomer[] {
    const conditions = this.buildConditions(filters)
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(
        or(
          like(repairs.deviceBrand, term),
          like(repairs.deviceModel, term),
          like(repairs.id, term),
          like(repairs.imei, term),
          like(customers.name, term),
          like(customers.phone, term)
        )!
      )
    }

    const query = this.db
      .select({ ...getTableColumns(repairs), customerName: customers.name, customerPhone: customers.phone })
      .from(repairs)
      .innerJoin(customers, eq(repairs.customerId, customers.id))

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

  /** Populates the Repair List's brand filter dropdown from what's actually in use. */
  listDistinctBrands(): string[] {
    const rows = this.db
      .selectDistinct({ brand: repairs.deviceBrand })
      .from(repairs)
      .where(eq(repairs.isDeleted, false))
      .all()
    return rows.map((row) => row.brand).sort()
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

  private buildConditions(filters: RepairFilters) {
    const conditions = filters.includeDeleted ? [] : [eq(repairs.isDeleted, false)]
    if (filters.customerId) conditions.push(eq(repairs.customerId, filters.customerId))
    if (filters.status) conditions.push(eq(repairs.status, filters.status))
    if (filters.brand) conditions.push(eq(repairs.deviceBrand, filters.brand))
    if (filters.dateFrom) conditions.push(gte(repairs.createdAt, filters.dateFrom))
    if (filters.dateTo) conditions.push(lte(repairs.createdAt, filters.dateTo))
    return conditions
  }
}
