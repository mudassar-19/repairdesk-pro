import { useEffect, useRef, useState } from 'react'
import type { Expense } from '../../../../main/db/repositories/expenseRepository'
import { getDateOnlyRangeBounds, type DateRangePreset } from '@shared/lib/dateRangePresets'
import { useDataSubscription } from '@shared/lib/dataBus'

export interface ExpenseListFilters {
  category: string | 'all'
  datePreset: DateRangePreset
  customFrom?: string
  customTo?: string
}

/**
 * Debounced, race-safe filtering over expenses — mirrors useRepairSearch,
 * but uses getDateOnlyRangeBounds since expenseDate is a plain "YYYY-MM-DD"
 * value (a date input), not a full ISO timestamp like repairs.createdAt.
 */
export function useExpenseSearch(filters: ExpenseListFilters): { results: Expense[]; loading: boolean } {
  const [results, setResults] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const [refreshTick, setRefreshTick] = useState(0)

  useDataSubscription(['expenses'], () => setRefreshTick((tick) => tick + 1))

  useEffect(() => {
    const thisRequest = ++requestId.current
    setLoading(true)
    const { dateFrom, dateTo } = getDateOnlyRangeBounds(filters.datePreset, {
      from: filters.customFrom,
      to: filters.customTo
    })

    const timer = setTimeout(() => {
      window.api.expenses
        .list({
          category: filters.category === 'all' ? undefined : filters.category,
          from: dateFrom,
          to: dateTo
        })
        .then((rows) => {
          if (requestId.current !== thisRequest) return
          setResults(rows)
          setLoading(false)
        })
    }, 100)

    return () => clearTimeout(timer)
  }, [filters.category, filters.datePreset, filters.customFrom, filters.customTo, refreshTick])

  return { results, loading }
}
