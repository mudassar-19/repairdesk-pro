import type { BilingualString } from '@shared/i18n'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** All dates here are plain 'YYYY-MM-DD' strings — parsed as UTC midnight so day-diff math isn't skewed by the local timezone's own offset. */
function toUtcMidnight(dateString: string): number {
  return new Date(`${dateString}T00:00:00Z`).getTime()
}

/** Whole days between two 'YYYY-MM-DD' strings (b - a). Positive when b is later. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMidnight(b) - toUtcMidnight(a)) / MS_PER_DAY)
}

/** How many whole days past a due/delivery date something is, relative to today. Always >= 1 for anything an overdue query would have returned. */
export function daysOverdue(dueDate: string, today: string): number {
  return Math.max(1, diffDays(dueDate, today))
}

/** Dynamic count text — English pluralizes, Urdu's "دن" (day) reads naturally for any count so it doesn't need a plural form. */
export function daysOverdueLabel(days: number): BilingualString {
  return {
    en: `${days} day${days === 1 ? '' : 's'} overdue`,
    ur: `${days} دن تاخیر سے`
  }
}

/** Adds whole days to a 'YYYY-MM-DD' string, returning the same format. */
export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Composite dismissal key for a Dashboard overdue-reminder banner —
 * deliberately includes the date, not just the entity id. If a dismissed
 * entry's relevant date later changes and it becomes overdue again under the
 * new date, that's a different key and the reminder correctly resurfaces
 * instead of staying silently suppressed forever. `namespace` keeps the
 * Overdue Delivery Reminder and Overdue Udhaar Reminder's keys from ever
 * colliding in the shared useDismissedBannersStore.
 */
export function overdueDismissKey(namespace: 'delivery' | 'udhaar', entityId: string, dateKey: string): string {
  return `overdue-${namespace}:${entityId}:${dateKey}`
}
