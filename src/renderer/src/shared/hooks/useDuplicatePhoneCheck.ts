import { useEffect, useRef, useState } from 'react'
import type { Customer } from '../../../../main/db/repositories/customerRepository'
import { normalizePhone } from '../lib/phone'

/**
 * Exact-match lookup against the normalized phone value, debounced while
 * typing. Used by both the full Customer form and CustomerPicker's inline
 * create — never allow either to submit a phone that already exists.
 * excludeId lets the edit form ignore the customer's own current phone.
 */
export function useDuplicatePhoneCheck(phone: string, excludeId?: string): Customer | null {
  const [match, setMatch] = useState<Customer | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 7) {
      setMatch(null)
      return
    }

    const thisRequest = ++requestId.current
    const timer = setTimeout(() => {
      window.api.customers.findByPhone(normalized).then((found) => {
        if (requestId.current !== thisRequest) return
        setMatch(found && found.id !== excludeId ? found : null)
      })
    }, 150)

    return () => clearTimeout(timer)
  }, [phone, excludeId])

  return match
}
