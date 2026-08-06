import { logActivity } from './activityLog'
import type { Repair } from '../../../../main/db/repositories/repairRepository'

/**
 * Whether "Mark as Delivered" should pause to ask about Udhaar tracking —
 * only when real money is still owed. Shared by every place that can
 * trigger a delivery (RepairStatusActions, OverdueDeliveryBanner) so the
 * threshold can never drift between them.
 */
export function repairNeedsUdhaarPrompt(repair: Pick<Repair, 'remainingBalance'>): boolean {
  return repair.remainingBalance > 0
}

/**
 * Creates the linked receivable Udhaar entry for a just-delivered repair's
 * unpaid balance. Looks up the customer fresh via IPC rather than requiring
 * the caller to already have it joined — RepairStatusActions is used both
 * where the repair is already joined with customer info (Dashboard,
 * RepairsPage) and where it isn't (RepairDetailPage's plain Repair), so this
 * keeps the helper usable from either without the caller needing to care.
 */
export async function createLinkedReceivableUdhaar(repair: Repair): Promise<void> {
  const customer = await window.api.customers.getById(repair.customerId)

  const created = await window.api.udhaar.create({
    personName: customer?.name ?? 'Unknown Customer',
    personPhone: customer?.phone ?? null,
    customerId: repair.customerId,
    direction: 'receivable',
    totalAmount: repair.remainingBalance,
    repairId: repair.id,
    notes: null
  })

  logActivity({
    actionType: 'create',
    entityType: 'udhaar',
    entityId: created.id,
    description: `Udhaar (receivable) of ${created.totalAmount.toFixed(2)} auto-tracked from delivered repair for ${created.personName}`,
    metadata: { direction: 'receivable', totalAmount: created.totalAmount, repairId: repair.id }
  })
}
