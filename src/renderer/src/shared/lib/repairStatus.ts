import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'

/**
 * Mirrors the string-literal union in src/main/db/schema.ts. Duplicated
 * (not imported) deliberately — schema.ts pulls in drizzle-orm/sqlite-core,
 * which has no business being bundled into the renderer just for a small
 * literal array. The Repair/RepairWithCustomer *types* still cross the
 * main/renderer boundary as type-only imports (zero runtime cost); only
 * this concrete value array, needed at runtime by Zod and the filter UI,
 * is re-declared here.
 *
 * Linear 4-state workflow: pending (default) -> completed (work done) ->
 * delivered (handed back, final/locked) or cancelled (final/locked) at any
 * point before delivered. See RepairRepository.update() for where the
 * delivered/cancelled lock is actually enforced.
 */
export const repairStatusValues = ['pending', 'completed', 'delivered', 'cancelled'] as const
export type RepairStatus = (typeof repairStatusValues)[number]

export const repairPriorityValues = ['low', 'normal', 'high'] as const
export type RepairPriority = (typeof repairPriorityValues)[number]

export const repairStatusLabel: Record<RepairStatus, BilingualString> = {
  pending: dictionary.repairs.statusPending,
  completed: dictionary.repairs.statusCompleted,
  delivered: dictionary.repairs.statusDelivered,
  cancelled: dictionary.repairs.statusCancelled
}

/** Reuses only the existing semantic tokens (warning/primary/success/danger) — no new colors. */
export const repairStatusBadgeClass: Record<RepairStatus, string> = {
  pending: 'bg-warning/10 text-warning',
  completed: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger'
}

/** Statuses where no further status change is allowed — mirrors RepairRepository.update()'s lock, for UI purposes only (the repository is the real enforcement point). */
export function isRepairStatusLocked(status: RepairStatus): boolean {
  return status === 'delivered' || status === 'cancelled'
}

export const repairPriorityLabel: Record<RepairPriority, BilingualString> = {
  low: dictionary.repairs.priorityLow,
  normal: dictionary.repairs.priorityNormal,
  high: dictionary.repairs.priorityHigh
}
