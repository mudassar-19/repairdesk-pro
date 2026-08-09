import { useState } from 'react'
import type { Customer } from '../../../../main/db/repositories/customerRepository'
import { useCustomerSearch } from '@shared/hooks/useCustomerSearch'
import { useDuplicatePhoneCheck } from '@shared/hooks/useDuplicatePhoneCheck'
import { normalizePhone } from '@shared/lib/phone'
import { logActivity } from '@shared/lib/activityLog'
import { dictionary } from '@shared/i18n'
import { BilingualText } from './BilingualText'
import { Button } from './Button'

export interface CustomerPickerProps {
  value: Customer | null
  onSelect: (customer: Customer) => void
  autoFocus?: boolean
}

/**
 * True when the query is phone-number-shaped (digits plus common phone
 * punctuation only) — used to decide whether "create new" should prefill
 * the Phone field or the Name field. Stripping non-digits and checking what
 * remains (the previous approach) matches ANY string containing a digit
 * anywhere — e.g. a name like "Room 204" — silently routing it into Phone
 * and leaving Name blank. Only common phone separators are stripped here,
 * so anything with a letter in it correctly falls through to Name instead.
 */
const isDigits = (value: string): boolean => {
  const stripped = value.replace(/[\s\-()+]/g, '')
  return stripped.length > 0 && /^\d+$/.test(stripped)
}

/**
 * Standalone, reusable find-or-create customer widget — lives in
 * shared/components (not features/customers) with zero dependency on the
 * Customers feature folder, so Phase 5's Repair Order form can drop this in
 * as-is via the same controlled { value, onSelect } contract.
 */
export function CustomerPicker({ value, onSelect, autoFocus }: CustomerPickerProps) {
  const [editing, setEditing] = useState(!value)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'search' | 'create'>('search')
  const { results, loading } = useCustomerSearch(query)

  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const duplicate = useDuplicatePhoneCheck(createPhone)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleSelect = (customer: Customer) => {
    onSelect(customer)
    setEditing(false)
    setQuery('')
    setMode('search')
  }

  const startCreate = () => {
    setMode('create')
    setCreateName(isDigits(query) ? '' : query)
    setCreatePhone(isDigits(query) ? query : '')
    setCreateError(null)
  }

  const handleCreate = async () => {
    if (duplicate) return
    const name = createName.trim()
    const phone = normalizePhone(createPhone)
    if (!name || phone.length < 7) {
      setCreateError('Enter a name and a valid phone number.')
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      const customer = await window.api.customers.create({ name, phone })
      logActivity({
        actionType: 'create',
        entityType: 'customer',
        entityId: customer.id,
        description: `Customer "${customer.name}" created`
      })
      setCreateName('')
      setCreatePhone('')
      handleSelect(customer)
    } catch {
      setCreateError('Could not create customer. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  if (!editing && value) {
    return (
      <div className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface-raised px-md py-sm">
        <div>
          <p className="text-sm font-medium text-ink">{value.name}</p>
          <p className="text-xs text-ink-muted">{value.phone}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <BilingualText text={dictionary.customers.changeCustomer} size="xs" align="center" />
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {mode === 'search' ? (
        <>
          <label className="flex flex-col gap-1 border-b border-border px-sm py-sm">
            <BilingualText text={dictionary.customers.pickerPlaceholder} size="sm" className="text-ink-muted" />
            <input
              type="text"
              autoFocus={autoFocus}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full text-sm text-ink outline-none"
            />
          </label>
          {/* Persistent "Create New Customer" — pinned right under the search input,
              never buried at the bottom of the (potentially long) results list, so it
              stays one tap away no matter how many customers exist. startCreate carries
              the typed query into the new-customer form (into Phone if it looks like a
              number, otherwise into Name). */}
          <button
            type="button"
            data-testid="create-new-customer"
            onClick={startCreate}
            className="flex w-full items-center gap-2 border-b border-border px-sm py-sm text-left text-primary transition-colors hover:bg-primary/5"
          >
            <span aria-hidden="true" className="text-base leading-none">
              +
            </span>
            <BilingualText text={dictionary.customers.createNew} size="sm" />
          </button>
          <div className="max-h-48 overflow-y-auto">
            {results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelect(customer)}
                className="flex w-full flex-col items-start gap-0.5 px-sm py-sm text-left transition-colors hover:bg-surface-raised"
              >
                <span className="text-sm font-medium text-ink">{customer.name}</span>
                <span className="text-xs text-ink-muted">{customer.phone}</span>
              </button>
            ))}
            {!loading && results.length === 0 && (
              <div className="px-sm py-sm">
                <BilingualText text={dictionary.customers.noMatches} size="sm" className="text-ink-muted" />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-sm p-sm">
          {createError && <p className="text-xs text-danger">{createError}</p>}

          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.customers.name} size="sm" className="text-ink-muted" />
            <input
              type="text"
              autoFocus
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className="rounded-md border border-border px-sm py-sm text-sm text-ink outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.customers.phone} size="sm" className="text-ink-muted" />
            <input
              type="tel"
              value={createPhone}
              onChange={(event) => setCreatePhone(event.target.value)}
              className="rounded-md border border-border px-sm py-sm text-sm text-ink outline-none focus:border-primary"
            />
          </label>

          {duplicate && (
            <div className="rounded-md bg-warning/10 p-sm text-warning">
              <BilingualText text={dictionary.customers.duplicateBody} size="sm" />
              <p className="mt-0.5 text-sm font-medium">
                {duplicate.name} ({duplicate.phone})
              </p>
              {!duplicate.isDeleted ? (
                // Not <Button> — this inherits the warning-tinted text color
                // from its parent callout via currentColor; Button's ghost
                // variant sets its own explicit (muted) text color, which
                // would override that inherited tone.
                <button type="button" onClick={() => handleSelect(duplicate)} className="mt-1 underline">
                  <BilingualText text={dictionary.customers.useExisting} size="sm" />
                </button>
              ) : (
                <div className="mt-1">
                  <BilingualText text={dictionary.customers.duplicateArchived} size="sm" />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-sm">
            <Button variant="ghost" size="sm" onClick={() => setMode('search')}>
              <BilingualText text={dictionary.customers.cancel} size="xs" align="center" />
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={creating || Boolean(duplicate)}>
              <BilingualText text={dictionary.customers.save} size="xs" align="center" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
