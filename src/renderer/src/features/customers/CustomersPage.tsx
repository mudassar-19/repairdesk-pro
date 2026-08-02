import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { EmptyState } from '@shared/components/EmptyState'
import { CustomersIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useCustomerSearch } from '@shared/hooks/useCustomerSearch'

export function CustomersPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { results, loading } = useCustomerSearch(query)

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-xl flex items-center justify-between gap-md">
        <BilingualText text={dictionary.nav.customers} as="div" size="xl" />
        <button
          type="button"
          onClick={() => navigate('/customers/new')}
          className="flex-shrink-0 rounded-md bg-primary px-md py-sm text-primary-ink transition-colors hover:bg-primary-hover"
        >
          <BilingualText text={dictionary.customers.addNew} size="sm" className="items-center" />
        </button>
      </div>

      <label className="mb-lg flex max-w-sm flex-col gap-1">
        <BilingualText text={dictionary.customers.searchPlaceholder} size="sm" className="text-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {results.length === 0 && !loading ? (
        query ? (
          <div className="flex flex-1 items-center justify-center">
            <BilingualText text={dictionary.customers.noMatches} size="sm" className="items-center text-ink-muted" />
          </div>
        ) : (
          <EmptyState
            title={dictionary.customers.emptyTitle}
            body={dictionary.customers.emptyBody}
            icon={CustomersIcon}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-surface shadow-card">
          <table className="w-full text-left">
            <thead className="border-b border-border bg-surface-raised">
              <tr>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.customers.name} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.customers.phone} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.customers.totalRepairs} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.customers.lastVisit} size="sm" className="text-ink-muted" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="cursor-pointer transition-colors hover:bg-surface-raised"
                >
                  <td className="px-lg py-md text-sm font-medium text-ink">{customer.name}</td>
                  <td className="px-lg py-md text-sm text-ink-muted">{customer.phone}</td>
                  {/* Repairs module (Phase 5) will replace these two placeholders with real counts/dates. */}
                  <td className="px-lg py-md text-sm text-ink-muted">0</td>
                  <td className="px-lg py-md text-sm text-ink-muted">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
