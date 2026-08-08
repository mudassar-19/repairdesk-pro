import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card, CardHeader } from '@shared/components/Card'
import { EmptyState } from '@shared/components/EmptyState'
import { PageHeader } from '@shared/components/PageHeader'
import { ScrollList } from '@shared/components/ScrollList'
import { StatusBadge } from '@shared/components/StatusBadge'
import { SummaryCard } from '@shared/components/SummaryCard'
import { ActivityFeedItem } from '@shared/components/ActivityFeedItem'
import { RepairStatusActions } from '@shared/components/RepairStatusActions'
import { RepairsIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useDataSubscription } from '@shared/lib/dataBus'
import { RecurringReminderBanner } from './RecurringReminderBanner'
import { OverdueDeliveryBanner } from './OverdueDeliveryBanner'
import { OverdueUdhaarBanner } from './OverdueUdhaarBanner'
import { MissedCloudBackupBanner } from './MissedCloudBackupBanner'
import type { DashboardSummary } from '../../../../main/db/repositories/dashboardRepository'
import type { Repair, RepairWithCustomer } from '../../../../main/db/repositories/repairRepository'
import type { ActivityLogRow } from '../../../../main/db/repositories/activityLogRepository'
import type { UdhaarSummary } from '../../../../main/ipc/udhaar'

export function DashboardPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [udhaarSummary, setUdhaarSummary] = useState<UdhaarSummary | null>(null)
  const [deliveries, setDeliveries] = useState<RepairWithCustomer[] | null>(null)
  const [recentRepairs, setRecentRepairs] = useState<RepairWithCustomer[] | null>(null)
  const [activity, setActivity] = useState<ActivityLogRow[] | null>(null)

  const refreshUdhaarSummary = () => {
    window.api.udhaar.getSummary().then(setUdhaarSummary)
  }

  /**
   * Every dashboard read in one place. Fired independently (not Promise.all)
   * so one section never blocks another's paint — each is already a fast,
   * indexed local query, but this keeps the page resilient either way. Kept
   * as a plain function (not a useCallback) because the mount effect owns its
   * only long-lived references via the listeners it registers.
   */
  const loadAll = () => {
    window.api.dashboard.getSummary().then(setSummary)
    window.api.dashboard.getTodaysDeliveries().then(setDeliveries)
    window.api.dashboard.getRecentRepairs(8).then(setRecentRepairs)
    window.api.listActivity({ limit: 12 }).then(setActivity)
    refreshUdhaarSummary()
  }

  /**
   * Settling a repair-linked receivable udhaar now also records a payment on
   * the repair (see udhaarService.recordUdhaarSettlement), so it moves the
   * Total Receivables card *and* the money-in cards (Revenue/Profit/Net) and
   * the repair's own balance in Recent Repairs — refetch all of them, not
   * just the udhaar summary.
   */
  const handleUdhaarChanged = () => {
    refreshUdhaarSummary()
    window.api.dashboard.getSummary().then(setSummary)
    window.api.dashboard.getRecentRepairs(8).then(setRecentRepairs)
  }

  // Part E: any business write anywhere in the app refreshes every dashboard
  // card/list live — no navigation or refocus needed.
  useDataSubscription(['repairs', 'payments', 'udhaar', 'expenses', 'customers'], loadAll)

  useEffect(() => {
    loadAll()
    // Belt-and-braces for the one thing the in-app event bus can't see:
    // returning to the app window from another app (or the OS re-showing it).
    const onFocus = () => loadAll()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadAll()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * A status change from either inline list can affect the summary cards too
   * (e.g. Pending/Ready for Pickup counts) — refetch that alongside patching
   * the affected row in place. Today's Deliveries additionally drops the row
   * once it's delivered/cancelled, matching what getTodaysDeliveries' own
   * query already excludes — otherwise a locked, action-less row would sit
   * there until the next full page load.
   */
  const handleRepairChanged = (updated: Repair) => {
    setDeliveries((current) =>
      current
        ?.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
        .filter((r) => r.status !== 'delivered' && r.status !== 'cancelled') ?? current
    )
    setRecentRepairs((current) => current?.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)) ?? current)
    window.api.dashboard.getSummary().then(setSummary)
    // Delivering an unpaid repair from a dashboard row can create a linked
    // receivable udhaar (the "track as udhaar?" prompt), so keep Total
    // Receivables/Payables live too, not just the money-in summary cards.
    refreshUdhaarSummary()
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={dictionary.nav.dashboard}
        action={
          <div className="flex flex-wrap items-center gap-sm">
            <Button variant="primary" onClick={() => navigate('/repairs/new')}>
              <BilingualText text={dictionary.repairs.addNew} size="sm" align="center" />
            </Button>
            <Button variant="secondary" onClick={() => navigate('/customers/new')}>
              <BilingualText text={dictionary.customers.addNew} size="sm" align="center" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/reports')}>
              <BilingualText text={dictionary.dashboard.viewReports} size="sm" align="center" />
            </Button>
          </div>
        }
      />

      {/* K18: reminders live in one compact, self-scrolling band so that no
          matter how many are active at once they can never push the summary
          cards and lists down the page indefinitely. It collapses to zero
          height when nothing is active (each banner renders null when empty). */}
      <div className="max-h-72 overflow-y-auto [&>*:last-child]:mb-0">
        <OverdueDeliveryBanner onRepairChanged={handleRepairChanged} />
        <OverdueUdhaarBanner onChanged={handleUdhaarChanged} />
        <MissedCloudBackupBanner />
        <RecurringReminderBanner />
      </div>

      {/* Today's Deliveries first — operationally the most time-sensitive thing on this screen. */}
      <Card padding="none" className="mb-xl">
        <CardHeader>
          <BilingualText text={dictionary.dashboard.todaysDeliveries} as="div" size="lg" />
          {deliveries && deliveries.length > 0 && (
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              {deliveries.length}
            </span>
          )}
        </CardHeader>
        {deliveries === null ? (
          <div className="p-lg">
            <BilingualText text={dictionary.common.loading} size="sm" className="text-ink-muted" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="p-lg text-center">
            <BilingualText
              text={dictionary.dashboard.noDeliveriesToday}
              size="sm"
              className="items-center text-ink-muted"
            />
          </div>
        ) : (
          <ScrollList maxHeight="sm" className="divide-y divide-border">
            {deliveries.map((repair) => (
              <div
                key={repair.id}
                onClick={() => navigate(`/repairs/${repair.id}`)}
                className="flex cursor-pointer items-center justify-between gap-md px-lg py-md transition-colors hover:bg-surface-raised"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {repair.customerName} — {repair.deviceBrand} {repair.deviceModel}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {repair.customerPhone}
                    {repair.deliveryTime ? ` · ${repair.deliveryTime}` : ''}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-sm">
                  <StatusBadge status={repair.status} />
                  <RepairStatusActions repair={repair} onChanged={handleRepairChanged} compact stopRowClick />
                </div>
              </div>
            ))}
          </ScrollList>
        )}
      </Card>

      <div className="mb-xl grid grid-cols-2 gap-lg md:grid-cols-4">
        <SummaryCard
          label={dictionary.dashboard.todaysRepairs}
          value={summary ? String(summary.todayRepairsCount) : '—'}
        />
        <SummaryCard
          label={dictionary.dashboard.pendingRepairs}
          value={summary ? String(summary.pendingRepairsCount) : '—'}
          tone="warning"
        />
        <SummaryCard
          label={dictionary.dashboard.readyForPickup}
          value={summary ? String(summary.readyForPickupCount) : '—'}
          tone="success"
        />
        <SummaryCard
          label={dictionary.dashboard.todaysRevenue}
          value={summary ? summary.todayRevenue.toFixed(2) : '—'}
          tone="primary"
        />
        <SummaryCard
          label={dictionary.dashboard.todaysProfit}
          value={summary ? summary.todayProfit.toFixed(2) : '—'}
          tone="success"
        />
        <SummaryCard
          label={dictionary.dashboard.monthlyRevenue}
          value={summary ? summary.monthlyRevenue.toFixed(2) : '—'}
          tone="primary"
        />
        <SummaryCard
          label={dictionary.dashboard.monthlyProfit}
          value={summary ? summary.monthlyProfit.toFixed(2) : '—'}
          tone="success"
        />
        <SummaryCard
          label={dictionary.dashboard.monthlyExpenses}
          value={summary ? summary.monthlyExpenses.toFixed(2) : '—'}
          tone="warning"
        />
        <SummaryCard
          label={dictionary.dashboard.netProfit}
          value={summary ? summary.netProfit.toFixed(2) : '—'}
          tone={summary && summary.netProfit < 0 ? 'danger' : 'success'}
        />
        <SummaryCard
          label={dictionary.udhaar.totalReceivables}
          value={udhaarSummary ? udhaarSummary.totalReceivables.toFixed(2) : '—'}
          tone="success"
        />
        <SummaryCard
          label={dictionary.udhaar.totalPayables}
          value={udhaarSummary ? udhaarSummary.totalPayables.toFixed(2) : '—'}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
        <Card padding="none" className="lg:col-span-2">
          <CardHeader>
            <BilingualText text={dictionary.dashboard.recentRepairs} as="div" size="lg" />
            <Button variant="ghost" size="sm" onClick={() => navigate('/repairs')}>
              <BilingualText text={dictionary.dashboard.viewAll} size="xs" align="center" />
            </Button>
          </CardHeader>
          {recentRepairs === null ? (
            <div className="p-lg">
              <BilingualText text={dictionary.common.loading} size="sm" className="text-ink-muted" />
            </div>
          ) : recentRepairs.length === 0 ? (
            <EmptyState title={dictionary.repairs.emptyTitle} body={dictionary.repairs.emptyBody} icon={RepairsIcon} />
          ) : (
            <ScrollList maxHeight="md" className="divide-y divide-border">
              {recentRepairs.map((repair) => (
                <div
                  key={repair.id}
                  onClick={() => navigate(`/repairs/${repair.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-md px-lg py-md transition-colors hover:bg-surface-raised"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{repair.customerName}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {repair.deviceBrand} {repair.deviceModel}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-sm">
                    <StatusBadge status={repair.status} />
                    <span className="w-16 text-right text-xs font-medium text-ink-muted">
                      {repair.remainingBalance.toFixed(2)}
                    </span>
                    <RepairStatusActions repair={repair} onChanged={handleRepairChanged} compact stopRowClick />
                  </div>
                </div>
              ))}
            </ScrollList>
          )}
        </Card>

        <Card padding="none">
          <CardHeader>
            <BilingualText text={dictionary.dashboard.recentActivity} as="div" size="lg" />
            <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
              <BilingualText text={dictionary.dashboard.viewAll} size="xs" align="center" />
            </Button>
          </CardHeader>
          {activity === null ? (
            <div className="p-lg">
              <BilingualText text={dictionary.common.loading} size="sm" className="text-ink-muted" />
            </div>
          ) : activity.length === 0 ? (
            <div className="p-lg text-center">
              <BilingualText
                text={dictionary.dashboard.noActivityYet}
                size="sm"
                className="items-center text-ink-muted"
              />
            </div>
          ) : (
            <ScrollList maxHeight="md" className="divide-y divide-border">
              {activity.map((entry) => (
                <ActivityFeedItem key={entry.id} entry={entry} />
              ))}
            </ScrollList>
          )}
        </Card>
      </div>
    </div>
  )
}
