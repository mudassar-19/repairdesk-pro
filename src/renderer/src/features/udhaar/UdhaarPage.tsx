import { Fragment, useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { EmptyState } from '@shared/components/EmptyState'
import { ExtendDateControl } from '@shared/components/ExtendDateControl'
import { PageHeader } from '@shared/components/PageHeader'
import { SummaryCard } from '@shared/components/SummaryCard'
import { UdhaarIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useUdhaarSearch, type OverdueFilter } from '@shared/hooks/useUdhaarSearch'
import { useDataSubscription } from '@shared/lib/dataBus'
import { udhaarStatusLabel, udhaarStatusBadgeClass, dueDateStatusLabel } from '@shared/lib/udhaar'
import { formatCurrency } from '@shared/lib/currency'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { logActivity } from '@shared/lib/activityLog'
import { diffDays, addDays } from '@shared/lib/overdueReminders'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { RecordSettlementModal } from './RecordSettlementModal'
import type { Udhaar } from '../../../../main/db/repositories/udhaarRepository'
import type { UdhaarDirection, UdhaarStatus } from '../../../../main/db/schema'
import { useNavigate } from 'react-router-dom'

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

const today = (): string => formatLocalDate(new Date())

export function UdhaarPage() {
  const navigate = useNavigate()
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'

  const [direction, setDirection] = useState<UdhaarDirection>('receivable')
  const [status, setStatus] = useState<UdhaarStatus | 'all'>('all')
  const [overdueFilter, setOverdueFilter] = useState<OverdueFilter>('all')
  const [search, setSearch] = useState('')
  const [settlingEntry, setSettlingEntry] = useState<Udhaar | null>(null)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [totals, setTotals] = useState<{ totalReceivables: number; totalPayables: number } | null>(null)

  const { results, loading, refresh } = useUdhaarSearch({ direction, status, overdueFilter, search })

  const loadTotals = () => {
    window.api.udhaar.getSummary().then(setTotals)
  }
  useEffect(() => {
    loadTotals()
  }, [])
  // Keep the receivables/payables totals live when udhaar changes anywhere.
  useDataSubscription(['udhaar'], loadTotals)

  const handleExtendDueDate = async (entry: Udhaar, newDate: string) => {
    if (!newDate) return
    const previousDate = entry.dueDate
    const updated = await window.api.udhaar.update(entry.id, { dueDate: newDate })
    if (!updated) return
    setExtendingId(null)
    refresh()
    const extendedByDays = previousDate ? diffDays(previousDate, newDate) : null
    logActivity({
      actionType: 'udhaar_due_date_extended',
      entityType: 'udhaar',
      entityId: updated.id,
      description:
        extendedByDays !== null
          ? `Udhaar due date extended from ${previousDate} to ${newDate} (${extendedByDays} day${extendedByDays === 1 ? '' : 's'})`
          : `Udhaar due date set to ${newDate}`,
      metadata: { fromDate: previousDate, toDate: newDate, extendedByDays }
    })
  }

  const hasActiveFilters = status !== 'all' || overdueFilter !== 'all' || Boolean(search)
  const activeTotal = direction === 'receivable' ? totals?.totalReceivables : totals?.totalPayables

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={dictionary.nav.udhaar}
        action={
          <Button variant="primary" onClick={() => navigate('/udhaar/new')}>
            <BilingualText text={dictionary.udhaar.addNew} size="sm" align="center" />
          </Button>
        }
      />

      <div className="mb-lg flex items-center gap-sm">
        <Button variant={direction === 'receivable' ? 'primary' : 'secondary'} size="sm" onClick={() => setDirection('receivable')}>
          <BilingualText text={dictionary.udhaar.receivables} size="xs" align="center" />
        </Button>
        <Button variant={direction === 'payable' ? 'primary' : 'secondary'} size="sm" onClick={() => setDirection('payable')}>
          <BilingualText text={dictionary.udhaar.payables} size="xs" align="center" />
        </Button>
      </div>

      <div className="mb-lg max-w-xs">
        <SummaryCard
          label={direction === 'receivable' ? dictionary.udhaar.totalReceivables : dictionary.udhaar.totalPayables}
          value={activeTotal !== undefined ? formatCurrency(activeTotal, currency) : '—'}
          tone={direction === 'receivable' ? 'success' : 'warning'}
        />
      </div>

      <Card padding="md" className="mb-lg flex flex-wrap items-end gap-md">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <BilingualText text={dictionary.udhaar.searchPlaceholder} size="sm" className="text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.udhaar.status} size="sm" className="text-ink-muted" />
          <select value={status} onChange={(event) => setStatus(event.target.value as UdhaarStatus | 'all')} className={selectClass}>
            <option value="all">{dictionary.udhaar.allStatuses.en}</option>
            <option value="pending">{udhaarStatusLabel.pending.en}</option>
            <option value="partially_settled">{udhaarStatusLabel.partially_settled.en}</option>
            <option value="settled">{udhaarStatusLabel.settled.en}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.udhaar.filterOverdueOnly} size="sm" className="text-ink-muted" />
          <select value={overdueFilter} onChange={(event) => setOverdueFilter(event.target.value as OverdueFilter)} className={selectClass}>
            <option value="all">{dictionary.udhaar.filterAll.en}</option>
            <option value="overdue">{dictionary.udhaar.filterOverdue.en}</option>
            <option value="upcoming">{dictionary.udhaar.filterUpcoming.en}</option>
          </select>
        </label>
      </Card>

      {results.length === 0 && !loading ? (
        hasActiveFilters ? (
          <div className="flex flex-1 items-center justify-center">
            <BilingualText text={dictionary.udhaar.noMatches} size="sm" className="items-center text-ink-muted" />
          </div>
        ) : (
          <EmptyState title={dictionary.udhaar.emptyTitle} body={dictionary.udhaar.emptyBody} icon={UdhaarIcon} />
        )
      ) : (
        <Card padding="none" className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised">
              <tr>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.udhaar.person} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm text-right">
                  <BilingualText text={dictionary.udhaar.amount} size="sm" className="items-end text-ink-muted" />
                </th>
                <th className="px-lg py-sm text-right">
                  <BilingualText text={dictionary.udhaar.remainingBalance} size="sm" className="items-end text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.udhaar.dueDate} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.udhaar.status} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((entry) => (
                <Fragment key={entry.id}>
                  <tr>
                    <td className="px-lg py-md">
                      <p className="text-sm font-medium text-ink">{entry.personName}</p>
                      {entry.personPhone && <p className="text-xs text-ink-muted">{entry.personPhone}</p>}
                    </td>
                    <td className="px-lg py-md text-right text-sm tabular-nums text-ink">
                      {formatCurrency(entry.totalAmount, currency)}
                    </td>
                    <td className="px-lg py-md text-right text-sm font-medium tabular-nums text-ink">
                      {formatCurrency(entry.remainingBalance, currency)}
                    </td>
                    <td className="px-lg py-md text-sm text-ink-muted">
                      <BilingualText text={dueDateStatusLabel(entry.dueDate, today())} size="xs" />
                    </td>
                    <td className="px-lg py-md">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${udhaarStatusBadgeClass[entry.status]}`}>
                        {udhaarStatusLabel[entry.status].en}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-lg py-md">
                      <div className="flex justify-end gap-sm">
                        {entry.status !== 'settled' && (
                          <>
                            <Button variant="primary" size="sm" onClick={() => setSettlingEntry(entry)}>
                              <BilingualText text={dictionary.udhaar.recordSettlement} size="xs" align="center" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setExtendingId((current) => (current === entry.id ? null : entry.id))}
                            >
                              <BilingualText text={dictionary.udhaar.extendDueDate} size="xs" align="center" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {extendingId === entry.id && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <ExtendDateControl
                          today={today()}
                          initialDate={addDays(today(), 1)}
                          dateLabel={dictionary.udhaar.newDueDate}
                          confirmLabel={dictionary.dashboard.updateDate}
                          onConfirm={(newDate) => handleExtendDueDate(entry, newDate)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <RecordSettlementModal
        entry={settlingEntry}
        open={settlingEntry !== null}
        onClose={() => setSettlingEntry(null)}
        onRecorded={() => {
          setSettlingEntry(null)
          refresh()
          loadTotals()
        }}
      />
    </div>
  )
}
