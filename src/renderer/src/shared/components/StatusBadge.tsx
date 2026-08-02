import { repairStatusBadgeClass, repairStatusLabel, type RepairStatus } from '@shared/lib/repairStatus'

/** Compact single-line pill — matches the Dashboard's connection-status pill precedent (Phase 1), not bilingual by design. */
export function StatusBadge({ status }: { status: RepairStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${repairStatusBadgeClass[status]}`}>
      {repairStatusLabel[status].en}
    </span>
  )
}
