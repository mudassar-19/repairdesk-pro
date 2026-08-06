import { useNavigate } from 'react-router-dom'
import { formatRelativeTime } from '@shared/lib/relativeTime'
import { getActivityIcon, resolveActivityLink } from '@shared/lib/activityTypes'
import type { ActivityLogRow } from '../../../../main/db/repositories/activityLogRepository'

export interface ActivityFeedItemProps {
  entry: ActivityLogRow
}

/**
 * Single activity row — shared by the Dashboard's Recent Activity panel and
 * the full Activity Timeline screen (Phase 13) so the two never drift. Only
 * customer/repair entries resolve to a navigable link (see
 * resolveActivityLink); everything else renders as a plain, non-clickable row.
 */
export function ActivityFeedItem({ entry }: ActivityFeedItemProps) {
  const navigate = useNavigate()
  const Icon = getActivityIcon(entry.entityType)
  const link = resolveActivityLink(entry.entityType, entry.entityId)

  return (
    <div
      onClick={link ? () => navigate(link) : undefined}
      className={`flex items-start gap-sm px-lg py-md ${
        link ? 'cursor-pointer transition-colors hover:bg-surface-raised' : ''
      }`}
    >
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon width={16} height={16} />
      </span>
      <div className="flex-1">
        <p className="text-sm text-ink">{entry.description}</p>
        <p className="text-xs text-ink-muted">{formatRelativeTime(entry.performedAt)}</p>
      </div>
    </div>
  )
}
