import { useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Card } from '@shared/components/Card'
import { StatusBadge } from '@shared/components/StatusBadge'
import { RepairStatusActions } from '@shared/components/RepairStatusActions'
import { dictionary } from '@shared/i18n'
import { formatCurrency } from '@shared/lib/currency'
import { formatLocalDate, type DateRangePreset } from '@shared/lib/dateRangePresets'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { useRepairSearch } from '@shared/hooks/useRepairSearch'

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

/** Tab-2 presets are keyed on the ORDER CREATION date (repairs.createdAt). */
type CreatedPreset = 'all' | 'today' | 'yesterday' | 'week' | 'custom'

/** Maps a Tab-2 created-date preset onto useRepairSearch's existing date inputs (which filter createdAt). */
function toSearchDateInputs(
  preset: CreatedPreset,
  from: string,
  to: string
): { datePreset: DateRangePreset; customFrom?: string; customTo?: string } {
  if (preset === 'today') return { datePreset: 'today' }
  if (preset === 'week') return { datePreset: 'week' }
  if (preset === 'yesterday') {
    const yesterday = formatLocalDate(new Date(Date.now() - 24 * 60 * 60 * 1000))
    return { datePreset: 'custom', customFrom: yesterday, customTo: yesterday }
  }
  if (preset === 'custom') return { datePreset: 'custom', customFrom: from, customTo: to }
  return { datePreset: 'all' }
}

/**
 * POS "Deliver Order" tab — a single, scannable list of existing not-yet-
 * delivered repairs (search by customer/phone/device + creation-date filter),
 * with the SAME inline status actions the main Repairs list and Dashboard rows
 * use (RepairStatusActions, compact) directly on each row — no select-then-view
 * step. Reuses useRepairSearch (createdAt-filtered, debounced, live) narrowed
 * client-side to pending/completed, and RepairStatusActions for the actions
 * (Mark as Completed / Mark as Delivered / Deliver on Credit / Cancel) → the
 * Part A delivery services. No new search or delivery logic.
 */
export function PosDeliverOrder() {
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'

  const [search, setSearch] = useState('')
  const [preset, setPreset] = useState<CreatedPreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const dateInputs = toSearchDateInputs(preset, customFrom, customTo)
  const { results, loading, refresh } = useRepairSearch({ search, status: 'all', brand: 'all', ...dateInputs })
  // Only orders still awaiting hand-over — the hook's status filter is single-value.
  const undelivered = results.filter((r) => r.status === 'pending' || r.status === 'completed')

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-xl">
      <BilingualText text={dictionary.pos.deliverOrder} as="div" size="xl" className="mb-lg items-start" />

      <Card padding="md" className="mb-lg flex flex-wrap items-end gap-md">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1">
          <BilingualText text={dictionary.pos.deliverSearch} size="sm" className="text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.pos.dateCreatedLabel} size="sm" className="text-ink-muted" />
          <select value={preset} onChange={(e) => setPreset(e.target.value as CreatedPreset)} className={selectClass}>
            <option value="all">{dictionary.repairs.dateAll.en}</option>
            <option value="today">{dictionary.repairs.dateToday.en}</option>
            <option value="yesterday">{dictionary.repairs.dateYesterday.en}</option>
            <option value="week">{dictionary.repairs.dateThisWeek.en}</option>
            <option value="custom">{dictionary.repairs.dateCustom.en}</option>
          </select>
        </label>

        {preset === 'custom' && (
          <>
            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.repairs.dateFrom} size="sm" className="text-ink-muted" />
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={selectClass} />
            </label>
            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.repairs.dateTo} size="sm" className="text-ink-muted" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={selectClass} />
            </label>
          </>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden" data-testid="pos-deliver-list">
        {undelivered.length === 0 && !loading ? (
          <div className="p-lg text-center">
            <BilingualText text={dictionary.pos.noUndelivered} size="sm" className="items-center text-ink-muted" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {undelivered.map((repair) => (
              <div key={repair.id} className="flex items-center justify-between gap-md px-lg py-md">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{repair.customerName}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {repair.deviceBrand} {repair.deviceModel} · {repair.customerPhone}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {dictionary.pos.createdOn.en}: {new Date(repair.createdAt).toLocaleDateString()} ·{' '}
                    {formatCurrency(repair.remainingBalance, currency)}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-sm">
                  <StatusBadge status={repair.status} />
                  {/* Exact same inline actions as the Repairs list / Dashboard rows. */}
                  <RepairStatusActions repair={repair} onChanged={refresh} compact stopRowClick />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
