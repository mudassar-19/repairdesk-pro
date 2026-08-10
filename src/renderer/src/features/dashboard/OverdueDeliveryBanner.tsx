import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { ExtendDateControl } from '@shared/components/ExtendDateControl'
import { StatusBadge } from '@shared/components/StatusBadge'
import { RepairStatusActions } from '@shared/components/RepairStatusActions'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { addDays, daysOverdue, daysOverdueLabel, diffDays, overdueDismissKey } from '@shared/lib/overdueReminders'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { useDismissedBannersStore } from '@shared/hooks/useDismissedBannersStore'
import type { Repair, RepairWithCustomer } from '../../../../main/db/repositories/repairRepository'

const today = (): string => formatLocalDate(new Date())

export interface OverdueDeliveryBannerProps {
  /** Same callback DashboardPage already passes to RepairStatusActions — keeps Today's Deliveries/Recent Repairs/summary in sync when an overdue repair is resolved from here. */
  onRepairChanged: (updated: Repair) => void
}

/**
 * Dashboard reminder for repairs whose estimatedDeliveryDate has already
 * passed while the repair is still 'pending' or 'completed' (i.e. never
 * handed back or written off). Fetches fresh on every mount — "on app open"
 * and "whenever Dashboard loads" are the same event here, since Dashboard is
 * the post-login landing route.
 *
 * Dismissal is per (repair id + estimatedDeliveryDate) via the existing
 * useDismissedBannersStore, not a single "seen it" flag — see
 * overdueDismissKey's own comment for why that matters.
 */
export function OverdueDeliveryBanner({ onRepairChanged }: OverdueDeliveryBannerProps) {
  const [overdueRepairs, setOverdueRepairs] = useState<RepairWithCustomer[] | null>(null)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const dismissed = useDismissedBannersStore((state) => state.dismissed)
  const dismiss = useDismissedBannersStore((state) => state.dismiss)

  useEffect(() => {
    window.api.dashboard.getOverdueDeliveries().then(setOverdueRepairs)
  }, [])

  const removeFromList = (repairId: string) => {
    setOverdueRepairs((current) => current?.filter((repair) => repair.id !== repairId) ?? current)
  }

  /**
   * All status/delivery/cancel actions now flow through the shared
   * RepairStatusActions component (same as Dashboard rows, Repairs list and
   * POS), so Cancel Order — and any future action — appears here automatically
   * without a hand-maintained copy. This handler just keeps the banner in sync:
   * once a repair is delivered or cancelled it's no longer an overdue-delivery,
   * so drop it; otherwise (still pending/completed) update it in place so its
   * status badge and available actions re-render. RepairStatusActions writes its
   * own activity-log entries, so we don't duplicate them here.
   */
  const handleRepairChanged = (updated: Repair) => {
    onRepairChanged(updated)
    if (updated.status === 'delivered' || updated.status === 'cancelled') {
      removeFromList(updated.id)
      setExtendingId((current) => (current === updated.id ? null : current))
    } else {
      setOverdueRepairs((current) => current?.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)) ?? current)
    }
  }

  const handleApplyExtension = async (repair: RepairWithCustomer, newDate: string) => {
    if (!newDate) return
    const previousDate = repair.estimatedDeliveryDate
    const updated = await window.api.repairs.update(repair.id, { estimatedDeliveryDate: newDate })
    if (!updated) return
    onRepairChanged(updated)
    removeFromList(repair.id)
    setExtendingId(null)
    const extendedByDays = previousDate ? diffDays(previousDate, newDate) : null
    logActivity({
      actionType: 'delivery_date_extended',
      entityType: 'repair',
      entityId: updated.id,
      description:
        extendedByDays !== null
          ? `Delivery date extended from ${previousDate} to ${newDate} (${extendedByDays} day${extendedByDays === 1 ? '' : 's'})`
          : `Delivery date set to ${newDate}`,
      metadata: { fromDate: previousDate, toDate: newDate, extendedByDays }
    })
  }

  const handleDismissAll = () => {
    visibleOverdue.forEach((repair) => dismiss(overdueDismissKey('delivery', repair.id, repair.estimatedDeliveryDate!)))
  }

  const toggleExtend = (repair: RepairWithCustomer) => {
    setExtendingId((current) => (current === repair.id ? null : repair.id))
  }

  if (overdueRepairs === null) return null

  const visibleOverdue = overdueRepairs.filter(
    (repair) => !dismissed.has(overdueDismissKey('delivery', repair.id, repair.estimatedDeliveryDate!))
  )

  if (visibleOverdue.length === 0) return null

  return (
    <div data-testid="overdue-delivery-banner" className="mb-xl rounded-lg border border-danger/30 bg-danger/5">
      <div className="flex items-center justify-between gap-md px-lg py-md">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-danger" />
          <BilingualText text={dictionary.dashboard.overdueDeliveries} as="div" size="lg" />
          <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">
            {visibleOverdue.length}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismissAll}
          aria-label="Dismiss"
          className="rounded-md p-1 text-ink-muted transition-colors hover:bg-danger/10 hover:text-ink"
        >
          ×
        </button>
      </div>

      <BilingualText
        text={dictionary.dashboard.overdueDeliveriesBody}
        size="sm"
        className="px-lg pb-md text-ink-muted"
      />

      <div className="divide-y divide-danger/20 border-t border-danger/20 bg-surface">
        {visibleOverdue.map((repair) => (
          <div key={repair.id}>
            <div className="flex flex-wrap items-center justify-between gap-md px-lg py-md">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {repair.customerName} — {repair.deviceBrand} {repair.deviceModel}
                </p>
                <p className="mt-0.5 text-xs font-medium text-danger">
                  {daysOverdueLabel(daysOverdue(repair.estimatedDeliveryDate!, today())).en}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-sm">
                <StatusBadge status={repair.status} />
                {/* Shared component — identical status/deliver/credit/Cancel actions
                    as every other repair surface, kept in sync automatically. */}
                <RepairStatusActions repair={repair} onChanged={handleRepairChanged} compact stopRowClick />
                <Button variant="ghost" size="sm" onClick={() => toggleExtend(repair)}>
                  <BilingualText text={dictionary.dashboard.extendDeliveryDate} size="xs" align="center" />
                </Button>
              </div>
            </div>

            {extendingId === repair.id && (
              <ExtendDateControl
                today={today()}
                initialDate={addDays(today(), 1)}
                dateLabel={dictionary.dashboard.newDeliveryDate}
                confirmLabel={dictionary.dashboard.updateDate}
                minDate={repair.estimatedDeliveryDate}
                onConfirm={(newDate) => handleApplyExtension(repair, newDate)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
