import type { ActivityLogEvent } from '../../../../main/ipc/activity'

/**
 * Fire-and-forget wrapper around window.api.logActivity. Every call site
 * must swallow logging failures rather than let them affect the real
 * operation they're describing — see the Phase 2 login bug where an
 * unguarded activity-log call threw and stranded the user mid-flow.
 */
export function logActivity(event: ActivityLogEvent): void {
  window.api.logActivity(event).catch(() => {})
}
