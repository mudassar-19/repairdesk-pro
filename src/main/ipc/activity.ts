import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import { ActivityLogRepository, type NewActivityLogInput } from '../db/repositories/activityLogRepository'

export type ActivityLogEvent = NewActivityLogInput

/**
 * Local-only event log. Phase 2 emits auth.login/auth.logout here; the
 * Phase 13 Activity Timeline module reads this same table rather than
 * requiring a rework of how events get recorded.
 */
export function registerActivityIpc(): void {
  ipcMain.handle('activity:log', (_event, entry: ActivityLogEvent): void => {
    new ActivityLogRepository(getDatabase()).create(entry)
  })
}
