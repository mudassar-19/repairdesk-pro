import { getCombinedRangeBounds, type DateRangePreset } from './dateRangePresets'
import type { ReportDateBounds } from '../../../../main/db/repositories/reportRepository'

/**
 * Reports use report-appropriate terminology (Daily/Weekly/Monthly/Yearly)
 * rather than the generic Repairs/Expenses filter labels (Today/This Week/
 * This Month), but resolve to the exact same underlying date math — this
 * maps one onto the other instead of duplicating the boundary logic.
 */
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

const periodToPreset: Record<ReportPeriod, DateRangePreset> = {
  daily: 'today',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
  custom: 'custom'
}

/** Returns undefined if a required bound isn't resolvable yet (e.g. custom period with no dates chosen) — callers should treat that as "not ready to generate". */
export function getReportBounds(
  period: ReportPeriod,
  custom?: { from?: string; to?: string }
): ReportDateBounds | null {
  const bounds = getCombinedRangeBounds(periodToPreset[period], custom)
  if (!bounds.isoFrom || !bounds.isoTo || !bounds.dateOnlyFrom || !bounds.dateOnlyTo) return null
  return {
    isoFrom: bounds.isoFrom,
    isoTo: bounds.isoTo,
    dateOnlyFrom: bounds.dateOnlyFrom,
    dateOnlyTo: bounds.dateOnlyTo
  }
}
