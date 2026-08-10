import { logActivity } from './activityLog'
import type { CancelRepairResult } from '../../../../main/db/services/repairService'

/**
 * The one renderer-side entry point for cancelling a repair, shared by
 * RepairStatusActions (Dashboard rows, Repairs list, POS deliver) and
 * RepairDetailPage — so every surface cancels through the exact same backend
 * call (repairs:cancel -> cancelRepair) and writes the exact same audit-trail
 * entry, naming the precise amount reversed from revenue (point 10). Keeping
 * this in one place is what stops the "action wired differently on each screen"
 * class of inconsistency from creeping back in.
 */
export async function cancelRepairWithLog(repairId: string): Promise<CancelRepairResult> {
  const result = await window.api.repairs.cancel(repairId)
  const { repair, reversedAmount } = result
  const reversalNote = reversedAmount > 0 ? ` — Rs. ${reversedAmount.toFixed(2)} reversed from revenue` : ''
  logActivity({
    actionType: 'status_change',
    entityType: 'repair',
    entityId: repair.id,
    description: `Repair cancelled${reversalNote}`,
    metadata: { toStatus: 'cancelled', reversedAmount }
  })
  return result
}
