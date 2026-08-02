export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

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

/** Resolves a UI date-range preset into the createdAt bounds RepairRepository.findAll expects. */
export function getDateRangeBounds(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string }
): { dateFrom?: string; dateTo?: string } {
  const now = new Date()

  if (preset === 'all') return {}
  if (preset === 'custom') {
    return {
      dateFrom: custom?.from ? startOfDay(new Date(custom.from)).toISOString() : undefined,
      dateTo: custom?.to ? endOfDay(new Date(custom.to)).toISOString() : undefined
    }
  }
  if (preset === 'today') {
    return { dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() }
  }
  if (preset === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return { dateFrom: startOfDay(start).toISOString(), dateTo: endOfDay(now).toISOString() }
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { dateFrom: startOfDay(start).toISOString(), dateTo: endOfDay(now).toISOString() }
}
