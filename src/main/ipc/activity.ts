import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import {
  ActivityLogRepository,
  type ActivityLogFilters,
  type ActivityLogRow,
  type ActivityPageFilters,
  type ActivityPageResult,
  type NewActivityLogInput
} from '../db/repositories/activityLogRepository'

export type ActivityLogEvent = NewActivityLogInput

/**
 * Local-only event log. Phase 2 emits auth.login/auth.logout here; Phase 5
 * added repair create/update/status-change/delete events. The Dashboard's
 * Recent Activity feed (Phase 6) is the first reader; the Phase 13 Activity
 * Timeline module will read this same table too, no rework needed.
 */
export function registerActivityIpc(): void {
  ipcMain.handle('activity:log', (_event, entry: ActivityLogEvent): void => {
    new ActivityLogRepository(getDatabase()).create(entry)
  })

  ipcMain.handle(
    'activity:list',
    (_event, filters?: ActivityLogFilters): ActivityLogRow[] => new ActivityLogRepository(getDatabase()).findAll(filters)
  )

  ipcMain.handle(
    'activity:findPage',
    (_event, filters: ActivityPageFilters): ActivityPageResult =>
      new ActivityLogRepository(getDatabase()).findPage(filters)
  )
}
