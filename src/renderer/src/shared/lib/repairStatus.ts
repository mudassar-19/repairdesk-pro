import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'

/**
 * Mirrors the string-literal unions in src/main/db/schema.ts. Duplicated
 * (not imported) deliberately — schema.ts pulls in drizzle-orm/sqlite-core,
 * which has no business being bundled into the renderer just for two small
 * literal arrays. The Repair/RepairWithCustomer *types* still cross the
 * main/renderer boundary as type-only imports (zero runtime cost); only
 * these concrete value arrays, needed at runtime by Zod and the filter UI,
 * are re-declared here.
 */
export const repairStatusValues = [
  'pending',
  'waiting_for_parts',
  'in_progress',
  'ready_for_pickup',
  'completed',
  'cancelled'
] as const
export type RepairStatus = (typeof repairStatusValues)[number]

export const repairPriorityValues = ['low', 'normal', 'high'] as const
export type RepairPriority = (typeof repairPriorityValues)[number]

export const repairStatusLabel: Record<RepairStatus, BilingualString> = {
  pending: dictionary.repairs.statusPending,
  waiting_for_parts: dictionary.repairs.statusWaitingForParts,
  in_progress: dictionary.repairs.statusInProgress,
  ready_for_pickup: dictionary.repairs.statusReadyForPickup,
  completed: dictionary.repairs.statusCompleted,
  cancelled: dictionary.repairs.statusCancelled
}

/** Reuses only the existing semantic tokens (success/warning/danger/primary/ink-muted) — no new colors. */
export const repairStatusBadgeClass: Record<RepairStatus, string> = {
  pending: 'bg-ink-muted/10 text-ink-muted',
  waiting_for_parts: 'bg-warning/10 text-warning',
  in_progress: 'bg-primary/10 text-primary',
  ready_for_pickup: 'bg-success/10 text-success',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger'
}

export const repairPriorityLabel: Record<RepairPriority, BilingualString> = {
  low: dictionary.repairs.priorityLow,
  normal: dictionary.repairs.priorityNormal,
  high: dictionary.repairs.priorityHigh
}
