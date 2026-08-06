import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { ExtendDateControl } from '@shared/components/ExtendDateControl'
import { StatusBadge } from '@shared/components/StatusBadge'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { repairStatusLabel } from '@shared/lib/repairStatus'
import { addDays, daysOverdue, daysOverdueLabel, diffDays, overdueDismissKey } from '@shared/lib/overdueReminders'
import { repairNeedsUdhaarPrompt, createLinkedReceivableUdhaar } from '@shared/lib/udhaarLinking'
import { formatCurrency } from '@shared/lib/currency'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
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
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'
  const [overdueRepairs, setOverdueRepairs] = useState<RepairWithCustomer[] | null>(null)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [confirmingDeliveryFor, setConfirmingDeliveryFor] = useState<RepairWithCustomer | null>(null)
  const dismissed = useDismissedBannersStore((state) => state.dismissed)
  const dismiss = useDismissedBannersStore((state) => state.dismiss)

  useEffect(() => {
    window.api.dashboard.getOverdueDeliveries().then(setOverdueRepairs)
  }, [])

  const removeFromList = (repairId: string) => {
    setOverdueRepairs((current) => current?.filter((repair) => repair.id !== repairId) ?? current)
  }

  const handleMarkDelivered = async (repair: RepairWithCustomer, trackAsUdhaar: boolean) => {
    const previousStatus = repair.status
    const updated = await window.api.repairs.update(repair.id, { status: 'delivered' })
    if (!updated) return
    onRepairChanged(updated)
    removeFromList(repair.id)
    logActivity({
      actionType: 'status_change',
      entityType: 'repair',
      entityId: updated.id,
      description: `Status changed from ${repairStatusLabel[previousStatus].en} to ${repairStatusLabel.delivered.en} (via overdue delivery reminder)`,
      metadata: { fromStatus: previousStatus, toStatus: 'delivered', viaOverdueReminder: true }
    })
    if (trackAsUdhaar) await createLinkedReceivableUdhaar(updated)
  }

  const handleMarkDeliveredClick = (repair: RepairWithCustomer) => {
    if (repairNeedsUdhaarPrompt(repair)) {
      setConfirmingDeliveryFor(repair)
    } else {
      void handleMarkDelivered(repair, false)
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
                <Button variant="primary" size="sm" onClick={() => handleMarkDeliveredClick(repair)}>
                  <BilingualText text={dictionary.repairs.markDelivered} size="xs" align="center" />
                </Button>
                <Button variant="secondary" size="sm" onClick={() => toggleExtend(repair)}>
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
                onConfirm={(newDate) => handleApplyExtension(repair, newDate)}
              />
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmingDeliveryFor !== null}
        title={dictionary.udhaar.trackBalancePromptTitle}
        body={dictionary.udhaar.trackBalancePromptBody}
        confirmLabel={dictionary.udhaar.trackAsUdhaar}
        cancelLabel={dictionary.udhaar.skipTracking}
        onConfirm={() => {
          const repair = confirmingDeliveryFor
          setConfirmingDeliveryFor(null)
          if (repair) void handleMarkDelivered(repair, true)
        }}
        onCancel={() => {
          const repair = confirmingDeliveryFor
          setConfirmingDeliveryFor(null)
          if (repair) void handleMarkDelivered(repair, false)
        }}
      >
        {confirmingDeliveryFor && (
          <div className="rounded-md bg-surface-raised p-md">
            <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
            <p className="mt-0.5 text-lg font-medium text-ink">
              {formatCurrency(confirmingDeliveryFor.remainingBalance, currency)}
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
