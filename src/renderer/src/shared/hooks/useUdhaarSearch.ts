import { useEffect, useRef, useState } from 'react'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import type { Udhaar } from '../../../../main/db/repositories/udhaarRepository'
import type { UdhaarDirection, UdhaarStatus } from '../../../../main/db/schema'

export type OverdueFilter = 'all' | 'overdue' | 'upcoming'

export interface UdhaarListFilters {
  direction: UdhaarDirection
  status: UdhaarStatus | 'all'
  overdueFilter: OverdueFilter
  search: string
}

/**
 * Debounced, race-safe search over one direction's (receivables/payables)
 * Udhaar entries — mirrors useExpenseSearch/useRepairSearch. overdueFilter
 * is applied client-side after fetching (not pushed into UdhaarRepository),
 * since it depends on "today" rather than a stored column value and this
 * list is never large enough for that to matter.
 */
export function useUdhaarSearch(filters: UdhaarListFilters): { results: Udhaar[]; loading: boolean; refresh: () => void } {
  const [results, setResults] = useState<Udhaar[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const thisRequest = ++requestId.current
    setLoading(true)

    const timer = setTimeout(() => {
      window.api.udhaar
        .list({
          direction: filters.direction,
          status: filters.status === 'all' ? undefined : filters.status,
          search: filters.search.trim() || undefined
        })
        .then((rows) => {
          if (requestId.current !== thisRequest) return
          const today = formatLocalDate(new Date())
          const filtered = rows.filter((row) => {
            if (filters.overdueFilter === 'all') return true
            const isOverdue = Boolean(row.dueDate) && row.dueDate! < today && row.status !== 'settled'
            return filters.overdueFilter === 'overdue' ? isOverdue : !isOverdue
          })
          setResults(filtered)
          setLoading(false)
        })
    }, 100)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.direction, filters.status, filters.overdueFilter, filters.search, refreshTick])

  return { results, loading, refresh: () => setRefreshTick((tick) => tick + 1) }
}
