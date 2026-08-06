import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import { useDismissedBannersStore } from '@shared/hooks/useDismissedBannersStore'

const currentMonthKey = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const REMINDER_ITEMS: { category: string; title: BilingualString }[] = [
  { category: 'rent', title: dictionary.dashboard.reminderRentTitle },
  { category: 'electricity', title: dictionary.dashboard.reminderElectricityTitle }
]

/**
 * Two lightweight EXISTS-style checks (see ExpenseRepository.hasEntryForCurrentMonth)
 * fired once on mount — negligible cost, same class as the other dashboard
 * queries. Dismissal is per-session (useDismissedBannersStore, in-memory)
 * and keyed by category+month, so dismissing August's rent nudge doesn't
 * suppress September's.
 */
export function RecurringReminderBanner() {
  const navigate = useNavigate()
  const dismissed = useDismissedBannersStore((state) => state.dismissed)
  const dismiss = useDismissedBannersStore((state) => state.dismiss)
  const [loggedStatus, setLoggedStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    REMINDER_ITEMS.forEach(({ category }) => {
      window.api.expenses.hasEntryForCurrentMonth(category).then((logged) => {
        setLoggedStatus((current) => ({ ...current, [category]: logged }))
      })
    })
  }, [])

  const monthKey = currentMonthKey()
  const visibleItems = REMINDER_ITEMS.filter(
    ({ category }) => loggedStatus[category] === false && !dismissed.has(`${category}-${monthKey}`)
  )

  if (visibleItems.length === 0) return null

  return (
    <div className="mb-xl divide-y divide-border rounded-lg border border-warning/30 bg-warning/5">
      {visibleItems.map(({ category, title }) => (
        <div key={category} className="flex items-center justify-between gap-md px-lg py-md">
          <BilingualText text={title} size="sm" />
          <div className="flex flex-shrink-0 items-center gap-sm">
            <Button variant="ghost" size="sm" onClick={() => navigate('/expenses/new')}>
              <BilingualText text={dictionary.dashboard.logNow} size="xs" align="center" />
            </Button>
            <button
              type="button"
              onClick={() => dismiss(`${category}-${monthKey}`)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-ink-muted transition-colors hover:bg-warning/10 hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
