import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Button } from './Button'
import { ActionMenu } from './ActionMenu'
import { BilingualText } from './BilingualText'
import { ConfirmDialog } from './ConfirmDialog'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { repairStatusLabel, isRepairStatusLocked, type RepairStatus } from '@shared/lib/repairStatus'
import { repairNeedsUdhaarPrompt, createLinkedReceivableUdhaar } from '@shared/lib/udhaarLinking'
import { formatCurrency } from '@shared/lib/currency'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import type { Repair } from '../../../../main/db/repositories/repairRepository'

export interface RepairStatusActionsProps {
  repair: Repair
  onChanged: (updated: Repair) => void
  /** Smaller buttons for inline use in list rows (Dashboard, Repairs List) — the Detail Page uses the full size. */
  compact?: boolean
  /** List rows wrap this in their own onClick-to-navigate handler — stops that click from firing when a status button is pressed. */
  stopRowClick?: boolean
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
 * Marking a repair delivered while it still has an unpaid remainingBalance
 * pauses for one extra question — track the unpaid amount as Udhaar? — via
 * repairNeedsUdhaarPrompt/createLinkedReceivableUdhaar (shared with
 * OverdueDeliveryBanner's own "Mark as Delivered" so the two never drift).
 * Declining never blocks the delivery itself; Udhaar tracking is strictly
 * additive bookkeeping on top of it.
 */
export function RepairStatusActions({ repair, onChanged, compact = false, stopRowClick = false }: RepairStatusActionsProps) {
  const textSize = compact ? 'xs' : 'sm'
  const buttonSize = compact ? 'sm' : 'md'
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'
  const [confirmingDelivery, setConfirmingDelivery] = useState(false)

  const changeStatus = (newStatus: RepairStatus) => async () => {
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
  }

  const deliver = async (trackAsUdhaar: boolean) => {
    await changeStatus('delivered')()
    if (trackAsUdhaar) await createLinkedReceivableUdhaar(repair)
  }

  const handleMarkDeliveredClick = (event: MouseEvent) => {
    if (stopRowClick) event.stopPropagation()
    if (repairNeedsUdhaarPrompt(repair)) {
      setConfirmingDelivery(true)
    } else {
      void deliver(false)
    }
  }

  const handleClick = (action: () => Promise<void>) => (event: MouseEvent) => {
    if (stopRowClick) event.stopPropagation()
    void action()
  }

  if (isRepairStatusLocked(repair.status)) return null

  const cancelItem = {
    label: dictionary.repairs.cancelOrder,
    danger: true,
    onClick: () => void changeStatus('cancelled')()
  }

  if (repair.status === 'pending') {
    return (
      <div className="flex items-center gap-xs">
        <Button variant="primary" size={buttonSize} onClick={handleClick(changeStatus('completed'))}>
          <BilingualText text={dictionary.repairs.markCompleted} size={textSize} align="center" />
        </Button>
        <ActionMenu items={[cancelItem]} stopRowClick={stopRowClick} />
      </div>
    )
  }

  // repair.status === 'completed'
  const revertItem = {
    label: dictionary.repairs.revertToPending,
    onClick: () => void changeStatus('pending')()
  }

  return (
    <div className="flex items-center gap-xs">
      <Button variant="primary" size={buttonSize} onClick={handleMarkDeliveredClick}>
        <BilingualText text={dictionary.repairs.markDelivered} size={textSize} align="center" />
      </Button>
      {compact ? (
        <ActionMenu items={[revertItem, cancelItem]} stopRowClick={stopRowClick} />
      ) : (
        <>
          <Button variant="secondary" size={buttonSize} onClick={handleClick(changeStatus('pending'))}>
            <BilingualText text={dictionary.repairs.revertToPending} size={textSize} align="center" />
          </Button>
          <ActionMenu items={[cancelItem]} stopRowClick={stopRowClick} />
        </>
      )}

      <ConfirmDialog
        open={confirmingDelivery}
        title={dictionary.udhaar.trackBalancePromptTitle}
        body={dictionary.udhaar.trackBalancePromptBody}
        confirmLabel={dictionary.udhaar.trackAsUdhaar}
        cancelLabel={dictionary.udhaar.skipTracking}
        onConfirm={() => {
          setConfirmingDelivery(false)
          void deliver(true)
        }}
        onCancel={() => {
          setConfirmingDelivery(false)
          void deliver(false)
        }}
      >
        <div className="rounded-md bg-surface-raised p-md">
          <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
          <p className="mt-0.5 text-lg font-medium text-ink">{formatCurrency(repair.remainingBalance, currency)}</p>
        </div>
      </ConfirmDialog>
    </div>
  )
}
