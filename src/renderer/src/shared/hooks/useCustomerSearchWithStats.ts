import { useEffect, useRef, useState } from 'react'
import type { CustomerWithStats } from '../../../../main/db/repositories/customerRepository'

/**
 * Same debounced, race-safe search as useCustomerSearch, but for the
 * Customers list specifically — which needs each customer's repair
 * count/last-visit date (customers:listWithStats), not just the plain
 * customer row. Kept as its own hook rather than a parameter on
 * useCustomerSearch since that one is also used by CustomerPicker, which
 * only ever needs the plain row and shouldn't pay for the extra join.
 */
export function useCustomerSearchWithStats(query: string): { results: CustomerWithStats[]; loading: boolean } {
  const [results, setResults] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const thisRequest = ++requestId.current
    setLoading(true)

    const timer = setTimeout(() => {
      window.api.customers.listWithStats({ search: query.trim() || undefined }).then((rows) => {
        if (requestId.current !== thisRequest) return
        setResults(rows)
        setLoading(false)
      })
    }, 100)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading }
}
