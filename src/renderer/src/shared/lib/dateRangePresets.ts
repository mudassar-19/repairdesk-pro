export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

/**
 * "YYYY-MM-DD" from a Date's LOCAL calendar components — never round-tripped
 * through .toISOString(), which converts to UTC first and silently shifts
 * the calendar date backward by one day for any positive-UTC-offset
 * timezone (Pakistan, this app's primary deployment, included) whenever
 * local midnight falls within the offset window. .toISOString() is exactly
 * right for a real *instant* (isoFrom/isoTo below, compared against
 * repairs.createdAt) — it's only wrong for deriving a *calendar date*.
 * Mirrors AnalyticsRepository.formatLocalDate (main process) and
 * main/lib/date.ts's copy of the same function — kept as separate copies
 * rather than a shared import since main and renderer can't share a module
 * across the Electron process boundary.
 */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function resolveBounds(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string }
): { from?: Date; to?: Date } {
  const now = new Date()

  if (preset === 'all') return {}
  if (preset === 'custom') {
    return {
      from: custom?.from ? startOfDay(new Date(custom.from)) : undefined,
      to: custom?.to ? endOfDay(new Date(custom.to)) : undefined
    }
  }
  if (preset === 'today') return { from: startOfDay(now), to: endOfDay(now) }
  if (preset === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return { from: startOfDay(start), to: endOfDay(now) }
  }
  if (preset === 'year') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { from: startOfDay(start), to: endOfDay(now) }
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: startOfDay(start), to: endOfDay(now) }
}

/** Full ISO timestamp bounds — for columns stored via new Date().toISOString(), e.g. repairs.createdAt. */
export function getDateRangeBounds(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string }
): { dateFrom?: string; dateTo?: string } {
  const { from, to } = resolveBounds(preset, custom)
  return { dateFrom: from?.toISOString(), dateTo: to?.toISOString() }
}

/**
 * Plain "YYYY-MM-DD" bounds — for date-only columns populated by a plain
 * <input type="date"> (expenses.expenseDate, payments.paymentDate). Comparing
 * those against full-ISO bounds would silently misclassify same-day rows,
 * since "2026-08-02" sorts lexicographically *before* "2026-08-02T00:00:00.000Z".
 */
export function getDateOnlyRangeBounds(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string }
): { dateFrom?: string; dateTo?: string } {
  const { from, to } = resolveBounds(preset, custom)
  return { dateFrom: from ? formatLocalDate(from) : undefined, dateTo: to ? formatLocalDate(to) : undefined }
}

/**
 * Both formats at once, resolved from the same underlying boundary dates —
 * for callers (Reports) that need to query both full-ISO columns (repairs)
 * and date-only columns (payments/expenses) for the same logical period.
 */
export function getCombinedRangeBounds(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string }
): { isoFrom?: string; isoTo?: string; dateOnlyFrom?: string; dateOnlyTo?: string } {
  const { from, to } = resolveBounds(preset, custom)
  return {
    isoFrom: from?.toISOString(),
    isoTo: to?.toISOString(),
    dateOnlyFrom: from ? formatLocalDate(from) : undefined,
    dateOnlyTo: to ? formatLocalDate(to) : undefined
  }
}
