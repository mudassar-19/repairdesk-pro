import { useEffect, useRef, useState } from 'react'
import type { PaymentWithContext } from '../../../../main/db/repositories/paymentRepository'
import type { PaymentType } from '../../../../main/db/schema'
import { getDateOnlyRangeBounds, type DateRangePreset } from '@shared/lib/dateRangePresets'

export interface PaymentListFilters {
  search: string
  type: PaymentType | 'all'
  datePreset: DateRangePreset
  customFrom?: string
  customTo?: string
}

/** Debounced, race-safe search over the "All Payments" ledger — mirrors useExpenseSearch/useRepairSearch. */
export function useAllPaymentsSearch(filters: PaymentListFilters): { results: PaymentWithContext[]; loading: boolean } {
  const [results, setResults] = useState<PaymentWithContext[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const thisRequest = ++requestId.current
    setLoading(true)
    const { dateFrom, dateTo } = getDateOnlyRangeBounds(filters.datePreset, {
      from: filters.customFrom,
      to: filters.customTo
    })

    const timer = setTimeout(() => {
      window.api.payments
        .listWithContext({
          search: filters.search.trim() || undefined,
          type: filters.type === 'all' ? undefined : filters.type,
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
  }, [filters.search, filters.type, filters.datePreset, filters.customFrom, filters.customTo])

  return { results, loading }
}
