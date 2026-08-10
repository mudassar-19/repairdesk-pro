import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Card } from '@shared/components/Card'
import { EmptyState } from '@shared/components/EmptyState'
import { PageHeader } from '@shared/components/PageHeader'
import { PaymentsIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useAllPaymentsSearch } from '@shared/hooks/useAllPaymentsSearch'
import { paymentTypeValues, paymentTypeLabel } from '@shared/lib/paymentType'
import { formatCurrency } from '@shared/lib/currency'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import type { PaymentType } from '../../../../main/db/schema'
import type { DateRangePreset } from '@shared/lib/dateRangePresets'

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

/**
 * The "All Payments" ledger — every payment across every repair, in one
 * searchable/filterable place. Deliberately separate from, and read-only
 * relative to, per-repair payment recording (RepairDetailPage's Payment
 * History + RecordPaymentModal, Phase 7) — this page only ever reads via
 * PaymentRepository.findAllWithContext; new payments are still always
 * recorded against a specific repair, since that's where the
 * remainingBalance/overpayment context lives. Clicking a row jumps to that
 * repair.
 */
export function PaymentsPage() {
  const navigate = useNavigate()
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'

  const [search, setSearch] = useState('')
  const [type, setType] = useState<PaymentType | 'all'>('all')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { results, loading } = useAllPaymentsSearch({ search, type, datePreset, customFrom, customTo })
  const hasActiveFilters = Boolean(search) || type !== 'all' || datePreset !== 'all'
  // A payment on a cancelled (or soft-deleted) repair is no longer active
  // revenue — matches activeRepairPaymentCondition on the backend. The row
  // stays visible with a "Cancelled" badge, but is excluded from the total.
  const isPaymentCancelled = (payment: (typeof results)[number]): boolean =>
    payment.repairStatus === 'cancelled' || payment.repairIsDeleted
  const total = results.reduce((sum, payment) => (isPaymentCancelled(payment) ? sum : sum + payment.amount), 0)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={dictionary.nav.payments} />

      <Card padding="md" className="mb-lg flex flex-wrap items-end gap-md">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1">
          <BilingualText text={dictionary.payments.searchPlaceholder} size="sm" className="text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.payments.paymentType} size="sm" className="text-ink-muted" />
          <select value={type} onChange={(event) => setType(event.target.value as PaymentType | 'all')} className={selectClass}>
            <option value="all">{dictionary.payments.allTypes.en}</option>
            {paymentTypeValues.map((value) => (
              <option key={value} value={value}>
                {paymentTypeLabel[value].en}
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
              <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className={selectClass} />
            </label>
          </>
        )}

        <div className="ml-auto flex flex-col items-end gap-1">
          <BilingualText text={dictionary.payments.runningTotal} size="sm" className="text-ink-muted" />
          <p className="text-xl font-medium tabular-nums text-primary">{formatCurrency(total, currency)}</p>
        </div>
      </Card>

      {results.length === 0 && !loading ? (
        hasActiveFilters ? (
          <div className="flex flex-1 items-center justify-center">
            <BilingualText text={dictionary.payments.noMatches} size="sm" className="items-center text-ink-muted" />
          </div>
        ) : (
          <EmptyState title={dictionary.payments.noPaymentsYet} body={dictionary.payments.emptyBody} icon={PaymentsIcon} />
        )
      ) : (
        <Card padding="none" className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised">
              <tr>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.payments.paymentDate} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.customer} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.deviceModel} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.payments.paymentType} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm text-right">
                  <BilingualText text={dictionary.payments.amount} size="sm" className="items-end text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.payments.notes} size="sm" className="text-ink-muted" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((payment) => {
                const cancelled = isPaymentCancelled(payment)
                return (
                <tr
                  key={payment.id}
                  onClick={() => navigate(`/repairs/${payment.repairId}`)}
                  className="cursor-pointer transition-colors hover:bg-surface-raised"
                >
                  <td className="px-lg py-md text-sm text-ink-muted">{payment.paymentDate}</td>
                  <td className="px-lg py-md">
                    <p className="text-sm font-medium text-ink">{payment.customerName}</p>
                    <p className="text-xs text-ink-muted">{payment.customerPhone}</p>
                  </td>
                  <td className="px-lg py-md text-sm text-ink-muted">
                    <div className="flex flex-col gap-0.5">
                      <span>
                        {payment.deviceBrand} {payment.deviceModel}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">
                          #{payment.repairId.slice(-6).toUpperCase()}
                        </span>
                        {payment.repairPaymentCount > 1 && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {dictionary.payments.paymentOf.en
                              .replace('{n}', String(payment.repairPaymentIndex))
                              .replace('{m}', String(payment.repairPaymentCount))}
                          </span>
                        )}
                        {cancelled && (
                          <span
                            title={dictionary.payments.cancelledHint.en}
                            className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger"
                          >
                            {dictionary.payments.cancelledBadge.en}
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-lg py-md text-sm text-ink-muted">{paymentTypeLabel[payment.type].en}</td>
                  <td
                    className={`px-lg py-md text-right text-sm font-medium tabular-nums ${cancelled ? 'text-ink-muted line-through' : 'text-ink'}`}
                  >
                    {formatCurrency(payment.amount, currency)}
                  </td>
                  <td className="max-w-[200px] truncate px-lg py-md text-sm text-ink-muted">{payment.notes ?? '—'}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
