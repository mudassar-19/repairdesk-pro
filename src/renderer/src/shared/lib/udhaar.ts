import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import type { UdhaarDirection, UdhaarStatus } from '../../../../main/db/schema'
import { diffDays } from './overdueReminders'

export const udhaarStatusLabel: Record<UdhaarStatus, BilingualString> = {
  pending: dictionary.udhaar.statusPending,
  partially_settled: dictionary.udhaar.statusPartiallySettled,
  settled: dictionary.udhaar.statusSettled
}

/** Reuses only the existing semantic tokens (warning/primary/success) — no new colors, same convention as repairStatusBadgeClass. */
export const udhaarStatusBadgeClass: Record<UdhaarStatus, string> = {
  pending: 'bg-warning/10 text-warning',
  partially_settled: 'bg-primary/10 text-primary',
  settled: 'bg-success/10 text-success'
}

/** Short "which way does the money flow" label — the same wording as the Receivables/Payables tabs on the Udhaar page. */
export const udhaarDirectionLabel: Record<UdhaarDirection, BilingualString> = {
  receivable: dictionary.udhaar.receivables,
  payable: dictionary.udhaar.payables
}

/**
 * Semantic coloring for a direction badge — matches the Udhaar page's own
 * receivable=success / payable=warning SummaryCard tones, so "owed to me" and
 * "I owe" read the same everywhere. Reuses existing tokens, no new colors.
 */
export const udhaarDirectionBadgeClass: Record<UdhaarDirection, string> = {
  receivable: 'bg-success/10 text-success',
  payable: 'bg-warning/10 text-warning'
}

/**
 * Bilingual "due in N days" / "due today" / "N days overdue" text for a
 * Udhaar row — distinct from overdueReminders.daysOverdueLabel, which only
 * ever describes the overdue case for the reminder banner. The list screen
 * needs to describe upcoming due dates too.
 */
export function dueDateStatusLabel(dueDate: string | null, today: string): BilingualString {
  if (!dueDate) return dictionary.udhaar.noDueDate

  const diff = diffDays(today, dueDate)
  if (diff === 0) return { en: 'Due today', ur: 'آج ادائیگی کا دن ہے' }
  if (diff > 0) {
    return { en: `Due in ${diff} day${diff === 1 ? '' : 's'}`, ur: `${diff} دن میں ادائیگی` }
  }
  const overdueDays = -diff
  return { en: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`, ur: `${overdueDays} دن تاخیر سے` }
}
