import { useEffect, useRef, useState } from 'react'
import type { Customer } from '../../../../main/db/repositories/customerRepository'

/**
 * Debounced, race-safe live search over customers (name or phone). Shared by
 * the Customers list page and CustomerPicker so both get identical
 * "under 100ms feeling" search behavior without duplicating the debounce +
 * stale-response guard logic.
 */
export function useCustomerSearch(query: string): { results: Customer[]; loading: boolean } {
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const thisRequest = ++requestId.current
    setLoading(true)

    const timer = setTimeout(() => {
      window.api.customers.list({ search: query.trim() || undefined }).then((rows) => {
        if (requestId.current !== thisRequest) return // a newer keystroke already superseded this response
        setResults(rows)
        setLoading(false)
      })
    }, 100)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading }
}
