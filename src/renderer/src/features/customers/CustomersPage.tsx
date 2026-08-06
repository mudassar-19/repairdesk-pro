import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { EmptyState } from '@shared/components/EmptyState'
import { PageHeader } from '@shared/components/PageHeader'
import { CustomersIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useCustomerSearchWithStats } from '@shared/hooks/useCustomerSearchWithStats'

export function CustomersPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { results, loading } = useCustomerSearchWithStats(query)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={dictionary.nav.customers}
        action={
          <Button variant="primary" onClick={() => navigate('/customers/new')}>
            <BilingualText text={dictionary.customers.addNew} size="sm" align="center" />
          </Button>
        }
      />

      <Card padding="md" className="mb-lg">
        <label className="flex max-w-sm flex-col gap-1">
          <BilingualText text={dictionary.customers.searchPlaceholder} size="sm" className="text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </Card>

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
        <Card padding="none" className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised">
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
                  <td className="px-lg py-md text-sm text-ink-muted">{customer.repairCount}</td>
                  <td className="px-lg py-md text-sm text-ink-muted">
                    {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
