import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Db } from '../client'
import { udhaarSettlements } from '../schema'
import { BaseRepository } from './baseRepository'

export type UdhaarSettlement = typeof udhaarSettlements.$inferSelect

export interface NewUdhaarSettlementInput {
  udhaarId: string
  amount: number
  settlementDate: string
  notes?: string | null
}

/**
 * Its own repository, not a method tacked onto UdhaarRepository — exactly
 * the same reason payments is a separate repository from repairs: a
 * settlement is its own entity with its own lifecycle.
 */
export class UdhaarSettlementRepository extends BaseRepository {
  constructor(db: Db) {
    super(db)
  }

  create(input: NewUdhaarSettlementInput): UdhaarSettlement {
    const now = new Date().toISOString()
    return this.write<UdhaarSettlement>((tx) =>
      tx
        .insert(udhaarSettlements)
        .values({
          id: randomUUID(),
          udhaarId: input.udhaarId,
          amount: input.amount,
          settlementDate: input.settlementDate,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
          isDeleted: false
        })
        .returning()
        .get()
    )!
  }

  findById(id: string): UdhaarSettlement | null {
    const row = this.db.select().from(udhaarSettlements).where(eq(udhaarSettlements.id, id)).get()
    return row ?? null
  }

  findByUdhaarId(udhaarId: string): UdhaarSettlement[] {
    return this.db
      .select()
      .from(udhaarSettlements)
      .where(and(eq(udhaarSettlements.udhaarId, udhaarId), eq(udhaarSettlements.isDeleted, false)))
      .all()
  }

  softDelete(id: string): UdhaarSettlement | null {
    return this.write<UdhaarSettlement>((tx) =>
      tx
        .update(udhaarSettlements)
        .set({ isDeleted: true, updatedAt: new Date().toISOString() })
        .where(eq(udhaarSettlements.id, id))
        .returning()
        .get() ?? null
    )
  }
}
