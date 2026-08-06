import { randomUUID } from 'node:crypto'
import { and, desc, eq, like, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { udhaar, udhaarSettlements, type UdhaarDirection, type UdhaarStatus } from '../schema'
import { BaseRepository } from './baseRepository'

export type Udhaar = typeof udhaar.$inferSelect

export interface NewUdhaarInput {
  personName: string
  personPhone?: string | null
  customerId?: string | null
  direction: UdhaarDirection
  totalAmount: number
  dueDate?: string | null
  repairId?: string | null
  notes?: string | null
}

export type UpdateUdhaarInput = Partial<Omit<NewUdhaarInput, 'direction'>>

export interface UdhaarFilters {
  direction?: UdhaarDirection
  status?: UdhaarStatus
  /** Matches against personName or personPhone. */
  search?: string
  includeDeleted?: boolean
}

function statusFor(totalAmount: number, amountSettled: number): UdhaarStatus {
  if (amountSettled <= 0) return 'pending'
  if (amountSettled >= totalAmount) return 'settled'
  return 'partially_settled'
}

export class UdhaarRepository extends BaseRepository {
  constructor(db: Db) {
    super(db)
  }

  create(input: NewUdhaarInput): Udhaar {
    const now = new Date().toISOString()
    return this.write<Udhaar>((tx) =>
      tx
        .insert(udhaar)
        .values({
          id: randomUUID(),
          personName: input.personName,
          personPhone: input.personPhone ?? null,
          customerId: input.customerId ?? null,
          direction: input.direction,
          totalAmount: input.totalAmount,
          amountSettled: 0,
          remainingBalance: input.totalAmount,
          status: 'pending',
          dueDate: input.dueDate ?? null,
          repairId: input.repairId ?? null,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
          isDeleted: false
        })
        .returning()
        .get()
    )!
  }

  findById(id: string): Udhaar | null {
    const row = this.db.select().from(udhaar).where(eq(udhaar.id, id)).get()
    return row ?? null
  }

  findAll(filters: UdhaarFilters = {}): Udhaar[] {
    const conditions = this.buildConditions(filters)
    const query = this.db.select().from(udhaar).orderBy(desc(udhaar.createdAt))
    return conditions.length ? query.where(and(...conditions)).all() : query.all()
  }

  findByRepairId(repairId: string): Udhaar[] {
    return this.db
      .select()
      .from(udhaar)
      .where(and(eq(udhaar.repairId, repairId), eq(udhaar.isDeleted, false)))
      .all()
  }

  /**
   * remainingBalance/status are recomputed from totalAmount and the sum of
   * non-deleted settlements on every update — the same "never trust a stale
   * stored total" pattern RepairRepository.update() already uses for
   * remainingBalance, so editing totalAmount after settlements already exist
   * (e.g. correcting a typo) can never silently erase what's already been
   * settled.
   */
  update(id: string, patch: UpdateUdhaarInput): Udhaar | null {
    return this.write<Udhaar>((tx) => {
      const existing = tx.select().from(udhaar).where(eq(udhaar.id, id)).get()
      if (!existing) return null

      const totalAmount = patch.totalAmount ?? existing.totalAmount
      const amountSettled = this.sumSettlements(tx, id)
      const remainingBalance = totalAmount - amountSettled

      return (
        tx
          .update(udhaar)
          .set({
            ...patch,
            amountSettled,
            remainingBalance,
            status: statusFor(totalAmount, amountSettled),
            updatedAt: new Date().toISOString()
          })
          .where(eq(udhaar.id, id))
          .returning()
          .get() ?? null
      )
    })
  }

  softDelete(id: string): Udhaar | null {
    return this.write<Udhaar>((tx) =>
      tx
        .update(udhaar)
        .set({ isDeleted: true, updatedAt: new Date().toISOString() })
        .where(eq(udhaar.id, id))
        .returning()
        .get() ?? null
    )
  }

  /**
   * Udhaar due dates that have passed while the entry is still not fully
   * settled — same indexed "< today" scan as
   * RepairRepository.findOverdueUnresolved, powering the Overdue Udhaar
   * Reminder. NULL dueDate never matches `<`, so open-ended entries are
   * correctly excluded without an extra isNotNull check.
   */
  findOverdueUnresolved(today: string): Udhaar[] {
    return this.db
      .select()
      .from(udhaar)
      .where(and(eq(udhaar.isDeleted, false), lt(udhaar.dueDate, today), sql`${udhaar.status} != 'settled'`))
      .orderBy(udhaar.dueDate)
      .all()
  }

  /**
   * Outstanding total for a direction — summing remainingBalance (not
   * totalAmount) across every non-deleted entry, since a settled entry's
   * remainingBalance is already 0 and needs no separate status filter to
   * exclude it from "what's still owed."
   */
  sumRemainingBalanceByDirection(direction: UdhaarDirection): number {
    const row = this.db
      .select({ total: sql<number>`coalesce(sum(${udhaar.remainingBalance}), 0)` })
      .from(udhaar)
      .where(and(eq(udhaar.isDeleted, false), eq(udhaar.direction, direction)))
      .get()
    return row?.total ?? 0
  }

  private sumSettlements(db: Db, udhaarId: string): number {
    const row = db
      .select({ total: sql<number>`coalesce(sum(${udhaarSettlements.amount}), 0)` })
      .from(udhaarSettlements)
      .where(and(eq(udhaarSettlements.udhaarId, udhaarId), eq(udhaarSettlements.isDeleted, false)))
      .get()
    return row?.total ?? 0
  }

  private buildConditions(filters: UdhaarFilters) {
    const conditions = filters.includeDeleted ? [] : [eq(udhaar.isDeleted, false)]
    if (filters.direction) conditions.push(eq(udhaar.direction, filters.direction))
    if (filters.status) conditions.push(eq(udhaar.status, filters.status))
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(or(like(udhaar.personName, term), like(udhaar.personPhone, term))!)
    }
    return conditions
  }
}
