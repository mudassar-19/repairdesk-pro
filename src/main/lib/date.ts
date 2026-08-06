/**
 * "YYYY-MM-DD" from a Date's LOCAL calendar components — never round-tripped
 * through .toISOString(), which converts to UTC first and silently shifts
 * the calendar date backward by one day for any positive-UTC-offset
 * timezone (Pakistan, this app's primary deployment, included) whenever
 * local midnight falls within the offset window. .toISOString() is exactly
 * right for a real *instant* (comparing against repairs.createdAt, an
 * actual UTC timestamp) — it's only wrong for deriving a *calendar date*,
 * which is what every caller here needs. Same fix already proven correct
 * in AnalyticsRepository.formatLocalDate; the renderer's
 * shared/lib/dateRangePresets.ts mirrors this exact function since main and
 * renderer can't share a module across the Electron process boundary.
 */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** "YYYY-MM-DD" for the current moment, in local calendar terms — see formatLocalDate. */
export function todayLocalDateString(): string {
  return formatLocalDate(new Date())
}
