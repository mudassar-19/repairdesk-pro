import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { EmptyState } from '@shared/components/EmptyState'
import { StatusBadge } from '@shared/components/StatusBadge'
import { RepairsIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useRepairSearch } from '@shared/hooks/useRepairSearch'
import { repairStatusValues, repairStatusLabel, type RepairStatus } from '@shared/lib/repairStatus'
import type { DateRangePreset } from '@shared/lib/dateRangePresets'

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function RepairsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RepairStatus | 'all'>('all')
  const [brand, setBrand] = useState('all')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [brands, setBrands] = useState<string[]>([])

  useEffect(() => {
    window.api.repairs.listBrands().then(setBrands)
  }, [])

  const { results, loading } = useRepairSearch({ search, status, brand, datePreset, customFrom, customTo })
  const hasActiveFilters = Boolean(search) || status !== 'all' || brand !== 'all' || datePreset !== 'all'

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-xl flex items-center justify-between gap-md">
        <BilingualText text={dictionary.nav.repairs} as="div" size="xl" />
        <button
          type="button"
          onClick={() => navigate('/repairs/new')}
          className="flex-shrink-0 rounded-md bg-primary px-md py-sm text-primary-ink transition-colors hover:bg-primary-hover"
        >
          <BilingualText text={dictionary.repairs.addNew} size="sm" className="items-center" />
        </button>
      </div>

      <div className="mb-lg flex flex-wrap items-end gap-md">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1">
          <BilingualText text={dictionary.repairs.searchPlaceholder} size="sm" className="text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.filterStatus} size="sm" className="text-ink-muted" />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as RepairStatus | 'all')}
            className={selectClass}
          >
            <option value="all">{dictionary.repairs.allStatuses.en}</option>
            {repairStatusValues.map((value) => (
              <option key={value} value={value}>
                {repairStatusLabel[value].en}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.filterBrand} size="sm" className="text-ink-muted" />
          <select value={brand} onChange={(event) => setBrand(event.target.value)} className={selectClass}>
            <option value="all">{dictionary.repairs.allBrands.en}</option>
            {brands.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.filterDateRange} size="sm" className="text-ink-muted" />
          <select
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value as DateRangePreset)}
            className={selectClass}
          >
            <option value="all">{dictionary.repairs.dateAll.en}</option>
            <option value="today">{dictionary.repairs.dateToday.en}</option>
            <option value="week">{dictionary.repairs.dateThisWeek.en}</option>
            <option value="month">{dictionary.repairs.dateThisMonth.en}</option>
            <option value="custom">{dictionary.repairs.dateCustom.en}</option>
          </select>
        </label>

        {datePreset === 'custom' && (
          <>
            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.repairs.dateFrom} size="sm" className="text-ink-muted" />
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={selectClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.repairs.dateTo} size="sm" className="text-ink-muted" />
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className={selectClass}
              />
            </label>
          </>
        )}
      </div>

      {results.length === 0 && !loading ? (
        hasActiveFilters ? (
          <div className="flex flex-1 items-center justify-center">
            <BilingualText text={dictionary.repairs.noMatches} size="sm" className="items-center text-ink-muted" />
          </div>
        ) : (
          <EmptyState title={dictionary.repairs.emptyTitle} body={dictionary.repairs.emptyBody} icon={RepairsIcon} />
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
                  <BilingualText text={dictionary.repairs.deviceModel} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.status} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.estimatedDeliveryDate} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((repair) => (
                <tr
                  key={repair.id}
                  onClick={() => navigate(`/repairs/${repair.id}`)}
                  className="cursor-pointer transition-colors hover:bg-surface-raised"
                >
                  <td className="px-lg py-md text-sm font-medium text-ink">{repair.customerName}</td>
                  <td className="px-lg py-md text-sm text-ink-muted">{repair.customerPhone}</td>
                  <td className="px-lg py-md text-sm text-ink-muted">
                    {repair.deviceBrand} {repair.deviceModel}
                  </td>
                  <td className="px-lg py-md">
                    <StatusBadge status={repair.status} />
                  </td>
                  <td className="px-lg py-md text-sm text-ink-muted">{repair.estimatedDeliveryDate ?? '—'}</td>
                  <td className="px-lg py-md text-sm font-medium text-ink">{repair.remainingBalance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
