import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Button } from './Button'
import { ActionMenu } from './ActionMenu'
import { BilingualText } from './BilingualText'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { cancelRepairWithLog } from '@shared/lib/cancelRepair'
import { repairStatusLabel, isRepairStatusLocked, type RepairStatus } from '@shared/lib/repairStatus'
import { DeliverOnCreditModal } from '@features/repairs/DeliverOnCreditModal'
import type { Repair } from '../../../../main/db/repositories/repairRepository'
import type { DeliverOnCreditResult } from '../../../../main/db/services/deliveryService'

export interface RepairStatusActionsProps {
  repair: Repair
  onChanged: (updated: Repair) => void
  /** Smaller buttons for inline use in list rows (Dashboard, Repairs List) — the Detail Page uses the full size. */
  compact?: boolean
  /** List rows wrap this in their own onClick-to-navigate handler — stops that click from firing when a status button is pressed. */
  stopRowClick?: boolean
  /**
   * Whether Cancel Order appears in this component's "more actions" menu.
   * Defaults true (Dashboard rows, Repairs list, POS). RepairDetailPage passes
   * false because it renders Cancel Order as its own prominent, first-class
   * button rather than burying it in a menu.
   */
  showCancel?: boolean
}

/**
 * The single place that decides which status actions are valid for a given
 * repair and performs the change — reused by RepairDetailPage, RepairsPage,
 * and DashboardPage so all three always agree on what's actually allowed,
 * and on how the actions are visually presented. Renders nothing once the
 * repair is delivered/cancelled — matches RepairRepository.update()'s
 * repository-layer lock, but is purely a UI convenience: the real
 * enforcement lives there, not here.
 *
 * Visual hierarchy: the single forward-progress action (Mark Completed /
 * Mark Delivered) is always the one solid, always-visible button. Cancel
 * Order — destructive and final — never sits next to it; it's always tucked
 * behind the "more actions" menu. In compact/row contexts (list rows), Revert
 * to Pending joins Cancel Order in that same menu, so a row only ever shows
 * one primary button inline; on the full Detail Page there's room to show
 * Revert as its own lighter, secondary button next to the primary one.
 *
 * Delivery is now a money event, not just a status flip (Part A):
 *   • "Mark as Delivered" (primary) = customer pays the full remaining balance
 *     now — records a `full` Payment for the balance AND marks delivered in one
 *     atomic call (deliverWithFullPayment). If nothing is owed, it just delivers.
 *   • "Deliver on Credit" (secondary) opens DeliverOnCreditModal to split the
 *     balance into a paid portion + a linked receivable Udhaar.
 * Both replace the old "flip status, then optionally track udhaar" prompt, so
 * money can never leave the shop unrecorded at the delivery moment.
 */
export function RepairStatusActions({ repair, onChanged, compact = false, stopRowClick = false, showCancel = true }: RepairStatusActionsProps) {
  const textSize = compact ? 'xs' : 'sm'
  const buttonSize = compact ? 'sm' : 'md'
  const [creditModalOpen, setCreditModalOpen] = useState(false)
  // Prevents a rapid double-click from firing a redundant status/delivery IPC
  // call and logging a duplicate (and stale-worded) activity entry. The backend
  // is already idempotent for the money (serialized writes + status lock), but
  // this keeps the activity log and UI honest. The `busy` ref-like guard also
  // covers clicks fired before React re-renders with the new disabled state.
  const [busy, setBusy] = useState(false)

  const runGuarded = async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (newStatus: RepairStatus) => () =>
    runGuarded(async () => {
      const previousStatus = repair.status
      const updated = await window.api.repairs.update(repair.id, { status: newStatus })
      if (updated) {
        onChanged(updated)
        logActivity({
          actionType: 'status_change',
          entityType: 'repair',
          entityId: updated.id,
          description: `Status changed from ${repairStatusLabel[previousStatus].en} to ${repairStatusLabel[newStatus].en}`,
          metadata: { fromStatus: previousStatus, toStatus: newStatus }
        })
      }
    })

  const handleMarkDelivered = () =>
    runGuarded(async () => {
      const previousStatus = repair.status
      const result = await window.api.repairs.deliverWithFullPayment(repair.id)
      onChanged(result.repair)
      logActivity({
        actionType: 'status_change',
        entityType: 'repair',
        entityId: result.repair.id,
        description: `Status changed from ${repairStatusLabel[previousStatus].en} to ${repairStatusLabel.delivered.en}${result.payment ? ` — paid in full (${result.payment.amount.toFixed(2)})` : ''}`,
        metadata: { fromStatus: previousStatus, toStatus: 'delivered', paymentId: result.payment?.id ?? null }
      })
    })

  const handleCreditDelivered = (result: DeliverOnCreditResult) => {
    setCreditModalOpen(false)
    onChanged(result.repair)
    logActivity({
      actionType: 'status_change',
      entityType: 'repair',
      entityId: result.repair.id,
      description: `Delivered on credit${result.payment ? ` — paid ${result.payment.amount.toFixed(2)}` : ''}${result.udhaar ? `, ${result.udhaar.totalAmount.toFixed(2)} on udhaar` : ''}`,
      metadata: { toStatus: 'delivered', paymentId: result.payment?.id ?? null, udhaarId: result.udhaar?.id ?? null }
    })
  }

  const handleMarkDeliveredClick = (event: MouseEvent) => {
    if (stopRowClick) event.stopPropagation()
    void handleMarkDelivered()
  }

  const handleCreditClick = (event: MouseEvent) => {
    if (stopRowClick) event.stopPropagation()
    setCreditModalOpen(true)
  }

  const handleClick = (action: () => Promise<void>) => (event: MouseEvent) => {
    if (stopRowClick) event.stopPropagation()
    void action()
  }

  if (isRepairStatusLocked(repair.status)) return null

  // Cancel goes through the shared cancelRepairWithLog helper (repairs:cancel →
  // cancelRepair), NOT a plain status flip, so the revenue/profit reversal and
  // its precise audit-trail entry happen identically on every surface.
  const handleCancel = () =>
    runGuarded(async () => {
      const { repair: updated } = await cancelRepairWithLog(repair.id)
      onChanged(updated)
    })

  const cancelItem = {
    label: dictionary.repairs.cancelOrder,
    danger: true,
    onClick: () => void handleCancel()
  }

  if (repair.status === 'pending') {
    const menuItems = showCancel ? [cancelItem] : []
    return (
      <div className="flex items-center gap-xs">
        <Button variant="primary" size={buttonSize} disabled={busy} onClick={handleClick(changeStatus('completed'))}>
          <BilingualText text={dictionary.repairs.markCompleted} size={textSize} align="center" />
        </Button>
        {menuItems.length > 0 && <ActionMenu items={menuItems} stopRowClick={stopRowClick} />}
      </div>
    )
  }

  // repair.status === 'completed'
  const revertItem = {
    label: dictionary.repairs.revertToPending,
    onClick: () => void changeStatus('pending')()
  }

  // Deliver on Credit only makes sense while money is still owed.
  const creditItem =
    repair.remainingBalance > 0
      ? { label: dictionary.repairs.deliverOnCredit, onClick: () => setCreditModalOpen(true) }
      : null

  return (
    <div className="flex items-center gap-xs">
      <Button variant="primary" size={buttonSize} disabled={busy} onClick={handleMarkDeliveredClick}>
        <BilingualText text={dictionary.repairs.markDelivered} size={textSize} align="center" />
      </Button>
      {compact ? (
        <ActionMenu
          items={[...(creditItem ? [creditItem] : []), revertItem, ...(showCancel ? [cancelItem] : [])]}
          stopRowClick={stopRowClick}
        />
      ) : (
        <>
          {creditItem && (
            <Button variant="secondary" size={buttonSize} disabled={busy} onClick={handleCreditClick}>
              <BilingualText text={dictionary.repairs.deliverOnCredit} size={textSize} align="center" />
            </Button>
          )}
          <Button variant="secondary" size={buttonSize} disabled={busy} onClick={handleClick(changeStatus('pending'))}>
            <BilingualText text={dictionary.repairs.revertToPending} size={textSize} align="center" />
          </Button>
          {showCancel && <ActionMenu items={[cancelItem]} stopRowClick={stopRowClick} />}
        </>
      )}

      <DeliverOnCreditModal
        open={creditModalOpen}
        remaining={repair.remainingBalance}
        onClose={() => setCreditModalOpen(false)}
        onConfirm={async ({ udhaarAmount, dueDate }) => {
          const result = await window.api.repairs.deliverOnCredit({ repairId: repair.id, udhaarAmount, dueDate })
          handleCreditDelivered(result)
        }}
      />
    </div>
  )
}
