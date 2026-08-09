import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { ExtendDateControl } from '@shared/components/ExtendDateControl'
import { StatusBadge } from '@shared/components/StatusBadge'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { addDays, daysOverdue, daysOverdueLabel, diffDays, overdueDismissKey } from '@shared/lib/overdueReminders'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { useDismissedBannersStore } from '@shared/hooks/useDismissedBannersStore'
import { DeliverOnCreditModal } from '@features/repairs/DeliverOnCreditModal'
import type { Repair, RepairWithCustomer } from '../../../../main/db/repositories/repairRepository'
import type { DeliverOnCreditResult } from '../../../../main/db/services/deliveryService'

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
  const [creditFor, setCreditFor] = useState<RepairWithCustomer | null>(null)
  const dismissed = useDismissedBannersStore((state) => state.dismissed)
  const dismiss = useDismissedBannersStore((state) => state.dismiss)

  useEffect(() => {
    window.api.dashboard.getOverdueDeliveries().then(setOverdueRepairs)
  }, [])

  const removeFromList = (repairId: string) => {
    setOverdueRepairs((current) => current?.filter((repair) => repair.id !== repairId) ?? current)
  }

  // Part A: full-payment delivery (records the balance as paid + delivers).
  const handleMarkDelivered = async (repair: RepairWithCustomer) => {
    const result = await window.api.repairs.deliverWithFullPayment(repair.id)
    onRepairChanged(result.repair)
    removeFromList(repair.id)
    logActivity({
      actionType: 'status_change',
      entityType: 'repair',
      entityId: result.repair.id,
      description: `Delivered (paid in full${result.payment ? ` ${result.payment.amount.toFixed(2)}` : ''}) via overdue delivery reminder`,
      metadata: { toStatus: 'delivered', paymentId: result.payment?.id ?? null, viaOverdueReminder: true }
    })
  }

  const handleCreditDelivered = (repair: RepairWithCustomer, result: DeliverOnCreditResult) => {
    setCreditFor(null)
    onRepairChanged(result.repair)
    removeFromList(repair.id)
    logActivity({
      actionType: 'status_change',
      entityType: 'repair',
      entityId: result.repair.id,
      description: `Delivered on credit via overdue reminder${result.payment ? ` — paid ${result.payment.amount.toFixed(2)}` : ''}${result.udhaar ? `, ${result.udhaar.totalAmount.toFixed(2)} on udhaar` : ''}`,
      metadata: { toStatus: 'delivered', paymentId: result.payment?.id ?? null, udhaarId: result.udhaar?.id ?? null, viaOverdueReminder: true }
    })
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
                <Button variant="primary" size="sm" onClick={() => void handleMarkDelivered(repair)}>
                  <BilingualText text={dictionary.repairs.markDelivered} size="xs" align="center" />
                </Button>
                {repair.remainingBalance > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setCreditFor(repair)}>
                    <BilingualText text={dictionary.repairs.deliverOnCredit} size="xs" align="center" />
                  </Button>
                )}
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

      <DeliverOnCreditModal
        open={creditFor !== null}
        remaining={creditFor?.remainingBalance ?? 0}
        onClose={() => setCreditFor(null)}
        onConfirm={async ({ udhaarAmount, dueDate }) => {
          if (!creditFor) return
          const result = await window.api.repairs.deliverOnCredit({ repairId: creditFor.id, udhaarAmount, dueDate })
          handleCreditDelivered(creditFor, result)
        }}
      />
    </div>
  )
}
