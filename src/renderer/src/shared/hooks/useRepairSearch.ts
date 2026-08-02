import { useEffect, useRef, useState } from 'react'
import type { RepairWithCustomer } from '../../../../main/db/repositories/repairRepository'
import type { RepairStatus } from '@shared/lib/repairStatus'
import { getDateRangeBounds, type DateRangePreset } from '@shared/lib/dateRangePresets'

export interface RepairListFilters {
  search: string
  status: RepairStatus | 'all'
  brand: string | 'all'
  datePreset: DateRangePreset
  customFrom?: string
  customTo?: string
}

/** Debounced, race-safe live search + filter over repairs, joined with customer name/phone for display. */
export function useRepairSearch(filters: RepairListFilters): { results: RepairWithCustomer[]; loading: boolean } {
  const [results, setResults] = useState<RepairWithCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const thisRequest = ++requestId.current
    setLoading(true)
    const { dateFrom, dateTo } = getDateRangeBounds(filters.datePreset, {
      from: filters.customFrom,
      to: filters.customTo
    })

    const timer = setTimeout(() => {
      window.api.repairs
        .listWithCustomer({
          search: filters.search.trim() || undefined,
          status: filters.status === 'all' ? undefined : filters.status,
          brand: filters.brand === 'all' ? undefined : filters.brand,
          dateFrom,
          dateTo
        })
        .then((rows) => {
          if (requestId.current !== thisRequest) return
          setResults(rows)
          setLoading(false)
        })
    }, 100)

    return () => clearTimeout(timer)
  }, [filters.search, filters.status, filters.brand, filters.datePreset, filters.customFrom, filters.customTo])

  return { results, loading }
}
