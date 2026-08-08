import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { formatCurrency } from '@shared/lib/currency'
import { categoryLabel } from '@shared/lib/expenseCategory'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { useDismissedBannersStore } from '@shared/hooks/useDismissedBannersStore'
import { useDataSubscription } from '@shared/lib/dataBus'

const currentMonthKey = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Recurring-expense auto-draft (Part J#16): every category the shop has marked
 * "repeats every month" (Part K#20) that hasn't been logged yet this month is
 * offered here as a one-tap, pre-filled draft (last month's amount) — the
 * ExpenseRepository.findRecurringDrafts query does the work. Dismissal is
 * per-session and keyed by category+month, so dismissing August's rent draft
 * doesn't suppress September's. Subscribes to expense writes so a draft
 * vanishes the moment its expense is logged.
 */
export function RecurringReminderBanner() {
  const navigate = useNavigate()
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'
  const dismissed = useDismissedBannersStore((state) => state.dismissed)
  const dismiss = useDismissedBannersStore((state) => state.dismiss)
  const [drafts, setDrafts] = useState<{ category: string; amount: number }[]>([])

  const load = () => window.api.expenses.getRecurringDrafts().then(setDrafts)
  useEffect(() => {
    load()
  }, [])
  useDataSubscription(['expenses'], load)

  const monthKey = currentMonthKey()
  const visible = drafts.filter((draft) => !dismissed.has(`${draft.category}-${monthKey}`))
  if (visible.length === 0) return null

  return (
    <div data-testid="recurring-reminder-banner" className="mb-xl rounded-lg border border-warning/30 bg-warning/5">
      <div className="px-lg py-md">
        <BilingualText text={dictionary.dashboard.recurringDueTitle} as="div" size="sm" className="font-medium text-ink" />
        <BilingualText text={dictionary.dashboard.recurringDueBody} size="xs" className="text-ink-muted" />
      </div>
      <div className="divide-y divide-warning/20 border-t border-warning/20 bg-surface">
        {visible.map((draft) => (
          <div key={draft.category} className="flex items-center justify-between gap-md px-lg py-md">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{categoryLabel(draft.category)}</p>
              <p className="text-xs text-ink-muted">
                {formatCurrency(draft.amount, currency)} · {dictionary.dashboard.lastMonthAmount.en}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-sm">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/expenses/new', { state: { category: draft.category, amount: draft.amount } })}
              >
                <BilingualText text={dictionary.dashboard.addDraft} size="xs" align="center" />
              </Button>
              <button
                type="button"
                onClick={() => dismiss(`${draft.category}-${monthKey}`)}
                aria-label="Dismiss"
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-warning/10 hover:text-ink"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
